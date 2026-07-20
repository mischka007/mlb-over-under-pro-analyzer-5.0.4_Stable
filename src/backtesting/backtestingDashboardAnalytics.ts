import { createConfidencePerformance, createPickPerformance, createRiskStats } from "./seasonBacktestRunner";
import type { BacktestResult, BacktestSummary } from "./backtestTypes";
import type { ConfidenceBacktestPerformance, PickBacktestPerformance, SeasonBacktestRiskStats } from "./seasonBacktestTypes";
import type {
  BacktestDatasetRecord,
  BacktestTimeSeriesPoint,
  CalibrationRecommendation,
  LineBucketPerformance,
  MarketQualityBucketPerformance,
  ModuleBacktestPerformance,
  ModuleKey,
  PremiumFilterEfficacyStat,
} from "@/types";
import { clamp, mean, stdDev } from "@/utils/math";

/**
 * Backtesting PRO Phase 3 + Tag 6 (Historical Validation): Dashboard-
 * Auswertungen.
 *
 * Wandelt einen `BacktestDatasetRecord[]` (siehe `backtestingDatasetBuilder.ts`)
 * in die vollständige, aggregierte Auswertung für die Backtesting-PRO-
 * Dashboard-Seite um. Kern-Kennzahlen (Monats-Performance, Confidence-/
 * Pick-Buckets, Drawdown/Streaks) werden dabei über die bereits
 * bestehende, unveränderte `seasonBacktestRunner.ts`-Infrastruktur
 * berechnet. Tag 6 ergänzt zusätzlich: Over/Under-Genauigkeit (bestehende
 * `createPickPerformance` wiederverwendet), Premium-Filter-Wirksamkeit,
 * Durchschnitts-Kennzahlen (Fair Odds/Edge/Expected Runs) sowie eine
 * erweiterte Modul-Auswertung (Ø Gewichtung, positive/negative
 * Auswirkung, Gewichtungs-Empfehlung je Modul) und eine Best-/Worst-
 * Bereich-Zusammenfassung.
 */

const ALL_MODULE_KEYS: ModuleKey[] = ["form", "pitcher", "bullpen", "offense", "weather", "ballpark", "h2h", "market"];

/** Standard-Linien-Raster für die Auswertung nach Wettlinie. */
const DEFAULT_LINE_BUCKETS = [7, 7.5, 8, 8.5, 9, 9.5];

export interface BacktestingDashboardData {
  records: BacktestDatasetRecord[];
  summary: BacktestSummary;
  averageEv: number;
  averageConfidence: number;
  /** Ø Fair Odds über alle platzierten Wetten (Dezimalquote). */
  averageFairOdds: number;
  /** Ø Expected Edge in Prozentpunkten über alle platzierten Wetten. */
  averageEdge: number;
  /** Ø modellseitig erwartete Gesamt-Runs über alle ausgewerteten Spiele. */
  averageExpectedRuns: number;
  confidenceBuckets: ConfidenceBacktestPerformance[];
  /** Over/Under-Genauigkeit — bestehende Pick-Performance-Funktion wiederverwendet. */
  overUnderPerformance: PickBacktestPerformance[];
  lineBuckets: LineBucketPerformance[];
  /** Version 6.0 (Paket 4), Schritt 9: ROI/Yield nach Marktqualität (Market Score). */
  marketQualityBuckets: MarketQualityBucketPerformance[];
  modulePerformance: ModuleBacktestPerformance[];
  premiumFilterEfficacy: PremiumFilterEfficacyStat;
  risk: SeasonBacktestRiskStats;
  recommendations: CalibrationRecommendation[];
  roiTimeSeries: BacktestTimeSeriesPoint[];
  yieldTimeSeries: BacktestTimeSeriesPoint[];
  hitRateTimeSeries: BacktestTimeSeriesPoint[];
  equityCurve: BacktestTimeSeriesPoint[];
  confidenceDistribution: { bucket: string; count: number }[];
  profitByLine: { line: number; profit: number }[];
  profitByModule: { label: string; profit: number }[];
  /** Kurzbeschreibung des Modell-Bereichs (Modul/Confidence/Linie) mit dem höchsten ROI. */
  bestModelArea: string;
  /** Kurzbeschreibung des Modell-Bereichs mit dem niedrigsten ROI. */
  worstModelArea: string;
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
/**
 * Version 6.0 (Paket 4), Schritt 9: ROI/Yield gruppiert nach Market
 * Score (Marktqualität). Bei Bulk-Backtests ist `record.marketScore`
 * aktuell konsequent `null` (siehe Typ-Dokumentation von
 * `BacktestDatasetRecord` — keine historischen Multi-Buchmacher-Daten
 * verfügbar) — diese Funktion liefert dann leere/Null-Buckets statt
 * erfundener Werte, ist aber vollständig korrekt für den Moment, in
 * dem echte historische Marktdaten verfügbar werden.
 */
const MARKET_QUALITY_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "Niedrig (0–39)", min: 0, max: 39 },
  { label: "Moderat (40–69)", min: 40, max: 69 },
  { label: "Hoch (70–100)", min: 70, max: 100 },
];

