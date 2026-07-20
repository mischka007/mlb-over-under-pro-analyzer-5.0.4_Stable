import type { GameInfo, NormalizedGameStatus } from "@/types";
import type { ScheduledGame } from "@/services/api/games";

/**
 * Version 6.0 — Paket 5: Spielinformationen.
 *
 * Leitet alle in Schritt 2 geforderten Anzeige-Informationen
 * ausschließlich aus bereits von der MLB Stats API geladenen, echten
 * Feldern ab (`ScheduledGame`, `@/services/api/games`, additiv um
 * `abstractGameState`/`gameType`/`seriesGameNumber`/`gamesInSeries`/
 * `doubleheaderGameNumber` erweitert) — keine zusätzliche API, keine
 * geschätzten Werte. Datum-/Zeitzonen-Formatierung nutzt ausschließlich
 * die im Browser bereits eingebauten `Intl`-APIs.
 */

const SEASON_PHASE_LABELS: Record<string, string> = {
  R: "Regular Season",
  P: "Playoffs",
  S: "Spring Training",
  A: "All-Star Game",
  D: "Division Series",
  L: "League Championship Series",
  W: "World Series",
  F: "Wild Card",
  E: "Exhibition",
};

function seasonPhaseLabelFor(gameType: string | null): string {
  if (gameType === null) return "Unbekannt";
  return SEASON_PHASE_LABELS[gameType] ?? `Unbekannt (${gameType})`;
}

/**
 * Normalisiert den freitextigen MLB-Status (`detailedState`/
 * `abstractGameState`) auf die in Schritt 2 geforderten Kategorien.
 * Verschoben/Beendet/Live haben Vorrang vor der Doubleheader-
 * Kennzeichnung (die nur relevant ist, solange das Spiel noch nicht
 * begonnen hat). Exportiert (Version 6.0, Paket 7A), damit
 * `useLiveMonitoring.ts` dieselbe Klassifikation wiederverwendet statt
 * sie zu duplizieren.
 */
export function normalizeGameStatusFromRaw(game: GameInfoSource): NormalizedGameStatus {
  const detailed = game.status.toLowerCase();
  const abstractState = (game.abstractGameState ?? "").toLowerCase();

  if (detailed.includes("postponed") || detailed.includes("suspended") || detailed.includes("cancelled")) {
    return "Verschoben";
  }

  if (abstractState === "final" || detailed.includes("final") || detailed.includes("completed")) {
    return "Beendet";
  }

  if (abstractState === "live" || detailed.includes("in progress") || detailed.includes("live") || detailed.includes("delayed")) {
    return "Live";
  }

  if (game.isDoubleheader && game.doubleheaderGameNumber === 1) return "Doubleheader Spiel 1";
  if (game.isDoubleheader && game.doubleheaderGameNumber === 2) return "Doubleheader Spiel 2";

  if (abstractState === "preview" || detailed.includes("scheduled") || detailed.includes("pre-game") || detailed.includes("warmup")) {
    return "Vor Spielbeginn";
  }

  return "Unbekannt";
}

/**
 * Genau die Felder, die `buildGameInfo()` benötigt — als eigener Typ
 * (statt des vollständigen `ScheduledGame`), damit sowohl `ScheduledGame`
 * selbst als auch `GameCardSummary` (das dieselben Feldnamen/-typen
 * trägt, aber z. B. keine `homeRuns`/`awayRuns` hat) strukturell
 * kompatibel sind.
 */
export type GameInfoSource = Pick<
  ScheduledGame,
  | "gamePk"
  | "officialDate"
  | "gameDate"
  | "status"
  | "abstractGameState"
  | "venueName"
  | "venueId"
  | "homeTeamName"
  | "awayTeamName"
  | "isDoubleheader"
  | "doubleheaderGameNumber"
  | "gameType"
  | "seriesGameNumber"
  | "gamesInSeries"
>;

/**
 * Baut die vollständigen Spielinformationen aus einem bereits geladenen
 * Spiel auf.
 */
export function buildGameInfo(game: GameInfoSource): GameInfo {
  const gameDate = new Date(game.gameDate);
  const [year, month, day] = game.officialDate.split("-");
  const dateLabel = year && month && day ? `${day}.${month}.${year}` : game.officialDate;

  // Der Wochentag wird bewusst aus `officialDate` (nicht dem UTC-
  // `gameDate`) abgeleitet, um Zeitzonen-bedingte Tagesverschiebungen zu
  // vermeiden (die MLB-eigene "offizielle" Spieltag-Angabe ist die
  // maßgebliche Referenz).
  const officialDateAsDate = new Date(`${game.officialDate}T12:00:00`);
  const weekdayLabel = Number.isNaN(officialDateAsDate.getTime())
    ? ""
    : new Intl.DateTimeFormat("de-DE", { weekday: "long" }).format(officialDateAsDate);

  let localTimeLabel = "";
  let germanTimeLabel = "";
  if (!Number.isNaN(gameDate.getTime())) {
    localTimeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/New_York",
      timeZoneName: "short",
    }).format(gameDate);

    germanTimeLabel = new Intl.DateTimeFormat("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Berlin",
      timeZoneName: "short",
    }).format(gameDate);
  }

  return {
    gameId: game.gamePk,
    homeTeamName: game.homeTeamName,
    awayTeamName: game.awayTeamName,
    dateLabel,
    weekdayLabel,
    localTimeLabel,
    germanTimeLabel,
    status: normalizeGameStatusFromRaw(game),
    venueName: game.venueName,
    venueId: game.venueId,
    doubleheaderGameNumber: game.doubleheaderGameNumber,
    seriesGameNumber: game.seriesGameNumber,
    gamesInSeries: game.gamesInSeries,
    seasonPhaseLabel: seasonPhaseLabelFor(game.gameType),
    loadedAt: Date.now(),
    gameStartTimestamp: Number.isNaN(gameDate.getTime()) ? null : gameDate.getTime(),
  };
}
