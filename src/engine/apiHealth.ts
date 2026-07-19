import type { ApiHealthReport, ApiSourceHealth, ApiSourceStatus, DataQualityReport } from "@/types";

/**
 * Tag 9 — API Health.
 *
 * Bewertet den Status je Datenquelle. `status`/`completenessPct` beruhen
 * auf echten, bereits vorhandenen Signalen: dem tatsächlichen Lade-
 * Status (`AvailabilityFlags` aus `useGameAutoLoad`) sowie der bereits
 * berechneten Feld-Vollständigkeit (`DataQualityReport`, Schritt 3,
 * unverändert wiederverwendet statt neu berechnet).
 *
 * `responseTimeMs`/`errorRatePct`/`lastUpdated` sind bewusst `null`: das
 * Projekt hat aktuell keine Instrumentierung, die reale Antwortzeiten
 * oder Fehlerraten je Request aufzeichnet (das nachzurüsten würde jeden
 * bestehenden Fetch-Aufruf in allen `services/api/*`-Dateien verändern
 * — eine Architekturänderung, die diese Aufgabe ausdrücklich
 * ausschließt). Erfundene Werte würden gegen das Transparenz-Gebot
 * verstoßen, daher konsequent `null` statt einer Zahl.
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
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Bullpen",
      status: statusFor(availability ? availability.homeBullpen && availability.awayBullpen : bullpenScore > 0, bullpenScore),
      fieldsLoaded: Math.round(bullpenScore / 10),
      fieldsExpected: 10,
      completenessPct: bullpenScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Offense",
      status: statusFor(availability ? availability.homeOffense && availability.awayOffense : offenseScore > 0, offenseScore),
      fieldsLoaded: Math.round(offenseScore / 10),
      fieldsExpected: 10,
      completenessPct: offenseScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Team Form",
      status: availability ? (availability.homeForm && availability.awayForm ? "verfügbar" : "nicht verfügbar") : "eingeschränkt",
      fieldsLoaded: 0,
      fieldsExpected: 0,
      completenessPct: availability ? (availability.homeForm && availability.awayForm ? 100 : 0) : 0,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Weather",
      status: statusFor(availability ? availability.weather : weatherScore > 0, weatherScore),
      fieldsLoaded: Math.round(weatherScore / 10),
      fieldsExpected: 10,
      completenessPct: weatherScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Ballpark",
      status: statusFor(availability ? availability.ballpark : ballparkScore > 0, ballparkScore),
      fieldsLoaded: Math.round(ballparkScore / 10),
      fieldsExpected: 10,
      completenessPct: ballparkScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Head-to-Head",
      status: statusFor(availability ? availability.h2h : h2hScore > 0, h2hScore),
      fieldsLoaded: Math.round(h2hScore / 10),
      fieldsExpected: 10,
      completenessPct: h2hScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    },
    {
      source: "Market",
      status: statusFor(availability ? availability.market : marketScore > 0, marketScore),
      fieldsLoaded: Math.round(marketScore / 10),
      fieldsExpected: 10,
      completenessPct: marketScore,
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
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
      responseTimeMs: null,
      errorRatePct: null,
      lastUpdated: null,
    });
  }

  const overallCompletenessPct = Math.round(sources.reduce((sum, s) => sum + s.completenessPct, 0) / Math.max(1, sources.length));

  return { sources, overallCompletenessPct };
}
