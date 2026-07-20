import type {
  ClosingLineValueResult,
  ClvOutcome,
  LineHistorySnapshot,
  LineMovementDirection,
  MarketIntelligenceResult,
  MarketMovementSpeed,
} from "@/types";
import type { OddsSnapshot } from "@/services/api/odds";
import { clamp, mean, stdDev } from "@/utils/math";

/**
 * Version 6.0 — Paket 4: Market Intelligence Engine.
 *
 * Berechnet alle in Schritt 2 geforderten Kennzahlen ausschließlich aus
 * real beobachteten Daten:
 *
 *  - Der eigenen, dauerhaft gespeicherten Linien-Historie je Matchup
 *    (`recordLineSnapshot`/`getLineHistory` in `@/services/api/odds`,
 *    Paket 4) — echte, zeitgestempelte Beobachtungen über die Zeit.
 *  - Den aktuell von MEHREREN Buchmachern gleichzeitig gelieferten
 *    Quoten (`OddsSnapshot[]`, bereits bestehend) — echte
 *    Buchmacher-Konsens-/Streuungs-Information.
 *
 * WICHTIG zu Sharp Money / Reverse Line Movement / Steam Move: echte
 * Public-Betting-Prozentsätze erfordern einen kostenpflichtigen
 * Datenfeed (bereits an anderer Stelle im Projekt dokumentiert,
 * `MarketSnapshot.publicOverPct` bleibt bewusst `null`). Diese drei
 * Kennzahlen sind daher begründete, aus echten Bewegungs-/Konsens-Daten
 * abgeleitete Heuristiken — keine erfundenen Werte, aber auch kein
 * Ersatz für eine echte Einsatzverteilungs-Analyse. Das ist an jeder
 * Stelle unten dokumentiert.
 */

const STABLE_MOVEMENT_THRESHOLD = 0.15;
const STRONG_MOVEMENT_THRESHOLD = 0.5;
const MOVEMENT_STRENGTH_SCALE = 1.5;

const STEAM_MOVE_MIN_MAGNITUDE = 0.3;
const STEAM_MOVE_MAX_HOURS = 2;

const LATE_SHARP_ACTION_MAX_HOURS_BEFORE_NOW = 3;

/** Konsens-Schwelle (Streuung der aktuellen Buchmacher-Linien), unterhalb derer der Markt als "einig" gilt. */
const HIGH_CONSENSUS_MAX_STDDEV = 0.15;

function computeMovementDirection(movement: number | null): LineMovementDirection {
  if (movement === null || Math.abs(movement) < STABLE_MOVEMENT_THRESHOLD) return "stable";
  return movement > 0 ? "over" : "under";
}

function computeMovementSpeed(movement: number | null, history: LineHistorySnapshot[]): { speed: MarketMovementSpeed; perHour: number | null } {
  if (movement === null || Math.abs(movement) < STABLE_MOVEMENT_THRESHOLD || history.length < 2) {
    return { speed: "keine Bewegung", perHour: null };
  }

  const first = history[0];
  const last = history[history.length - 1];
  const hoursElapsed = (last.timestamp - first.timestamp) / (1000 * 60 * 60);

  if (hoursElapsed <= 0) return { speed: "keine Bewegung", perHour: null };

  const perHour = Math.abs(movement) / hoursElapsed;

  const speed: MarketMovementSpeed = perHour >= 0.3 ? "schnell" : perHour >= 0.08 ? "moderat" : "langsam";
  return { speed, perHour };
}

/**
 * Marktkonsens (Schritt 2/3): wie einig sich die AKTUELL abgefragten
 * Buchmacher bei der Linie sind — aus der echten Streuung der
 * gleichzeitig gelieferten `OddsSnapshot[]`, nicht geschätzt.
 */
function computeMarketConsensus(currentSnapshots: OddsSnapshot[]): number {
  if (currentSnapshots.length < 2) return 100;
  const spread = stdDev(currentSnapshots.map((s) => s.line));
  return clamp(100 - (spread / HIGH_CONSENSUS_MAX_STDDEV) * 100, 0, 100);
}

