import type {
  AdaptiveIntelligenceResult,
  AdaptiveModuleWeight,
  BacktestDatasetRecord,
  BayesianProbabilitySource,
  BayesianProbabilityUpdate,
  ConfidenceCalibrationPoint,
  LearnedSynergy,
  ModuleBacktestPerformance,
  ModuleKey,
  ModuleResult,
  MonteCarloResult,
  PoissonResult,
  PredictionEngine2Result,
} from "@/types";
import { clamp, mean, stdDev } from "@/utils/math";

/**
 * Version 6.0 — Paket 2: Adaptive Intelligence Engine.
 *
 * WICHTIG: Vollständig additiv, ersetzt nichts. Wiederverwendet:
 *  - Poisson, Monte Carlo, Prediction Engine 2.0 (Paket 1) — unverändert,
 *    nur als Eingaben für die Bayesianische Kombination (Schritt 4+7).
 *  - `ModuleBacktestPerformance` (`@/backtesting/backtestingDashboardAnalytics`,
 *    unverändert) — Datenquelle für adaptive Gewichtung (Schritt 2).
 *  - `BacktestDatasetRecord` (unverändert) — Datenquelle für gelernte
 *    Synergien (Schritt 3+6).
 *  - `ConfidenceCalibrationPoint` (`@/backtesting/modelOptimizationAnalytics`,
 *    unverändert) — Datenquelle für die Confidence-Kalibrierungskurve
 *    (Schritt 5).
 *
 * Alle historien-abhängigen Teile (Schritt 2, 3, 5, 6) sind bewusst
 * OPTIONAL: eine Live-Einzelspiel-Analyse ohne vorherigen Backtest-Lauf
 * erhält dafür neutrale Werte (Multiplikator 1, keine gelernten
 * Synergien, keine Kalibrierungs-Korrektur) statt erfundener Werte —
 * identisch zum bereits etablierten Muster in `confidenceEngine.ts`
 * und `predictionEngine2.ts`. Die Bayesianische Wahrscheinlichkeits-
 * Kombination (Schritt 4+7) ist dagegen immer aktiv, da sie
 * ausschließlich bereits live vorhandene Werte nutzt.
 */

// ---------------------------------------------------------------------------
// Schritt 4 + 7: Bayesianische Wahrscheinlichkeits-Kombination
// ---------------------------------------------------------------------------

function logit(p: number): number {
  const c = clamp(p, 0.001, 0.999);
  return Math.log(c / (1 - c));
}

function sigmoid(l: number): number {
  return 1 / (1 + Math.exp(-l));
}

/** Bounds für den symmetrischen Verstärkungs-/Dämpfungsfaktor — bewusst moderat (Schritt: "nicht aggressiver"). */
const MIN_AGREEMENT_FACTOR = 0.55;
const MAX_AGREEMENT_FACTOR = 1.25;
const AGREEMENT_SHAPING_GAMMA = 1.4;

/** Skala, auf die die Streuung der Log-Odds für die Übereinstimmungs-Bewertung normalisiert wird. */
const LOGIT_SPREAD_NORMALIZATION = 2.0;

/**
 * Kombiniert Poisson-, Monte-Carlo- und Prediction-Engine-2.0-
 * Wahrscheinlichkeit über eine log-odds-basierte (Bayesianische)
 * Fusion statt eines linearen Mittels (wie es `AdvancedPrediction.probabilityOver`
 * bereits nutzt und weiterhin unverändert nutzt). Stimmen die Quellen
 * stark überein, wird die kombinierte Wahrscheinlichkeit überproportional
 * von 50 % weggeschoben ("starke Signale verstärken", Schritt 4/7).
 * Widersprechen sich die Quellen, wird das Ergebnis überproportional
 * Richtung 50 % gedämpft ("widersprüchliche Signale reduzieren").
 * Auf [2 %, 98 %] geklemmt, damit keine unrealistische Extremaussage
 * entstehen kann (Schritt 6/7: "realistisch bleiben").
 */
