import type {
  AdvancedPrediction,
  AnalyzerState,
  BankrollResult,
  BullpenQualityAssessment,
  ConsensusResult,
  DynamicWeightingAdjustment,
  ModuleResult,
  ModuleWeightMultipliers,
  MonteCarloResult,
  OffenseQualityAssessment,
  PitcherQualityAssessment,
  PoissonResult,
} from "@/types";
import {
  BULLPEN_HIGH_WORKLOAD_IP3_THRESHOLD,
  BULLPEN_HIGH_WORKLOAD_IP7_THRESHOLD,
} from "@/utils/scoring";
import { calculatePredictionGrade, computeConfidenceBreakdown } from "@/engine/confidenceEngine";
import { clamp, toNumber, weightedAverage } from "@/utils/math";

export interface PredictionResult {
  overProbability: number;
  underProbability: number;
  confidence: number;
}

export function calculatePrediction(
  overProbability: number
): PredictionResult {

  const underProbability = 1 - overProbability;

  const confidence = Math.max(
    overProbability,
    underProbability
  );

  return {
    overProbability,
    underProbability,
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Prediction Engine PRO: dynamische Gewichtung
// ---------------------------------------------------------------------------

/** Schwellenwert für den individuellen Pitcher Score, ab dem ein Starter als "Ass" gilt. */
const ACE_PITCHER_SCORE_THRESHOLD = 78;

/** Schwellenwert für den individuellen Pitcher Score, unterhalb dessen ein Starter als "schwach" gilt. */
const WEAK_PITCHER_SCORE_THRESHOLD = 40;

/** Schwellenwert für den individuellen Bullpen Score, ab dem ein Bullpen als "Elite" gilt. */
const ELITE_BULLPEN_SCORE_THRESHOLD = 80;

/** Windgeschwindigkeit (mph), ab der ein Wind-Effekt als spielentscheidend gilt. */
const STRONG_WIND_MPH_THRESHOLD = 10;

/** Ballpark Run Factor, ab dem ein Park als extremer Hitter-Park (Coors-Field-artig) gilt. */
const EXTREME_HITTER_PARK_RUN_FACTOR = 115;

/** Ballpark Run Factor, unterhalb dessen ein Park als Pitcher-freundlich gilt. */
const PITCHER_FRIENDLY_PARK_RUN_FACTOR = 90;

/** Linienbewegung (Runs), ab der eine Marktbewegung als "groß" gilt. */
const BIG_LINE_MOVEMENT_THRESHOLD = 0.5;

/** Ober-/Untergrenze, auf die der kumulierte dynamische Gewichtungsfaktor je Modul geklemmt wird. */
const MIN_DYNAMIC_WEIGHT_FACTOR = 0.6;
const MAX_DYNAMIC_WEIGHT_FACTOR = 1.6;

/**
 * Kontext-Signale, aus denen die dynamische Gewichtung abgeleitet wird.
 * Wird in `GameModel.ts` aus dem `AnalyzerState` sowie den bereits
 * berechneten Pitcher-/Bullpen-PRO-Qualitätsbewertungen zusammengestellt.
 */
export interface DynamicWeightingContext {
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenScore: number | null;
  awayBullpenScore: number | null;
  homeBullpenIp3: number | null;
  homeBullpenIp7: number | null;
  awayBullpenIp3: number | null;
  awayBullpenIp7: number | null;
  windDirection: "out" | "in" | "cross" | "none";
  windSpeedMph: number | null;
  ballparkRunFactor: number | null;
  marketOpeningLine: number | null;
  marketCurrentLine: number | null;
}

/**
 * Wendet szenario-basierte dynamische Gewichtungsanpassungen auf die
 * Modul-Gewichte an, BEVOR der Konsens berechnet wird. Die
 * Basis-Gewichte (inkl. der Bullpen-/Offense-PRO-Reliability-Anpassung
 * aus Paket 1) bleiben als Ausgangspunkt erhalten; hier kommen weitere,
 * multiplikative Anpassungen aus konkreten Spiel-Szenarien hinzu:
 *
 *  - Ass-vs-Ass-Duell            → Pitcher-Gewicht ↑
 *  - beide Starter schwach       → Offense-Gewicht ↑
 *  - Elite-Bullpen (ein Team)    → Bullpen-Gewicht ↑
 *  - Bullpen erschöpft (ein Team)→ Bullpen-Gewicht ↑
 *  - starker Wind hinaus/hinein  → Weather-Gewicht ↑
 *  - extremer Hitter-Park        → Ballpark-Gewicht ↑
 *  - Pitcher-freundlicher Park   → Ballpark-Gewicht ↓
 *  - große Marktbewegung         → Market-Gewicht ↑
 *
 * Der kumulierte Faktor je Modul wird auf
 * [MIN_DYNAMIC_WEIGHT_FACTOR, MAX_DYNAMIC_WEIGHT_FACTOR] geklemmt, damit
 * kein einzelnes Modul den Konsens vollständig dominieren kann. Module
 * ohne Daten (`hasData === false`) werden unverändert durchgereicht, da
 * sie ohnehin von `computeConsensus()` ausgeschlossen werden.
 */
export function applyDynamicWeighting(
  modules: ModuleResult[],
  context: DynamicWeightingContext
): { modules: ModuleResult[]; adjustments: DynamicWeightingAdjustment[] } {
  const adjustments: DynamicWeightingAdjustment[] = [];
  const factors: Partial<Record<ModuleResult["key"], number>> = {};

  const addFactor = (key: ModuleResult["key"], factor: number, reason: string) => {
    factors[key] = (factors[key] ?? 1) * factor;
    adjustments.push({ moduleKey: key, reason, factor });
  };

  // --- Ass-vs-Ass-Duell / schwache Starter ---------------------------------
  const homeAce = context.homePitcherQuality.hasData && context.homePitcherQuality.score >= ACE_PITCHER_SCORE_THRESHOLD;
  const awayAce = context.awayPitcherQuality.hasData && context.awayPitcherQuality.score >= ACE_PITCHER_SCORE_THRESHOLD;
  const homeWeak = context.homePitcherQuality.hasData && context.homePitcherQuality.score <= WEAK_PITCHER_SCORE_THRESHOLD;
  const awayWeak = context.awayPitcherQuality.hasData && context.awayPitcherQuality.score <= WEAK_PITCHER_SCORE_THRESHOLD;

  if (homeAce && awayAce) {
    addFactor("pitcher", 1.25, "Ass-vs-Ass-Duell: beide Starter mit Pitcher Score ≥ 78 — Pitcher-Einfluss auf das Ergebnis steigt.");
  }

  if (homeWeak && awayWeak) {
    addFactor("offense", 1.2, "Beide Starter unterdurchschnittlich (Pitcher Score ≤ 40) — Offense-Einfluss auf das Ergebnis steigt.");
  }

  // --- Elite-Bullpen / Bullpen-Erschöpfung ---------------------------------
  const eliteBullpen =
    (context.homeBullpenScore !== null && context.homeBullpenScore >= ELITE_BULLPEN_SCORE_THRESHOLD) ||
    (context.awayBullpenScore !== null && context.awayBullpenScore >= ELITE_BULLPEN_SCORE_THRESHOLD);

  if (eliteBullpen) {
    addFactor("bullpen", 1.15, "Elite-Bullpen (Bullpen Score ≥ 80) bei mindestens einem Team erkannt.");
  }

  const bullpenExhausted = [context.homeBullpenIp3, context.awayBullpenIp3].some(
    (ip3) => ip3 !== null && ip3 > BULLPEN_HIGH_WORKLOAD_IP3_THRESHOLD
  ) ||
    [context.homeBullpenIp7, context.awayBullpenIp7].some(
      (ip7) => ip7 !== null && ip7 > BULLPEN_HIGH_WORKLOAD_IP7_THRESHOLD
    );

  if (bullpenExhausted) {
    addFactor("bullpen", 1.15, "Bullpen-Erschöpfung bei mindestens einem Team erkannt — Bullpen-Einfluss auf den Spielverlauf steigt.");
  }

  // --- Wind ------------------------------------------------------------------
  if (
    context.windDirection === "out" &&
    context.windSpeedMph !== null &&
    context.windSpeedMph >= STRONG_WIND_MPH_THRESHOLD
  ) {
    addFactor("weather", 1.3, `Starker Wind hinauswehend (${context.windSpeedMph.toFixed(0)} mph) — Weather-Einfluss steigt.`);
  }

  if (
    context.windDirection === "in" &&
    context.windSpeedMph !== null &&
    context.windSpeedMph >= STRONG_WIND_MPH_THRESHOLD
  ) {
    addFactor("weather", 1.3, `Starker Wind hineinwehend (${context.windSpeedMph.toFixed(0)} mph) — Weather-Einfluss steigt.`);
  }

  // --- Ballpark ----------------------------------------------------------
  if (context.ballparkRunFactor !== null && context.ballparkRunFactor >= EXTREME_HITTER_PARK_RUN_FACTOR) {
    addFactor("ballpark", 1.25, `Extremer Hitter-Park erkannt (Run Factor ${context.ballparkRunFactor.toFixed(0)}) — Ballpark-Einfluss steigt.`);
  }

  if (context.ballparkRunFactor !== null && context.ballparkRunFactor < PITCHER_FRIENDLY_PARK_RUN_FACTOR) {
    addFactor("ballpark", 0.75, `Pitcher-freundlicher Park erkannt (Run Factor ${context.ballparkRunFactor.toFixed(0)}) — Ballpark-Einfluss sinkt.`);
  }

  // --- Markt ---------------------------------------------------------------
  if (
    context.marketOpeningLine !== null &&
    context.marketCurrentLine !== null &&
    Math.abs(context.marketCurrentLine - context.marketOpeningLine) >= BIG_LINE_MOVEMENT_THRESHOLD
  ) {
    addFactor(
      "market",
      1.3,
      `Große Marktbewegung erkannt (${context.marketOpeningLine.toFixed(1)} → ${context.marketCurrentLine.toFixed(1)}) — Market-Einfluss steigt.`
    );
  }

  const adjustedModules = modules.map((module) => {
    const rawFactor = factors[module.key];
    if (rawFactor === undefined || !module.hasData) {
      return module;
    }
    const clampedFactor = clamp(rawFactor, MIN_DYNAMIC_WEIGHT_FACTOR, MAX_DYNAMIC_WEIGHT_FACTOR);
    return { ...module, weight: clamp(module.weight * clampedFactor, 0, 1) };
  });

  return { modules: adjustedModules, adjustments };
}

// ---------------------------------------------------------------------------
// Historical Calibration PRO: Anwendung kalibrierter Gewichte
// ---------------------------------------------------------------------------

/**
 * Wendet Historical-Calibration-PRO-Multiplikatoren auf die Modul-
 * Gewichte an (siehe `@/backtesting/historicalCalibration`). Rein
 * multiplikativ und optional — ohne Aufruf (bzw. mit allen Werten = 1)
 * bleibt das Ergebnis identisch zum Ausgangszustand. Wird sowohl von
 * `computeFullAnalysis()` (zur optionalen Anwendung kalibrierter Gewichte
 * auf echte Prognosen) als auch von der Kalibrierung selbst (zur
 * Bewertung von Kandidaten-Multiplikatoren gegen historische Ergebnisse)
 * genutzt — eine einzige, konsistente Implementierung für beide Zwecke.
 */
export function applyCalibrationMultipliers(modules: ModuleResult[], multipliers: ModuleWeightMultipliers): ModuleResult[] {
  return modules.map((module) => ({
    ...module,
    weight: clamp(module.weight * (multipliers[module.key] ?? 1), 0, 1),
  }));
}

// ---------------------------------------------------------------------------
// Prediction Engine PRO: Confidence-Penalties
// ---------------------------------------------------------------------------

/**
 * Reduziert die Konsens-Confidence anhand operativer Risikofaktoren, die
 * NICHT bereits in den Modul-Scores selbst enthalten sind: fehlende
 * Lineup-Bestätigung und bekannte Verletzungssorgen. Undefinierte/legacy
 * Zustände (z. B. aus älteren, vor dieser Erweiterung gespeicherten
 * Sessions) werden konservativ als "kein Problem" behandelt, damit
 * bestehende gespeicherte Analysen sich nicht rückwirkend verschlechtern.
 */
export function applyConfidencePenalties(
  confidence: number,
  setup: { lineupsConfirmed: boolean; noInjuryConcerns?: boolean }
): { confidence: number; penalties: string[] } {
  const penalties: string[] = [];
  let factor = 1;

  if (!setup.lineupsConfirmed) {
    factor *= 0.9;
    penalties.push("Lineup noch nicht final bestätigt — Confidence reduziert.");
  }

  const hasInjuryConcern = setup.noInjuryConcerns === false;
  if (hasInjuryConcern) {
    factor *= 0.85;
    penalties.push("Bekannte Verletzungssorge bei einem Schlüsselspieler — Confidence reduziert.");
  }

  return { confidence: clamp(confidence * factor, 0, 1), penalties };
}

// ---------------------------------------------------------------------------
// Prediction Engine PRO: erweiterte Prognose-Metriken
// ---------------------------------------------------------------------------

/**
 * Bestimmt die "Fair Total Line": die Linie, bei der laut dem
 * Poisson-Modell Über- und Unter-Wahrscheinlichkeit exakt ausgeglichen
 * wären (kontinuierliche Interpolation über die Run-Verteilung).
 */
function computeFairTotalLine(poisson: PoissonResult): number {
  let cumulative = 0;
  for (const { runs, probability } of poisson.distribution) {
    const previousCumulative = cumulative;
    cumulative += probability;
    if (cumulative >= 0.5 && probability > 0) {
      const fraction = (0.5 - previousCumulative) / probability;
      return runs - 0.5 + clamp(fraction, 0, 1);
    }
  }
  return poisson.expectedRuns;
}

/**
 * Projiziert eine erwartete Closing Line aus der bisherigen
 * Linienbewegung (Momentum) sowie dem Sharp-Money-Anteil, sofern
 * Marktdaten vorhanden sind. Liefert `null`, wenn keine aktuelle Linie
 * bekannt ist.
 */
function computeExpectedClosingLine(market: {
  openingLine: number | null;
  currentLine: number | null;
  sharpOverPct: number | null;
}): number | null {
  if (market.currentLine === null) return null;

  let drift = 0;

  if (market.sharpOverPct !== null) {
    drift += ((market.sharpOverPct - 50) / 100) * 0.5;
  }

  if (market.openingLine !== null) {
    const momentum = market.currentLine - market.openingLine;
    drift += momentum * 0.5;
  }

  return clamp(drift + market.currentLine, market.currentLine - 1, market.currentLine + 1);
}

/**
 * Berechnet die Buchmacher-Marge (Vig) aus den Über-/Unter-Quoten, sofern
 * beide vorhanden sind.
 */
function computeBookmakerEdge(oddsOver: number | null, oddsUnder: number | null): number | null {
  if (oddsOver === null || oddsUnder === null || oddsOver <= 0 || oddsUnder <= 0) return null;
  return (1 / oddsOver + 1 / oddsUnder - 1) * 100;
}

/**
 * Berechnet die anteilige Aufteilung der modellseitig erwarteten
 * Gesamt-Runs auf Heim- und Auswärtsteam. Nutzt dafür ein separates,
 * leichtgewichtiges Rohsignal aus Pitcher-/Bullpen-/Offense-Inputs (siehe
 * `computeTeamRunSplitRatio` in `GameModel.ts`), skaliert aber immer auf
 * die bereits validierte `expectedTotal` — die Gesamt-Run-Erwartung
 * selbst bleibt dadurch unverändert (keine Regression), nur die
 * Aufteilung ist neu.
 */
function splitExpectedRuns(
  expectedTotal: number,
  homeRatio: number | null
): { home: number | null; away: number | null } {
  if (homeRatio === null) {
    // Leichter Heimvorteil als neutraler Fallback (MLB-typisch ca. 52 %).
    return { home: expectedTotal * 0.52, away: expectedTotal * 0.48 };
  }
  const ratio = clamp(homeRatio, 0.3, 0.7);
  return { home: expectedTotal * ratio, away: expectedTotal * (1 - ratio) };
}

/**
 * Berechnet die vollständige erweiterte Prognose (Prediction Engine PRO).
 * Reine additive Veredelung: verändert weder Poisson/Monte-Carlo/Bankroll/
 * Consensus noch deren Basisberechnung, sondern kombiniert deren Ausgaben
 * zu den zusätzlich angeforderten Kennzahlen. Die Confidence selbst wird
 * vollständig von der Confidence Engine PRO berechnet (siehe
 * `@/engine/confidenceEngine`).
 */
export function computeAdvancedPrediction(params: {
  modules: ModuleResult[];
  consensus: ConsensusResult;
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  bankroll: BankrollResult;
  finalExpectedRuns: number;
  homeRunRatio: number | null;
  setup: AnalyzerState["setup"];
  weather: AnalyzerState["weather"];
  market: AnalyzerState["market"];
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weightingAdjustments: DynamicWeightingAdjustment[];
  activeModuleCount: number;
  totalModuleCount: number;
  /** Trefferquote (%) vergleichbarer historischer Backtests, falls verfügbar (siehe Paket 7). */
  historicalAccuracyPct: number | null;
}): AdvancedPrediction {
  const { consensus, poisson, montecarlo, bankroll, finalExpectedRuns, homeRunRatio, setup, market, weightingAdjustments } = params;

  const { home: expectedRunsHome, away: expectedRunsAway } = splitExpectedRuns(finalExpectedRuns, homeRunRatio);

  const probabilityOver =
    weightedAverage([
      { value: poisson.overProbability, weight: 0.5 },
      { value: montecarlo.overProbability, weight: 0.5 },
    ]) ?? poisson.overProbability;

  const probabilityUnder = 1 - probabilityOver;

  const confidenceBreakdown = computeConfidenceBreakdown({
    modules: params.modules,
    consensus,
    montecarlo,
    homePitcherQuality: params.homePitcherQuality,
    awayPitcherQuality: params.awayPitcherQuality,
    homeBullpenQuality: params.homeBullpenQuality,
    awayBullpenQuality: params.awayBullpenQuality,
    homeOffenseQuality: params.homeOffenseQuality,
    awayOffenseQuality: params.awayOffenseQuality,
    weather: params.weather,
    market,
    setup,
    historicalAccuracyPct: params.historicalAccuracyPct,
  });

  const confidence = confidenceBreakdown.confidence;
  const penalties = confidenceBreakdown.penalties;
  const predictionGrade = calculatePredictionGrade(confidence);

  const oddsOver = toNumber(setup.oddsOver);
  const oddsUnder = toNumber(setup.oddsUnder);
  const bookmakerEdge = computeBookmakerEdge(oddsOver, oddsUnder);

  const expectedEdge = consensus.pick === null ? null : bankroll.valuePct;
  const valueEdge = consensus.pick === null ? null : bankroll.expectedValue * 100;

  const expectedClosingLine = computeExpectedClosingLine({
    openingLine: toNumber(market.openingLine),
    currentLine: toNumber(market.currentLine),
    sharpOverPct: toNumber(market.sharpOverPct),
  });

  const fairTotalLine = computeFairTotalLine(poisson);
  const modelTotal = Math.round(finalExpectedRuns * 2) / 2;
  const modelSpread = expectedRunsHome !== null && expectedRunsAway !== null ? expectedRunsHome - expectedRunsAway : null;

  const dataCompleteness = params.totalModuleCount > 0 ? (params.activeModuleCount / params.totalModuleCount) * 100 : 0;

  const edgeComponent = clamp(50 + (expectedEdge ?? 0) * 2, 0, 100);

  const premiumScore = clamp(
    Math.round(
      weightedAverage([
        { value: confidence * 100, weight: 0.4 },
        { value: (consensus.stars / 5) * 100, weight: 0.2 },
        { value: edgeComponent, weight: 0.2 },
        { value: dataCompleteness, weight: 0.2 },
      ]) ?? 50
    ),
    0,
    100
  );

  const mcSpreadPct = montecarlo.mean > 0 ? clamp(((montecarlo.ciHigh - montecarlo.ciLow) / montecarlo.mean) * 100, 0, 100) : 50;

  const riskScore = clamp(
    Math.round(
      weightedAverage([
        { value: 100 - confidence * 100, weight: 0.5 },
        { value: mcSpreadPct, weight: 0.3 },
        { value: 100 - dataCompleteness, weight: 0.2 },
      ]) ?? 50
    ),
    0,
    100
  );

  return {
    expectedRunsHome,
    expectedRunsAway,
    expectedTotal: finalExpectedRuns,
    probabilityOver,
    probabilityUnder,
    confidence,
    predictionGrade,
    premiumScore,
    riskScore,
    expectedEdge,
    valueEdge,
    bookmakerEdge,
    expectedClosingLine,
    fairTotalLine,
    modelTotal,
    modelSpread,
    weightingAdjustments,
    confidencePenalties: penalties,
    confidenceBreakdown,
  };
}