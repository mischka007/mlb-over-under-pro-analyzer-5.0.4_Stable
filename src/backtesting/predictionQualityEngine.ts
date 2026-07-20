import type {
  BacktestDatasetRecord,
  ConfidenceCalibrationPoint,
  ModelQualitySummary,
  PredictionDriftDirection,
  PredictionQualityReport,
  QualityGrade,
  RollingMetricPoint,
} from "@/types";
import { clamp, mean, stdDev } from "@/utils/math";

/**
 * Version 6.0 — Paket 6: Prediction Quality Engine.
 *
 * WICHTIG: Baut bewusst auf den bereits bestehenden Tag-7-Berechnungen
 * auf (`computeModelQuality()`, `ConfidenceCalibrationPoint[]` aus
 * `computeConfidenceCalibration()`, unverändert wiederverwendet als
 * Eingaben) — implementiert NICHTS davon neu. Nur die in dieser
 * Aufgabe tatsächlich fehlenden Konzepte sind hier neu: Prediction
 * Drift, Prediction Stability, Prediction Consistency, aggregierter
 * Calibration/Confidence Error, Trust Score und Rolling-Metriken.
 */

const ROLLING_WINDOW_SIZE = 20;
const MIN_RECORDS_FOR_DRIFT = 20;
const MIN_BUCKET_SAMPLE_SIZE = 5;

/** Sortiert Backtest-Datensätze chronologisch nach `date` (aufsteigend). */
function sortChronologically(records: BacktestDatasetRecord[]): BacktestDatasetRecord[] {
  return [...records].sort((a, b) => a.date.localeCompare(b.date));
}

/** Trefferquote (0–100) über eine Teilmenge entschiedener (nicht Push) Datensätze. */
function hitRatePct(records: BacktestDatasetRecord[]): number {
  const decided = records.filter((r) => r.hit !== null);
  if (decided.length === 0) return 0;
  const wins = decided.filter((r) => r.hit === true).length;
  return (wins / decided.length) * 100;
}

// ---------------------------------------------------------------------------
// Aggregierter Confidence-/Calibration-Error (aus bereits bestehenden
// ConfidenceCalibrationPoint[] abgeleitet — keine neue Kalibrierungs-
// Berechnung, nur eine andere Aggregation derselben Daten)
// ---------------------------------------------------------------------------

/** Mittlerer absoluter Kalibrierungsfehler in Prozentpunkten (nur Buckets mit ausreichender Stichprobe). */
function computeConfidenceError(calibration: ConfidenceCalibrationPoint[]): number {
  const usable = calibration.filter((c) => c.decidedBets >= MIN_BUCKET_SAMPLE_SIZE);
  if (usable.length === 0) return 0;
  return mean(usable.map((c) => Math.abs(c.gap)));
}

/**
 * Expected Calibration Error (ECE) — Standardverfahren zur
 * Kalibrierungs-Bewertung: stichproben-gewichteter Mittelwert der
 * absoluten Kalibrierungslücke je Bucket (größere Buckets zählen
 * stärker).
 */
function computeExpectedCalibrationError(calibration: ConfidenceCalibrationPoint[]): number {
  const usable = calibration.filter((c) => c.decidedBets >= MIN_BUCKET_SAMPLE_SIZE);
  const totalBets = usable.reduce((sum, c) => sum + c.decidedBets, 0);
  if (totalBets === 0) return 0;
  return usable.reduce((sum, c) => sum + (c.decidedBets / totalBets) * Math.abs(c.gap), 0);
}

// ---------------------------------------------------------------------------
// Schritt 6: Rolling-Metriken (echtes gleitendes Fenster)
// ---------------------------------------------------------------------------

/**
 * Berechnet Rolling-Metriken über ein gleitendes Fenster der
 * chronologisch sortierten, entschiedenen Datensätze. Jeder Punkt
 * repräsentiert die letzten `ROLLING_WINDOW_SIZE` Spiele bis zu diesem
 * Zeitpunkt — eine andere, ergänzende Sicht als die bereits bestehenden
 * KUMULATIVEN Zeitreihen (`buildYieldTimeSeries()` etc., unverändert).
 */
