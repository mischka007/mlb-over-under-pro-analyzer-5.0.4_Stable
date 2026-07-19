import type { CalibrationResult } from "./historicalCalibration";
import type { BacktestSummary } from "./backtestTypes";
import type {
  BacktestDatasetRecord,
  ConfidenceCalibrationPoint,
  ErrorCauseCategory,
  ModelQualitySummary,
  ModuleBacktestPerformance,
  ModuleKey,
  ModuleWeightingAnalysis,
  QualityGrade,
} from "@/types";
import { clamp, mean } from "@/utils/math";

/**
 * Tag 7 — Model Optimization & Self-Learning Analytics.
 *
 * Baut auf den bereits bestehenden Backtesting-PRO-Auswertungen
 * (`backtestingDashboardAnalytics.ts`, unverändert) sowie der bereits
 * bestehenden Historical-Calibration-PRO-Engine
 * (`historicalCalibration.ts`, unverändert wiederverwendet für die
 * Gewichtungsanalyse) auf und ergänzt ausschließlich die tatsächlich
 * fehlenden Auswertungen: Confidence-Validierung (vorhergesagte
 * Confidence vs. tatsächliche Trefferquote), automatische
 * Fehlerursachen-Erkennung verlorener Predictions sowie eine
 * zusammengesetzte Modellqualitäts-Bewertung. Verändert keine
 * Modul-Gewichte — reine Analyse/Empfehlung.
 */

export interface ModelOptimizationData {
  modelQuality: ModelQualitySummary;
  confidenceCalibration: ConfidenceCalibrationPoint[];
  errorCauses: ErrorCauseCategory[];
  weightingAnalysis: ModuleWeightingAnalysis[];
  strongestModules: ModuleBacktestPerformance[];
  weakestModules: ModuleBacktestPerformance[];
  /** Ob eine Gewichtungsanalyse verfügbar ist (benötigt eine erfolgreich gelaufene Historical Calibration). */
  calibrationAvailable: boolean;
  calibrationNote: string;
}

const CONFIDENCE_CALIBRATION_BUCKETS: { label: string; min: number; max: number; predictedPct: number }[] = [
  { label: "50–60%", min: 0.5, max: 0.6, predictedPct: 55 },
  { label: "60–70%", min: 0.6, max: 0.7, predictedPct: 65 },
  { label: "70–80%", min: 0.7, max: 0.8, predictedPct: 75 },
  { label: "80–90%", min: 0.8, max: 0.9, predictedPct: 85 },
  { label: "90%+", min: 0.9, max: 1.01, predictedPct: 95 },
];

/**
 * Schritt 5 — Confidence Validation: vergleicht die vorhergesagte
 * Confidence (Bucket-Mittelwert) mit der tatsächlichen Trefferquote
 * innerhalb dieses Bereichs. Eine gute Kalibrierung zeigt eine geringe
 * Differenz (`gap`) zwischen beiden Werten in jedem Bereich.
 */
export function computeConfidenceCalibration(records: BacktestDatasetRecord[]): ConfidenceCalibrationPoint[] {
  const decided = records.filter((r) => r.hit !== null);

  return CONFIDENCE_CALIBRATION_BUCKETS.map(({ label, min, max, predictedPct }) => {
    const inBucket = decided.filter((r) => r.confidence >= min && r.confidence < max);
    const wins = inBucket.filter((r) => r.hit === true).length;
    const actualPct = inBucket.length > 0 ? (wins / inBucket.length) * 100 : 0;

    return {
      bucket: label,
      predictedPct,
      actualPct,
      gap: inBucket.length > 0 ? actualPct - predictedPct : 0,
      decidedBets: inBucket.length,
    };
  });
}

