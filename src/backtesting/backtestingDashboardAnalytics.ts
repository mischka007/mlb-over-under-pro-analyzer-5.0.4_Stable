import { createConfidencePerformance, createRiskStats } from "./seasonBacktestRunner";
import type { BacktestResult, BacktestSummary } from "./backtestTypes";
import type { ConfidenceBacktestPerformance, SeasonBacktestRiskStats } from "./seasonBacktestTypes";
import type {
  BacktestDatasetRecord,
  BacktestTimeSeriesPoint,
  CalibrationRecommendation,
  LineBucketPerformance,
  ModuleBacktestPerformance,
  ModuleKey,
} from "@/types";
import { mean } from "@/utils/math";

/**
 * Backtesting PRO Phase 3: Dashboard-Auswertungen.
 *
 * Wandelt einen `BacktestDatasetRecord[]` (siehe `backtestingDatasetBuilder.ts`)
 * in die vollständige, aggregierte Auswertung für die neue Backtesting-
 * PRO-Dashboard-Seite um. Kern-Kennzahlen (Monats-Performance, Confidence-
 * Buckets, Drawdown/Streaks) werden dabei über die bereits bestehende,
 * unveränderte `seasonBacktestRunner.ts`-Infrastruktur berechnet — hier
 * neu hinzu kommen ausschließlich: Linien-Auswertung, Modul-Auswertung,
 * Kalibrierungs-Empfehlungen sowie die Zeitreihen/Verteilungen für die
 * Visualisierung.
 */

const ALL_MODULE_KEYS: ModuleKey[] = ["form", "pitcher", "bullpen", "offense", "weather", "ballpark", "h2h", "market"];

/** Standard-Linien-Raster für die Auswertung nach Wettlinie. */
const DEFAULT_LINE_BUCKETS = [7, 7.5, 8, 8.5, 9, 9.5];

export interface BacktestingDashboardData {
  records: BacktestDatasetRecord[];
  summary: BacktestSummary;
  averageEv: number;
  averageConfidence: number;
  confidenceBuckets: ConfidenceBacktestPerformance[];
  lineBuckets: LineBucketPerformance[];
  modulePerformance: ModuleBacktestPerformance[];
  risk: SeasonBacktestRiskStats;
  recommendations: CalibrationRecommendation[];
  roiTimeSeries: BacktestTimeSeriesPoint[];
  yieldTimeSeries: BacktestTimeSeriesPoint[];
  hitRateTimeSeries: BacktestTimeSeriesPoint[];
  equityCurve: BacktestTimeSeriesPoint[];
  confidenceDistribution: { bucket: string; count: number }[];
  profitByLine: { line: number; profit: number }[];
  profitByModule: { label: string; profit: number }[];
}

/**
 * Wandelt die reichhaltigen `BacktestDatasetRecord` in die einfachere
 * `BacktestResult`-Form um, damit die bestehenden, unveränderten
 * Auswertungsfunktionen aus `seasonBacktestRunner.ts` direkt
 * wiederverwendet werden können. `homeRuns`/`awayRuns`/`odds` werden von
 * diesen Funktionen nicht gelesen (sie arbeiten ausschließlich mit
 * `outcome`/`profit`/`confidence`/`officialDate`) und daher unkritisch
 * mit neutralen Platzhaltern befüllt.
 */
function toBacktestResults(records: BacktestDatasetRecord[]): BacktestResult[] {
  return records
    .filter((r): r is BacktestDatasetRecord & { prediction: "over" | "under" } => r.prediction !== null)
    .map((r) => ({
      gameId: r.gameId,
      officialDate: r.date,
      gameDate: r.date,
      homeTeam: r.homeTeam,
      awayTeam: r.awayTeam,
      homeRuns: 0,
      awayRuns: 0,
      actualRuns: r.actualRuns,
      line: r.line,
      predictedPick: r.prediction,
      confidence: r.confidence,
      odds: r.fairOdds ?? 1.91,
      outcome: r.hit === null ? "push" : r.hit ? "win" : "loss",
      profit: r.profitLoss,
    }));
}

function computeSummary(results: BacktestResult[]): BacktestSummary {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let profit = 0;

  for (const result of results) {
    if (result.outcome === "win") wins++;
    else if (result.outcome === "loss") losses++;
    else pushes++;
    profit += result.profit;
  }

  const totalGames = results.length;
  const decidedBets = wins + losses;
  const hitRate = decidedBets > 0 ? wins / decidedBets : 0;
  const roi = totalGames > 0 ? profit / totalGames : 0;
  const yieldValue = decidedBets > 0 ? profit / decidedBets : 0;

  return { totalGames, wins, losses, pushes, decidedBets, hitRate, roi, yield: yieldValue, profit };
}

