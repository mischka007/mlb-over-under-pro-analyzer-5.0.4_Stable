import {
  mlbGet,
  safe,
  toMlbDate,
} from "@/services/api/mlbStatsClient";

import {
  cached,
} from "@/services/cache/cache";

/**
 * Cache-Version des H2H-Datenmodells.
 *
 * v3:
 *
 * - saisonweise API-Abfragen
 * - nur Regular Season
 * - strikter Point-in-Time-Filter
 * - aktuelle gamePk ausgeschlossen
 * - Deduplizierung
 * - jüngste H2H-Spiele priorisiert
 */
const H2H_CACHE_VERSION =
  "v3-season-by-season-regular-season";

/**
 * MLB gameType:
 *
 * R = Regular Season
 */
const REGULAR_SEASON_GAME_TYPE =
  "R";

/**
 * Maximale Anzahl zurückliegender
 * Kalenderjahre für die H2H-Historie.
 *
 * Beispiel:
 *
 * Cutoff 2025
 *
 * → 2020
 * → 2021
 * → 2022
 * → 2023
 * → 2024
 * → 2025
 */
const H2H_LOOKBACK_YEARS =
  5;

/**
 * Einzelnes historisches direktes Duell
 * zwischen zwei MLB-Teams.
 */
export interface H2HGame {
  /**
   * Zeitpunkt des Spiels.
   */
  date: string;

  /**
   * MLB gamePk.
   */
  gamePk:
    number |
    null;

  /**
   * MLB-Spieltyp.
   *
   * In der aktuellen H2H-Logik wird
   * ausschließlich "R" verwendet.
   */
  gameType:
    string |
    null;

  /**
   * Gesamtzahl der Runs beider Teams.
   */
  totalRuns: number;
}

/**
 * Minimale MLB-Schedule-Struktur.
 */
interface MlbScheduleResponse {
  dates: {
    games: {
      gamePk?: number;

      gameDate: string;

      gameType?: string;

      status: {
        detailedState: string;
      };

      teams: {
        home: {
          team: {
            id: number;
          };

          score?: number;
        };

        away: {
          team: {
            id: number;
          };

          score?: number;
        };
      };
    }[];
  }[];
}

/**
 * Einzelnes Schedule-Spiel.
 */
type MlbScheduleGame =
  MlbScheduleResponse["dates"][number]["games"][number];

/**
 * Beschreibt einen einzelnen
 * API-Abfragezeitraum.
 */
interface H2HDateRange {
  year: number;

  startDate: Date;

  endDate: Date;
}

/**
 * Prüft, ob ein Spiel abgeschlossen
 * und mit Ergebnis verfügbar ist.
 */
function isCompletedH2HGame(
  game: MlbScheduleGame
): boolean {
  return (
    game.status
      .detailedState ===
      "Final" &&
    game.teams
      .home
      .score !=
      null &&
    game.teams
      .away
      .score !=
      null
  );
}

/**
 * Prüft, ob das Spiel zur
 * Regular Season gehört.
 */
function isRegularSeasonH2HGame(
  game: MlbScheduleGame
): boolean {
  return (
    game.gameType ===
    REGULAR_SEASON_GAME_TYPE
  );
}

/**
 * Prüft, ob exakt die beiden
 * angeforderten Teams beteiligt sind.
 */
function isRequestedMatchup(
  game: MlbScheduleGame,
  teamAId: number,
  teamBId: number
): boolean {
  const homeTeamId =
    game.teams
      .home
      .team
      .id;

  const awayTeamId =
    game.teams
      .away
      .team
      .id;

  return (
    (
      homeTeamId ===
        teamAId &&
      awayTeamId ===
        teamBId
    ) ||
    (
      homeTeamId ===
        teamBId &&
      awayTeamId ===
        teamAId
    )
  );
}

/**
 * Gemeinsamer Qualitätsfilter.
 */
