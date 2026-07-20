import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GameCardSummary,
  LiveMonitoringApiStatus,
  LiveMonitoringChangeFlags,
  LiveMonitoringSnapshot,
  LiveQualityMetrics,
  NormalizedGameStatus,
  SmartAlert,
} from "@/types";
import { buildLiveMonitoringSnapshot, buildSmartAlerts, computeLiveQualityMetrics, detectChangeFlags } from "@/engine/liveMonitoringEngine";
import { normalizeGameStatusFromRaw } from "@/engine/gameInfoEngine";
import { fetchGamesForDate } from "@/services/api/games";
import { fetchLineups } from "@/services/api/lineups";
import { fetchMarketSnapshot } from "@/services/api/market";
import { fetchWeatherForCoordinates } from "@/services/api/weather";
import { getBallparkCoordinates } from "@/services/api/ballpark";
import { getRequestMetric } from "@/services/cache/cache";

/**
 * Version 6.0 — Paket 7A/7B/7C: Live Monitoring Hook.
 *
 * Paket 7A: Polling-Infrastruktur. Paket 7B: Smart Alerts + Change
 * History. Paket 7C (neu, additiv): automatische, gezielte Re-Analyse
 * — bei erkannter Wetter-/Odds-/Market-Score-Änderung werden
 * AUSSCHLIESSLICH die betroffenen `AnalyzerState`-Felder über die
 * bereits bestehenden `updateWeather()`/`updateMarket()`-Setter
 * (`useAnalyzerState`, unverändert) aktualisiert — das löst die
 * bereits bestehende, reaktive `computeFullAnalysis()`-Neuberechnung
 * in `Dashboard.tsx` aus (kein manueller zweiter Berechnungspfad, keine
 * Architekturänderung). "Nur betroffene Module" gilt auf Datenebene:
 * ein Wetter-Update berührt nie die Markt-Felder und umgekehrt.
 *
 * Pitcher-/Lineup-Änderungen werden weiterhin erkannt und als Alert
 * dokumentiert, lösen aber bewusst KEIN automatisches Update aus — ein
 * Pitcherwechsel erfordert das Nachladen vollständiger Pitcher-/
 * Bullpen-Statistiken (mehrere kaskadierende Abrufe), was über den
 * Rahmen einer gezielten Einzelfeld-Aktualisierung hinausginge.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const MAX_HISTORY_ENTRIES = 100;
/** Begrenzt den Check-Verlauf für Live Stability (Paket 7C) auf ein sinnvolles Fenster. */
const MAX_CHECK_HISTORY_ENTRIES = 50;

const MONITORED_API_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: "games", label: "MLB Stats API (Spielplan)" },
  { prefix: "lineups", label: "MLB Stats API (Lineups)" },
  { prefix: "odds", label: "The Odds API" },
  { prefix: "weather", label: "OpenWeather API" },
];

function readApiStatus(): LiveMonitoringApiStatus[] {
  return MONITORED_API_PREFIXES.map(({ prefix, label }) => {
    const metric = getRequestMetric(prefix);
    if (!metric) return { source: label, status: "nicht verfügbar" as const, lastCheckedAt: null };
    return {
      source: label,
      status: metric.lastSuccess ? ("verfügbar" as const) : ("eingeschränkt" as const),
      lastCheckedAt: metric.lastCallTimestamp,
    };
  });
}

export interface UseLiveMonitoringResult {
  isActive: boolean;
  toggle: () => void;
  lastCheckedAt: number | null;
  nextCheckAt: number | null;
  checkIntervalMs: number;
  apiStatus: LiveMonitoringApiStatus[];
  lastChangeFlags: LiveMonitoringChangeFlags | null;
  changeHistory: SmartAlert[];
  /** Version 6.0 (Paket 7C): Live Stability, Update Confidence, Prediction Reliability (live), Alert Confidence. */
  liveQuality: LiveQualityMetrics;
}

/**
 * Überwacht ein geladenes Spiel auf Änderungen bei Starting Pitcher,
 * Lineups, Wetter, Odds/Market Score, Steam Move, Reverse Line
 * Movement, Prediction, Confidence, Data Quality und Spielstatus.
 * `dataQualityScore`/`predictionPick`/`confidencePct` werden vom
 * Aufrufer übergeben (bereits von `computeFullAnalysis()`/
 * `@/engine/dataQualityEngine` berechnet). `onWeatherChange`/
 * `onMarketChange` sind optional (Paket 7C): werden sie übergeben,
 * löst dieser Hook bei einer erkannten, relevanten Änderung die
 * gezielte State-Aktualisierung aus.
 */