/**
 * Auswertung nach Wettlinie: gruppiert nach dem nächstgelegenen
 * Standard-Linienwert (7.0 … 9.5). Linien außerhalb dieses Rasters
 * fallen in den nächstgelegenen Bucket, damit auch untypische
 * historische Linien (z. B. 8.0 vs. leicht abweichende Buchmacher-
 * Linien) sauber ausgewertet werden.
 */
export function computeLineBucketPerformance(
  records: BacktestDatasetRecord[],
  buckets: number[] = DEFAULT_LINE_BUCKETS
): LineBucketPerformance[] {
  const grouped = new Map<number, BacktestDatasetRecord[]>();

  for (const bucket of buckets) {
    grouped.set(bucket, []);
  }

  for (const record of records) {
    if (record.prediction === null) continue;
    const closest = buckets.reduce((best, candidate) =>
      Math.abs(candidate - record.line) < Math.abs(best - record.line) ? candidate : best
    );
    grouped.get(closest)?.push(record);
  }

  return buckets.map((line) => {
    const group = grouped.get(line) ?? [];
    let wins = 0;
    let losses = 0;
    let pushes = 0;
    let profit = 0;

    for (const record of group) {
      if (record.hit === true) wins++;
      else if (record.hit === false) losses++;
      else pushes++;
      profit += record.profitLoss;
    }

    const decidedBets = wins + losses;
    const hitRate = decidedBets > 0 ? wins / decidedBets : 0;
    const roi = group.length > 0 ? profit / group.length : 0;

    return { line, bets: group.length, wins, losses, pushes, decidedBets, hitRate, roi, profit };
  });
}

/**
 * Auswertung je Modul über alle Spiele hinweg: durchschnittlicher
 * Einfluss, Trefferquote (stimmte die Modul-Richtung mit dem
 * tatsächlichen Ergebnis überein?), ROI (nur Spiele, in denen die
 * Modul-Richtung mit dem platzierten Pick übereinstimmte) sowie wie oft
 * dieses Modul das mit Abstand einflussreichste war.
 */
export function computeModulePerformance(records: BacktestDatasetRecord[]): ModuleBacktestPerformance[] {
  const decidedRecords = records.filter((r) => r.actualResult !== "push");

  const strongestCounts = new Map<ModuleKey, number>();
  let evaluableForStrongest = 0;

  for (const record of decidedRecords) {
    if (record.moduleInfluences.length === 0) continue;
    const strongest = [...record.moduleInfluences].sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence))[0];
    strongestCounts.set(strongest.moduleKey, (strongestCounts.get(strongest.moduleKey) ?? 0) + 1);
    evaluableForStrongest++;
  }

  return ALL_MODULE_KEYS.map((moduleKey) => {
    const entriesWithData = decidedRecords
      .map((r) => ({ record: r, influence: r.moduleInfluences.find((i) => i.moduleKey === moduleKey) }))
      .filter((e): e is { record: BacktestDatasetRecord; influence: NonNullable<(typeof e)["influence"]> } => e.influence !== undefined);

    const label = entriesWithData[0]?.influence.label ?? moduleKey;

    const averageInfluence = entriesWithData.length > 0 ? mean(entriesWithData.map((e) => e.influence.influence)) : 0;

    const directionalEntries = entriesWithData.filter((e) => e.influence.direction !== "neutral");
    const correctDirectional = directionalEntries.filter((e) => e.influence.direction === e.record.actualResult).length;
    const hitRate = directionalEntries.length > 0 ? correctDirectional / directionalEntries.length : 0;

    const agreementWithPickEntries = entriesWithData.filter(
      (e) => e.record.prediction !== null && e.influence.direction === e.record.prediction && e.record.hit !== null
    );
    const roiProfit = agreementWithPickEntries.reduce((sum, e) => sum + e.record.profitLoss, 0);
    const roi = agreementWithPickEntries.length > 0 ? roiProfit / agreementWithPickEntries.length : 0;

    const strongestCount = strongestCounts.get(moduleKey) ?? 0;
    const strongestPct = evaluableForStrongest > 0 ? (strongestCount / evaluableForStrongest) * 100 : 0;

    return {
      moduleKey,
      label,
      averageInfluence,
      hitRate,
      roi,
      strongestCount,
      strongestPct,
      gamesWithData: entriesWithData.length,
    };
  });
}