/**
 * Marktvolatilität (Schritt 2): kombiniert die Streuung der Linie über
 * die Zeit (Historie) mit der aktuellen Streuung über Buchmacher hinweg.
 */
function computeMarketVolatility(history: LineHistorySnapshot[], currentSnapshots: OddsSnapshot[]): number {
  const historicalSpread = history.length >= 2 ? stdDev(history.map((h) => h.line)) : 0;
  const currentSpread = currentSnapshots.length >= 2 ? stdDev(currentSnapshots.map((s) => s.line)) : 0;
  const combined = historicalSpread * 0.6 + currentSpread * 0.4;
  return clamp((combined / 0.4) * 100, 0, 100);
}

/**
 * Schritt 4 — Sharp/Public/Reverse/Steam-Heuristiken. Ausschließlich aus
 * Bewegungsstärke, -geschwindigkeit und Buchmacher-Konsens abgeleitet
 * (siehe Modul-Dokumentation oben) — keine echten Public-Betting-Daten
 * verfügbar, daher als Heuristik gekennzeichnet.
 */
function detectMarketBehavior(params: {
  movement: number | null;
  movementSpeed: MarketMovementSpeed;
  movementSpeedPerHour: number | null;
  consensusPct: number;
  history: LineHistorySnapshot[];
}): {
  sharpMovementDetected: boolean;
  publicMovementDetected: boolean;
  reverseLineMovementDetected: boolean;
  steamMoveDetected: boolean;
  lateSharpAction: boolean;
} {
  const magnitude = params.movement !== null ? Math.abs(params.movement) : 0;

  // Sharp Movement (Heuristik): deutliche Bewegung bei gleichzeitig
  // hohem Buchmacher-Konsens — spricht für koordinierte, informierte
  // Bewegung statt eines einzelnen abweichenden Buchmachers.
  const sharpMovementDetected = magnitude >= STRONG_MOVEMENT_THRESHOLD && params.consensusPct >= 70;

  // Public Movement (Heuristik): Bewegung vorhanden, aber (noch) ohne
  // breiten Buchmacher-Konsens — eher konsistent mit organischer,
  // schrittweiser (nicht koordinierter) Bewegung.
  const publicMovementDetected = magnitude >= STABLE_MOVEMENT_THRESHOLD && magnitude < STRONG_MOVEMENT_THRESHOLD && params.consensusPct < 70;

  // Steam Move: deutliche Bewegung in sehr kurzer, tatsächlich
  // gemessener Zeitspanne (aus der echten Linien-Historie).
  const steamMoveDetected =
    magnitude >= STEAM_MOVE_MIN_MAGNITUDE &&
    params.movementSpeedPerHour !== null &&
    params.history.length >= 2 &&
    (params.history[params.history.length - 1].timestamp - params.history[0].timestamp) / (1000 * 60 * 60) <= STEAM_MOVE_MAX_HOURS;

  // Late Sharp Action: die jüngste erfasste Bewegung liegt zeitlich sehr
  // nah an "jetzt" und war deutlich.
  let lateSharpAction = false;
  if (params.history.length >= 2 && magnitude >= STABLE_MOVEMENT_THRESHOLD) {
    const hoursSinceLastMovement = (Date.now() - params.history[params.history.length - 1].timestamp) / (1000 * 60 * 60);
    lateSharpAction = hoursSinceLastMovement <= LATE_SHARP_ACTION_MAX_HOURS_BEFORE_NOW;
  }

  // Reverse Line Movement (Heuristik, siehe Modul-Dokumentation): ohne
  // echte Public-Betting-Prozentsätze nicht im klassischen Sinn
  // bestimmbar. Als konservativer Näherungswert gilt hier: eine als
  // "Sharp Movement" erkannte, aber ungewöhnlich schnelle Bewegung
  // gegen eine zuvor bereits mehrfach bestätigte (stabile) Linie —
  // deutet auf späten, informierten Geldfluss hin, der die vorher
  // stabile Markterwartung umkehrt.
  const priorStability =
    params.history.length >= 3 ? stdDev(params.history.slice(0, -1).map((h) => h.line)) < STABLE_MOVEMENT_THRESHOLD : false;
  const reverseLineMovementDetected = sharpMovementDetected && priorStability;

  return { sharpMovementDetected, publicMovementDetected, reverseLineMovementDetected, steamMoveDetected, lateSharpAction };
}