export function computeRollingMetrics(records: BacktestDatasetRecord[]): RollingMetricPoint[] {
  const sorted = sortChronologically(records);
  const decided = sorted.filter((r) => r.hit !== null);
  if (decided.length < ROLLING_WINDOW_SIZE) return [];

  const points: RollingMetricPoint[] = [];

  for (let i = ROLLING_WINDOW_SIZE - 1; i < decided.length; i++) {
    const window = decided.slice(i - ROLLING_WINDOW_SIZE + 1, i + 1);
    const wins = window.filter((r) => r.hit === true).length;
    const rollingAccuracy = (wins / window.length) * 100;
    const rollingRoi = mean(window.map((r) => r.profitLoss)) * 100;
    const rollingYield = rollingRoi; // Flat-Stake-Konvention: Yield entspricht ROI je entschiedener Wette (konsistent mit bestehender Konvention in backtestingDashboardAnalytics.ts)
    const rollingConfidenceGap = mean(window.map((r) => Math.abs(r.confidence - (r.hit ? 1 : 0)))) * 100;
    const rollingDataCompleteness = mean(window.map((r) => (r.moduleInfluences.length / 8) * 100));

    points.push({
      index: i - ROLLING_WINDOW_SIZE + 1,
      date: window[window.length - 1].date,
      rollingAccuracy,
      rollingRoi,
      rollingYield,
      rollingConfidenceGap,
      rollingDataCompleteness,
    });
  }

  return points;
}

// ---------------------------------------------------------------------------
// Schritt 2: Prediction Drift, Stability, Consistency, Reliability
// ---------------------------------------------------------------------------

/**
 * Prediction Drift: Differenz zwischen der Trefferquote der jüngeren
 * Hälfte und der älteren Hälfte der chronologisch sortierten,
 * entschiedenen Spiele — positiv = das Modell wird aktuell besser,
 * negativ = es wird schlechter. Erfordert mindestens
 * `MIN_RECORDS_FOR_DRIFT` entschiedene Spiele, sonst `0`/"stabil"
 * (zu wenig Datenbasis für eine belastbare Aussage).
 */
function computeDrift(sortedDecided: BacktestDatasetRecord[]): { drift: number; direction: PredictionDriftDirection } {
  if (sortedDecided.length < MIN_RECORDS_FOR_DRIFT) return { drift: 0, direction: "stabil" };

  const mid = Math.floor(sortedDecided.length / 2);
  const olderHalf = sortedDecided.slice(0, mid);
  const recentHalf = sortedDecided.slice(mid);

  const drift = hitRatePct(recentHalf) - hitRatePct(olderHalf);
  const direction: PredictionDriftDirection = drift > 3 ? "verbessert" : drift < -3 ? "verschlechtert" : "stabil";

  return { drift, direction };
}

/** Prediction Stability: 100 minus (skalierte) Streuung der Rolling-Accuracy — je ruhiger der Verlauf, desto stabiler. */
function computeStability(rollingMetrics: RollingMetricPoint[]): number {
  if (rollingMetrics.length < 3) return 50; // zu wenig Rolling-Punkte für eine belastbare Aussage — neutral statt erfunden
  const spread = stdDev(rollingMetrics.map((p) => p.rollingAccuracy));
  return clamp(100 - spread * 2, 0, 100);
}