/**
 * Erzeugt automatische, ausschließlich informative Kalibrierungs-
 * Empfehlungen aus den tatsächlich berechneten Backtest-Kennzahlen.
 * Verändert KEINE Modul-Gewichte — reine Textausgabe zur Einordnung.
 */
export function generateCalibrationRecommendations(params: {
  modulePerformance: ModuleBacktestPerformance[];
  confidenceBuckets: ConfidenceBacktestPerformance[];
  summary: BacktestSummary;
  averageEv: number;
}): CalibrationRecommendation[] {
  const recommendations: CalibrationRecommendation[] = [];

  const modulesWithData = params.modulePerformance.filter((m) => m.gamesWithData >= 10);

  if (modulesWithData.length > 0) {
    const bestByRoi = [...modulesWithData].sort((a, b) => b.roi - a.roi)[0];
    if (bestByRoi.roi > 0) {
      recommendations.push({
        category: "module",
        text: `${bestByRoi.label}-Modul liefert im Backtest-Zeitraum den höchsten ROI (${(bestByRoi.roi * 100).toFixed(1)} %) unter Spielen, in denen es mit dem Pick übereinstimmte.`,
        basedOnValue: bestByRoi.roi,
      });
    }

    const worstByRoi = [...modulesWithData].sort((a, b) => a.roi - b.roi)[0];
    if (worstByRoi.roi < 0 && worstByRoi.moduleKey !== bestByRoi.moduleKey) {
      recommendations.push({
        category: "module",
        text: `${worstByRoi.label}-Modul lag im Backtest-Zeitraum im Schnitt unter break-even (ROI ${(worstByRoi.roi * 100).toFixed(1)} %), wenn es mit dem Pick übereinstimmte.`,
        basedOnValue: worstByRoi.roi,
      });
    }

    const neutralModules = modulesWithData.filter((m) => Math.abs(m.averageInfluence) < 1);
    for (const neutral of neutralModules) {
      recommendations.push({
        category: "module",
        text: `${neutral.label}-Modul war im Backtest-Zeitraum überwiegend neutral (durchschnittlicher Einfluss ${neutral.averageInfluence.toFixed(2)}).`,
        basedOnValue: neutral.averageInfluence,
      });
    }
  }

  const highConfidenceBuckets = params.confidenceBuckets.filter((b) => b.decidedBets >= 10 && (b.bucket.startsWith("80") || b.bucket.startsWith("90")));
  const bestConfidenceBucket = [...highConfidenceBuckets].sort((a, b) => b.roi - a.roi)[0];
  if (bestConfidenceBucket && bestConfidenceBucket.roi > 0) {
    recommendations.push({
      category: "confidence",
      text: `Confidence-Bereich "${bestConfidenceBucket.bucket}" war im Backtest-Zeitraum besonders profitabel (ROI ${(bestConfidenceBucket.roi * 100).toFixed(1)} % über ${bestConfidenceBucket.decidedBets} Wetten).`,
      basedOnValue: bestConfidenceBucket.roi,
    });
  }

  const lowConfidenceBuckets = params.confidenceBuckets.filter((b) => b.decidedBets >= 10 && (b.bucket.startsWith("50") || b.bucket.startsWith("60")));
  const worstLowConfidenceBucket = [...lowConfidenceBuckets].sort((a, b) => a.roi - b.roi)[0];
  if (worstLowConfidenceBucket && worstLowConfidenceBucket.roi < 0) {
    recommendations.push({
      category: "confidence",
      text: `Confidence-Bereich "${worstLowConfidenceBucket.bucket}" war im Backtest-Zeitraum unprofitabel (ROI ${(worstLowConfidenceBucket.roi * 100).toFixed(1)} %) — Wetten in diesem Bereich verdienen zusätzliche Vorsicht.`,
      basedOnValue: worstLowConfidenceBucket.roi,
    });
  }

  if (params.summary.decidedBets >= 20) {
    if (params.averageEv > 0) {
      recommendations.push({
        category: "staking",
        text: `Der durchschnittliche Expected Value über alle platzierten Wetten liegt bei +${params.averageEv.toFixed(1)} % — Kelly-basierte Einsätze dürften im Schnitt einen höheren Yield liefern als Flat-Staking.`,
        basedOnValue: params.averageEv,
      });
    } else {
      recommendations.push({
        category: "staking",
        text: `Der durchschnittliche Expected Value über alle platzierten Wetten liegt bei ${params.averageEv.toFixed(1)} % — im aktuellen Backtest-Zeitraum bietet Kelly-Staking keinen belastbaren Vorteil gegenüber Flat-Staking.`,
        basedOnValue: params.averageEv,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      category: "general",
      text: "Noch nicht genügend historische Wetten für belastbare Kalibrierungs-Empfehlungen (mindestens 10-20 Wetten pro Kategorie empfohlen).",
      basedOnValue: params.summary.decidedBets,
    });
  }

  return recommendations;
}

function buildRoiTimeSeries(records: BacktestDatasetRecord[]): BacktestTimeSeriesPoint[] {
  const decided = records.filter((r) => r.hit !== null);
  let cumulativeProfit = 0;
  return decided.map((r, i) => {
    cumulativeProfit += r.profitLoss;
    return { index: i + 1, date: r.date, value: cumulativeProfit / (i + 1) };
  });
}

function buildYieldTimeSeries(records: BacktestDatasetRecord[]): BacktestTimeSeriesPoint[] {
  const decided = records.filter((r) => r.hit !== null);
  let cumulativeProfit = 0;
  let decidedCount = 0;
  return decided.map((r) => {
    cumulativeProfit += r.profitLoss;
    decidedCount += 1;
    return { index: decidedCount, date: r.date, value: cumulativeProfit / decidedCount };
  });
}

function buildHitRateTimeSeries(records: BacktestDatasetRecord[]): BacktestTimeSeriesPoint[] {
  const decided = records.filter((r) => r.hit !== null);
  let wins = 0;
  return decided.map((r, i) => {
    if (r.hit) wins += 1;
    return { index: i + 1, date: r.date, value: (wins / (i + 1)) * 100 };
  });
}

function buildEquityCurve(records: BacktestDatasetRecord[]): BacktestTimeSeriesPoint[] {
  const decided = records.filter((r) => r.hit !== null);
  let equity = 0;
  return decided.map((r, i) => {
    equity += r.profitLoss;
    return { index: i + 1, date: r.date, value: equity };
  });
}

const CONFIDENCE_DISTRIBUTION_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "50–60%", min: 0.5, max: 0.6 },
  { label: "60–70%", min: 0.6, max: 0.7 },
  { label: "70–80%", min: 0.7, max: 0.8 },
  { label: "80–90%", min: 0.8, max: 0.9 },
  { label: "90%+", min: 0.9, max: 1.01 },
];

