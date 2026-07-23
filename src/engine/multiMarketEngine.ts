import type {
  ConsensusResult,
  MarketCandidate,
  MoneylineAnalysis,
  MultiMarketAnalysis,
  PoissonResult,
  QualityGrade,
  RunLineAnalysis,
} from "@/types";
import { computeBankrollResult } from "@/utils/kelly";

/**
 * Version 7.1 — Multi-Market Analyzer: vergleicht Over/Under, Run Line
 * und Moneyline auf einheitlicher Basis und wählt den besten
 * statistischen Mehrwert (Expected Value), NICHT nur die höchste
 * Wahrscheinlichkeit.
 *
 * WICHTIG: Berechnet nichts neu. Nimmt ausschließlich die bereits an
 * anderer Stelle vollständig berechneten Ergebnisse entgegen
 * (`ConsensusResult`/O/U-Bankroll aus dem bestehenden Over/Under-Modell,
 * `RunLineAnalysis` aus `@/engine/runLineEngine`, `MoneylineAnalysis`
 * aus `@/engine/moneylineEngine`) und bildet daraus ein einheitliches
 * Ranking.
 */

const TARGET_ODDS = 2.0;
/** Ab welcher relativen Value-%-Differenz zum besten Kandidaten ein anderer Kandidat noch als "ähnlich gut" gilt (Prozentpunkte Value). */
const SIMILAR_VALUE_MARGIN_PP = 3;

/** Wandelt eine Modell-Note (A+ bis D) in einen 0–100-Punktwert um — für den einheitlichen Premium Score über alle Märkte hinweg. */
function gradeToScore(grade: QualityGrade): number {
  const map: Record<QualityGrade, number> = { "A+": 97, A: 90, "A-": 85, "B+": 78, B: 70, C: 55, D: 35 };
  return map[grade] ?? 50;
}

/**
 * Baut aus Confidence, Value % und Datenqualitäts-Note einen
 * einheitlichen 0–100-Premium-Score — dieselbe Gewichtung, mit der
 * bereits an anderer Stelle (`assessQuality()`) Confidence und
 * Datenqualität kombiniert werden, hier nur um die Value-Komponente
 * ergänzt, damit Märkte mit unterschiedlichen Quotenniveaus fair
 * vergleichbar sind.
 */
function computePremiumScore(confidence: number, valuePct: number | null, dataQualityGrade: QualityGrade): number {
  const confidenceScore = confidence * 100;
  const valueScore = valuePct !== null ? Math.max(0, Math.min(100, 50 + valuePct * 2.5)) : 50;
  const qualityScore = gradeToScore(dataQualityGrade);
  return Math.round(confidenceScore * 0.4 + valueScore * 0.4 + qualityScore * 0.2);
}

function buildCandidate(params: {
  market: MarketCandidate["market"];
  label: string;
  probability: number;
  fairOdds: number;
  marketOdds: number | null;
  valuePct: number | null;
  bankrollAmount: number;
  confidence: number;
  stars: number;
  dataQualityGrade: QualityGrade;
  reasoning: string[];
}): MarketCandidate {
  // WICHTIG (Bugfix): Expected Value/Kelly werden hier INDIVIDUELL aus
  // der Wahrscheinlichkeit UND Quote DIESES Kandidaten berechnet
  // (`computeBankrollResult()`, dieselbe bestehende Funktion wie in
  // jedem Einzelmodus) — nicht aus einem einzigen, für die jeweils
  // intern gewählte Empfehlung berechneten `BankrollResult` übernommen.
  // Andernfalls hätten alle Run-Line-Linien und beide Moneyline-Seiten
  // identische, falsche EV-/Kelly-Werte gezeigt.
  const bankroll = computeBankrollResult(params.probability, params.marketOdds ?? params.fairOdds, params.bankrollAmount);

  return {
    market: params.market,
    label: params.label,
    probability: params.probability,
    fairOdds: params.fairOdds,
    marketOdds: params.marketOdds,
    valuePct: params.valuePct,
    expectedValue: bankroll.expectedValue,
    kellyStake: bankroll.kellyStake,
    confidence: params.confidence,
    stars: params.stars,
    premiumScore: computePremiumScore(params.confidence, params.valuePct, params.dataQualityGrade),
    distanceToTargetOdds: Math.abs((params.marketOdds ?? params.fairOdds) - TARGET_ODDS),
    reasoning: params.reasoning,
  };
}

/**
 * Wählt den Best-Value-Kandidaten (Schritt "Best Value Ranking"):
 * primär nach Expected Value sortiert — die Zielquote ≈2.00 wirkt nur
 * als Tiebreaker unter Kandidaten mit ähnlichem Value (Marge:
 * `SIMILAR_VALUE_MARGIN_PP`), verdrängt aber nie einen klar besseren
 * Value-Pick.
 */
export function selectBestValueCandidate(candidates: MarketCandidate[]): MarketCandidate {
  const withValue = candidates.filter((c) => c.valuePct !== null);
  const pool = withValue.length > 0 ? withValue : candidates;
  const sorted = [...pool].sort((a, b) => (b.valuePct ?? b.expectedValue * 100) - (a.valuePct ?? a.expectedValue * 100));
  const best = sorted[0];

  const bestValue = best.valuePct ?? best.expectedValue * 100;
  const similar = sorted.filter((c) => bestValue - (c.valuePct ?? c.expectedValue * 100) <= SIMILAR_VALUE_MARGIN_PP);
  if (similar.length <= 1) return best;

  return similar.reduce((closest, c) => (Math.abs(c.fairOdds - TARGET_ODDS) < Math.abs(closest.fairOdds - TARGET_ODDS) ? c : closest), similar[0]);
}