/** Prediction Consistency: 100 minus (skalierte) Streuung der monatlichen Trefferquote. */
function computeConsistency(sortedDecided: BacktestDatasetRecord[]): number {
  const byMonth = new Map<string, BacktestDatasetRecord[]>();
  for (const record of sortedDecided) {
    const monthKey = record.date.slice(0, 7); // YYYY-MM
    const bucket = byMonth.get(monthKey) ?? [];
    bucket.push(record);
    byMonth.set(monthKey, bucket);
  }

  const monthlyRates = [...byMonth.values()].filter((bucket) => bucket.length >= 5).map((bucket) => hitRatePct(bucket));
  if (monthlyRates.length < 2) return 50; // zu wenig Monate mit ausreichender Stichprobe — neutral statt erfunden

  const spread = stdDev(monthlyRates);
  return clamp(100 - spread * 1.5, 0, 100);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Baut den vollständigen Prediction-Quality-Report auf.
 * `modelQuality` (aus `computeModelQuality()`, Tag 7, unverändert)
 * sowie `confidenceCalibration` (aus `computeConfidenceCalibration()`,
 * Tag 7, unverändert) werden als bereits berechnete Ergebnisse
 * übergeben — diese Funktion berechnet sie NICHT neu, sondern
 * kombiniert und erweitert sie.
 */
export function buildPredictionQualityReport(params: {
  records: BacktestDatasetRecord[];
  modelQuality: ModelQualitySummary;
  confidenceCalibration: ConfidenceCalibrationPoint[];
}): PredictionQualityReport {
  const sorted = sortChronologically(params.records);
  const decided = sorted.filter((r) => r.hit !== null);

  const predictionAccuracy = hitRatePct(decided);
  const predictionError = 100 - predictionAccuracy;

  const confidenceError = computeConfidenceError(params.confidenceCalibration);
  const calibrationError = computeExpectedCalibrationError(params.confidenceCalibration);

  const rollingMetrics = computeRollingMetrics(params.records);
  const { drift: predictionDrift, direction: driftDirection } = computeDrift(decided);
  const predictionStability = computeStability(rollingMetrics);
  const predictionConsistency = computeConsistency(decided);

  const predictionReliability = clamp(
    predictionStability * 0.4 + predictionConsistency * 0.35 + clamp(100 - calibrationError * 4, 0, 100) * 0.25,
    0,
    100
  );

  const confidenceAccuracy = clamp(100 - confidenceError * 4, 0, 100);

  // Trust Score: gewichtete Kombination aus der bereits bestehenden
  // Gesamt-Modellqualität (Tag 7) sowie den neuen Dimensionen — reine
  // Ergänzung, keine Neuerfindung des bestehenden overallScore.
  const trustScore = clamp(
    params.modelQuality.overallScore * 0.4 +
      predictionStability * 0.2 +
      predictionConsistency * 0.2 +
      clamp(50 + predictionDrift * 2, 0, 100) * 0.2,
    0,
    100
  );

  const trustGrade: QualityGrade =
    trustScore >= 92 ? "A+" : trustScore >= 85 ? "A" : trustScore >= 78 ? "A-" : trustScore >= 70 ? "B+" : trustScore >= 62 ? "B" : trustScore >= 55 ? "C" : "D";

  const notes: string[] = [
    `Prediction Accuracy: ${predictionAccuracy.toFixed(1)} % über ${decided.length} entschiedene Spiele.`,
    `Confidence Error: ${confidenceError.toFixed(1)} pp · Calibration Error (ECE): ${calibrationError.toFixed(1)} pp.`,
    decided.length >= MIN_RECORDS_FOR_DRIFT
      ? `Prediction Drift: ${predictionDrift >= 0 ? "+" : ""}${predictionDrift.toFixed(1)} pp (${driftDirection}, jüngere vs. ältere Hälfte).`
      : `Prediction Drift: nicht berechenbar (mindestens ${MIN_RECORDS_FOR_DRIFT} entschiedene Spiele nötig, ${decided.length} vorhanden).`,
    rollingMetrics.length > 0
      ? `Rolling-Metriken über ${rollingMetrics.length} Fenster (Fenstergröße ${ROLLING_WINDOW_SIZE}) berechnet.`
      : `Rolling-Metriken nicht berechenbar (mindestens ${ROLLING_WINDOW_SIZE} entschiedene Spiele nötig, ${decided.length} vorhanden).`,
    `Trust Score: ${trustScore.toFixed(1)}/100 (${trustGrade}).`,
  ];

  return {
    modelQuality: params.modelQuality,
    predictionAccuracy,
    predictionError,
    confidenceError,
    calibrationError,
    predictionDrift,
    driftDirection,
    predictionStability,
    predictionConsistency,
    predictionReliability,
    confidenceAccuracy,
    trustScore,
    trustGrade,
    rollingMetrics,
    sampleSize: decided.length,
    notes,
  };
}
