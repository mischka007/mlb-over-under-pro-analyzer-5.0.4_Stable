import { runBacktest, evaluateBacktestGames } from "./backtestEngine";
import { createConfidencePerformance, createMonthlyPerformance, createPickPerformance, createRiskStats } from "./seasonBacktestRunner";
import type { BacktestDecisionDiagnostic, BacktestResult, BacktestSummary } from "./backtestTypes";
import type { ConfidenceBacktestPerformance, MonthlyBacktestPerformance, PickBacktestPerformance, SeasonBacktestRiskStats } from "./seasonBacktestTypes";

/**
 * Backtesting PRO.
 *
 * Baut auf der bereits bestehenden, umfangreichen Backtest-
 * Infrastruktur auf (ROI/Yield/Profit/Win Rate aus `backtestEngine.ts`,
 * Monats-/Pick-/Confidence-Performance sowie Drawdown/Streaks aus
 * `seasonBacktestRunner.ts` — alle unverändert wiederverwendet) und
 * ergänzt die vier bisher fehlenden professionellen Kennzahlen:
 *
 *  - Prediction Accuracy   (Magnitude-Genauigkeit der Runs-Prognose)
 *  - Module Accuracy       (gerichtete Trefferquote je Einzelmodul)
 *  - Average Edge          (Modell- vs. implizite Buchmacher-Wahrscheinlichkeit)
 *  - Average Closing Line Value (nur mit echten Closing-Line-Daten — kein Fake-Wert)
 *
 * `createBacktestingProReport()` fügt alles zu einem einzigen,
 * vollständigen Report zusammen — "Over Accuracy"/"Under Accuracy"
 * und "Confidence Accuracy" aus der Aufgabenstellung entsprechen dabei
 * der bereits vorhandenen Pick- bzw. Confidence-Bucket-Performance,
 * "Historical Performance" der bereits vorhandenen Monats-Performance.
 */

export interface ModuleAccuracyStat {
  moduleKey: string;
  label: string;
  /** Anzahl Spiele, in denen dieses Modul überhaupt Daten hatte. */
  gamesWithData: number;
  /** Davon Spiele mit einem gerichteten Score (≠ 50) — nur diese fließen in die Trefferquote ein. */
  directionalGames: number;
  correctDirectionalPicks: number;
  /** `null`, wenn keine gerichteten Modul-Scores vorlagen. */
  accuracyPct: number | null;
}

export interface PredictionAccuracyStat {
  gamesEvaluated: number;
  meanAbsoluteErrorRuns: number;
  rootMeanSquaredErrorRuns: number;
  /** 0–100, normalisiert relativ zur durchschnittlichen Wettlinie (100 = im Schnitt exakt getroffen). */
  accuracyPct: number;
}

export interface EdgeStat {
  gamesEvaluated: number;
  averageEdgePct: number | null;
}

export interface ClosingLineValueStat {
  gamesEvaluated: number;
  averageClosingLineValue: number | null;
  note: string;
}

export interface BacktestingProReport {
  /** ROI/Yield/Profit/Win Rate — bereits bestehende Kennzahlen, unverändert übernommen. */
  summary: BacktestSummary;
  /** "Over Accuracy" — bereits bestehende Pick-Performance, gefiltert auf OVER. */
  overPerformance: PickBacktestPerformance | null;
  /** "Under Accuracy" — bereits bestehende Pick-Performance, gefiltert auf UNDER. */
  underPerformance: PickBacktestPerformance | null;
  predictionAccuracy: PredictionAccuracyStat;
  moduleAccuracy: ModuleAccuracyStat[];
  /** "Confidence Accuracy" — bereits bestehende Confidence-Bucket-Performance. */
  confidenceAccuracy: ConfidenceBacktestPerformance[];
  edge: EdgeStat;
  closingLineValue: ClosingLineValueStat;
  /** Drawdown + längste Gewinn-/Verlustserie — bereits bestehend. */
  risk: SeasonBacktestRiskStats;
  /** "Historical Performance" — bereits bestehende Monats-Performance. */
  historicalPerformance: MonthlyBacktestPerformance[];
  gamesWithDiagnostics: number;
  generatedAt: string;
}

const MODULE_LABEL_FALLBACK: Record<string, string> = {
  form: "Team-Form",
  pitcher: "Starting Pitcher",
  bullpen: "Bullpen",
  offense: "Offense",
  weather: "Wetter",
  ballpark: "Ballpark",
  h2h: "Head-to-Head",
  market: "Markt",
};

function determineActualOutcome(actualRuns: number, line: number): "over" | "under" | "push" {
  if (actualRuns > line) return "over";
  if (actualRuns < line) return "under";
  return "push";
}

