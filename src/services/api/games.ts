import {
  mlbGet,
  safe,
  toMlbDate,
} from "@/services/api/mlbStatsClient";

import { cached } from "@/services/cache/cache";

/**
 * Ein einzelnes MLB-Spiel.
 */
export interface ScheduledGame {
  gamePk: number;

  /**
   * Offizieller MLB-Spieltag
   * im Format YYYY-MM-DD.
   *
   * Dieser Wert entspricht dem Datum,
   * unter dem das Spiel vom MLB-Schedule
   * zurückgegeben wurde.
   *
   * WICHTIG:
   *
   * Dieser Wert ist unabhängig vom
   * exakten UTC-Zeitpunkt in gameDate.
   *
   * Beispiel:
   *
   * officialDate:
   * "2025-07-01"
   *
   * gameDate:
   * "2025-06-30T22:35:00Z"
   *
   * Für Backtest-Zeiträume und
   * Monatsstatistiken verwenden wir
   * officialDate.
   */
  officialDate: string;

  /**
   * Exakter Spielzeitpunkt
   * als ISO-Zeitstempel.
   */
  gameDate: string;

  status: string;

  /**
   * Version 6.0 (Paket 5): normalisierter MLB-Status
   * ("Preview"/"Live"/"Final" etc.) — präziser als der freitextige
   * `status` (`detailedState`) für die automatische Statusklassifikation
   * (siehe `@/engine/gameInfoEngine`). `null`, falls die API dieses Feld
   * (in seltenen Fällen) nicht liefert.
   */
  abstractGameState: string | null;

  venueName: string;
  venueId: number | null;

  homeTeamId: number;
  homeTeamName: string;

  awayTeamId: number;
  awayTeamName: string;

  homeRuns: number | null;
  awayRuns: number | null;

  homeProbablePitcherId: number | null;
  homeProbablePitcherName: string | null;

  awayProbablePitcherId: number | null;
  awayProbablePitcherName: string | null;

  isDoubleheader: boolean;
  /** Version 6.0 (Paket 5): welches Spiel eines Doubleheaders (1 oder 2). `null` außerhalb eines Doubleheaders bzw. falls die API es nicht liefert. */
  doubleheaderGameNumber: number | null;
  /** Version 6.0 (Paket 5): MLB-Saisonphase-Code ("R" = Regular Season, "P" = Playoffs, "S" = Spring Training, "A" = All-Star etc.). `null`, falls nicht geliefert. */
  gameType: string | null;
  /** Version 6.0 (Paket 5): Spielnummer innerhalb der aktuellen Serie. `null`, falls nicht geliefert. */
  seriesGameNumber: number | null;
  /** Version 6.0 (Paket 5): Gesamtzahl der Spiele in der aktuellen Serie. `null`, falls nicht geliefert. */
  gamesInSeries: number | null;
}

/**
 * Typ der MLB-Schedule-Antwort.
 */
interface MlbScheduleResponse {
  dates: {
    /**
     * Offizieller MLB-Spieltag.
     *
     * Die MLB-API liefert diesen Wert
     * normalerweise im Format YYYY-MM-DD.
     */
    date?: string;

    games: {
      gamePk: number;
      gameDate: string;

      status: {
        detailedState: string;
        abstractGameState?: string;
      };

      doubleHeader: string;
      /** Version 6.0 (Paket 5): welches Spiel eines Doubleheaders (MLB liefert dies i. d. R. als String "1"/"2"/"y"). */
      gameNumber?: number;
      gameType?: string;
      seriesGameNumber?: number;
      gamesInSeries?: number;

      venue?: {
        id: number;
        name: string;
      };

      teams: {
        home: {
          team: {
            id: number;
            name: string;
          };

          score?: number;

          probablePitcher?: {
            id: number;
            fullName: string;
          };
        };

        away: {
          team: {
            id: number;
            name: string;
          };

          score?: number;

          probablePitcher?: {
            id: number;
            fullName: string;
          };
        };
      };
    }[];
  }[];
}

/**
 * Wandelt ein MLB-API-Spiel
 * in unser internes Format um.
 */
function mapGame(
  raw: MlbScheduleResponse["dates"][number]["games"][number],
  officialDate: string
): ScheduledGame {
  return {
    gamePk:
      raw.gamePk,

    officialDate,

    gameDate:
      raw.gameDate,

    status:
      raw.status.detailedState,

    abstractGameState:
      raw.status.abstractGameState ?? null,

    venueName:
      raw.venue?.name ?? "",

    venueId:
      raw.venue?.id ?? null,

    homeTeamId:
      raw.teams.home.team.id,

    homeTeamName:
      raw.teams.home.team.name,

    awayTeamId:
      raw.teams.away.team.id,

    awayTeamName:
      raw.teams.away.team.name,

    homeRuns:
      raw.teams.home.score ?? null,

    awayRuns:
      raw.teams.away.score ?? null,

    homeProbablePitcherId:
      raw.teams.home.probablePitcher?.id ??
      null,

    homeProbablePitcherName:
      raw.teams.home.probablePitcher?.fullName ??
      null,

    awayProbablePitcherId:
      raw.teams.away.probablePitcher?.id ??
      null,

    awayProbablePitcherName:
      raw.teams.away.probablePitcher?.fullName ??
      null,

    isDoubleheader:
      raw.doubleHeader !== "N",

    doubleheaderGameNumber:
      raw.gameNumber ?? null,

    gameType:
      raw.gameType ?? null,

    seriesGameNumber:
      raw.seriesGameNumber ?? null,

    gamesInSeries:
      raw.gamesInSeries ?? null,
  };
}