/**
 * Schritt 5 — Closing Line Value. `closingLine` ist die zuletzt real
 * beobachtete Linie (ohne kontinuierliches Live-Monitoring ist das der
 * ehrlichste verfügbare Näherungswert für die "wahre" Closing Line).
 * `pickDirection` (falls bekannt) bestimmt die Richtung des CLV.
 */
function computeClosingLineValue(params: {
  openingLine: number | null;
  currentLine: number | null;
  closingLine: number | null;
  pickDirection: "over" | "under" | null;
}): ClosingLineValueResult {
  if (params.currentLine === null || params.closingLine === null || params.pickDirection === null) {
    return {
      openingLine: params.openingLine,
      currentLine: params.currentLine,
      closingLine: params.closingLine,
      clv: null,
      clvPct: null,
      outcome: "unbekannt",
    };
  }

  // Over-Wette: eine niedrigere eigene Linie als die Closing Line ist
  // positiv (man hat "billiger" gekauft, bevor der Markt weiter Richtung
  // Over zog). Under-Wette: umgekehrt.
  const rawDifference = params.closingLine - params.currentLine;
  const clv = params.pickDirection === "over" ? rawDifference : -rawDifference;
  const clvPct = params.currentLine !== 0 ? (clv / params.currentLine) * 100 : null;

  const outcome: ClvOutcome = Math.abs(clv) < 0.05 ? "push" : clv > 0 ? "positive" : "negative";

  return { openingLine: params.openingLine, currentLine: params.currentLine, closingLine: params.closingLine, clv, clvPct, outcome };
}

/**
 * Schritt 3 — Market Score (0–100): kombiniert Bewegungsstärke,
 * Marktstabilität/-konsens, erkannte Sharp-/Steam-/RLM-Signale sowie die
 * Datenqualität (Anzahl Buchmacher, Historienlänge) zu einem einzigen,
 * in die Prognose einfließenden Wert.
 */
function computeMarketScore(params: {
  movementStrength: number;
  consensusPct: number;
  volatility: number;
  sharpMovementDetected: boolean;
  reverseLineMovementDetected: boolean;
  steamMoveDetected: boolean;
  bookmakerCount: number;
  historyLength: number;
}): number {
  const dataQuality = clamp((params.bookmakerCount / 6) * 50 + (params.historyLength / 10) * 50, 0, 100);
  const consistency = clamp(100 - params.volatility, 0, 100);

  let signalStrength = params.movementStrength * 0.4 + params.consensusPct * 0.3 + consistency * 0.3;

  if (params.sharpMovementDetected) signalStrength = clamp(signalStrength * 1.15, 0, 100);
  if (params.reverseLineMovementDetected) signalStrength = clamp(signalStrength * 1.1, 0, 100);
  if (params.steamMoveDetected) signalStrength = clamp(signalStrength * 1.1, 0, 100);

  return Math.round(clamp(signalStrength * 0.7 + dataQuality * 0.3, 0, 100));
}

/**
 * Baut das vollständige Market-Intelligence-Ergebnis auf.
 * `pickDirection` ist optional (z. B. aus `ConsensusResult.pick`) und
 * wird ausschließlich für die CLV-Berechnung benötigt.
 */