function buildConfidenceDistribution(records: BacktestDatasetRecord[]): { bucket: string; count: number }[] {
  return CONFIDENCE_DISTRIBUTION_BUCKETS.map(({ label, min, max }) => ({
    bucket: label,
    count: records.filter((r) => r.prediction !== null && r.confidence >= min && r.confidence < max).length,
  }));
}

function buildProfitByLine(lineBuckets: LineBucketPerformance[]): { line: number; profit: number }[] {
  return lineBuckets.map((b) => ({ line: b.line, profit: b.profit }));
}

function buildProfitByModule(modulePerformance: ModuleBacktestPerformance[]): { label: string; profit: number }[] {
  return modulePerformance.map((m) => ({ label: m.label, profit: m.roi * m.gamesWithData }));
}

/**
 * Baut das vollständige, aggregierte Datenpaket für die Backtesting-
 * PRO-Dashboard-Seite aus einem `BacktestDatasetRecord[]` auf.
 */
export function buildBacktestingDashboardData(records: BacktestDatasetRecord[]): BacktestingDashboardData {
  const results = toBacktestResults(records);
  const summary = computeSummary(results);

  const decidedRecords = records.filter((r) => r.prediction !== null);
  const evValues = decidedRecords.map((r) => r.valuePct).filter((v): v is number => v !== null);
  const averageEv = evValues.length > 0 ? mean(evValues) : 0;
  const averageConfidence = decidedRecords.length > 0 ? mean(decidedRecords.map((r) => r.confidence)) * 100 : 0;

  const confidenceBuckets = createConfidencePerformance(results);
  const lineBuckets = computeLineBucketPerformance(records);
  const modulePerformance = computeModulePerformance(records);
  const risk = createRiskStats(results);

  const recommendations = generateCalibrationRecommendations({ modulePerformance, confidenceBuckets, summary, averageEv });

  return {
    records,
    summary,
    averageEv,
    averageConfidence,
    confidenceBuckets,
    lineBuckets,
    modulePerformance,
    risk,
    recommendations,
    roiTimeSeries: buildRoiTimeSeries(records),
    yieldTimeSeries: buildYieldTimeSeries(records),
    hitRateTimeSeries: buildHitRateTimeSeries(records),
    equityCurve: buildEquityCurve(records),
    confidenceDistribution: buildConfidenceDistribution(records),
    profitByLine: buildProfitByLine(lineBuckets),
    profitByModule: buildProfitByModule(modulePerformance),
  };
}
