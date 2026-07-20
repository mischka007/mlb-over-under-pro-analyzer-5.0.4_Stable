import type {
  AlertSeverity,
  LiveMonitoringCategory,
  LiveMonitoringChangeFlags,
  LiveMonitoringSnapshot,
  LiveQualityMetrics,
  NormalizedGameStatus,
  SmartAlert,
} from "@/types";
import { clamp, mean } from "@/utils/math";

/**
 * Version 6.0 — Paket 7A/7B: Live Monitoring Engine.
 *
 * Paket 7A: Snapshot-Aufbau + Änderungserkennung (reine Infrastruktur).
 * Paket 7B (neu, additiv): erzeugt aus erkannten Änderungen echte,
 * dokumentierte `SmartAlert`-Objekte (Zeit, alter/neuer Wert,
 * Auswirkung, Schweregrad) — baut vollständig auf der bestehenden
 * Snapshot-/Vergleichslogik aus Paket 7A auf, keine neue
 * Erkennungslogik dupliziert.
 *
 * Alle Werte stammen ausschließlich aus bereits an anderer Stelle im
 * Projekt real berechneten Daten (Wetter, Markt/Odds inkl. Steam-Move/
 * Reverse-Line-Movement aus `marketIntelligenceEngine.ts` Paket 4,
 * Lineups, Spielstatus, Data Quality Score, sowie Pick/Confidence aus
 * `computeFullAnalysis()`).
 */

const WEATHER_TEMP_CHANGE_THRESHOLD_C = 3;
const WEATHER_WIND_DEGREES_CHANGE_THRESHOLD = 45;
const WEATHER_WIND_CHANGE_THRESHOLD_MPH = 5;
const ODDS_LINE_CHANGE_THRESHOLD = 0.15;
const DATA_QUALITY_CHANGE_THRESHOLD = 10;
/** Version 6.0 (Paket 7B) */
const MARKET_SCORE_CHANGE_THRESHOLD = 10;
const CONFIDENCE_CHANGE_THRESHOLD_PCT = 5;