export function computeMarketIntelligence(params: {
  currentSnapshots: OddsSnapshot[];
  history: LineHistorySnapshot[];
  openingLine: number | null;
  pickDirection?: "over" | "under" | null;
}): MarketIntelligenceResult {
  const currentLine = params.currentSnapshots.length > 0 ? mean(params.currentSnapshots.map((s) => s.line)) : null;
  const closingLine = params.history.length > 0 ? params.history[params.history.length - 1].line : currentLine;

  const lineMovement = params.openingLine !== null && currentLine !== null ? currentLine - params.openingLine : null;
  const lineMovementPct =
    lineMovement !== null && params.openingLine !== null && params.openingLine !== 0 ? (lineMovement / params.openingLine) * 100 : null;

  const movementDirection = computeMovementDirection(lineMovement);
  const movementStrength = lineMovement !== null ? clamp((Math.abs(lineMovement) / MOVEMENT_STRENGTH_SCALE) * 100, 0, 100) : 0;
  const { speed: movementSpeed, perHour: movementSpeedPerHour } = computeMovementSpeed(lineMovement, params.history);

  const marketConsensusPct = computeMarketConsensus(params.currentSnapshots);
  const marketVolatility = computeMarketVolatility(params.history, params.currentSnapshots);

  const behavior = detectMarketBehavior({
    movement: lineMovement,
    movementSpeed,
    movementSpeedPerHour,
    consensusPct: marketConsensusPct,
    history: params.history,
  });

  const clv = computeClosingLineValue({
    openingLine: params.openingLine,
    currentLine,
    closingLine,
    pickDirection: params.pickDirection ?? null,
  });

  const marketScore = computeMarketScore({
    movementStrength,
    consensusPct: marketConsensusPct,
    volatility: marketVolatility,
    sharpMovementDetected: behavior.sharpMovementDetected,
    reverseLineMovementDetected: behavior.reverseLineMovementDetected,
    steamMoveDetected: behavior.steamMoveDetected,
    bookmakerCount: params.currentSnapshots.length,
    historyLength: params.history.length,
  });

  const notes: string[] = [
    lineMovement !== null
      ? `Linienbewegung: ${params.openingLine?.toFixed(1)} → ${currentLine?.toFixed(1)} (${lineMovement >= 0 ? "+" : ""}${lineMovement.toFixed(2)}, ${
          movementDirection === "stable" ? "stabil" : movementDirection === "over" ? "Richtung Over" : "Richtung Under"
        }).`
      : "Keine ausreichenden Linien-Daten für eine Bewegungsanalyse.",
    `Buchmacher-Konsens: ${marketConsensusPct.toFixed(0)}/100 (${params.currentSnapshots.length} Buchmacher aktuell abgefragt).`,
    behavior.sharpMovementDetected
      ? "Sharp-Movement-Heuristik ausgelöst (deutliche, konsensgetragene Bewegung)."
      : "Keine Sharp-Movement-Heuristik ausgelöst.",
    behavior.reverseLineMovementDetected ? "Reverse-Line-Movement-Heuristik ausgelöst." : "Keine Reverse-Line-Movement-Heuristik ausgelöst.",
    behavior.steamMoveDetected
      ? "Steam-Move-Heuristik ausgelöst (schnelle Bewegung in kurzer, real gemessener Zeit)."
      : "Keine Steam-Move-Heuristik ausgelöst.",
    clv.outcome !== "unbekannt" ? `CLV: ${clv.clv?.toFixed(2)} Punkte (${clv.outcome}).` : "CLV nicht berechenbar (kein Pick oder keine Closing Line verfügbar).",
  ];

  return {
    openingLine: params.openingLine,
    currentLine,
    closingLine,
    lineMovement,
    lineMovementPct,
    movementDirection,
    movementStrength,
    movementSpeed,
    movementSpeedPerHour,
    sharpMovementDetected: behavior.sharpMovementDetected,
    publicMovementDetected: behavior.publicMovementDetected,
    reverseLineMovementDetected: behavior.reverseLineMovementDetected,
    steamMoveDetected: behavior.steamMoveDetected,
    lateSharpAction: behavior.lateSharpAction,
    marketConsensusPct,
    marketVolatility,
    bookmakerCount: params.currentSnapshots.length,
    historyLength: params.history.length,
    marketScore,
    clv,
    notes,
  };
}