export function computeBayesianProbabilityUpdate(params: {
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  predictionEngine2: PredictionEngine2Result;
}): BayesianProbabilityUpdate {
  const rawSources: { source: string; probability: number; weight: number }[] = [
    { source: "Poisson", probability: params.poisson.overProbability, weight: 1 },
    {
      source: "Monte Carlo",
      probability: params.montecarlo.overProbability,
      weight: clamp(params.montecarlo.simulationConfidence / 100, 0.1, 1),
    },
    {
      source: "Prediction Engine 2.0",
      probability: params.predictionEngine2.enhancedScore / 100,
      weight: clamp(params.predictionEngine2.nonLinearConfidence, 0.1, 1),
    },
  ];

  const weightSum = rawSources.reduce((sum, s) => sum + s.weight, 0) || 1;
  const logits = rawSources.map((s) => logit(s.probability));
  const baseLogOdds = rawSources.reduce((sum, s, i) => sum + logits[i] * s.weight, 0) / weightSum;

  const logitSpread = stdDev(logits);
  const sourceAgreement = clamp(1 - logitSpread / LOGIT_SPREAD_NORMALIZATION, 0, 1);

  const agreementFactor =
    MIN_AGREEMENT_FACTOR + (MAX_AGREEMENT_FACTOR - MIN_AGREEMENT_FACTOR) * sourceAgreement ** AGREEMENT_SHAPING_GAMMA;

  const finalLogOdds = baseLogOdds * agreementFactor;
  const bayesianOverProbability = clamp(sigmoid(finalLogOdds), 0.02, 0.98);

  const sources: BayesianProbabilitySource[] = rawSources.map((s, i) => ({ ...s, logOdds: logits[i] }));
  const linearMeanProbability = mean(rawSources.map((s) => s.probability));

  return {
    bayesianOverProbability,
    bayesianUnderProbability: 1 - bayesianOverProbability,
    sources,
    sourceAgreement,
    separationDelta: Math.abs(bayesianOverProbability - 0.5) - Math.abs(linearMeanProbability - 0.5),
  };
}

// ---------------------------------------------------------------------------
// Schritt 2: Adaptive Module Weighting
// ---------------------------------------------------------------------------

/** Mindestanzahl historischer Spiele mit Daten, unterhalb derer ein Modul nicht adaptiv angepasst wird (zu wenig Evidenz). */
const MIN_SAMPLE_SIZE_FOR_ADAPTIVE_WEIGHTING = 20;

/** Wie stark eine 1%-Abweichung der historischen Trefferquote von 50 % das Gewicht anpasst. */
const ADAPTIVE_WEIGHT_SENSITIVITY = 1.6;

const MIN_ADAPTIVE_MULTIPLIER = 0.7;
const MAX_ADAPTIVE_MULTIPLIER = 1.4;

/**
 * Passt die Modul-Gewichte anhand ihrer NACHGEWIESENEN historischen
 * Qualität an (`ModuleBacktestPerformance.hitRate`, aus echten
 * Backtest-Daten — keine feste Regel, welches Modul "gut" ist, sondern
 * ausschließlich aus der gemessenen Trefferquote abgeleitet). Module
 * mit zu wenigen historischen Spielen bleiben unverändert
 * (Multiplikator 1) statt aus einer unsicheren Stichprobe zu urteilen.
 * Liefert `[]`, wenn keine Performance-Daten vorliegen.
 */
export function computeAdaptiveModuleWeights(
  modules: ModuleResult[],
  modulePerformance: ModuleBacktestPerformance[] | undefined
): AdaptiveModuleWeight[] {
  if (!modulePerformance || modulePerformance.length === 0) return [];

  const performanceByKey = new Map(modulePerformance.map((p) => [p.moduleKey, p]));

  return modules
    .filter((m) => m.hasData)
    .map((m) => {
      const performance = performanceByKey.get(m.key);

      if (!performance || performance.gamesWithData < MIN_SAMPLE_SIZE_FOR_ADAPTIVE_WEIGHTING) {
        return {
          moduleKey: m.key,
          label: m.label,
          baseWeight: m.weight,
          adaptiveMultiplier: 1,
          adjustedWeight: m.weight,
          reason:
            performance === undefined
              ? "Keine historischen Backtest-Daten für dieses Modul verfügbar — Gewicht unverändert."
              : `Zu wenige historische Spiele (${performance.gamesWithData} < ${MIN_SAMPLE_SIZE_FOR_ADAPTIVE_WEIGHTING}) — Gewicht unverändert.`,
        };
      }

      // hitRate 0.5 = neutral (kein Anpassungsgrund), Abweichung davon
      // treibt den Multiplikator proportional zur Sensitivität.
      const hitRateDeviation = performance.hitRate - 0.5;
      const adaptiveMultiplier = clamp(
        1 + hitRateDeviation * ADAPTIVE_WEIGHT_SENSITIVITY * 2,
        MIN_ADAPTIVE_MULTIPLIER,
        MAX_ADAPTIVE_MULTIPLIER
      );

      return {
        moduleKey: m.key,
        label: m.label,
        baseWeight: m.weight,
        adaptiveMultiplier,
        adjustedWeight: clamp(m.weight * adaptiveMultiplier, 0, 1),
        reason: `Historische Trefferquote ${(performance.hitRate * 100).toFixed(1)} % über ${performance.gamesWithData} Spiele — Gewicht ${
          adaptiveMultiplier >= 1 ? "erhöht" : "reduziert"
        }.`,
      };
    });
}

