import type {
  AdvancedPrediction,
  BetTier,
  ConsensusResult,
  PremiumBetAssessment,
  PremiumBetFactor,
  PremiumFilterResult,
  QualityGrade,
} from "@/types";
import { calculatePredictionGrade } from "@/engine/confidenceEngine";
import { clamp, weightedAverage } from "@/utils/math";

/**
 * Premium Bet Engine PRO.
 *
 * Kombiniert Edge, Confidence, Consensus, Simulationsqualität, Historical
 * Accuracy (falls verfügbar), Market-Datenqualität, Closing-Line-
 * Ausrichtung, Expected Value und Bookmaker Edge zu einem
 * zusammengesetzten 0–100-"Bettability"-Score. Zusammen mit den harten
 * Premium-Filter-Prüfungen (Lineup/Pitcher/Wetter bestätigt, positive
 * EV/Kelly, kein Doubleheader, Regen < 60 %) ergibt sich daraus eine von
 * sechs Stufen:
 *
 *   No Bet → Lean → Good Bet → Strong Bet → Premium Bet → Elite Bet
 *
 * Die beiden höchsten Stufen (Premium Bet, Elite Bet) sind zusätzlich an
 * das Bestehen des Premium-Filters gekoppelt — ein hoher Score allein
 * reicht nicht, wenn z. B. das Lineup noch nicht final bestätigt ist.
 * Das ist bewusst so gebaut, damit die höchsten Empfehlungsstufen niemals
 * rein rechnerisch, ohne operative Bestätigung, vergeben werden.
 */

/** Score-Schwellen für die sechs Bet-Tiers (kumulierter Bettability-Score). */
const TIER_SCORE_THRESHOLDS = {
  eliteBet: 88,
  premiumBet: 76,
  strongBet: 64,
  goodBet: 50,
  lean: 36,
};

/** Mindest-Confidence, die für "Elite Bet" zusätzlich zum Score erforderlich ist. */
const ELITE_BET_MIN_CONFIDENCE = 0.85;

/**
 * Bewertet die Ausrichtung der projizierten Closing Line zum Modell-Pick.
 * Bewegt sich die erwartete Closing Line (aus der Prediction Engine PRO,
 * Paket 2) weiter in Richtung des Picks, ist das ein positives Signal
 * (der Markt dürfte sich in Richtung des Modells bewegen); bewegt sie
 * sich dagegen, ist das ein Warnsignal.
 */
function computeClosingLineAlignmentScore(pick: ConsensusResult["pick"], currentLine: number | null, expectedClosingLine: number | null): number {
  if (pick === null || currentLine === null || expectedClosingLine === null) return 50;

  const projectedMovement = expectedClosingLine - currentLine;
  if (Math.abs(projectedMovement) < 0.05) return 55; // kaum projizierte Bewegung — leicht neutral-positiv

  const aligned = pick === "over" ? projectedMovement > 0 : projectedMovement < 0;
  const magnitude = clamp(Math.abs(projectedMovement) / 1, 0, 1); // volle Wirkung ab 1 Run projizierter Bewegung

  return aligned ? clamp(55 + magnitude * 45, 0, 100) : clamp(55 - magnitude * 55, 0, 100);
}

/** Leitet aus dem Bettability-Score + Premium-Filter das finale `BetTier` ab. */
function deriveTier(score: number, pick: ConsensusResult["pick"], confidence: number, premiumFilterPassed: boolean): BetTier {
  if (pick === null) return "No Bet";

  if (score >= TIER_SCORE_THRESHOLDS.eliteBet && premiumFilterPassed && confidence >= ELITE_BET_MIN_CONFIDENCE) {
    return "Elite Bet";
  }
  if (score >= TIER_SCORE_THRESHOLDS.premiumBet && premiumFilterPassed) {
    return "Premium Bet";
  }
  if (score >= TIER_SCORE_THRESHOLDS.strongBet) {
    return "Strong Bet";
  }
  if (score >= TIER_SCORE_THRESHOLDS.goodBet) {
    return "Good Bet";
  }
  if (score >= TIER_SCORE_THRESHOLDS.lean) {
    return "Lean";
  }
  return "No Bet";
}

/**
 * Berechnet die vollständige Premium-Bet-Bewertung.
 */