/**
 * Lädt alle MLB-Spiele
 * für ein bestimmtes Datum.
 *
 * Standardmäßig wird das heutige
 * Datum verwendet.
 *
 * WICHTIG:
 *
 * Jedes Spiel erhält zusätzlich
 * den offiziellen MLB-Spieltag.
 *
 * Dadurch bleiben:
 *
 * - angeforderter Spieltag
 * - exakter UTC-Spielzeitpunkt
 *
 * sauber voneinander getrennt.
 */
export async function fetchGamesForDate(
  date: Date = new Date()
): Promise<ScheduledGame[]> {
  const requestedDate =
    toMlbDate(
      date
    );

  return cached(
    `games:${requestedDate}`,
    async () => {
      const data =
        await mlbGet<MlbScheduleResponse>(
          "/schedule",
          {
            sportId: 1,

            date:
              requestedDate,

            hydrate:
              "team,probablePitcher,venue",
          }
        );

      /**
       * Nicht nur data.dates[0] verwenden.
       *
       * Falls die MLB-API mehrere
       * Datumsgruppen zurückgibt,
       * bleiben deren offizielle
       * Spieltage dadurch erhalten.
       */
      return (
        data.dates ?? []
      ).flatMap(
        (
          dateGroup
        ) => {
          const officialDate =
            dateGroup.date ??
            requestedDate;

          return (
            dateGroup.games ??
            []
          ).map(
            (
              game
            ) =>
              mapGame(
                game,
                officialDate
              )
          );
        }
      );
    }
  );
}

/**
 * Sucht ein konkretes Spiel
 * des heutigen Tages anhand
 * der beiden Teamnamen.
 */
export async function findTodaysGame(
  homeTeamName: string,
  awayTeamName: string
): Promise<ScheduledGame | null> {
  return safe(
    async () => {
      const games =
        await fetchGamesForDate();

      const match =
        games.find(
          (
            game
          ) =>
            game.homeTeamName
              .toLowerCase()
              .includes(
                homeTeamName.toLowerCase()
              ) &&
            game.awayTeamName
              .toLowerCase()
              .includes(
                awayTeamName.toLowerCase()
              )
        );

      if (
        !match
      ) {
        throw new Error(
          "Spiel nicht im heutigen Spielplan gefunden"
        );
      }

      return match;
    }
  );
}

/**
 * Ergebnis eines vergangenen
 * Team-Spiels.
 */
export interface RecentGameResult {
  date: string;

  runsScored: number;
  runsAllowed: number;

  win: boolean;
}

/**
 * Typ für historische Team-Spiele.
 */
interface MlbTeamScheduleResponse {
  dates: {
    games: {
      gameDate: string;

      status: {
        detailedState: string;
      };

      teams: {
        home: {
          team: {
            id: number;
          };

          score?: number;
          isWinner?: boolean;
        };

        away: {
          team: {
            id: number;
          };

          score?: number;
          isWinner?: boolean;
        };
      };
    }[];
  }[];
}

/**
 * Lädt die letzten abgeschlossenen
 * Spiele eines Teams.
 *
 * LIVE-MODUS:
 *
 * fetchRecentTeamGames(
 *   teamId,
 *   20
 * )
 *
 * verwendet den heutigen Zeitpunkt.
 *
 * BACKTEST-MODUS:
 *
 * fetchRecentTeamGames(
 *   teamId,
 *   20,
 *   historicalDate
 * )
 *
 * verwendet ausschließlich Spiele,
 * die VOR dem historischen Stichtag
 * stattgefunden haben.
 *
 * Dadurch verhindern wir,
 * dass zukünftige Spiele in einen
 * historischen Backtest einfließen.
 */