/**
 * Module Accuracy: bewertet für jedes Modul UNABHÄNGIG, ob dessen
 * eigener gerichteter Score (> 50 = Over-Signal, < 50 = Under-Signal)
 * mit dem tatsächlichen Ergebnis übereinstimmt — unabhängig davon, ob
 * das Modul am Ende überhaupt mit Gewicht in den Konsens eingegangen
 * ist. Zeigt, welche Module historisch tatsächlich prädiktiv waren.
 * Ein Score von exakt 50 (neutral, kein Signal) wird nicht gewertet.
 */
export function computeModuleAccuracy(diagnostics: BacktestDecisionDiagnostic[]): ModuleAccuracyStat[] {
  const stats = new Map<string, { label: string; gamesWithData: number; directional: number; correct: number }>();

  for (const diagnostic of diagnostics) {
    const actual = determineActualOutcome(diagnostic.actualRuns, diagnostic.line);
    if (actual === "push") continue;

    for (const module of diagnostic.modules) {
      if (!module.hasData) continue;

      const entry = stats.get(module.key) ?? { label: module.label, gamesWithData: 0, directional: 0, correct: 0 };
      entry.gamesWithData += 1;

      if (module.score !== 50) {
        entry.directional += 1;
        const moduleLean = module.score > 50 ? "over" : "under";
        if (moduleLean === actual) entry.correct += 1;
      }

      stats.set(module.key, entry);
    }
  }

  return Array.from(stats.entries()).map(([moduleKey, entry]) => ({
    moduleKey,
    label: entry.label || MODULE_LABEL_FALLBACK[moduleKey] || moduleKey,
    gamesWithData: entry.gamesWithData,
    directionalGames: entry.directional,
    correctDirectionalPicks: entry.correct,
    accuracyPct: entry.directional > 0 ? (entry.correct / entry.directional) * 100 : null,
  }));
}

/**
 * Prediction Accuracy: misst, wie nah die modellseitig erwarteten
 * Gesamt-Runs (`finalExpectedRuns`) am tatsächlichen Ergebnis lagen —
 * ergänzt die bestehende, rein binäre Trefferquote (Win Rate) um eine
 * Magnitude-Genauigkeit (MAE, RMSE sowie eine auf die durchschnittliche
 * Wettlinie normalisierte 0–100-Genauigkeit).
 */
export function computePredictionAccuracy(diagnostics: BacktestDecisionDiagnostic[]): PredictionAccuracyStat {
  if (diagnostics.length === 0) {
    return { gamesEvaluated: 0, meanAbsoluteErrorRuns: 0, rootMeanSquaredErrorRuns: 0, accuracyPct: 0 };
  }

  let sumAbsError = 0;
  let sumSquaredError = 0;
  let sumLine = 0;

  for (const diagnostic of diagnostics) {
    const error = diagnostic.finalExpectedRuns - diagnostic.actualRuns;
    sumAbsError += Math.abs(error);
    sumSquaredError += error * error;
    sumLine += diagnostic.line;
  }

  const gamesEvaluated = diagnostics.length;
  const meanAbsoluteErrorRuns = sumAbsError / gamesEvaluated;
  const rootMeanSquaredErrorRuns = Math.sqrt(sumSquaredError / gamesEvaluated);
  const averageLine = sumLine / gamesEvaluated;

  // Normalisiert die durchschnittliche absolute Abweichung relativ zur
  // durchschnittlichen Wettlinie: 0 Runs Abweichung → 100 %, eine
  // Abweichung in Höhe der halben durchschnittlichen Linie → 0 %.
  const accuracyPct = averageLine > 0 ? Math.max(0, 100 - (meanAbsoluteErrorRuns / (averageLine / 2)) * 100) : 0;

  return { gamesEvaluated, meanAbsoluteErrorRuns, rootMeanSquaredErrorRuns, accuracyPct };
}

/**
 * Average Edge: durchschnittliche Differenz zwischen Modellwahrschein-
 * lichkeit (Poisson) der gewählten Seite und der impliziten Buchmacher-
 * Wahrscheinlichkeit (aus der historischen Test-Quote), in
 * Prozentpunkten, über alle tatsächlich platzierten Wetten.
 */
export function computeAverageEdge(diagnostics: BacktestDecisionDiagnostic[], results: BacktestResult[]): EdgeStat {
  const resultByGameId = new Map(results.map((r) => [r.gameId, r]));

  let sumEdge = 0;
  let count = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.predictedPick === null) continue;
    const result = resultByGameId.get(diagnostic.gameId);
    if (!result || !result.odds || result.odds <= 0) continue;

    const modelProbability = diagnostic.predictedPick === "over" ? diagnostic.poissonOverProbability : diagnostic.poissonUnderProbability;
    const impliedProbability = 1 / result.odds;

    sumEdge += (modelProbability - impliedProbability) * 100;
    count += 1;
  }

  return { gamesEvaluated: count, averageEdgePct: count > 0 ? sumEdge / count : null };
}