function filterRelevantH2HGames(
  games: MlbScheduleGame[],
  teamAId: number,
  teamBId: number
): MlbScheduleGame[] {
  return games.filter(
    (
      game
    ) =>
      isCompletedH2HGame(
        game
      ) &&
      isRegularSeasonH2HGame(
        game
      ) &&
      isRequestedMatchup(
        game,
        teamAId,
        teamBId
      )
  );
}

/**
 * Wandelt ein MLB-Schedule-Spiel
 * in das kompakte H2H-Format um.
 */
function mapToH2HGame(
  game: MlbScheduleGame
): H2HGame {
  return {
    date:
      game.gameDate,

    gamePk:
      game.gamePk ??
      null,

    gameType:
      game.gameType ??
      null,

    totalRuns:
      (
        game.teams
          .home
          .score ??
        0
      ) +
      (
        game.teams
          .away
          .score ??
        0
      ),
  };
}

/**
 * Sortiert H2H-Spiele chronologisch
 * vom ältesten zum neuesten Spiel.
 */
function sortH2HGamesChronologically(
  games: H2HGame[]
): H2HGame[] {
  return [
    ...games,
  ].sort(
    (
      firstGame,
      secondGame
    ) => {
      const firstTimestamp =
        new Date(
          firstGame.date
        ).getTime();

      const secondTimestamp =
        new Date(
          secondGame.date
        ).getTime();

      if (
        Number.isNaN(
          firstTimestamp
        ) &&
        Number.isNaN(
          secondTimestamp
        )
      ) {
        return (
          (
            firstGame.gamePk ??
            0
          ) -
          (
            secondGame.gamePk ??
            0
          )
        );
      }

      if (
        Number.isNaN(
          firstTimestamp
        )
      ) {
        return 1;
      }

      if (
        Number.isNaN(
          secondTimestamp
        )
      ) {
        return -1;
      }

      if (
        firstTimestamp ===
        secondTimestamp
      ) {
        return (
          (
            firstGame.gamePk ??
            0
          ) -
          (
            secondGame.gamePk ??
            0
          )
        );
      }

      return (
        firstTimestamp -
        secondTimestamp
      );
    }
  );
}

/**
 * Entfernt doppelte H2H-Spiele.
 *
 * Primär:
 * gamePk
 *
 * Fallback:
 * Datum + Total Runs
 */
function deduplicateH2HGames(
  games: H2HGame[]
): H2HGame[] {
  const seen =
    new Set<string>();

  const uniqueGames:
    H2HGame[] = [];

  for (
    const game of games
  ) {
    const key =
      game.gamePk !=
      null
        ? `gamePk:${game.gamePk}`
        : [
            "fallback",
            game.date,
            game.totalRuns,
          ].join(
            ":"
          );

    if (
      seen.has(
        key
      )
    ) {
      continue;
    }

    seen.add(
      key
    );

    uniqueGames.push(
      game
    );
  }

  return uniqueGames;
}

/**
 * Erstellt einen lokalen Date-Wert.
 *
 * Dadurch vermeiden wir unnötige
 * UTC-Verschiebungen bei der Erstellung
 * von Saison-Zeiträumen.
 */
function createLocalDate(
  year: number,
  monthIndex: number,
  day: number
): Date {
  const date =
    new Date();

  date.setFullYear(
    year,
    monthIndex,
    day
  );

  date.setHours(
    12,
    0,
    0,
    0
  );

  return date;
}

/**
 * Erstellt saisonweise Abfragezeiträume.
 *
 * Beispiel:
 *
 * Cutoff:
 * 2025-07-01
 *
 * Ergebnis:
 *
 * 2020-01-01 → 2020-12-31
 * 2021-01-01 → 2021-12-31
 * 2022-01-01 → 2022-12-31
 * 2023-01-01 → 2023-12-31
 * 2024-01-01 → 2024-12-31
 * 2025-01-01 → 2025-07-01
 */
