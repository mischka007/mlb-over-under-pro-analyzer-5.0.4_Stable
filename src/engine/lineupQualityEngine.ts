import type { DataQualityLabel, LineupQualityScore } from "@/types";
import type { LineupPlayer } from "@/services/api/lineups";
import { clamp } from "@/utils/math";

/**
 * Version 6.0 — Paket 5, Punkt 2: Lineup Quality Engine.
 *
 * Ersetzt das bisher immer `null`e `ExtendedMetrics.lineupStrengthScore`
 * (siehe `useGameAutoLoad.ts`, Zeile mit `lineupStrengthScore: null,` —
 * war nie berechnet) durch einen echten, aus real geladenen Daten
 * abgeleiteten Score. Nutzt `LineupPlayer[]` (`@/services/api/lineups`,
 * um `position`/`fetchedAt` erweitert) — keine neue Datenquelle, nur
 * bisher ungenutzte Felder desselben, bereits bestehenden MLB-Feeds.
 */

const STANDARD_LINEUP_SIZE = 9;

function labelForScore(score: number): DataQualityLabel {
  if (score >= 85) return "Exzellent";
  if (score >= 70) return "Gut";
  if (score >= 50) return "Ausreichend";
  if (score >= 30) return "Schwach";
  return "Unzureichend";
}

/** Anteil der Batting-Order-Plätze 1–9, die tatsächlich (genau einmal) belegt sind. */
function assessBattingOrderCompleteness(players: LineupPlayer[]): number {
  const filledSlots = new Set(players.map((p) => p.battingOrder).filter((o): o is number => o !== null && o >= 1 && o <= STANDARD_LINEUP_SIZE));
  return (filledSlots.size / STANDARD_LINEUP_SIZE) * 100;
}

/**
 * Positionsabdeckung: wie viele unterschiedliche Feldpositionen unter
 * den 9 Startern real gemeldet sind, abzüglich eines Abschlags für
 * doppelt besetzte Positionen (deutet auf unvollständige/fehlerhafte
 * Daten hin).
 */
function assessPositionCoverage(players: LineupPlayer[]): number {
  const positions = players.map((p) => p.position).filter((p): p is string => p !== null && p !== "");
  if (positions.length === 0) return 0;

  const uniquePositions = new Set(positions);
  const duplicateCount = positions.length - uniquePositions.size;
  const duplicatePenalty = duplicateCount > 0 ? clamp(1 - duplicateCount * 0.15, 0.4, 1) : 1;

  const coverageRatio = clamp(uniquePositions.size / STANDARD_LINEUP_SIZE, 0, 1);
  return clamp(coverageRatio * duplicatePenalty * 100, 0, 100);
}

/**
 * Berechnet den vollständigen Lineup Quality Score aus real geladenen
 * Daten. `fetchedAt` (aus `LineupResult.fetchedAt`) fließt als
 * Aktualitäts-Faktor ein: länger als 30 Minuten alte Lineup-Daten
 * innerhalb derselben Session werden leicht abgewertet (könnten sich
 * zwischenzeitlich geändert haben).
 */
export function computeLineupQualityScore(params: {
  homeLineup: LineupPlayer[] | null;
  awayLineup: LineupPlayer[] | null;
  homePitcherConfirmed: boolean;
  awayPitcherConfirmed: boolean;
  fetchedAt: number | null;
}): LineupQualityScore {
  const bothLineupsAvailable = !!params.homeLineup && !!params.awayLineup && params.homeLineup.length > 0 && params.awayLineup.length > 0;
  const pitcherConfirmed = params.homePitcherConfirmed && params.awayPitcherConfirmed;
  const ageMinutes = params.fetchedAt !== null ? (Date.now() - params.fetchedAt) / 60000 : null;

  if (!bothLineupsAvailable) {
    return {
      score: pitcherConfirmed ? 20 : 0,
      label: labelForScore(pitcherConfirmed ? 20 : 0),
      battingOrderCompleteness: 0,
      positionCoverage: 0,
      pitcherConfirmed,
      bothLineupsAvailable: false,
      ageMinutes,
      notes: [
        "Lineups noch nicht veröffentlicht (MLB veröffentlicht offizielle Lineups i. d. R. erst 1–3 Stunden vor Spielbeginn).",
        pitcherConfirmed ? "Beide Starter bereits bekannt." : "Mindestens ein Starter noch nicht bekannt.",
      ],
    };
  }

  const homeBatting = assessBattingOrderCompleteness(params.homeLineup!);
  const awayBatting = assessBattingOrderCompleteness(params.awayLineup!);
  const battingOrderCompleteness = (homeBatting + awayBatting) / 2;

  const homePosition = assessPositionCoverage(params.homeLineup!);
  const awayPosition = assessPositionCoverage(params.awayLineup!);
  const positionCoverage = (homePosition + awayPosition) / 2;

  // Aktualität: keine Abwertung innerhalb der ersten 30 Minuten, danach
  // langsam sinkender Faktor, nach unten auf 70 % begrenzt (Lineups
  // ändern sich selten grundlegend nach Veröffentlichung).
  const recencyFactor = ageMinutes !== null ? clamp(1 - Math.max(0, ageMinutes - 30) / 120, 0.7, 1) : 1;

  const rawScore = (battingOrderCompleteness * 0.45 + positionCoverage * 0.35 + (pitcherConfirmed ? 100 : 50) * 0.2) * recencyFactor;
  const score = Math.round(clamp(rawScore, 0, 100));

  const notes: string[] = [
    `Batting-Order-Vollständigkeit: ${battingOrderCompleteness.toFixed(0)}/100.`,
    `Positionsabdeckung: ${positionCoverage.toFixed(0)}/100.`,
    pitcherConfirmed ? "Beide Starter bestätigt." : "Mindestens ein Starter noch nicht bestätigt.",
    ageMinutes !== null ? `Lineup-Daten ${ageMinutes.toFixed(0)} Minuten alt.` : "Kein Abrufzeitpunkt verfügbar.",
    "Verletzte Spieler/fehlende Stammspieler fließen bewusst nicht ein — keine Verletzungs-/Roster-Historien-Datenquelle im Projekt verfügbar.",
  ];

  return { score, label: labelForScore(score), battingOrderCompleteness, positionCoverage, pitcherConfirmed, bothLineupsAvailable, ageMinutes, notes };
}
