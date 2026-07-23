import type { AnalyzerState, RunLineAnalysis, RunLineOutcome, RunLineRecommendation } from "@/types";
import { assessBullpenQuality, assessOffenseQuality, assessPitcherQuality } from "@/utils/scoring";
import { poissonPmf } from "@/utils/poisson";
import { clamp, toNumber } from "@/utils/math";
import { formatSigned } from "@/utils/format";

/**
 * Version 7.0 — Run Line (Asian Handicap) Analyzer, Prediction Engine.
 *
 * WICHTIG: Repliziert KEINE bestehende Berechnung. Nutzt ausschließlich
 * bereits bestehende, unveränderte Bausteine:
 *
 *  - `AdvancedPrediction.expectedRunsHome`/`.expectedRunsAway`
 *    (`@/engine/predictionEngine`, Prediction Engine PRO — bereits
 *    bestehend seit der ursprünglichen Entwicklung) liefert bereits
 *    einen validierten Heim-/Auswärts-Split des Gesamt-Run-Totals
 *    (aus Pitcher-/Bullpen-/Offense-Rohsignalen, auf `finalExpectedRuns`
 *    skaliert). Die Run-Line-Engine berechnet diesen Split NICHT
 *    erneut, sondern übernimmt ihn direkt als Eingabe.
 *  - `assessPitcherQuality()`/`assessBullpenQuality()`/
 *    `assessOffenseQuality()` (`@/utils/scoring`, unverändert) für die
 *    Explainable-AI-Begründung (Team-vs-Team-Vergleich).
 *  - `poissonPmf()` (`@/utils/poisson`, unverändert, hier nur
 *    exportiert) — dieselbe, bereits validierte
 *    Poisson-Verteilungsberechnung, jetzt für Heim und Auswärts
 *    getrennt statt nur für die Gesamtsumme.
 */

/** Standard-MLB-Run-Lines (immer .5, kein Push möglich) sowie eine alternative Linie für sehr klare Favoriten. */
const STANDARD_RUN_LINES = [1.5, 2.5, 3.5];

/** Zielquote-Präferenz (siehe Aufgabenstellung "Zielquote"). */
const TARGET_ODDS = 2.0;
const TARGET_ODDS_MIN = 1.9;
const TARGET_ODDS_MAX = 2.2;
/** Ab welcher Wahrscheinlichkeits-Differenz zum besten Kandidaten eine Run Line noch als "ähnlich gut" gilt. */
const SIMILAR_PROBABILITY_MARGIN_PCT = 5;

/** P(sideRuns − otherRuns > line) über das gemeinsame Poisson-Gitter (Faltung zweier unabhängiger PMFs). */
function computeCoverProbability(homePmf: number[], awayPmf: number[], line: number, side: "home" | "away"): number {
  const cap = homePmf.length - 1;
  let probability = 0;
  for (let h = 0; h <= cap; h++) {
    for (let a = 0; a <= cap; a++) {
      const diff = side === "home" ? h - a : a - h;
      if (diff > line) probability += homePmf[h] * awayPmf[a];
    }
  }
  return probability;
}

function fairOddsFromProbability(probability: number): number {
  const safe = clamp(probability, 0.01, 0.99);
  return Math.round((1 / safe) * 100) / 100;
}

interface RunLineCandidate {
  line: number;
  side: "favorite" | "underdog";
  team: "home" | "away";
  probability: number;
  fairOdds: number;
  marketOdds: number | null;
}

/**
 * Wählt aus allen Kandidaten die Empfehlung (Schritt "Zielquote"):
 * Grundlage ist IMMER die Wahrscheinlichkeit. Erst unter mehreren
 * statistisch ähnlich guten Kandidaten (Marge: `SIMILAR_PROBABILITY_MARGIN_PCT`
 * Prozentpunkte) wird zusätzlich die Nähe zur Zielquote ≈2.00
 * berücksichtigt — eine Run Line mit deutlich höherer Wahrscheinlichkeit
 * gewinnt immer, unabhängig von ihrer Quote.
 */
function selectRecommendation(candidates: RunLineCandidate[]): RunLineCandidate {
  const viable = candidates.filter((c) => c.probability > 0.5);
  const pool = viable.length > 0 ? viable : candidates;
  const sorted = [...pool].sort((a, b) => b.probability - a.probability);
  const best = sorted[0];

  const similar = sorted.filter((c) => (best.probability - c.probability) * 100 <= SIMILAR_PROBABILITY_MARGIN_PCT);
  if (similar.length <= 1) return best;

  return similar.reduce((closest, c) => (Math.abs(c.fairOdds - TARGET_ODDS) < Math.abs(closest.fairOdds - TARGET_ODDS) ? c : closest), similar[0]);
}