/**
 * Average Closing Line Value (CLV): vergleicht die zur Wettzeit
 * verwendete Linie mit der tatsächlichen historischen Closing Line —
 * NUR wenn für das jeweilige Spiel eine echte Closing Line vorliegt.
 *
 * WICHTIG: Historische Closing-Line-Daten werden aktuell nicht im
 * großen Stil geladen (die zugrunde liegende historische Odds-API ist
 * kostenpflichtig, siehe `historicalMarketTest.ts`). Ohne echte
 * Closing-Line-Daten liefert diese Funktion bewusst `null` statt eines
 * erfundenen Werts. Sobald echte Closing-Line-Daten je Spiel vorliegen
 * (`closingLinesByGameId`, z. B. aus einem künftigen Bulk-Import über
 * die historische Odds-API), berechnet diese Funktion den CLV korrekt.
 */
export function computeAverageClosingLineValue(
  diagnostics: BacktestDecisionDiagnostic[],
  closingLinesByGameId?: Map<number, number>
): ClosingLineValueStat {
  if (!closingLinesByGameId || closingLinesByGameId.size === 0) {
    return {
      gamesEvaluated: 0,
      averageClosingLineValue: null,
      note: "Keine historischen Closing-Line-Daten verfügbar (kostenpflichtige historische Odds-API, siehe historicalMarketTest.ts) — es wird kein Wert erfunden.",
    };
  }

  let sumClv = 0;
  let count = 0;

  for (const diagnostic of diagnostics) {
    if (diagnostic.predictedPick === null) continue;
    const closingLine = closingLinesByGameId.get(diagnostic.gameId);
    if (closingLine === undefined) continue;

    // CLV in Richtung des Picks: bei OVER ist eine gestiegene Closing
    // Line (im Vergleich zur eigenen Wettlinie) positiv — man hat vor
    // der Marktbewegung nach oben gekauft; bei UNDER entsprechend
    // umgekehrt.
    const rawMovement = closingLine - diagnostic.line;
    const clv = diagnostic.predictedPick === "over" ? rawMovement : -rawMovement;

    sumClv += clv;
    count += 1;
  }

  return {
    gamesEvaluated: count,
    averageClosingLineValue: count > 0 ? sumClv / count : null,
    note:
      count > 0
        ? "Berechnet aus echten historischen Closing-Line-Daten."
        : "Closing-Line-Daten vorhanden, aber keine Übereinstimmung mit ausgewerteten Spielen gefunden.",
  };
}

/**
 * Erstellt den vollständigen Backtesting-PRO-Report. Vergleicht dabei
 * jede Prognose mit dem tatsächlichen Ergebnis (`BacktestResult` enthält
 * bereits `outcome`/`profit` aus `evaluateBacktestGames()`, die
 * Diagnose-Daten `finalExpectedRuns`/`poissonOverProbability`/etc. aus
 * `createPredictedBacktestGames()` in `backtestRunner.ts`).
 */
