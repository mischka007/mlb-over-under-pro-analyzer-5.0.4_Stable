import type { ApiHealthReport, ApiSourceHealth, ApiSourceStatus, DataQualityReport } from "@/types";
import { getRequestMetric } from "@/services/cache/cache";

/**
 * Tag 9 — API Health. Erweitert in Version 6.0 (Paket 5), Schritt 8:
 * `responseTimeMs`/`errorRatePct`/`lastUpdated` stammen jetzt aus der
 * echten, zentral in `cached()` erfassten Instrumentierung (siehe
 * `@/services/cache/cache`, `getRequestMetric()`) — nicht mehr `null`.
 * Bleiben `null`, solange für diese Quelle in der aktuellen Session noch
 * kein echter Netzwerkaufruf stattgefunden hat (z. B. Ballpark: rein
 * statische Referenztabelle ohne Netzwerkzugriff, siehe `ballpark.ts`).
 *
 * `status`/`completenessPct` bewerten weiterhin auf Basis des
 * tatsächlichen Lade-Status (`AvailabilityFlags`) sowie der bereits
 * berechneten Feld-Vollständigkeit (`DataQualityReport`, unverändert
 * wiederverwendet).
 */

export interface ApiHealthAvailability {
  homePitcher: boolean;
  awayPitcher: boolean;
  homeBullpen: boolean;
  awayBullpen: boolean;
  homeOffense: boolean;
  awayOffense: boolean;
  homeForm: boolean;
  awayForm: boolean;
  weather: boolean;
  ballpark: boolean;
  h2h: boolean;
  market: boolean;
  lineups: boolean;
}

function statusFor(loaded: boolean, completenessPct: number): ApiSourceStatus {
  if (!loaded) return "nicht verfügbar";
  if (completenessPct < 60) return "eingeschränkt";
  return "verfügbar";
}

function findAreaScore(dataQuality: DataQualityReport, area: string): number {
  return dataQuality.areas.find((a) => a.area === area)?.qualityScore ?? 0;
}

/**
 * Liest die echte Instrumentierung für einen Cache-Key-Präfix aus
 * (`null`, wenn in dieser Session noch kein Aufruf stattfand — kein
 * erfundener Wert).
 */
function realMetricsFor(cacheKeyPrefix: string | null): { responseTimeMs: number | null; errorRatePct: number | null; lastUpdated: string | null } {
  if (cacheKeyPrefix === null) return { responseTimeMs: null, errorRatePct: null, lastUpdated: null };

  const metric = getRequestMetric(cacheKeyPrefix);
  if (!metric) return { responseTimeMs: null, errorRatePct: null, lastUpdated: null };

  const totalCalls = metric.successCount + metric.errorCount;
  return {
    responseTimeMs: Math.round(metric.lastResponseTimeMs),
    errorRatePct: totalCalls > 0 ? Math.round((metric.errorCount / totalCalls) * 1000) / 10 : null,
    lastUpdated: new Date(metric.lastCallTimestamp).toISOString(),
  };
}

/**
 * Baut den vollständigen API-Health-Report auf. `availability` ist
 * optional (aus `useGameAutoLoad`s `AvailabilityFlags`) — fehlt sie
 * (z. B. bei einer aus dem Verlauf geladenen Analyse ohne Live-Ladezyklus),
 * wird der Lade-Status konservativ aus der Datenqualität abgeleitet statt
 * erfunden.
 */
export function buildApiHealthReport(dataQuality: DataQualityReport, availability?: ApiHealthAvailability): ApiHealthReport {
  const pitcherScore = findAreaScore(dataQuality, "Pitcher");
  const bullpenScore = findAreaScore(dataQuality, "Bullpen");
  const offenseScore = findAreaScore(dataQuality, "Offense");
  const weatherScore = findAreaScore(dataQuality, "Weather");
  const marketScore = findAreaScore(dataQuality, "Market");
  const h2hScore = findAreaScore(dataQuality, "Head-to-Head");
  const ballparkScore = findAreaScore(dataQuality, "Ballpark");
  const lineupsArea = dataQuality.areas.find((a) => a.area === "Lineups");

  const sources: ApiSourceHealth[] = [
    {
      source: "Starting Pitcher",
      status: statusFor(availability ? availability.homePitcher && availability.awayPitcher : pitcherScore > 0, pitcherScore),
      fieldsLoaded: Math.round(pitcherScore / 10),
      fieldsExpected: 10,
      completenessPct: pitcherScore,
      ...realMetricsFor("pitcher-stats"),
    },
    {
      source: "Bullpen",
      status: statusFor(availability ? availability.homeBullpen && availability.awayBullpen : bullpenScore > 0, bullpenScore),
      fieldsLoaded: Math.round(bullpenScore / 10),
      fieldsExpected: 10,
      completenessPct: bullpenScore,
      ...realMetricsFor("bullpen-stats"),
    },
    {
      source: "Offense",
      status: statusFor(availability ? availability.homeOffense && availability.awayOffense : offenseScore > 0, offenseScore),
      fieldsLoaded: Math.round(offenseScore / 10),
      fieldsExpected: 10,
      completenessPct: offenseScore,
      ...realMetricsFor("team-offense"),
    },
    {
      source: "Team Form",
      status: availability ? (availability.homeForm && availability.awayForm ? "verfügbar" : "nicht verfügbar") : "eingeschränkt",
      fieldsLoaded: 0,
      fieldsExpected: 0,
      completenessPct: availability ? (availability.homeForm && availability.awayForm ? 100 : 0) : 0,
      ...realMetricsFor("recent-games"),
    },
    {
      source: "Weather",
      status: statusFor(availability ? availability.weather : weatherScore > 0, weatherScore),
      fieldsLoaded: Math.round(weatherScore / 10),
      fieldsExpected: 10,
      completenessPct: weatherScore,
      ...realMetricsFor("weather"),
    },
    {
      source: "Ballpark",
      status: statusFor(availability ? availability.ballpark : ballparkScore > 0, ballparkScore),
      fieldsLoaded: Math.round(ballparkScore / 10),
      fieldsExpected: 10,
      completenessPct: ballparkScore,
      ...realMetricsFor(null),
    },
    {
      source: "Head-to-Head",
      status: statusFor(availability ? availability.h2h : h2hScore > 0, h2hScore),
      fieldsLoaded: Math.round(h2hScore / 10),
      fieldsExpected: 10,
      completenessPct: h2hScore,
      ...realMetricsFor("h2h"),
    },
    {
      source: "Market",
      status: statusFor(availability ? availability.market : marketScore > 0, marketScore),
      fieldsLoaded: Math.round(marketScore / 10),
      fieldsExpected: 10,
      completenessPct: marketScore,
      ...realMetricsFor("odds"),
    },
  ];

  if (lineupsArea || availability) {
    const completeness = lineupsArea?.qualityScore ?? (availability?.lineups ? 100 : 0);
    sources.push({
      source: "Lineups",
      status: statusFor(availability ? availability.lineups : completeness > 0, completeness),
      fieldsLoaded: completeness > 0 ? 1 : 0,
      fieldsExpected: 1,
      completenessPct: completeness,
      ...realMetricsFor("lineups"),
    });
  }

  const overallCompletenessPct = Math.round(sources.reduce((sum, s) => sum + s.completenessPct, 0) / Math.max(1, sources.length));

  return { sources, overallCompletenessPct };
}