/** Kürzester Winkel-Abstand zwischen zwei Grad-Werten (0–360), korrekt über die 0°/360°-Grenze hinweg (z. B. 350° und 10° sind nur 20° auseinander, nicht 340°). */
function circularDegreesDifference(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Baut einen Snapshot der überwachten Werte auf — reine Zusammenstellung bereits vorhandener Werte, keine eigene Berechnung. */
export function buildLiveMonitoringSnapshot(params: {
  homeProbablePitcherId: number | null;
  awayProbablePitcherId: number | null;
  lineupsConfirmed: boolean;
  weatherTemperatureC: number | null;
  weatherWindSpeedMph: number | null;
  weatherWindDegrees: number | null;
  currentLine: number | null;
  marketScore: number | null;
  gameStatus: NormalizedGameStatus;
  dataQualityScore: number;
  steamMoveDetected: boolean;
  reverseLineMovementDetected: boolean;
  predictionPick: "over" | "under" | null;
  confidencePct: number | null;
}): LiveMonitoringSnapshot {
  return { timestamp: Date.now(), ...params };
}

const EMPTY_CHANGE_FLAGS: LiveMonitoringChangeFlags = {
  pitcherChanged: false,
  lineupsChanged: false,
  weatherChanged: false,
  oddsChanged: false,
  statusChanged: false,
  dataQualityChanged: false,
  steamMoveChanged: false,
  reverseLineMovementChanged: false,
  predictionChanged: false,
  confidenceChanged: false,
  marketScoreChanged: false,
  changedCategories: [],
  hasAnyChange: false,
};

/**
 * Vergleicht zwei Snapshots und erkennt, WELCHE Bereiche sich geändert
 * haben. `previous === null` (erster Check nach Aktivierung) liefert
 * bewusst "keine Änderung" — es gibt noch keinen Referenzwert.
 */
export function detectChangeFlags(previous: LiveMonitoringSnapshot | null, current: LiveMonitoringSnapshot): LiveMonitoringChangeFlags {
  if (previous === null) return EMPTY_CHANGE_FLAGS;

  const pitcherChanged = previous.homeProbablePitcherId !== current.homeProbablePitcherId || previous.awayProbablePitcherId !== current.awayProbablePitcherId;

  const lineupsChanged = previous.lineupsConfirmed !== current.lineupsConfirmed;

  const weatherChanged =
    (previous.weatherTemperatureC !== null &&
      current.weatherTemperatureC !== null &&
      Math.abs(previous.weatherTemperatureC - current.weatherTemperatureC) >= WEATHER_TEMP_CHANGE_THRESHOLD_C) ||
    (previous.weatherWindSpeedMph !== null &&
      current.weatherWindSpeedMph !== null &&
      Math.abs(previous.weatherWindSpeedMph - current.weatherWindSpeedMph) >= WEATHER_WIND_CHANGE_THRESHOLD_MPH) ||
    (previous.weatherWindDegrees !== null &&
      current.weatherWindDegrees !== null &&
      circularDegreesDifference(previous.weatherWindDegrees, current.weatherWindDegrees) >= WEATHER_WIND_DEGREES_CHANGE_THRESHOLD);

  const oddsChanged =
    previous.currentLine !== null && current.currentLine !== null && Math.abs(previous.currentLine - current.currentLine) >= ODDS_LINE_CHANGE_THRESHOLD;

  const statusChanged = previous.gameStatus !== current.gameStatus;

  const dataQualityChanged = Math.abs(previous.dataQualityScore - current.dataQualityScore) >= DATA_QUALITY_CHANGE_THRESHOLD;

  // Version 6.0 (Paket 7B)
  const steamMoveChanged = previous.steamMoveDetected !== current.steamMoveDetected;
  const reverseLineMovementChanged = previous.reverseLineMovementDetected !== current.reverseLineMovementDetected;
  const predictionChanged = previous.predictionPick !== current.predictionPick;
  const confidenceChanged =
    previous.confidencePct !== null &&
    current.confidencePct !== null &&
    Math.abs(previous.confidencePct - current.confidencePct) >= CONFIDENCE_CHANGE_THRESHOLD_PCT;
  const marketScoreChanged =
    previous.marketScore !== null && current.marketScore !== null && Math.abs(previous.marketScore - current.marketScore) >= MARKET_SCORE_CHANGE_THRESHOLD;

  const changedCategories: LiveMonitoringCategory[] = [];
  if (pitcherChanged) changedCategories.push("pitcher");
  if (lineupsChanged) changedCategories.push("lineups");
  if (weatherChanged) changedCategories.push("weather");
  if (oddsChanged) changedCategories.push("odds");
  if (statusChanged) changedCategories.push("status");
  if (dataQualityChanged) changedCategories.push("dataQuality");
  if (steamMoveChanged) changedCategories.push("steamMove");
  if (reverseLineMovementChanged) changedCategories.push("reverseLineMovement");
  if (predictionChanged) changedCategories.push("prediction");
  if (confidenceChanged) changedCategories.push("confidence");
  if (marketScoreChanged) changedCategories.push("marketScoreValue");

  return {
    pitcherChanged,
    lineupsChanged,
    weatherChanged,
    oddsChanged,
    statusChanged,
    dataQualityChanged,
    steamMoveChanged,
    reverseLineMovementChanged,
    predictionChanged,
    confidenceChanged,
    marketScoreChanged,
    changedCategories,
    hasAnyChange: changedCategories.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Version 6.0 (Paket 7B): Smart Alerts — erzeugt aus erkannten
// Änderungen dokumentierte Alert-Objekte mit altem/neuem Wert,
// Auswirkung und Schweregrad.
// ---------------------------------------------------------------------------

let alertSequence = 0;
function nextAlertId(): string {
  alertSequence += 1;
  return `alert-${Date.now()}-${alertSequence}`;
}

function pitcherLabel(id: number | null): string {
  return id !== null ? `Pitcher-ID ${id}` : "unbekannt";
}

/**
 * Version 6.0 (Paket 7C) — "Alert Confidence" für schwellenwertbasierte
 * Änderungen: bei exakt der Schwelle 50, bei doppelter Schwelle (oder
 * mehr) 100 — je deutlicher über der Erkennungsschwelle, desto sicherer
 * ist die Änderung real und nicht nur knapp über der Grenze.
 */
function magnitudeConfidence(magnitude: number, threshold: number): number {
  if (threshold <= 0) return 100;
  const ratio = magnitude / threshold;
  return Math.round(Math.min(100, 50 + (ratio - 1) * 50));
}

/**
 * Erzeugt aus zwei Snapshots + den bereits erkannten Change-Flags
 * (Paket 7A, `detectChangeFlags()`, unverändert wiederverwendet) die
 * vollständige Liste dokumentierter Smart Alerts. `previous === null`
 * liefert `[]` (kein Referenzwert für einen Vergleich vorhanden).
 */
export function buildSmartAlerts(previous: LiveMonitoringSnapshot | null, current: LiveMonitoringSnapshot, flags: LiveMonitoringChangeFlags): SmartAlert[] {
  if (previous === null || !flags.hasAnyChange) return [];

  const alerts: SmartAlert[] = [];
  const timestamp = current.timestamp;

  if (flags.pitcherChanged) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "pitcher",
      description: "Starting Pitcher geändert",
      oldValue: `Heim: ${pitcherLabel(previous.homeProbablePitcherId)} · Auswärts: ${pitcherLabel(previous.awayProbablePitcherId)}`,
      newValue: `Heim: ${pitcherLabel(current.homeProbablePitcherId)} · Auswärts: ${pitcherLabel(current.awayProbablePitcherId)}`,
      impact: "Pitcher-Modul, Bullpen-Belastung und Prediction Engine sollten neu geprüft werden — ein Starterwechsel verändert die Prognosegrundlage erheblich.",
      severity: "kritisch",
      confidencePct: 100,
    });
  }

  if (flags.lineupsChanged) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "lineup",
      description: "Lineup-Bestätigungsstatus geändert",
      oldValue: previous.lineupsConfirmed ? "bestätigt" : "nicht bestätigt",
      newValue: current.lineupsConfirmed ? "bestätigt" : "nicht bestätigt",
      impact: current.lineupsConfirmed
        ? "Lineups sind jetzt bestätigt — Lineup Quality Score und Data Quality steigen."
        : "Lineups sind nicht mehr als bestätigt verfügbar — Prognose mit Vorsicht behandeln.",
      severity: current.lineupsConfirmed ? "niedrig" : "mittel",
      confidencePct: 100,
    });
  }

  if (flags.weatherChanged) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "weather",
      description: "Wetterbedingungen geändert",
      oldValue: `${previous.weatherTemperatureC?.toFixed(0) ?? "–"}°C, ${previous.weatherWindSpeedMph?.toFixed(0) ?? "–"}mph`,
      newValue: `${current.weatherTemperatureC?.toFixed(0) ?? "–"}°C, ${current.weatherWindSpeedMph?.toFixed(0) ?? "–"}mph`,
      impact: "Weather-Modul und Over/Under-Einschätzung sollten neu geprüft werden.",
      severity: "mittel",
      confidencePct: previous.weatherTemperatureC !== null && current.weatherTemperatureC !== null
        ? magnitudeConfidence(Math.abs(previous.weatherTemperatureC - current.weatherTemperatureC), WEATHER_TEMP_CHANGE_THRESHOLD_C)
        : 100,
    });
  }

  if (flags.oddsChanged) {
    const movement = current.currentLine !== null && previous.currentLine !== null ? current.currentLine - previous.currentLine : 0;
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "odds",
      description: "Wettlinie bewegt",
      oldValue: previous.currentLine?.toFixed(1) ?? "–",
      newValue: current.currentLine?.toFixed(1) ?? "–",
      impact: `Line Movement ${movement >= 0 ? "+" : ""}${movement.toFixed(2)} — Market Intelligence sollte neu geprüft werden.`,
      severity: Math.abs(movement) >= 0.5 ? "hoch" : "mittel",
      confidencePct: magnitudeConfidence(Math.abs(movement), ODDS_LINE_CHANGE_THRESHOLD),
    });
  }

  if (flags.steamMoveChanged && current.steamMoveDetected) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "steamMove",
      description: "Steam Move erkannt",
      oldValue: "nicht erkannt",
      newValue: "erkannt",
      impact: "Schnelle, konsensgetragene Marktbewegung — deutet auf koordinierte, informierte Bewegung hin.",
      severity: "hoch",
      confidencePct: 100,
    });
  }

  if (flags.reverseLineMovementChanged && current.reverseLineMovementDetected) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "reverseLineMovement",
      description: "Reverse Line Movement erkannt",
      oldValue: "nicht erkannt",
      newValue: "erkannt",
      impact: "Die Linie bewegt sich gegen eine zuvor stabile Markterwartung — möglicher später, informierter Geldfluss.",
      severity: "hoch",
      confidencePct: 100,
    });
  }

  if (flags.predictionChanged) {
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "prediction",
      description: "Prediction (Pick) geändert",
      oldValue: previous.predictionPick ?? "kein Pick",
      newValue: current.predictionPick ?? "kein Pick",
      impact: "Der Modell-Pick hat sich gedreht — eine zuvor gespeicherte oder geplante Wette sollte überprüft werden.",
      severity: "kritisch",
      confidencePct: 100,
    });
  }

  if (flags.confidenceChanged) {
    const delta = current.confidencePct !== null && previous.confidencePct !== null ? current.confidencePct - previous.confidencePct : 0;
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "confidence",
      description: "Confidence geändert",
      oldValue: previous.confidencePct !== null ? `${previous.confidencePct.toFixed(1)}%` : "–",
      newValue: current.confidencePct !== null ? `${current.confidencePct.toFixed(1)}%` : "–",
      impact: `Confidence ${delta >= 0 ? "gestiegen" : "gesunken"} um ${Math.abs(delta).toFixed(1)} Prozentpunkte.`,
      severity: Math.abs(delta) >= 15 ? "hoch" : "mittel",
      confidencePct: magnitudeConfidence(Math.abs(delta), CONFIDENCE_CHANGE_THRESHOLD_PCT),
    });
  }

  if (flags.marketScoreChanged) {
    const delta = current.marketScore !== null && previous.marketScore !== null ? current.marketScore - previous.marketScore : 0;
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "marketScore",
      description: "Market Score geändert",
      oldValue: previous.marketScore?.toFixed(0) ?? "–",
      newValue: current.marketScore?.toFixed(0) ?? "–",
      impact: `Marktqualität ${delta >= 0 ? "gestiegen" : "gesunken"} — Markt-Einfluss auf die Prognose passt sich entsprechend an.`,
      severity: "mittel",
      confidencePct: magnitudeConfidence(Math.abs(delta), MARKET_SCORE_CHANGE_THRESHOLD),
    });
  }

  if (flags.dataQualityChanged) {
    const delta = current.dataQualityScore - previous.dataQualityScore;
    const severity: AlertSeverity = delta < 0 ? (Math.abs(delta) >= 20 ? "hoch" : "mittel") : "niedrig";
    alerts.push({
      id: nextAlertId(),
      timestamp,
      category: "dataQuality",
      description: "Data Quality geändert",
      oldValue: previous.dataQualityScore.toFixed(0),
      newValue: current.dataQualityScore.toFixed(0),
      impact:
        delta < 0
          ? "Datenqualität gesunken — die Confidence-Anpassung (Paket 5) dämpft die Prognose entsprechend stärker."
          : "Datenqualität gestiegen — die Prognosegrundlage ist solider geworden.",
      severity,
      confidencePct: magnitudeConfidence(Math.abs(delta), DATA_QUALITY_CHANGE_THRESHOLD),
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Version 6.0 (Paket 7C): Live-Qualitätskennzahlen — Live Stability,
// Update Confidence, Prediction Reliability (live), Alert Confidence.
// Bewusst DISTINKT von `PredictionQualityReport` (Paket 6): dort wird
// die Modellqualität über viele vergangene Backtests bewertet, hier
// die Verlässlichkeit der aktuellen Live-Überwachung EINES laufenden
// Spiels — keine Dopplung, andere Datengrundlage.
// ---------------------------------------------------------------------------

/** Ab wie vielen Minuten seit dem letzten erfolgreichen Check die Aktualität als "veraltet" gilt. */
const STALE_UPDATE_THRESHOLD_MINUTES = 15;

/**
 * Berechnet die Live-Qualitätskennzahlen aus dem tatsächlichen Verlauf
 * der durchgeführten Checks (Paket 7A) und den daraus erzeugten Smart
 * Alerts (Paket 7B) — keine neue Datenquelle, nur eine andere
 * Aggregation bereits vorhandener, real erfasster Werte.
 */
export function computeLiveQualityMetrics(params: {
  checkHistory: { timestamp: number; hadChange: boolean }[];
  alerts: SmartAlert[];
  apiStatusAllHealthy: boolean;
  lastCheckedAt: number | null;
}): LiveQualityMetrics {
  const checksPerformed = params.checkHistory.length;
  const changesDetectedCount = params.checkHistory.filter((c) => c.hadChange).length;

  // Live Stability: je seltener sich relativ zu den durchgeführten
  // Checks tatsächlich etwas geändert hat, desto stabiler.
  const changeRate = checksPerformed > 0 ? changesDetectedCount / checksPerformed : 0;
  const liveStability = Math.round(clamp(100 - changeRate * 100, 0, 100));

  // Update Confidence: Aktualität der letzten Prüfung + Gesundheit der
  // überwachten APIs.
  const minutesSinceLastCheck = params.lastCheckedAt !== null ? (Date.now() - params.lastCheckedAt) / 60000 : null;
  const recencyFactor =
    minutesSinceLastCheck === null ? 0 : clamp(100 - (minutesSinceLastCheck / STALE_UPDATE_THRESHOLD_MINUTES) * 100, 0, 100);
  const apiHealthFactor = params.apiStatusAllHealthy ? 100 : 60;
  const updateConfidence = Math.round(clamp(recencyFactor * 0.6 + apiHealthFactor * 0.4, 0, 100));

  // Alert Confidence: Mittelwert der pro-Alert berechneten Konfidenz.
  const averageAlertConfidence = params.alerts.length > 0 ? Math.round(mean(params.alerts.map((a) => a.confidencePct))) : 100;

  // Kritische Alerts drücken die Live-Verlässlichkeit zusätzlich —
  // bewusst begrenzt (max. -30 Punkte), keine künstliche Verstärkung.
  const criticalAlertCount = params.alerts.filter((a) => a.severity === "kritisch").length;
  const criticalPenalty = clamp(criticalAlertCount * 10, 0, 30);

  const livePredictionReliability = Math.round(
    clamp(liveStability * 0.4 + updateConfidence * 0.35 + averageAlertConfidence * 0.25 - criticalPenalty, 0, 100)
  );

  return { liveStability, updateConfidence, livePredictionReliability, averageAlertConfidence, checksPerformed, changesDetectedCount };
}
