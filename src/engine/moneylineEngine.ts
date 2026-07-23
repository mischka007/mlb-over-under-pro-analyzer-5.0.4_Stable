import type { AnalyzerState, MoneylineAnalysis, MoneylineOutcome, MoneylineRecommendation } from "@/types";
import { buildExplainableReasons, computeCoverProbability, fairOddsFromProbability } from "@/engine/runLineEngine";
import { poissonPmf } from "@/utils/poisson";
import { clamp, toNumber } from "@/utils/math";
import { formatSigned } from "@/utils/format";
import { starsFromConfidence } from "@/utils/consensus";
import { computeBankrollResult } from "@/utils/kelly";

/**
 * Version 7.1 — Moneyline-Analyzer.
 *
 * WICHTIG: Repliziert KEINE bestehende Berechnung. Nutzt ausschließlich
 * bereits bestehende, unveränderte Bausteine:
 *
 *  - `AdvancedPrediction.expectedRunsHome`/`.expectedRunsAway`
 *    (Prediction Engine PRO, unverändert) als Eingabe.
 *  - `computeCoverProbability()`/`fairOddsFromProbability()`
 *    (`@/engine/runLineEngine`, für Version 7.0 gebaut, hier nur
 *    exportiert und wiederverwendet) — ein Sieg ist statistisch
 *    nichts anderes als "Run Line 0" (`diff > 0`), daher exakt
 *    dieselbe Poisson-Faltung wie bei Run Line, nur mit Linie 0.
 *  - `buildExplainableReasons()` (`@/engine/runLineEngine`, unverändert)
 *    für die Team-vs-Team-Begründung — identisch zur Run-Line-Logik,
 *    da dieselben Qualitätsvergleiche (Pitcher/Bullpen/Offense/Form/
 *    Heimvorteil) auch für die Moneyline gelten.
 *  - `starsFromConfidence()` (`@/utils/consensus`) und
 *    `computeBankrollResult()` (`@/utils/kelly`) — dieselben Funktionen
 *    wie bei Over/Under und Run Line.
 */