export function computeMarketQualityPerformance(records: BacktestDatasetRecord[]): MarketQualityBucketPerformance[] {
  return MARKET_QUALITY_BUCKETS.map(({ label, min, max }) => {
    const group = records.filter((r) => r.marketScore !== null && r.marketScore >= min && r.marketScore <= max);

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
    const yieldValue = decidedBets > 0 ? profit / decidedBets : 0;

    return { label, minScore: min, maxScore: max, bets: group.length, wins, losses, pushes, decidedBets, hitRate, roi, yield: yieldValue, profit };
  });
}

/**
 * Auswertung einer Gruppe von Spielen mit derselben (gerundeten) Wettlinie. */
export function computeLineBucketPerformance(
  records: BacktestDatasetRecord[],
  buckets: number[] = DEFAULT_LINE_BUCKETS
): LineBucketPerformance[] {
  const grouped = new Map<number, BacktestDatasetRecord[]>();

  for (const bucket of buckets) {
    grouped.set(bucket, []);
  }

  for (const record of records) {
    if (record.prediction === null || buckets.length === 0) continue;
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
 * Generiert eine rein informative, aus Trefferquote/ROI abgeleitete
 * Gewichtungs-Empfehlung für ein einzelnes Modul. Passt selbst keine
 * Gewichte an (siehe `@/backtesting/historicalCalibration` für die
 * tatsächliche, optionale Gewichts-Kalibrierung).
 */
function describeModuleWeightingRecommendation(label: string, roi: number, hitRate: number, gamesWithData: number): string {
  if (gamesWithData < 10) {
    return `Zu wenige Spiele (${gamesWithData}) für eine belastbare Empfehlung zu ${label}.`;
  }
  if (roi > 0.05 && hitRate > 0.52) {
    return `${label}-Modul zeigt im Backtest-Zeitraum überdurchschnittliche Performance — Gewichtung beibehalten oder leicht erhöhen.`;
  }
  if (roi < -0.05 || hitRate < 0.48) {
    return `${label}-Modul zeigt im Backtest-Zeitraum unterdurchschnittliche Performance — Gewichtung kritisch prüfen.`;
  }
  return `${label}-Modul liegt im Backtest-Zeitraum im neutralen Bereich — keine Anpassung angezeigt.`;
}

/**
 * Auswertung je Modul über alle Spiele hinweg: durchschnittlicher
 * Einfluss, durchschnittliche tatsächliche Gewichtung, Anteil positiver/
 * negativer Ausschläge, Trefferquote (stimmte die Modul-Richtung mit dem
 * tatsächlichen Ergebnis überein?), ROI (nur Spiele, in denen die
 * Modul-Richtung mit dem platzierten Pick übereinstimmte), wie oft
 * dieses Modul das mit Abstand einflussreichste war, sowie eine rein
 * informative Gewichtungs-Empfehlung.
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
    const averageWeight = entriesWithData.length > 0 ? mean(entriesWithData.map((e) => e.influence.weight)) : 0;

    const positiveInfluenceValues = entriesWithData.filter((e) => e.influence.influence > 0).map((e) => e.influence.influence);
    const negativeInfluenceValues = entriesWithData.filter((e) => e.influence.influence < 0).map((e) => e.influence.influence);
    const averagePositiveInfluence = positiveInfluenceValues.length > 0 ? mean(positiveInfluenceValues) : 0;
    const averageNegativeInfluence = negativeInfluenceValues.length > 0 ? mean(negativeInfluenceValues) : 0;

    // Brier-Score-Prinzip: bildet den Modul-Score (0-100) linear auf eine
    // Über-Wahrscheinlichkeit (0-1) ab und vergleicht sie quadriert mit
    // dem tatsächlichen Ergebnis — Standardmaß für die Güte einer
    // probabilistischen Einschätzung.
    const errorValues = entriesWithData.map((e) => {
      const impliedOverProbability = 0.5 + clamp(e.influence.score - 50, -50, 50) / 100;
      const actualOver = e.record.actualResult === "over" ? 1 : 0;
      return (impliedOverProbability - actualOver) ** 2;
    });
    const averageError = errorValues.length > 0 ? mean(errorValues) : 0;

    // Stabilität: je geringer die Streuung des Einflusses über die
    // Spiele, desto konsistenter/vorhersagbarer verhält sich das Modul.
    const influenceStdDev = entriesWithData.length > 1 ? stdDev(entriesWithData.map((e) => e.influence.influence)) : 0;
    const stability = clamp(100 - (influenceStdDev / 10) * 100, 0, 100);

    const positiveInfluenceCount = entriesWithData.filter((e) => e.influence.direction === "over").length;
    const negativeInfluenceCount = entriesWithData.filter((e) => e.influence.direction === "under").length;
    const positiveInfluencePct = entriesWithData.length > 0 ? (positiveInfluenceCount / entriesWithData.length) * 100 : 0;
    const negativeInfluencePct = entriesWithData.length > 0 ? (negativeInfluenceCount / entriesWithData.length) * 100 : 0;

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
      averagePositiveInfluence,
      averageNegativeInfluence,
      averageError,
      stability,
      averageWeight,
      positiveInfluenceCount,
      positiveInfluencePct,
      negativeInfluenceCount,
      negativeInfluencePct,
      hitRate,
      roi,
      strongestCount,
      strongestPct,
      gamesWithData: entriesWithData.length,
      weightingRecommendation: describeModuleWeightingRecommendation(label, roi, hitRate, entriesWithData.length),
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
 * Wirksamkeits-Auswertung des Premium-Filters: vergleicht Trefferquote
 * und ROI von Spielen, die den Filter bestanden haben, mit denen, die
 * ihn nicht bestanden haben. Der Premium-Filter ist bewusst als
 * separate Auswertung geführt (nicht als 9. `ModuleKey`), da er
 * architektonisch ein hartes Gate ist, kein gewichtetes Konsens-Modul.
 */
function computePremiumFilterEfficacy(records: BacktestDatasetRecord[]): PremiumFilterEfficacyStat {
  const decided = records.filter((r) => r.hit !== null);
  const passed = decided.filter((r) => r.premiumFilterPassed);
  const failed = decided.filter((r) => !r.premiumFilterPassed);

  const winsPassed = passed.filter((r) => r.hit === true).length;
  const winsFailed = failed.filter((r) => r.hit === true).length;

  const hitRatePassed = passed.length > 0 ? winsPassed / passed.length : 0;
  const hitRateFailed = failed.length > 0 ? winsFailed / failed.length : 0;

  const roiPassed = passed.length > 0 ? passed.reduce((sum, r) => sum + r.profitLoss, 0) / passed.length : 0;
  const roiFailed = failed.length > 0 ? failed.reduce((sum, r) => sum + r.profitLoss, 0) / failed.length : 0;

  return { gamesPassed: passed.length, gamesFailed: failed.length, hitRatePassed, hitRateFailed, roiPassed, roiFailed };
}

/**
 * Fasst den Modell-Bereich (Modul, Confidence-Bucket oder Wettlinie) mit
 * dem höchsten bzw. niedrigsten ROI in einem lesbaren Satz zusammen —
 * für die "Beste und schlechteste Modellbereiche"-Übersicht im
 * Dashboard. Berücksichtigt nur Bereiche mit ausreichender Datenbasis
 * (mindestens 10 Spiele/Wetten), um Zufallsausreißer zu vermeiden.
 */
function computeBestWorstAreas(params: {
  modulePerformance: ModuleBacktestPerformance[];
  confidenceBuckets: ConfidenceBacktestPerformance[];
  lineBuckets: LineBucketPerformance[];
}): { bestModelArea: string; worstModelArea: string } {
  type Candidate = { label: string; roi: number; sampleSize: number };

  const candidates: Candidate[] = [
    ...params.modulePerformance
      .filter((m) => m.gamesWithData >= 10)
      .map((m) => ({ label: `Modul "${m.label}"`, roi: m.roi, sampleSize: m.gamesWithData })),
    ...params.confidenceBuckets
      .filter((b) => b.decidedBets >= 10)
      .map((b) => ({ label: `Confidence-Bereich "${b.bucket}"`, roi: b.roi, sampleSize: b.decidedBets })),
    ...params.lineBuckets
      .filter((b) => b.decidedBets >= 10)
      .map((b) => ({ label: `Wettlinie ${b.line.toFixed(1)}`, roi: b.roi, sampleSize: b.decidedBets })),
  ];

  if (candidates.length === 0) {
    return {
      bestModelArea: "Noch nicht genügend Daten (mindestens 10 Wetten je Bereich) für eine belastbare Aussage.",
      worstModelArea: "Noch nicht genügend Daten (mindestens 10 Wetten je Bereich) für eine belastbare Aussage.",
    };
  }

  const best = [...candidates].sort((a, b) => b.roi - a.roi)[0];
  const worst = [...candidates].sort((a, b) => a.roi - b.roi)[0];

  return {
    bestModelArea: `${best.label}: ROI ${(best.roi * 100).toFixed(1)} % (${best.sampleSize} Wetten).`,
    worstModelArea: `${worst.label}: ROI ${(worst.roi * 100).toFixed(1)} % (${worst.sampleSize} Wetten).`,
  };
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

  const fairOddsValues = decidedRecords.map((r) => r.fairOdds).filter((v): v is number => v !== null);
  const averageFairOdds = fairOddsValues.length > 0 ? mean(fairOddsValues) : 0;

  const edgeValues = decidedRecords.map((r) => r.edge).filter((v): v is number => v !== null);
  const averageEdge = edgeValues.length > 0 ? mean(edgeValues) : 0;

  const averageExpectedRuns = records.length > 0 ? mean(records.map((r) => r.expectedRuns)) : 0;

  const confidenceBuckets = createConfidencePerformance(results);
  const overUnderPerformance = createPickPerformance(results);
  const lineBuckets = computeLineBucketPerformance(records);
  const marketQualityBuckets = computeMarketQualityPerformance(records);
  const modulePerformance = computeModulePerformance(records);
  const premiumFilterEfficacy = computePremiumFilterEfficacy(records);
  const risk = createRiskStats(results);

  const recommendations = generateCalibrationRecommendations({ modulePerformance, confidenceBuckets, summary, averageEv });
  const { bestModelArea, worstModelArea } = computeBestWorstAreas({ modulePerformance, confidenceBuckets, lineBuckets });

  return {
    records,
    summary,
    averageEv,
    averageConfidence,
    averageFairOdds,
    averageEdge,
    averageExpectedRuns,
    confidenceBuckets,
    overUnderPerformance,
    lineBuckets,
    marketQualityBuckets,
    modulePerformance,
    premiumFilterEfficacy,
    risk,
    recommendations,
    roiTimeSeries: buildRoiTimeSeries(records),
    yieldTimeSeries: buildYieldTimeSeries(records),
    hitRateTimeSeries: buildHitRateTimeSeries(records),
    equityCurve: buildEquityCurve(records),
    confidenceDistribution: buildConfidenceDistribution(records),
    profitByLine: buildProfitByLine(lineBuckets),
    profitByModule: buildProfitByModule(modulePerformance),
    bestModelArea,
    worstModelArea,
  };
}