function createHistoricalH2HDateRanges(
  cutoff: Date
): H2HDateRange[] {
  const cutoffYear =
    cutoff.getFullYear();

  const firstYear =
    cutoffYear -
    H2H_LOOKBACK_YEARS;

  const ranges:
    H2HDateRange[] = [];

  for (
    let year =
      firstYear;
    year <=
      cutoffYear;
    year++
  ) {
    const startDate =
      createLocalDate(
        year,
        0,
        1
      );

    const endDate =
      year ===
      cutoffYear
        ? new Date(
            cutoff
          )
        : createLocalDate(
            year,
            11,
            31
          );

    ranges.push({
      year,

      startDate,

      endDate,
    });
  }

  return ranges;
}

/**
 * Lädt einen einzelnen saisonweisen
 * H2H-Zeitraum.
 *
 * Fehler in einer Saison führen nicht
 * automatisch dazu, dass alle anderen
 * Jahre verloren gehen.
 */
async function fetchH2HGamesForDateRange(
  teamAId: number,
  teamBId: number,
  range: H2HDateRange
): Promise<MlbScheduleGame[]> {
  const data =
    await safe(
      () =>
        mlbGet<MlbScheduleResponse>(
          "/schedule",
          {
            sportId:
              1,

            teamId:
              teamAId,

            opponentId:
              teamBId,

            gameType:
              REGULAR_SEASON_GAME_TYPE,

            startDate:
              toMlbDate(
                range.startDate
              ),

            endDate:
              toMlbDate(
                range.endDate
              ),
          }
        )
    );

  if (
    !data
  ) {
    console.warn(
      `[H2H] Saisonabfrage ${range.year} fehlgeschlagen.`,
      {
        teamAId,

        teamBId,

        startDate:
          toMlbDate(
            range.startDate
          ),

        endDate:
          toMlbDate(
            range.endDate
          ),
      }
    );

    return [];
  }

  return data.dates.flatMap(
    (
      date
    ) =>
      date.games
  );
}

/**
 * Lädt mehrere H2H-Zeiträume
 * nacheinander.
 *
 * Bewusst sequenziell:
 *
 * - geringere gleichzeitige API-Last
 * - weniger Risiko für Netzwerkfehler
 * - einfachere Diagnose
 */
async function fetchH2HGamesForRanges(
  teamAId: number,
  teamBId: number,
  ranges: H2HDateRange[]
): Promise<MlbScheduleGame[]> {
  const allGames:
    MlbScheduleGame[] = [];

  for (
    const range of ranges
  ) {
    const games =
      await fetchH2HGamesForDateRange(
        teamAId,
        teamBId,
        range
      );

    allGames.push(
      ...games
    );
  }

  return allGames;
}

/**
 * Lädt die letzten direkten Duelle
 * zwischen zwei Teams für den
 * Live-Analyzer.
 *
 * Auch hier werden die Daten saisonweise
 * geladen, damit eine große Mehrjahres-
 * Schedule-Abfrage nicht unvollständig
 * zurückkommt.
 */
export async function fetchHeadToHead(
  teamAId: number,
  teamBId: number,
  limit = 20
): Promise<H2HGame[]> {
  const normalizedLimit =
    Math.max(
      1,
      Math.floor(
        limit
      )
    );

  const end =
    new Date();

  const ranges =
    createHistoricalH2HDateRanges(
      end
    );

  const cacheTeamIds =
    [
      teamAId,
      teamBId,
    ].sort(
      (
        firstId,
        secondId
      ) =>
        firstId -
        secondId
    );

  const cacheKey =
    [
      "h2h",
      H2H_CACHE_VERSION,
      cacheTeamIds.join(
        "-"
      ),
      toMlbDate(
        end
      ),
      normalizedLimit,
    ].join(
      ":"
    );

  const result =
    await safe(
      async () =>
        cached(
          cacheKey,
          async () => {
            const scheduleGames =
              await fetchH2HGamesForRanges(
                teamAId,
                teamBId,
                ranges
              );

            const relevantGames =
              filterRelevantH2HGames(
                scheduleGames,
                teamAId,
                teamBId
              );

            const mappedGames =
              relevantGames.map(
                mapToH2HGame
              );

            const uniqueGames =
              deduplicateH2HGames(
                mappedGames
              );

            const sortedGames =
              sortH2HGamesChronologically(
                uniqueGames
              );

            return sortedGames.slice(
              -normalizedLimit
            );
          }
        )
    );

  return (
    result ??
    []
  );
}