export function computeMoneylineAnalysis(params: {
  state: AnalyzerState;
  expectedRunsHome: number | null;
  expectedRunsAway: number | null;
  finalExpectedRuns: number;
}): MoneylineAnalysis {
  const splitEstimated = params.expectedRunsHome === null || params.expectedRunsAway === null;
  const homeExpectedRuns = params.expectedRunsHome ?? params.finalExpectedRuns / 2;
  const awayExpectedRuns = params.expectedRunsAway ?? params.finalExpectedRuns / 2;

  const cap = Math.max(20, Math.ceil(Math.max(homeExpectedRuns, awayExpectedRuns) * 4));
  const homePmf = poissonPmf(clamp(homeExpectedRuns, 0.01, 20), cap);
  const awayPmf = poissonPmf(clamp(awayExpectedRuns, 0.01, 20), cap);

  // Sieg = Run Line 0 ("diff > 0") — dieselbe Faltung wie bei Run Line.
  const homeWinRegulation = computeCoverProbability(homePmf, awayPmf, 0, "home");
  const awayWinRegulation = computeCoverProbability(homePmf, awayPmf, 0, "away");
  const tieProbability = clamp(1 - homeWinRegulation - awayWinRegulation, 0, 1);

  // MLB-Spiele enden nie unentschieden (Extra Innings) — unser
  // Poisson-Modell bildet Extra-Innings-Dynamik nicht ab. Die (kleine)
  // "diff=0"-Restwahrscheinlichkeit wird transparent 50/50 verteilt,
  // statt sie zu ignorieren oder zu erfinden.
  const homeWinProbability = clamp(homeWinRegulation + tieProbability / 2, 0.01, 0.99);
  const awayWinProbability = clamp(awayWinRegulation + tieProbability / 2, 0.01, 0.99);

  const homeMarketOdds = toNumber(params.state.setup.moneylineHomeOdds);
  const awayMarketOdds = toNumber(params.state.setup.moneylineAwayOdds);

  const outcomes: MoneylineOutcome[] = [
    {
      team: "home",
      winProbability: homeWinProbability,
      fairOdds: fairOddsFromProbability(homeWinProbability),
      marketOdds: homeMarketOdds,
      valuePct: homeMarketOdds !== null ? (homeWinProbability * homeMarketOdds - 1) * 100 : null,
    },
    {
      team: "away",
      winProbability: awayWinProbability,
      fairOdds: fairOddsFromProbability(awayWinProbability),
      marketOdds: awayMarketOdds,
      valuePct: awayMarketOdds !== null ? (awayWinProbability * awayMarketOdds - 1) * 100 : null,
    },
  ];

  // Empfehlung: bei vorhandenen Marktquoten die Seite mit dem besseren
  // Value wählen (Ziel: statistischer Mehrwert, nicht nur die höhere
  // Wahrscheinlichkeit); ohne Marktquoten schlicht der Favorit.
  const chosen =
    outcomes[0].valuePct !== null && outcomes[1].valuePct !== null
      ? outcomes[0].valuePct >= outcomes[1].valuePct
        ? outcomes[0]
        : outcomes[1]
      : outcomes[0].winProbability >= outcomes[1].winProbability
        ? outcomes[0]
        : outcomes[1];

  // Confidence direkt aus der eigenen Wahrscheinlichkeit abgeleitet —
  // dieselbe Herleitung wie bei Run Line (Version 7.0).
  const confidence = clamp(Math.abs(chosen.winProbability - 0.5) / 0.5 * 0.5 + 0.5, 0, 1);

  const favoriteTeam: "home" | "away" = homeWinProbability >= awayWinProbability ? "home" : "away";
  const explainableReasons = buildExplainableReasons(params.state, favoriteTeam);

  const reasoning: string[] = [
    `${chosen.team === "home" ? "Heimteam" : "Auswärtsteam"} zum Sieg mit ${(chosen.winProbability * 100).toFixed(1)} % berechneter Wahrscheinlichkeit.`,
    chosen.valuePct !== null
      ? `Value ${formatSigned(chosen.valuePct)} % bei Marktquote ${chosen.marketOdds?.toFixed(2)}.`
      : "Keine Marktquote hinterlegt — Empfehlung basiert auf der höheren Gewinnwahrscheinlichkeit.",
    splitEstimated ? "Heim-/Auswärts-Aufteilung mangels Daten symmetrisch angenommen." : "Heim-/Auswärts-Aufteilung aus der bestehenden Prediction Engine PRO übernommen.",
  ];

  const recommendation: MoneylineRecommendation = {
    team: chosen.team,
    probability: chosen.winProbability,
    fairOdds: chosen.fairOdds,
    marketOdds: chosen.marketOdds,
    valuePct: chosen.valuePct,
    confidence,
    stars: starsFromConfidence(confidence),
    reasoning,
  };

  const bankrollAmount = Math.max(0, toNumber(params.state.setup.bankroll) ?? 0);
  const bankroll = computeBankrollResult(recommendation.probability, recommendation.marketOdds ?? recommendation.fairOdds, bankrollAmount);

  const notes: string[] = [
    `Heim-Sieg: ${(homeWinProbability * 100).toFixed(1)} % · Auswärts-Sieg: ${(awayWinProbability * 100).toFixed(1)} %.`,
    `Unentschieden-Restwahrscheinlichkeit (9 Innings, Modell): ${(tieProbability * 100).toFixed(1)} % — 50/50 auf Heim/Auswärts verteilt (Extra Innings nicht modelliert).`,
  ];

  return {
    homeWinProbability,
    awayWinProbability,
    tieProbabilityRedistributed: tieProbability,
    outcomes,
    recommendation,
    bankroll,
    explainableReasons,
    notes,
  };
}