export function createBacktestingProReport(
  results: BacktestResult[],
  diagnostics: BacktestDecisionDiagnostic[],
  closingLinesByGameId?: Map<number, number>
): BacktestingProReport {
  const summary = runBacktest(results);
  const pickPerformance = createPickPerformance(results);

  return {
    summary,
    overPerformance: pickPerformance.find((p) => p.pick === "over") ?? null,
    underPerformance: pickPerformance.find((p) => p.pick === "under") ?? null,
    predictionAccuracy: computePredictionAccuracy(diagnostics),
    moduleAccuracy: computeModuleAccuracy(diagnostics),
    confidenceAccuracy: createConfidencePerformance(results),
    edge: computeAverageEdge(diagnostics, results),
    closingLineValue: computeAverageClosingLineValue(diagnostics, closingLinesByGameId),
    risk: createRiskStats(results),
    historicalPerformance: createMonthlyPerformance(results),
    gamesWithDiagnostics: diagnostics.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Praktischer Komfort-Wrapper: nimmt direkt die bereits ausgewerteten
 * `BacktestGame[]` (mit `predictedPick`) entgegen, wertet sie aus
 * (`evaluateBacktestGames`) und erstellt daraus den vollständigen
 * Report — spart dem Aufrufer den Zwischenschritt.
 */
export function createBacktestingProReportFromPredictedGames(
  predictedGames: Parameters<typeof evaluateBacktestGames>[0],
  diagnostics: BacktestDecisionDiagnostic[],
  closingLinesByGameId?: Map<number, number>
): BacktestingProReport {
  const results = evaluateBacktestGames(predictedGames);
  return createBacktestingProReport(results, diagnostics, closingLinesByGameId);
}

/**
 * Formatiert einen `BacktestingProReport` als lesbaren Text-Report (für
 * Browser-Konsole / Dev-Tools, konsistent mit den bestehenden
 * Backtest-Report-Ausgaben in `backtestReport.ts` und
 * `historicalCalibration.ts`).
 */
export function formatBacktestingProReport(report: BacktestingProReport): string {
  const lines: string[] = [];

  lines.push("========================================");
  lines.push("BACKTESTING PRO REPORT");
  lines.push("========================================");
  lines.push("");
  lines.push(`Erstellt: ${report.generatedAt}`);
  lines.push(`Spiele mit Diagnose: ${report.gamesWithDiagnostics}`);
  lines.push("");

  lines.push("--- Kern-Kennzahlen ---");
  lines.push(`Spiele gesamt: ${report.summary.totalGames}`);
  lines.push(`Entschiedene Wetten: ${report.summary.decidedBets}`);
  lines.push(`Win Rate: ${(report.summary.hitRate * 100).toFixed(2)} %`);
  lines.push(`ROI: ${(report.summary.roi * 100).toFixed(2)} %`);
  lines.push(`Yield: ${(report.summary.yield * 100).toFixed(2)} %`);
  lines.push(`Profit: ${report.summary.profit.toFixed(2)} Units`);
  lines.push("");

  lines.push("--- Über/Unter-Genauigkeit ---");
  if (report.overPerformance) {
    lines.push(`Over Accuracy: ${(report.overPerformance.hitRate * 100).toFixed(2)} % (${report.overPerformance.decidedBets} Wetten)`);
  }
  if (report.underPerformance) {
    lines.push(`Under Accuracy: ${(report.underPerformance.hitRate * 100).toFixed(2)} % (${report.underPerformance.decidedBets} Wetten)`);
  }
  lines.push("");

  lines.push("--- Prediction Accuracy (Runs-Magnitude) ---");
  lines.push(`MAE: ${report.predictionAccuracy.meanAbsoluteErrorRuns.toFixed(2)} Runs`);
  lines.push(`RMSE: ${report.predictionAccuracy.rootMeanSquaredErrorRuns.toFixed(2)} Runs`);
  lines.push(`Accuracy: ${report.predictionAccuracy.accuracyPct.toFixed(1)} %`);
  lines.push("");

  lines.push("--- Module Accuracy ---");
  for (const module of report.moduleAccuracy) {
    const accuracyText = module.accuracyPct !== null ? `${module.accuracyPct.toFixed(1)} %` : "n/a";
    lines.push(`  ${module.label.padEnd(18, " ")} ${accuracyText} (${module.directionalGames} gerichtete Spiele von ${module.gamesWithData} mit Daten)`);
  }
  lines.push("");

  lines.push("--- Confidence Accuracy (Kalibrierung) ---");
  for (const bucket of report.confidenceAccuracy) {
    lines.push(`  ${bucket.bucket.padEnd(12, " ")} Trefferquote ${(bucket.hitRate * 100).toFixed(1)} % (${bucket.decidedBets} Wetten)`);
  }
  lines.push("");

  lines.push("--- Edge & Closing Line Value ---");
  lines.push(`Average Edge: ${report.edge.averageEdgePct !== null ? `${report.edge.averageEdgePct.toFixed(2)} Prozentpunkte` : "n/a"} (${report.edge.gamesEvaluated} Wetten)`);
  lines.push(
    `Average Closing Line Value: ${report.closingLineValue.averageClosingLineValue !== null ? report.closingLineValue.averageClosingLineValue.toFixed(3) : "n/a"} — ${report.closingLineValue.note}`
  );
  lines.push("");

  lines.push("--- Drawdown & Serien ---");
  lines.push(`Längste Gewinnserie: ${report.risk.longestWinStreak}`);
  lines.push(`Längste Verlustserie: ${report.risk.longestLossStreak}`);
  lines.push(`Maximaler Drawdown: ${report.risk.maximumDrawdown.toFixed(2)} Units (${report.risk.maximumDrawdownPct.toFixed(1)} %)`);
  lines.push("");

  lines.push("--- Historical Performance (Monate) ---");
  for (const month of report.historicalPerformance) {
    lines.push(`  ${month.month}: ${(month.hitRate * 100).toFixed(1)} % Trefferquote, ROI ${(month.roi * 100).toFixed(1)} %, ${month.decidedBets} Wetten`);
  }

  lines.push("========================================");

  return lines.join("\n");
}