/**
 * Lädt historische direkte Duelle
 * ausschließlich aus der Zeit VOR
 * einem Point-in-Time-Stichtag.
 *
 * Ablauf:
 *
 * 1. Historische Jahre einzeln laden.
 * 2. Nur Regular Season.
 * 3. Nur exakt das angeforderte Matchup.
 * 4. Aktuelle gamePk ausschließen.
 * 5. Nur gameDate < cutoff.
 * 6. Duplikate entfernen.
 * 7. Chronologisch sortieren.
 * 8. Jüngste `limit` Spiele auswählen.
 */
export async function fetchHistoricalHeadToHead(
  teamAId: number,
  teamBId: number,
  asOfDate: Date,
  limit = 20,
  excludeGamePk:
    number |
    null =
    null
): Promise<H2HGame[]> {
  const cutoff =
    new Date(
      asOfDate
    );

  if (
    Number.isNaN(
      cutoff.getTime()
    )
  ) {
    console.warn(
      "[Historical H2H] Ungültiger Point-in-Time-Stichtag.",
      {
        teamAId,

        teamBId,

        asOfDate,
      }
    );

    return [];
  }

  const normalizedLimit =
    Math.max(
      1,
      Math.floor(
        limit
      )
    );

  const ranges =
    createHistoricalH2HDateRanges(
      cutoff
    );

  const cacheTeamIds =
    [
      teamAId,
      teamBId,
    ].sort(
      (
        firstId,
        secondId
      ) =>
        firstId -
        secondId
    );

  const cacheKey =
    [
      "historical-h2h",
      H2H_CACHE_VERSION,
      cacheTeamIds.join(
        "-"
      ),
      cutoff.toISOString(),
      normalizedLimit,
      excludeGamePk ??
        "none",
    ].join(
      ":"
    );

  const result =
    await safe(
      async () =>
        cached(
          cacheKey,
          async () => {
            /**
             * Saisonweise laden.
             */
            const scheduleGames =
              await fetchH2HGamesForRanges(
                teamAId,
                teamBId,
                ranges
              );

            /**
             * Nur:
             *
             * - Final
             * - Scores vorhanden
             * - Regular Season
             * - exaktes Matchup
             */
            const relevantGames =
              filterRelevantH2HGames(
                scheduleGames,
                teamAId,
                teamBId
              );

            /**
             * Strikter Point-in-Time-Filter.
             */
            const pointInTimeGames =
              relevantGames.filter(
                (
                  game
                ) => {
                  if (
                    excludeGamePk !=
                      null &&
                    game.gamePk ===
                      excludeGamePk
                  ) {
                    return false;
                  }

                  const gameTimestamp =
                    new Date(
                      game.gameDate
                    ).getTime();

                  if (
                    Number.isNaN(
                      gameTimestamp
                    )
                  ) {
                    return false;
                  }

                  return (
                    gameTimestamp <
                    cutoff.getTime()
                  );
                }
              );

            const mappedGames =
              pointInTimeGames.map(
                mapToH2HGame
              );

            const uniqueGames =
              deduplicateH2HGames(
                mappedGames
              );

            const sortedGames =
              sortH2HGamesChronologically(
                uniqueGames
              );

            /**
             * Wichtig:
             *
             * Da aufsteigend sortiert wurde,
             * liefert slice(-limit) die
             * jüngsten direkten Duelle vor
             * dem Stichtag.
             */
            return sortedGames.slice(
              -normalizedLimit
            );
          }
        )
    );

  return (
    result ??
    []
  );
}