/**
 * Baut die vollständige marktübergreifende Analyse. Alle Eingaben sind
 * bereits vollständig berechnete, bestehende Ergebnisse — diese
 * Funktion vergleicht und rankt nur.
 */
export function computeMultiMarketAnalysis(params: {
  consensus: ConsensusResult;
  poisson: PoissonResult;
  bankrollAmount: number;
  ouLine: number;
  ouMarketOdds: { over: number | null; under: number | null };
  ouDataQualityGrade: QualityGrade;
  runLine: RunLineAnalysis;
  runLineDataQualityGrade: QualityGrade;
  moneyline: MoneylineAnalysis;
  moneylineDataQualityGrade: QualityGrade;
}): MultiMarketAnalysis {
  const candidates: MarketCandidate[] = [];

  // Over/Under: nutzt die bereits bestehende Consensus-Berechnung unverändert; EV/Kelly werden wie bei allen anderen Kandidaten individuell berechnet.
  if (params.consensus.pick !== null) {
    const marketOdds = params.consensus.pick === "over" ? params.ouMarketOdds.over : params.ouMarketOdds.under;
    const probability = params.consensus.pick === "over" ? params.poisson.overProbability : params.poisson.underProbability;
    const valuePct = marketOdds !== null ? (probability * marketOdds - 1) * 100 : null;
    candidates.push(
      buildCandidate({
        market: "overUnder",
        label: `${params.consensus.pick === "over" ? "Over" : "Under"} ${params.ouLine}`,
        probability,
        fairOdds: probability > 0 ? Math.round((1 / probability) * 100) / 100 : 0,
        marketOdds,
        valuePct,
        bankrollAmount: params.bankrollAmount,
        confidence: params.consensus.confidence,
        stars: params.consensus.stars,
        dataQualityGrade: params.ouDataQualityGrade,
        reasoning: [`${params.consensus.pick === "over" ? "Over" : "Under"}-Empfehlung aus dem bestehenden Over/Under-Modell (Konsens-Score ${params.consensus.finalScore.toFixed(1)}).`],
      })
    );
  }

  // Run Line: alle berechneten Linien als eigene Kandidaten (nicht nur die intern gewählte Empfehlung),
  // damit der Multi-Market-Vergleich die volle Bandbreite sieht.
  for (const outcome of params.runLine.outcomes) {
    const favoriteTeamLabel = outcome.favoriteTeam === "home" ? "Home" : "Away";
    const underdogTeamLabel = outcome.favoriteTeam === "home" ? "Away" : "Home";
    const favoriteMarketOdds = outcome.line === params.runLine.recommendation.line && params.runLine.recommendation.side === "favorite" ? params.runLine.recommendation.marketOdds : null;
    const underdogMarketOdds = outcome.line === params.runLine.recommendation.line && params.runLine.recommendation.side === "underdog" ? params.runLine.recommendation.marketOdds : null;

    candidates.push(
      buildCandidate({
        market: "runLine",
        label: `${favoriteTeamLabel} −${outcome.line}`,
        probability: outcome.favoriteCoverProbability,
        fairOdds: outcome.favoriteFairOdds,
        marketOdds: favoriteMarketOdds,
        valuePct: favoriteMarketOdds !== null ? (outcome.favoriteCoverProbability * favoriteMarketOdds - 1) * 100 : null,
        bankrollAmount: params.bankrollAmount,
        confidence: params.runLine.recommendation.confidence,
        stars: params.runLine.recommendation.stars,
        dataQualityGrade: params.runLineDataQualityGrade,
        reasoning: [`${favoriteTeamLabel} als Favorit auf −${outcome.line} (${(outcome.favoriteCoverProbability * 100).toFixed(1)} %).`],
      }),
      buildCandidate({
        market: "runLine",
        label: `${underdogTeamLabel} +${outcome.line}`,
        probability: outcome.underdogCoverProbability,
        fairOdds: outcome.underdogFairOdds,
        marketOdds: underdogMarketOdds,
        valuePct: underdogMarketOdds !== null ? (outcome.underdogCoverProbability * underdogMarketOdds - 1) * 100 : null,
        bankrollAmount: params.bankrollAmount,
        confidence: params.runLine.recommendation.confidence,
        stars: params.runLine.recommendation.stars,
        dataQualityGrade: params.runLineDataQualityGrade,
        reasoning: [`${underdogTeamLabel} als Underdog auf +${outcome.line} (${(outcome.underdogCoverProbability * 100).toFixed(1)} %).`],
      })
    );
  }

  // Moneyline: beide Seiten als Kandidaten.
  for (const outcome of params.moneyline.outcomes) {
    candidates.push(
      buildCandidate({
        market: "moneyline",
        label: `${outcome.team === "home" ? "Home" : "Away"} ML`,
        probability: outcome.winProbability,
        fairOdds: outcome.fairOdds,
        marketOdds: outcome.marketOdds,
        valuePct: outcome.valuePct,
        bankrollAmount: params.bankrollAmount,
        confidence: params.moneyline.recommendation.confidence,
        stars: params.moneyline.recommendation.stars,
        dataQualityGrade: params.moneylineDataQualityGrade,
        reasoning: [`${outcome.team === "home" ? "Heimteam" : "Auswärtsteam"} zum Sieg (${(outcome.winProbability * 100).toFixed(1)} %).`],
      })
    );
  }

  const bestValue = selectBestValueCandidate(candidates);
  const alternatives = [...candidates]
    .filter((c) => c !== bestValue)
    .sort((a, b) => (b.valuePct ?? b.expectedValue * 100) - (a.valuePct ?? a.expectedValue * 100))
    .slice(0, 4);

  return { candidates, bestValue, alternatives };
}