export async function fetchRecentTeamGames(
  teamId: number,
  limit = 20,
  asOfDate: Date = new Date()
): Promise<RecentGameResult[]> {
  /**
   * Wir erzeugen eine eigene Kopie,
   * damit das übergebene Date-Objekt
   * niemals verändert wird.
   */
  const cutoffDate =
    new Date(
      asOfDate
    );

  /**
   * Der Stichtag selbst darf nicht
   * in die Form-Berechnung einfließen.
   *
   * Deshalb endet das Suchfenster
   * einen Tag VOR dem Stichtag.
   */
  const end =
    new Date(
      cutoffDate
    );

  end.setDate(
    end.getDate() - 1
  );

  /**
   * Großzügiges Suchfenster,
   * damit genügend abgeschlossene
   * Spiele gefunden werden.
   */
  const start =
    new Date(
      end
    );

  start.setDate(
    start.getDate() - 60
  );

  const startDate =
    toMlbDate(
      start
    );

  const endDate =
    toMlbDate(
      end
    );

  /**
   * Der Stichtag gehört in den
   * Cache-Key.
   *
   * Dadurch können historische
   * Backtests nicht versehentlich
   * heutige Formdaten aus dem Cache
   * erhalten.
   */
  return cached(
    `recent-games:${teamId}:${limit}:${endDate}`,
    async () => {
      const data =
        await mlbGet<MlbTeamScheduleResponse>(
          "/schedule",
          {
            sportId: 1,
            teamId,
            startDate,
            endDate,
          }
        );

      const games =
        data.dates
          .flatMap(
            (
              dateGroup
            ) =>
              dateGroup.games
          )
          .filter(
            (
              game
            ) =>
              game.status.detailedState ===
              "Final"
          );

      const results:
        RecentGameResult[] =
        games.map(
          (
            game
          ) => {
            const isHome =
              game.teams.home.team.id ===
              teamId;

            const own =
              isHome
                ? game.teams.home
                : game.teams.away;

            const opponent =
              isHome
                ? game.teams.away
                : game.teams.home;

            return {
              date:
                game.gameDate,

              runsScored:
                own.score ?? 0,

              runsAllowed:
                opponent.score ?? 0,

              win:
                Boolean(
                  own.isWinner
                ),
            };
          }
        );

      /**
       * Die letzten limit Spiele
       * vor dem Stichtag.
       */
      return results.slice(
        -limit
      );
    }
  );
}

/**
 * Informationen zu Ruhetagen
 * und Reise.
 */
export interface RestAndTravel {
  restDays: number | null;

  traveledSinceLastGame:
    boolean | null;

  lastVenueName:
    string | null;
}

/**
 * Typ für Team-Spielplan
 * inklusive Stadion.
 */
interface MlbTeamScheduleWithVenueResponse {
  dates: {
    games: {
      gameDate: string;

      status: {
        detailedState: string;
      };

      venue: {
        name: string;
      };
    }[];
  }[];
}

/**
 * Ermittelt Ruhetage sowie,
 * ob das Team seit dem letzten
 * Spiel den Spielort gewechselt hat.
 *
 * Diese bestehende Funktion arbeitet
 * weiterhin im Live-Modus.
 *
 * Eine historische Variante wird
 * später separat ergänzt.
 */
export async function fetchRestAndTravel(
  teamId: number,
  currentVenueName: string
): Promise<RestAndTravel> {
  const result =
    await safe(
      async () => {
        const end =
          new Date();

        const start =
          new Date();

        start.setDate(
          start.getDate() - 10
        );

        const data =
          await mlbGet<MlbTeamScheduleWithVenueResponse>(
            "/schedule",
            {
              sportId: 1,
              teamId,

              startDate:
                toMlbDate(
                  start
                ),

              endDate:
                toMlbDate(
                  end
                ),

              hydrate:
                "venue",
            }
          );

        const games =
          data.dates
            .flatMap(
              (
                dateGroup
              ) =>
                dateGroup.games
            )
            .filter(
              (
                game
              ) =>
                game.status
                  .detailedState ===
                "Final"
            );

        if (
          games.length === 0
        ) {
          throw new Error(
            "Keine letzten Spiele gefunden"
          );
        }

        const last =
          games[
            games.length - 1
          ];

        const lastDate =
          new Date(
            last.gameDate
          );

        const restDays =
          Math.max(
            0,

            Math.round(
              (
                Date.now() -
                lastDate.getTime()
              ) /
                (
                  1000 *
                  60 *
                  60 *
                  24
                )
            ) - 1
          );

        return {
          restDays,

          traveledSinceLastGame:
            last.venue.name !==
            currentVenueName,

          lastVenueName:
            last.venue.name,
        };
      }
    );

  return (
    result ?? {
      restDays:
        null,

      traveledSinceLastGame:
        null,

      lastVenueName:
        null,
    }
  );
}

/**
 * Lädt alle MLB-Spiele eines
 * beliebigen historischen Datums.
 *
 * Diese Funktion wird für das
 * Backtesting-System verwendet.
 *
 * Bei abgeschlossenen Spielen
 * stehen zusätzlich homeRuns
 * und awayRuns zur Verfügung.
 */
export async function fetchHistoricalGames(
  date: Date
): Promise<ScheduledGame[]> {
  return fetchGamesForDate(
    date
  );
}