function buildReasoning(candidate: RunLineCandidate, bestOverall: RunLineCandidate, splitEstimated: boolean): string[] {
  const reasons: string[] = [
    `${candidate.team === "home" ? "Heimteam" : "Auswärtsteam"} als ${candidate.side === "favorite" ? "Favorit (−" : "Underdog (+"}${candidate.line}) mit ${(candidate.probability * 100).toFixed(1)} % berechneter Erfolgswahrscheinlichkeit.`,
  ];

  if (candidate.line !== bestOverall.line || candidate.side !== bestOverall.side) {
    reasons.push(
      `Statistisch ähnlich gut wie −/+${bestOverall.line} (${(bestOverall.probability * 100).toFixed(1)} %), aber mit einer Quote näher am Zielbereich (1.90–2.20) gewählt.`
    );
  } else {
    reasons.push("Klar höchste Erfolgswahrscheinlichkeit unter allen geprüften Run Lines — unabhängig von der Quote gewählt.");
  }

  const withinTarget = candidate.fairOdds >= TARGET_ODDS_MIN && candidate.fairOdds <= TARGET_ODDS_MAX;
  reasons.push(
    withinTarget
      ? `Faire Quote ${candidate.fairOdds.toFixed(2)} liegt im Zielbereich (1.90–2.20).`
      : `Faire Quote ${candidate.fairOdds.toFixed(2)} liegt außerhalb des Zielbereichs — beibehalten, da der statistische Vorteil dies rechtfertigt.`
  );

  if (splitEstimated) {
    reasons.push("Heim-/Auswärts-Aufteilung mangels ausreichender Pitcher-/Offense-Daten symmetrisch angenommen (kein erfundener Vorteil).");
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Explainable AI (Version 7.0): Team-vs-Team-Gründe für den Favoriten
// ---------------------------------------------------------------------------

/** Ab welcher Score-Differenz (0–100-Skala) ein Vorteil als nennenswert gilt. */
const QUALITY_ADVANTAGE_THRESHOLD = 8;
/** Ab welcher Differenz in erwarteten Runs (letzte 10 Spiele) ein Form-Unterschied als nennenswert gilt. */
const FORM_ADVANTAGE_THRESHOLD = 0.7;

/**
 * Vergleicht Favorit und Underdog über Pitcher-/Bullpen-/Offense-
 * Qualität (bereits bestehende `assessPitcherQuality()`/
 * `assessBullpenQuality()`/`assessOffenseQuality()`, unverändert
 * wiederverwendet — dieselben Funktionen, die auch die
 * Over/Under-Module PRO nutzen), Heimvorteil und jüngste Form. Erzeugt
 * ausschließlich Aussagen aus real vorhandenen Datenvergleichen — keine
 * erfundene Begründung.
 */
function buildExplainableReasons(state: AnalyzerState, favoriteTeam: "home" | "away"): string[] {
  const reasons: string[] = [];
  const favoriteLabel = favoriteTeam === "home" ? "Favorit (Heim)" : "Favorit (Auswärts)";

  const favoritePitcher = favoriteTeam === "home" ? state.home.pitcher : state.away.pitcher;
  const underdogPitcher = favoriteTeam === "home" ? state.away.pitcher : state.home.pitcher;
  const favoriteOffenseInput = favoriteTeam === "home" ? state.home.offense : state.away.offense;
  const underdogOffenseInput = favoriteTeam === "home" ? state.away.offense : state.home.offense;

  const favoritePitcherQuality = assessPitcherQuality(favoritePitcher, underdogOffenseInput);
  const underdogPitcherQuality = assessPitcherQuality(underdogPitcher, favoriteOffenseInput);
  if (favoritePitcherQuality.hasData && underdogPitcherQuality.hasData) {
    const diff = favoritePitcherQuality.score - underdogPitcherQuality.score;
    if (diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`+ Starting-Pitcher-Vorteil ${favoriteLabel} (${favoritePitcherQuality.score.toFixed(0)} vs. ${underdogPitcherQuality.score.toFixed(0)}).`);
    else if (-diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`− Starting-Pitcher-Nachteil ${favoriteLabel} (${favoritePitcherQuality.score.toFixed(0)} vs. ${underdogPitcherQuality.score.toFixed(0)}).`);
  }

  const favoriteBullpenInput = favoriteTeam === "home" ? state.home.bullpen : state.away.bullpen;
  const underdogBullpenInput = favoriteTeam === "home" ? state.away.bullpen : state.home.bullpen;
  const favoriteBullpenQuality = assessBullpenQuality(favoriteBullpenInput);
  const underdogBullpenQuality = assessBullpenQuality(underdogBullpenInput);
  if (favoriteBullpenQuality.hasData && underdogBullpenQuality.hasData) {
    const diff = favoriteBullpenQuality.score - underdogBullpenQuality.score;
    if (diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`+ Bullpen-Vorteil ${favoriteLabel} (${favoriteBullpenQuality.score.toFixed(0)} vs. ${underdogBullpenQuality.score.toFixed(0)}).`);
    else if (-diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`− Bullpen-Nachteil ${favoriteLabel} (${favoriteBullpenQuality.score.toFixed(0)} vs. ${underdogBullpenQuality.score.toFixed(0)}).`);
  }

  const favoriteOffenseQuality = assessOffenseQuality(favoriteOffenseInput);
  const underdogOffenseQuality = assessOffenseQuality(underdogOffenseInput);
  if (favoriteOffenseQuality.hasData && underdogOffenseQuality.hasData) {
    const diff = favoriteOffenseQuality.score - underdogOffenseQuality.score;
    if (diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`+ Offensiv-Vorteil ${favoriteLabel} (${favoriteOffenseQuality.score.toFixed(0)} vs. ${underdogOffenseQuality.score.toFixed(0)}).`);
    else if (-diff >= QUALITY_ADVANTAGE_THRESHOLD) reasons.push(`− Offensiv-Nachteil ${favoriteLabel} (${favoriteOffenseQuality.score.toFixed(0)} vs. ${underdogOffenseQuality.score.toFixed(0)}).`);
  }

  // Heimvorteil: real belegter, ligaweiter Sabermetrik-Fakt (MLB-Heimteams
  // gewinnen historisch ca. 53–54 % ihrer Spiele) — kein erfundener Bonus,
  // nur als Kontext-Hinweis, wenn der Favorit zugleich Heimteam ist.
  if (favoriteTeam === "home") {
    reasons.push("+ Heimvorteil unterstützt den Favoriten zusätzlich (MLB-Heimteams gewinnen historisch ca. 53–54 % ihrer Spiele).");
  } else {
    reasons.push("− Favorit spielt auswärts — kein zusätzlicher Heimvorteil.");
  }

  // Jüngste Form (letzte 10 Spiele, sofern hinterlegt).
  const favoriteForm = favoriteTeam === "home" ? state.home.form : state.away.form;
  const underdogForm = favoriteTeam === "home" ? state.away.form : state.home.form;
  const favoriteFormValues = favoriteForm.last10.map((v) => toNumber(v)).filter((v): v is number => v !== null);
  const underdogFormValues = underdogForm.last10.map((v) => toNumber(v)).filter((v): v is number => v !== null);
  if (favoriteFormValues.length >= 5 && underdogFormValues.length >= 5) {
    const favoriteFormAvg = favoriteFormValues.reduce((s: number, v: number) => s + v, 0) / favoriteFormValues.length;
    const underdogFormAvg = underdogFormValues.reduce((s: number, v: number) => s + v, 0) / underdogFormValues.length;
    const diff = favoriteFormAvg - underdogFormAvg;
    if (diff >= FORM_ADVANTAGE_THRESHOLD) reasons.push(`+ Bessere jüngste Form ${favoriteLabel} (Ø ${favoriteFormAvg.toFixed(1)} vs. ${underdogFormAvg.toFixed(1)} Runs/Spiel, letzte 10).`);
    else if (-diff >= FORM_ADVANTAGE_THRESHOLD) reasons.push(`− Schlechtere jüngste Form ${favoriteLabel} (Ø ${favoriteFormAvg.toFixed(1)} vs. ${underdogFormAvg.toFixed(1)} Runs/Spiel, letzte 10).`);
  }

  if (reasons.length === 0) {
    reasons.push("Kein Modul zeigt einen klar dominanten Team-Vorteil — die Empfehlung beruht auf einer knappen Gesamtabwägung.");
  }

  return reasons;
}

/**
 * Baut die vollständige Run-Line-Analyse auf. `finalExpectedRuns` ist
 * das bereits an anderer Stelle berechnete, validierte Gesamt-Run-Total
 * (`FullAnalysis.finalExpectedRuns`, unverändert übernommen).
 * `expectedRunsHome`/`expectedRunsAway` stammen aus der bereits
 * bestehenden `AdvancedPrediction` (Prediction Engine PRO) — werden
 * hier nur übernommen, nicht neu berechnet.
 * `confidence` ist die bereits bestehende Gesamt-Confidence
 * (`ConsensusResult.confidence`/`PredictionEngine2Result.nonLinearConfidence`),
 * wird nur übernommen, nicht neu berechnet.
 */
export function computeRunLineAnalysis(params: {
  state: AnalyzerState;
  finalExpectedRuns: number;
  confidence: number;
  /** Bereits bestehender, validierter Split aus `AdvancedPrediction.expectedRunsHome`/`.expectedRunsAway` (Prediction Engine PRO). */
  expectedRunsHome: number | null;
  expectedRunsAway: number | null;
}): RunLineAnalysis {
  // Fällt nur auf eine ehrliche, symmetrische Aufteilung zurück, wenn
  // die bereits bestehende Prediction Engine PRO ausnahmsweise keinen
  // Split liefern konnte (z. B. gänzlich fehlende Rohdaten) — kein
  // erfundenes Ungleichgewicht.
  const splitEstimated = params.expectedRunsHome === null || params.expectedRunsAway === null;
  const homeExpectedRuns = params.expectedRunsHome ?? params.finalExpectedRuns / 2;
  const awayExpectedRuns = params.expectedRunsAway ?? params.finalExpectedRuns / 2;

  const cap = Math.max(20, Math.ceil(Math.max(homeExpectedRuns, awayExpectedRuns) * 4));
  const homePmf = poissonPmf(clamp(homeExpectedRuns, 0.01, 20), cap);
  const awayPmf = poissonPmf(clamp(awayExpectedRuns, 0.01, 20), cap);

  const expectedRunDifferential = homeExpectedRuns - awayExpectedRuns;
  const favoriteTeam: "home" | "away" = expectedRunDifferential >= 0 ? "home" : "away";
  const favoritePmf = favoriteTeam === "home" ? homePmf : awayPmf;
  const underdogPmf = favoriteTeam === "home" ? awayPmf : homePmf;

  const outcomes: RunLineOutcome[] = STANDARD_RUN_LINES.map((line) => {
    const favoriteCoverProbability = computeCoverProbability(favoritePmf, underdogPmf, line, "home");
    const underdogCoverProbability = 1 - favoriteCoverProbability;
    return {
      line,
      favoriteTeam,
      favoriteCoverProbability,
      underdogCoverProbability,
      favoriteFairOdds: fairOddsFromProbability(favoriteCoverProbability),
      underdogFairOdds: fairOddsFromProbability(underdogCoverProbability),
    };
  });

  const favoriteMarketOdds = toNumber(params.state.setup.runLineFavoriteOdds);
  const underdogMarketOdds = toNumber(params.state.setup.runLineUnderdogOdds);

  const candidates: RunLineCandidate[] = outcomes.flatMap((outcome) => [
    {
      line: outcome.line,
      side: "favorite" as const,
      team: favoriteTeam,
      probability: outcome.favoriteCoverProbability,
      fairOdds: outcome.favoriteFairOdds,
      marketOdds: favoriteMarketOdds,
    },
    {
      line: outcome.line,
      side: "underdog" as const,
      team: favoriteTeam === "home" ? "away" : "home",
      probability: outcome.underdogCoverProbability,
      fairOdds: outcome.underdogFairOdds,
      marketOdds: underdogMarketOdds,
    },
  ]);

  const bestOverall = [...candidates].sort((a, b) => b.probability - a.probability)[0];
  const chosen = selectRecommendation(candidates);

  const valuePct = chosen.marketOdds !== null ? (chosen.probability * chosen.marketOdds - 1) * 100 : null;
  const distanceToTargetOdds = Math.abs((chosen.marketOdds ?? chosen.fairOdds) - TARGET_ODDS);

  const recommendation: RunLineRecommendation = {
    line: chosen.line,
    side: chosen.side,
    team: chosen.team,
    probability: chosen.probability,
    fairOdds: chosen.fairOdds,
    marketOdds: chosen.marketOdds,
    valuePct,
    confidence: params.confidence,
    distanceToTargetOdds,
    reasoning: buildReasoning(chosen, bestOverall, splitEstimated),
  };

  const explainableReasons = buildExplainableReasons(params.state, favoriteTeam);

  const notes: string[] = [
    `Heim: ${homeExpectedRuns.toFixed(2)} erwartete Runs · Auswärts: ${awayExpectedRuns.toFixed(2)} erwartete Runs (Summe skaliert auf bereits validiertes Total ${params.finalExpectedRuns.toFixed(2)}).`,
    `Erwartete Run-Differenz: ${formatSigned(expectedRunDifferential, 2)} (${favoriteTeam === "home" ? "Heimteam" : "Auswärtsteam"} favorisiert).`,
    splitEstimated ? "Heim-/Auswärts-Aufteilung mangels Daten symmetrisch angenommen." : "Heim-/Auswärts-Aufteilung aus der bestehenden Prediction Engine PRO übernommen.",
  ];

  return { homeExpectedRuns, awayExpectedRuns, expectedRunDifferential, favoriteTeam, outcomes, recommendation, splitEstimated, explainableReasons, notes };
}