export function assessPremiumBet(params: {
  consensus: ConsensusResult;
  advancedPrediction: AdvancedPrediction;
  premiumFilter: PremiumFilterResult;
  currentLine: number | null;
}): PremiumBetAssessment {
  const { consensus, advancedPrediction, premiumFilter, currentLine } = params;

  const simulationQualityFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "simulation");
  const marketDataQualityFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "marketDataQuality");
  const historicalAccuracyFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "historicalAccuracy");

  const edgeScore = advancedPrediction.expectedEdge === null ? null : clamp(50 + advancedPrediction.expectedEdge * 3, 0, 100);
  const confidenceScore = advancedPrediction.confidence * 100;
  const consensusScore = (consensus.stars / 5) * 100;
  const simulationScore = simulationQualityFactor?.score ?? null;
  const marketDataQualityScore = marketDataQualityFactor?.score ?? null;
  const closingLineAlignmentScore = computeClosingLineAlignmentScore(consensus.pick, currentLine, advancedPrediction.expectedClosingLine);
  const expectedValueScore = advancedPrediction.valueEdge === null ? null : clamp(50 + advancedPrediction.valueEdge * 4, 0, 100);
  const bookmakerEdgeScore = advancedPrediction.bookmakerEdge === null ? null : clamp(100 - advancedPrediction.bookmakerEdge * 15, 0, 100);
  const historicalAccuracyScore = historicalAccuracyFactor?.score ?? null;

  const factors: PremiumBetFactor[] = [
    { key: "edge", label: "Expected Edge", score: edgeScore, weight: 0.15, note: "Modell- vs. implizite Buchmacher-Wahrscheinlichkeit." },
    { key: "confidence", label: "Confidence", score: confidenceScore, weight: 0.18, note: "Finale Confidence Engine PRO." },
    { key: "consensus", label: "Consensus", score: consensusScore, weight: 0.1, note: "Sterne-Bewertung des Modul-Konsens." },
    { key: "simulation", label: "Simulation", score: simulationScore, weight: 0.12, note: "Monte-Carlo-PRO-Stabilität & Poisson-Übereinstimmung." },
    { key: "market", label: "Market", score: marketDataQualityScore, weight: 0.07, note: "Vollständigkeit der Marktdaten." },
    { key: "closingLine", label: "Closing Line", score: closingLineAlignmentScore, weight: 0.08, note: "Ausrichtung der projizierten Closing Line zum Pick." },
    { key: "expectedValue", label: "Expected Value", score: expectedValueScore, weight: 0.13, note: "Erwarteter Wert der gewählten Seite." },
    { key: "bookmakerEdge", label: "Bookmaker Edge", score: bookmakerEdgeScore, weight: 0.07, note: "Buchmacher-Marge (Vig) — niedriger ist besser." },
  ];

  if (historicalAccuracyScore !== null) {
    factors.push({
      key: "historicalAccuracy",
      label: "Historical Accuracy",
      score: historicalAccuracyScore,
      weight: 0.1,
      note: "Trefferquote vergleichbarer historischer Backtests.",
    });
  }

  const score = clamp(
    Math.round(weightedAverage(factors.map((f) => ({ value: f.score, weight: f.weight }))) ?? 0),
    0,
    100
  );

  const tier = deriveTier(score, consensus.pick, advancedPrediction.confidence, premiumFilter.allPassed);
  const grade: QualityGrade = calculatePredictionGrade(advancedPrediction.confidence);

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (consensus.pick === null) {
    warnings.push("Kein eindeutiger Pick — keine Wette empfohlen.");
  } else {
    factors
      .filter((f) => f.score !== null && f.score >= 75)
      .forEach((f) => reasons.push(`${f.label} stark (${Math.round(f.score as number)}/100).`));

    factors
      .filter((f) => f.score !== null && f.score <= 35)
      .forEach((f) => warnings.push(`${f.label} schwach (${Math.round(f.score as number)}/100).`));

    if ((tier === "Elite Bet" || tier === "Premium Bet") && !premiumFilter.allPassed) {
      warnings.push("Hoher Score, aber Premium-Filter nicht bestanden — Einstufung entsprechend begrenzt.");
    }

    if (!premiumFilter.checks.lineupsConfirmed) {
      warnings.push("Lineup nicht final bestätigt.");
    }

    if (!premiumFilter.checks.pitcherConfirmed) {
      warnings.push("Pitcher nicht final bestätigt.");
    }

    if (!premiumFilter.checks.weatherConfirmed) {
      warnings.push("Wetterprognose nicht final bestätigt.");
    }

    if (!premiumFilter.checks.rainBelow60) {
      warnings.push("Regenwahrscheinlichkeit ≥ 60 % — erhöhtes Ausfallrisiko.");
    }

    if (score >= TIER_SCORE_THRESHOLDS.eliteBet && advancedPrediction.confidence < ELITE_BET_MIN_CONFIDENCE) {
      warnings.push(`Score erreicht Elite-Niveau, Confidence (${Math.round(advancedPrediction.confidence * 100)}%) liegt aber unter der Mindestschwelle von ${Math.round(ELITE_BET_MIN_CONFIDENCE * 100)}%.`);
    }
  }

  return { tier, grade, score, factors, reasons, warnings };
}