const MODULE_ERROR_LABELS: Record<ModuleKey, { over: string; under: string }> = {
  offense: { over: "Überschätzung der Offensive", under: "Unterschätzung der Offensive" },
  pitcher: { over: "Überschätzung der Pitcher", under: "Unterschätzung der Pitcher" },
  bullpen: { over: "Bullpen-Fehler (zu offensiv eingeschätzt)", under: "Bullpen-Fehler (zu defensiv eingeschätzt)" },
  weather: { over: "Wetterfehler (Run-Umfeld überschätzt)", under: "Wetterfehler (Run-Umfeld unterschätzt)" },
  ballpark: { over: "Ballpark-Fehler (Park-Faktor überschätzt)", under: "Ballpark-Fehler (Park-Faktor unterschätzt)" },
  market: { over: "Marktfehler (Linie falsch interpretiert, Richtung Over)", under: "Marktfehler (Linie falsch interpretiert, Richtung Under)" },
  form: { over: "Team-Form-Fehler (Richtung Over)", under: "Team-Form-Fehler (Richtung Under)" },
  h2h: { over: "Head-to-Head-Fehler (Richtung Over)", under: "Head-to-Head-Fehler (Richtung Under)" },
};

/**
 * Schritt 4 — Fehleranalyse: untersucht ausschließlich verlorene
 * Predictions (`hit === false`) und ermittelt je Spiel das Modul mit
 * dem stärksten falschen Ausschlag (Richtung ≠ tatsächliches Ergebnis,
 * höchster absoluter Einfluss) als primäre Fehlerursache. Zählt die
 * Häufigkeit je Kategorie über alle verlorenen Spiele.
 */