// ---------------------------------------------------------------------------
// Schritt 3 + 6: Self Learning — gelernte Modul-Synergien
// ---------------------------------------------------------------------------

const MIN_SAMPLE_SIZE_FOR_LEARNED_SYNERGY = 15;
/** Eine Modul-Paar-Kombination gilt nur als gelernte Synergie, wenn ihre Trefferquote diesen Vorsprung gegenüber 50 % hat. */
const MIN_HIT_RATE_EDGE_FOR_SYNERGY = 0.1;
const MAX_LEARNED_SYNERGY_BONUS = 8;

const ALL_MODULE_KEYS: ModuleKey[] = ["form", "pitcher", "bullpen", "offense", "weather", "ballpark", "h2h", "market"];

/**
 * Analysiert historische Backtest-Datensätze und erkennt
 * Modul-PAAR-Kombinationen, die — wenn beide Module in dieselbe
 * Richtung ausschlugen — historisch überdurchschnittlich oft richtig
 * lagen. Generalisiert die in Prediction Engine 2.0 (Paket 1) fest
 * definierten zwei Referenz-Synergien zu datengetriebenen, aus der
 * tatsächlichen Historie gelernten Kombinationen — keine feste Regel,
 * welche Kombination funktioniert, sondern ausschließlich aus
 * gemessenen Trefferquoten abgeleitet. Liefert `[]` ohne historische
 * Daten oder wenn keine Kombination die Mindestschwellen erreicht.
 */
export function discoverLearnedSynergies(records: BacktestDatasetRecord[] | undefined): LearnedSynergy[] {
  if (!records || records.length === 0) return [];

  const decidedRecords = records.filter((r) => r.actualResult !== "push");
  const synergies: LearnedSynergy[] = [];

  for (let i = 0; i < ALL_MODULE_KEYS.length; i++) {
    for (let j = i + 1; j < ALL_MODULE_KEYS.length; j++) {
      const keyA = ALL_MODULE_KEYS[i];
      const keyB = ALL_MODULE_KEYS[j];

      for (const direction of ["over", "under"] as const) {
        const matchingGames = decidedRecords.filter((r) => {
          const influenceA = r.moduleInfluences.find((inf) => inf.moduleKey === keyA);
          const influenceB = r.moduleInfluences.find((inf) => inf.moduleKey === keyB);
          return influenceA?.direction === direction && influenceB?.direction === direction;
        });

        if (matchingGames.length < MIN_SAMPLE_SIZE_FOR_LEARNED_SYNERGY) continue;

        const correct = matchingGames.filter((r) => r.actualResult === direction).length;
        const hitRate = correct / matchingGames.length;
        const edge = hitRate - 0.5;

        if (edge < MIN_HIT_RATE_EDGE_FOR_SYNERGY) continue;

        const labelA = matchingGames[0].moduleInfluences.find((inf) => inf.moduleKey === keyA)?.label ?? keyA;
        const labelB = matchingGames[0].moduleInfluences.find((inf) => inf.moduleKey === keyB)?.label ?? keyB;

        // Bonus proportional zum nachgewiesenen Vorsprung über 50 %, gedeckelt.
        const bonusMagnitude = clamp(edge * 40, 0, MAX_LEARNED_SYNERGY_BONUS);

        synergies.push({
          moduleKeys: [keyA, keyB],
          direction,
          historicalHitRate: hitRate,
          sampleSize: matchingGames.length,
          bonus: direction === "over" ? bonusMagnitude : -bonusMagnitude,
          description: `${labelA} + ${labelB} gemeinsam Richtung ${direction === "over" ? "Over" : "Under"}: historisch ${(hitRate * 100).toFixed(1)} % Trefferquote über ${matchingGames.length} Spiele.`,
        });
      }
    }
  }

  return synergies.sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus));
}

// ---------------------------------------------------------------------------
// Schritt 5: Confidence Calibration
// ---------------------------------------------------------------------------

