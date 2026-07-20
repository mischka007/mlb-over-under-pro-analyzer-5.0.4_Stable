import type { BacktestDatasetRecord, PredictionQualityReport } from "@/types";
import { isoDateStamp } from "@/utils/format";

/**
 * Backtesting PRO Phase 3: Export-Funktionen für den vollständigen
 * Backtest-Datensatz. Ergänzt die bestehende `src/utils/csv.ts` (bleibt
 * unverändert) um einen zweiten, spezialisierten CSV-Export für
 * mehrzeilige Backtest-Datensätze sowie einen JSON-Export. Folgt exakt
 * demselben Browser-Download-Muster (Blob + Object-URL) wie der
 * bestehende `exportAnalysisAsCsv()`.
 */

/** Escaped einen CSV-Feldwert (Kommas, Anführungszeichen, Zeilenumbrüche). Identische Logik wie in `csv.ts`. */
function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const CSV_COLUMNS: { header: string; get: (r: BacktestDatasetRecord) => string | number }[] = [
  { header: "Datum", get: (r) => r.date },
  { header: "Liga", get: (r) => r.league },
  { header: "Heimteam", get: (r) => r.homeTeam },
  { header: "Auswärtsteam", get: (r) => r.awayTeam },
  { header: "Wettlinie", get: (r) => r.line.toFixed(1) },
  { header: "Prediction", get: (r) => r.prediction ?? "–" },
  { header: "Over Probability %", get: (r) => (r.overProbability * 100).toFixed(1) },
  { header: "Under Probability %", get: (r) => (r.underProbability * 100).toFixed(1) },
  { header: "Expected Runs", get: (r) => r.expectedRuns.toFixed(2) },
  { header: "Expected Run Differential", get: (r) => (r.expectedRunDifferential !== null ? r.expectedRunDifferential.toFixed(2) : "–") },
  { header: "Fair Odds", get: (r) => (r.fairOdds !== null ? r.fairOdds.toFixed(2) : "–") },
  { header: "Edge %", get: (r) => (r.edge !== null ? r.edge.toFixed(2) : "–") },
  { header: "Value %", get: (r) => (r.valuePct !== null ? r.valuePct.toFixed(2) : "–") },
  { header: "Kelly %", get: (r) => r.kellyPct.toFixed(2) },
  { header: "Confidence %", get: (r) => (r.confidence * 100).toFixed(1) },
  { header: "Premium Rating", get: (r) => r.premiumRating },
  { header: "Tatsächliches Ergebnis", get: (r) => r.actualResult },
  { header: "Tatsächliche Runs", get: (r) => r.actualRuns },
  { header: "Treffer", get: (r) => (r.hit === null ? "–" : r.hit ? "Ja" : "Nein") },
  { header: "Gewinn/Verlust", get: (r) => r.profitLoss.toFixed(3) },
  { header: "Market Opening Line", get: (r) => (r.marketOpeningLine !== null ? r.marketOpeningLine.toFixed(1) : "–") },
  { header: "Market Closing Line", get: (r) => (r.marketClosingLine !== null ? r.marketClosingLine.toFixed(1) : "–") },
  { header: "Market Score", get: (r) => (r.marketScore !== null ? r.marketScore.toFixed(0) : "–") },
  { header: "Sharp Movement", get: (r) => (r.sharpMovementDetected ? "Ja" : "Nein") },
  { header: "Reverse Line Movement", get: (r) => (r.reverseLineMovementDetected ? "Ja" : "Nein") },
  { header: "Steam Move", get: (r) => (r.steamMoveDetected ? "Ja" : "Nein") },
  { header: "CLV", get: (r) => (r.clv !== null ? r.clv.toFixed(2) : "–") },
];

/**
 * Exportiert den vollständigen Backtest-Datensatz als CSV-Datei (eine
 * Zeile pro Spiel) und löst den Download im Browser aus.
 */
export function exportBacktestDatasetAsCsv(records: BacktestDatasetRecord[]): void {
  const rows: (string | number)[][] = [CSV_COLUMNS.map((c) => c.header), ...records.map((r) => CSV_COLUMNS.map((c) => c.get(r)))];

  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  triggerDownload(`\uFEFF${csvContent}`, "text/csv;charset=utf-8;", `mlb-backtest-${isoDateStamp()}.csv`);
}

/**
 * Exportiert den vollständigen Backtest-Datensatz als JSON-Datei
 * (inklusive Modul-Einflüsse je Spiel) und löst den Download im Browser
 * aus.
 */
export function exportBacktestDatasetAsJson(records: BacktestDatasetRecord[]): void {
  const jsonContent = JSON.stringify(records, null, 2);
  triggerDownload(jsonContent, "application/json;charset=utf-8;", `mlb-backtest-${isoDateStamp()}.json`);
}

/**
 * Version 6.0 (Paket 6), Schritt 9: exportiert den aggregierten
 * Prediction-Quality-Report (Trust Score, Drift, Stabilität,
 * Konsistenz, Kalibrierungsfehler, Rolling-Metriken) als CSV-Datei.
 * Eigene Funktion statt Erweiterung von `CSV_COLUMNS`, da es sich um
 * EINEN Aggregatwert über alle Spiele handelt, nicht um eine Zeile pro
 * Spiel.
 */
export function exportPredictionQualityAsCsv(quality: PredictionQualityReport): void {
  const rows: (string | number)[][] = [
    ["Kennzahl", "Wert"],
    ["Trust Score", quality.trustScore.toFixed(1)],
    ["Trust Grade", quality.trustGrade],
    ["Prediction Accuracy (%)", quality.predictionAccuracy.toFixed(1)],
    ["Prediction Error (%)", quality.predictionError.toFixed(1)],
    ["Confidence Error (pp)", quality.confidenceError.toFixed(1)],
    ["Calibration Error / ECE (pp)", quality.calibrationError.toFixed(1)],
    ["Prediction Drift (pp)", quality.predictionDrift.toFixed(1)],
    ["Drift-Richtung", quality.driftDirection],
    ["Prediction Stability", quality.predictionStability.toFixed(1)],
    ["Prediction Consistency", quality.predictionConsistency.toFixed(1)],
    ["Prediction Reliability", quality.predictionReliability.toFixed(1)],
    ["Confidence Accuracy", quality.confidenceAccuracy.toFixed(1)],
    ["Stichprobengröße (entschiedene Spiele)", quality.sampleSize],
    ["Modellqualität (Gesamt, Tag 7)", quality.modelQuality.overallScore.toFixed(1)],
    ["Modellqualität Grade", quality.modelQuality.grade],
    [""],
    ["Rolling-Metriken", ""],
    ["Datum", "Rolling Accuracy (%)", "Rolling ROI (%)", "Rolling Confidence Gap (pp)", "Rolling Datenvollständigkeit (%)"],
    ...quality.rollingMetrics.map((p) => [
      p.date,
      p.rollingAccuracy.toFixed(1),
      p.rollingRoi.toFixed(1),
      p.rollingConfidenceGap.toFixed(1),
      p.rollingDataCompleteness.toFixed(1),
    ]),
  ];

  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  triggerDownload(`\uFEFF${csvContent}`, "text/csv;charset=utf-8;", `mlb-prediction-quality-${isoDateStamp()}.csv`);
}