export function computeErrorCauses(records: BacktestDatasetRecord[]): ErrorCauseCategory[] {
  const lostRecords = records.filter((r) => r.hit === false);

  const counts = new Map<string, { moduleKey: ModuleKey; label: string; count: number }>();

  for (const record of lostRecords) {
    const wrongDirectionModules = record.moduleInfluences.filter(
      (m) => m.direction !== "neutral" && m.direction !== record.actualResult
    );
    if (wrongDirectionModules.length === 0) continue;

    const primaryCulprit = [...wrongDirectionModules].sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence))[0];
    const labels = MODULE_ERROR_LABELS[primaryCulprit.moduleKey];
    const label = primaryCulprit.direction === "over" ? labels.over : labels.under;
    const key = `${primaryCulprit.moduleKey}:${primaryCulprit.direction}`;

    const entry = counts.get(key) ?? { moduleKey: primaryCulprit.moduleKey, label, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }

  const totalLostWithCause = Array.from(counts.values()).reduce((sum, c) => sum + c.count, 0);

  return Array.from(counts.values())
    .map((c) => ({
      moduleKey: c.moduleKey,
      label: c.label,
      description: `${c.label} war in ${c.count} von ${lostRecords.length} verlorenen Predictions das einflussreichste falsch ausgerichtete Modul.`,
      count: c.count,
      pct: totalLostWithCause > 0 ? (c.count / totalLostWithCause) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Schritt 3 — Gewichtungsanalyse: nutzt das Ergebnis der bereits
 * bestehenden Historical-Calibration-PRO-Engine
 * (`runHistoricalCalibration`, unverändert) für "optimale Gewichtung",
 * "empfohlene Änderung" und "erwartete Verbesserung". Liefert ein
 * leeres Array, wenn keine Kalibrierung vorliegt (z. B. zu wenige
 * historische Spiele) — kein erfundener Wert.
 */
export function buildWeightingAnalysis(
  modulePerformance: ModuleBacktestPerformance[],
  calibration: CalibrationResult | null
): ModuleWeightingAnalysis[] {
  if (!calibration) return [];

  const baselineValidation = calibration.baseline.validationAccuracy;
  const calibratedValidation = calibration.calibrated.validationAccuracy;
  const expectedImprovementPct =
    baselineValidation !== null && calibratedValidation !== null ? (calibratedValidation - baselineValidation) * 100 : 0;

  return modulePerformance.map((m) => {
    const multiplier = calibration.calibrated.multipliers[m.moduleKey] ?? 1;
    const currentWeight = m.averageWeight;
    const optimalWeight = clamp(currentWeight * multiplier, 0, 1);
    const recommendedChangePct = (multiplier - 1) * 100;

    return {
      moduleKey: m.moduleKey,
      label: m.label,
      currentWeight,
      optimalWeight,
      recommendedChangePct,
      expectedImprovementPct: calibration.applied ? expectedImprovementPct : 0,
    };
  });
}

/**
 * Schritt 6 — Modellqualität: zusammengesetzte 0–100-Bewertung aus
 * tatsächlicher Genauigkeit, Confidence-Kalibrierungsgüte (geringe
 * durchschnittliche Abweichung zwischen vorhergesagter Confidence und
 * tatsächlicher Trefferquote) sowie durchschnittlicher Modul-Stabilität.
 */
export function computeModelQuality(params: {
  summary: BacktestSummary;
  confidenceCalibration: ConfidenceCalibrationPoint[];
  modulePerformance: ModuleBacktestPerformance[];
}): ModelQualitySummary {
  const accuracyScore = clamp(params.summary.hitRate * 100, 0, 100);

  const calibratedBuckets = params.confidenceCalibration.filter((c) => c.decidedBets >= 5);
  const averageAbsGap = calibratedBuckets.length > 0 ? mean(calibratedBuckets.map((c) => Math.abs(c.gap))) : 15;
  const calibrationScore = clamp(100 - averageAbsGap * 4, 0, 100);

  const modulesWithData = params.modulePerformance.filter((m) => m.gamesWithData > 0);
  const stabilityScore = modulesWithData.length > 0 ? mean(modulesWithData.map((m) => m.stability)) : 50;

  const overallScore = clamp(
    Math.round((accuracyScore * 0.45 + calibrationScore * 0.3 + stabilityScore * 0.25) * 10) / 10,
    0,
    100
  );

  const grade: QualityGrade =
    overallScore >= 92 ? "A+" : overallScore >= 85 ? "A" : overallScore >= 78 ? "A-" : overallScore >= 70 ? "B+" : overallScore >= 62 ? "B" : overallScore >= 55 ? "C" : "D";

  return { overallScore, grade, accuracyScore, calibrationScore, stabilityScore };
}

/** Schritt 6 — stärkste/schwächste Module nach ROI, mit Mindestdatenbasis. */
function getStrongestWeakestModules(modulePerformance: ModuleBacktestPerformance[]): {
  strongestModules: ModuleBacktestPerformance[];
  weakestModules: ModuleBacktestPerformance[];
} {
  const withData = modulePerformance.filter((m) => m.gamesWithData >= 10);
  const sortedByRoi = [...withData].sort((a, b) => b.roi - a.roi);

  return {
    strongestModules: sortedByRoi.slice(0, 3),
    weakestModules: sortedByRoi.slice(-3).reverse(),
  };
}

/**
 * Baut das vollständige Model-Optimization-Datenpaket (Tag 7) auf.
 * `calibration` ist optional — wird `null` übergeben (z. B. weil noch
 * keine Historical-Calibration gelaufen ist), bleibt die
 * Gewichtungsanalyse leer statt einen Wert zu erfinden.
 */
export function buildModelOptimizationData(params: {
  records: BacktestDatasetRecord[];
  modulePerformance: ModuleBacktestPerformance[];
  summary: BacktestSummary;
  calibration: CalibrationResult | null;
}): ModelOptimizationData {
  const confidenceCalibration = computeConfidenceCalibration(params.records);
  const errorCauses = computeErrorCauses(params.records);
  const modelQuality = computeModelQuality({
    summary: params.summary,
    confidenceCalibration,
    modulePerformance: params.modulePerformance,
  });
  const weightingAnalysis = buildWeightingAnalysis(params.modulePerformance, params.calibration);
  const { strongestModules, weakestModules } = getStrongestWeakestModules(params.modulePerformance);

  return {
    modelQuality,
    confidenceCalibration,
    errorCauses,
    weightingAnalysis,
    strongestModules,
    weakestModules,
    calibrationAvailable: params.calibration !== null,
    calibrationNote:
      params.calibration !== null
        ? params.calibration.applied
          ? "Kalibrierung verfügbar und übernommen (Validierungs-Trefferquote überschritt die Mindestschwelle)."
          : "Kalibrierung berechnet, aber nicht übernommen (Verbesserung unterschritt die Mindestschwelle) — optimale Gewichte entsprechen daher den aktuellen."
        : "Keine Kalibrierung verfügbar — zu wenige historische Spiele im gewählten Zeitraum (siehe Historical Calibration PRO).",
  };
}