/**
 * Reshaped eine rohe Confidence anhand der historisch beobachteten
 * Kalibrierungskurve (`ConfidenceCalibrationPoint[]`, aus
 * `computeConfidenceCalibration()`, unverändert wiederverwendet): traf
 * z. B. eine historische "70 %"-Prognose tatsächlich nur in 63 % der
 * Fälle zu, wird eine zukünftige Prognose in diesem Confidence-Bereich
 * entsprechend nach unten korrigiert. Liefert die unveränderte
 * Eingabe-Confidence (`applied: false`), wenn keine Kalibrierungsdaten
 * vorliegen oder der betroffene Bucket zu wenige Spiele hat.
 */
export function applyConfidenceCalibrationCurve(
  rawConfidence: number,
  calibrationPoints: ConfidenceCalibrationPoint[] | undefined
): { calibratedConfidence: number; applied: boolean } {
  if (!calibrationPoints || calibrationPoints.length === 0) {
    return { calibratedConfidence: rawConfidence, applied: false };
  }

  const rawPct = rawConfidence * 100;
  // Wählt den Kalibrierungs-Bucket mit dem nächstgelegenen vorhergesagten Mittelwert.
  const closestPoint = [...calibrationPoints].sort((a, b) => Math.abs(a.predictedPct - rawPct) - Math.abs(b.predictedPct - rawPct))[0];

  if (!closestPoint || closestPoint.decidedBets < MIN_SAMPLE_SIZE_FOR_LEARNED_SYNERGY) {
    return { calibratedConfidence: rawConfidence, applied: false };
  }

  // Korrektur um die Hälfte der beobachteten Abweichung — vorsichtig
  // statt vollständig auf die (ggf. verrauschte) Historie zu vertrauen.
  const correctionPct = closestPoint.gap * 0.5;
  const calibratedConfidence = clamp((rawPct + correctionPct) / 100, 0, 1);

  return { calibratedConfidence, applied: true };
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export function computeAdaptiveIntelligence(params: {
  modules: ModuleResult[];
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  predictionEngine2: PredictionEngine2Result;
  modulePerformance?: ModuleBacktestPerformance[];
  historicalRecords?: BacktestDatasetRecord[];
  confidenceCalibrationPoints?: ConfidenceCalibrationPoint[];
}): AdaptiveIntelligenceResult {
  const bayesianUpdate = computeBayesianProbabilityUpdate({
    poisson: params.poisson,
    montecarlo: params.montecarlo,
    predictionEngine2: params.predictionEngine2,
  });

  const adaptiveWeights = computeAdaptiveModuleWeights(params.modules, params.modulePerformance);
  const learnedSynergies = discoverLearnedSynergies(params.historicalRecords);

  const { calibratedConfidence, applied: calibrationApplied } = applyConfidenceCalibrationCurve(
    params.predictionEngine2.nonLinearConfidence,
    params.confidenceCalibrationPoints
  );

  const notes: string[] = [
    `Bayesianische Kombination: ${(bayesianUpdate.bayesianOverProbability * 100).toFixed(1)} % Over (Quellen-Übereinstimmung: ${(bayesianUpdate.sourceAgreement * 100).toFixed(0)} %, Separation: ${bayesianUpdate.separationDelta >= 0 ? "+" : ""}${(bayesianUpdate.separationDelta * 100).toFixed(1)} pp gegenüber linearem Mittel).`,
    adaptiveWeights.length > 0
      ? `Adaptive Gewichtung: ${adaptiveWeights.filter((w) => w.adaptiveMultiplier !== 1).length} von ${adaptiveWeights.length} Modulen angepasst.`
      : "Adaptive Gewichtung: keine historischen Modul-Performance-Daten verfügbar — Basis-Gewichte unverändert.",
    learnedSynergies.length > 0
      ? `Self Learning: ${learnedSynergies.length} datengetriebene Modul-Synergie(n) mit nachgewiesenem historischem Vorsprung erkannt.`
      : "Self Learning: keine historischen Daten verfügbar oder keine Kombination erreicht die Mindestschwelle.",
    calibrationApplied
      ? "Confidence Calibration: Korrektur anhand historischer Kalibrierungskurve angewendet."
      : "Confidence Calibration: keine ausreichenden historischen Kalibrierungsdaten verfügbar — unkorrigiert.",
  ];

  return {
    bayesianUpdate,
    adaptiveWeights,
    learnedSynergies,
    calibratedConfidence,
    calibrationApplied,
    adaptiveWeightingApplied: adaptiveWeights.some((w) => w.adaptiveMultiplier !== 1),
    notes,
  };
}