export function useLiveMonitoring(params: {
  game: GameCardSummary | null;
  dataQualityScore: number | null;
  predictionPick: "over" | "under" | null;
  confidencePct: number | null;
  onWeatherChange?: (weather: { temperatureC: string; windSpeedMph: string }) => void;
  onMarketChange?: (market: { currentLine: string; marketScore: string }) => void;
}): UseLiveMonitoringResult {
  const [isActive, setIsActive] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [nextCheckAt, setNextCheckAt] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<LiveMonitoringApiStatus[]>([]);
  const [lastChangeFlags, setLastChangeFlags] = useState<LiveMonitoringChangeFlags | null>(null);
  const [changeHistory, setChangeHistory] = useState<SmartAlert[]>([]);
  const [checkHistory, setCheckHistory] = useState<{ timestamp: number; hadChange: boolean }[]>([]);

  const previousSnapshotRef = useRef<LiveMonitoringSnapshot | null>(null);
  // Aktuellste Werte/Callbacks per Ref statt nur als Closure-Abhängigkeit
  // — vermeidet, dass `runCheck()` bei jeder Analyse-Neuberechnung neu
  // erzeugt und der Intervall-Timer neu gestartet werden muss.
  const latestParamsRef = useRef(params);
  latestParamsRef.current = params;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Neues Spiel geladen → vorherigen Referenz-Snapshot und Historie
  // verwerfen (ein Snapshot/Historie von Spiel A darf nie mit Spiel B
  // vermischt werden).
  useEffect(() => {
    previousSnapshotRef.current = null;
    setLastCheckedAt(null);
    setNextCheckAt(null);
    setLastChangeFlags(null);
    setChangeHistory([]);
    setCheckHistory([]);
  }, [params.game?.gamePk]);

  const runCheck = useCallback(async () => {
    const game = latestParamsRef.current.game;
    if (!game) return;

    // Nur die tatsächlich überwachten, bereits bestehenden Endpunkte
    // erneut abfragen — dank Cache (5–10 Min. TTL, Paket 4/5) kein
    // zusätzlicher Netzwerkaufruf, solange die Daten noch frisch sind.
    const [schedule, lineups, market] = await Promise.all([
      fetchGamesForDate(new Date(`${game.officialDate}T12:00:00`)).catch(() => []),
      fetchLineups(game.gamePk).catch(() => null),
      fetchMarketSnapshot(game.homeTeamName, game.awayTeamName).catch(() => null),
    ]);

    const scheduleGame = schedule.find((g) => g.gamePk === game.gamePk) ?? null;

    let weatherTemperatureC: number | null = null;
    let weatherWindSpeedMph: number | null = null;
    let weatherWindDegrees: number | null = null;
    const coordinates = getBallparkCoordinates(game.venueName);
    if (coordinates) {
      const weather = await fetchWeatherForCoordinates(coordinates.lat, coordinates.lon).catch(() => null);
      if (weather) {
        weatherTemperatureC = weather.temperatureC;
        weatherWindSpeedMph = weather.windSpeedMph;
        weatherWindDegrees = weather.windDegrees;
      }
    }

    const gameStatus: NormalizedGameStatus = scheduleGame ? normalizeGameStatusFromRaw(scheduleGame) : "Unbekannt";

    const snapshot = buildLiveMonitoringSnapshot({
      homeProbablePitcherId: scheduleGame?.homeProbablePitcherId ?? game.homeProbablePitcherId,
      awayProbablePitcherId: scheduleGame?.awayProbablePitcherId ?? game.awayProbablePitcherId,
      lineupsConfirmed: !!lineups && lineups.home.length > 0 && lineups.away.length > 0,
      weatherTemperatureC,
      weatherWindSpeedMph,
      weatherWindDegrees,
      currentLine: market?.currentLine ?? null,
      marketScore: market?.marketIntelligence?.marketScore ?? null,
      gameStatus,
      dataQualityScore: latestParamsRef.current.dataQualityScore ?? 0,
      steamMoveDetected: market?.marketIntelligence?.steamMoveDetected ?? false,
      reverseLineMovementDetected: market?.marketIntelligence?.reverseLineMovementDetected ?? false,
      predictionPick: latestParamsRef.current.predictionPick,
      confidencePct: latestParamsRef.current.confidencePct,
    });

    const previous = previousSnapshotRef.current;
    const flags = detectChangeFlags(previous, snapshot);
    const newAlerts = buildSmartAlerts(previous, snapshot, flags);
    previousSnapshotRef.current = snapshot;

    // Version 6.0 (Paket 7C): gezielte Re-Analyse — nur die tatsächlich
    // betroffenen Felder werden aktualisiert, jeweils über den bereits
    // bestehenden Setter. Löst die bestehende reaktive Neuberechnung in
    // Dashboard.tsx aus, ohne einen zweiten Berechnungspfad einzuführen.
    if (flags.weatherChanged && weatherTemperatureC !== null && weatherWindSpeedMph !== null) {
      latestParamsRef.current.onWeatherChange?.({
        temperatureC: String(Math.round(weatherTemperatureC)),
        windSpeedMph: String(Math.round(weatherWindSpeedMph)),
      });
    }
    if ((flags.oddsChanged || flags.marketScoreChanged) && market) {
      latestParamsRef.current.onMarketChange?.({
        currentLine: market.currentLine != null ? String(market.currentLine) : "",
        marketScore: market.marketIntelligence ? String(market.marketIntelligence.marketScore) : "",
      });
    }

    if (!isMountedRef.current) return;
    setLastChangeFlags(flags);
    if (newAlerts.length > 0) {
      setChangeHistory((prevHistory) => [...newAlerts, ...prevHistory].slice(0, MAX_HISTORY_ENTRIES));
    }
    setCheckHistory((prevChecks) => [...prevChecks, { timestamp: snapshot.timestamp, hadChange: flags.hasAnyChange }].slice(-MAX_CHECK_HISTORY_ENTRIES));
    setLastCheckedAt(snapshot.timestamp);
    setNextCheckAt(snapshot.timestamp + CHECK_INTERVAL_MS);
    setApiStatus(readApiStatus());
  }, []);

  const toggle = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isActive || !params.game) return;

    // Sofortiger erster Check beim Aktivieren, danach im festen Intervall.
    void runCheck();
    const interval = window.setInterval(() => {
      void runCheck();
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, params.game?.gamePk, runCheck]);

  const liveQuality = computeLiveQualityMetrics({
    checkHistory,
    alerts: changeHistory,
    apiStatusAllHealthy: apiStatus.length > 0 && apiStatus.every((s) => s.status === "verfügbar"),
    lastCheckedAt,
  });

  return {
    isActive,
    toggle,
    lastCheckedAt,
    nextCheckAt,
    checkIntervalMs: CHECK_INTERVAL_MS,
    apiStatus,
    lastChangeFlags,
    changeHistory,
    liveQuality,
  };
}
