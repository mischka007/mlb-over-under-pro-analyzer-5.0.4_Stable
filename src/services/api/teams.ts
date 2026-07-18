import {
  mlbGet,
  safe,
  toMlbDate,
} from "@/services/api/mlbStatsClient";

import {
  cached,
} from "@/services/cache/cache";

import {
  fetchRecentTeamGames,
} from "@/services/api/games";

/**
 * Offensivstatistiken eines MLB-Teams.
 */
export interface TeamOffenseStats {
  runsPerGame: number | null;

  avg: number | null;

  obp: number | null;

  slg: number | null;

  ops: number | null;

  strikeoutPct: number | null;

  walkPct: number | null;

  /**
   * Diese erweiterten Metriken sind über
   * die aktuell verwendete freie MLB-Quelle
   * nicht direkt verfügbar.
   */
  wrcPlus: null;

  wOBA: null;

  hardHitPct: null;

  barrelPct: null;
}

/**
 * Antworttyp der MLB-Team-Statistik.
 */
interface MlbTeamStatsResponse {
  stats: {
    splits: {
      stat: {
        runs?: number;

        gamesPlayed?: number;

        avg?: string;

        obp?: string;

        slg?: string;

        ops?: string;

        strikeOuts?: number;

        baseOnBalls?: number;

        plateAppearances?: number;
      };
    }[];
  }[];
}

/**
 * Wandelt einen MLB-Statistikblock
 * in das interne Offense-Format um.
 *
 * Diese gemeinsame Funktion wird sowohl
 * vom Live-Modus als auch vom historischen
 * Point-in-Time-Backtest verwendet.
 */
function mapTeamOffenseStats(
  data: MlbTeamStatsResponse
): TeamOffenseStats {
  const stat =
    data.stats?.[0]
      ?.splits?.[0]
      ?.stat;

  if (
    !stat
  ) {
    throw new Error(
      "Keine Team-Hitting-Stats gefunden"
    );
  }

  const games =
    stat.gamesPlayed ??
    null;

  const runsPerGame =
    stat.runs != null &&
    games != null &&
    games > 0
      ? stat.runs /
        games
      : null;

  const plateAppearances =
    stat.plateAppearances ??
    null;

  const strikeoutPct =
    stat.strikeOuts != null &&
    plateAppearances != null &&
    plateAppearances > 0
      ? (
          stat.strikeOuts /
          plateAppearances
        ) *
        100
      : null;

  const walkPct =
    stat.baseOnBalls != null &&
    plateAppearances != null &&
    plateAppearances > 0
      ? (
          stat.baseOnBalls /
          plateAppearances
        ) *
        100
      : null;

  return {
    runsPerGame,

    avg:
      stat.avg != null
        ? Number(
            stat.avg
          )
        : null,

    obp:
      stat.obp != null
        ? Number(
            stat.obp
          )
        : null,

    slg:
      stat.slg != null
        ? Number(
            stat.slg
          )
        : null,

    ops:
      stat.ops != null
        ? Number(
            stat.ops
          )
        : null,

    strikeoutPct,

    walkPct,

    wrcPlus:
      null,

    wOBA:
      null,

    hardHitPct:
      null,

    barrelPct:
      null,
  };
}

/**
 * Lädt die Saison-Offensivstatistik
 * eines Teams.
 *
 * LIVE-MODUS:
 *
 * Diese Funktion bleibt kompatibel
 * mit dem bisherigen Live-System.
 */
export async function fetchTeamOffenseStats(
  teamId: number,
  season: number =
    new Date().getFullYear()
): Promise<TeamOffenseStats | null> {
  return safe(
    async () =>
      cached(
        `team-offense:${teamId}:${season}`,
        async () => {
          const data =
            await mlbGet<MlbTeamStatsResponse>(
              `/teams/${teamId}/stats`,
              {
                stats:
                  "season",

                group:
                  "hitting",

                season,
              }
            );

          return mapTeamOffenseStats(
            data
          );
        }
      )
  );
}

/**
 * Ermittelt den Saisonbeginn für
 * einen historischen Stichtag.
 *
 * Für den MLB-Backtest verwenden wir
 * bewusst den 1. Januar des jeweiligen
 * Jahres als technischen Startpunkt.
 *
 * Dadurch werden keine zukünftigen Daten
 * einbezogen.
 *
 * Da vor Beginn der Regular Season keine
 * MLB-Regular-Season-Spiele vorhanden sind,
 * beeinflusst der frühere Startpunkt die
 * tatsächlichen Saisonstatistiken nicht.
 */
function getHistoricalSeasonStart(
  asOfDate: Date
): Date {
  return new Date(
    asOfDate.getFullYear(),
    0,
    1,
    0,
    0,
    0,
    0
  );
}

/**
 * Lädt historische Offensivstatistiken
 * eines Teams ausschließlich aus dem
 * Zeitraum VOR einem historischen Stichtag.
 *
 * Beispiel:
 *
 * Spiel:
 * 2025-07-15
 *
 * Verwendete Daten:
 * 2025-01-01 bis 2025-07-14
 *
 * Dadurch dürfen Spiele am Stichtag selbst
 * und zukünftige Spiele nicht in die
 * Backtest-Prognose einfließen.
 *
 * WICHTIG:
 *
 * Der historische Stichtag wird in den
 * Cache-Key aufgenommen.
 *
 * Dadurch kann ein Backtest für Juli 2025
 * niemals versehentlich die Offense-Daten
 * eines späteren Stichtags aus dem Cache
 * erhalten.
 */
export async function fetchHistoricalTeamOffenseStats(
  teamId: number,
  asOfDate: Date
): Promise<TeamOffenseStats | null> {
  return safe(
    async () => {
      /**
       * Eigene Date-Kopie erstellen.
       *
       * Das übergebene Date-Objekt wird
       * niemals verändert.
       */
      const cutoffDate =
        new Date(
          asOfDate
        );

      /**
       * Der Stichtag selbst darf nicht
       * in die historischen Statistiken
       * einfließen.
       *
       * Deshalb endet der Datenbereich
       * einen Kalendertag vorher.
       */
      const endDate =
        new Date(
          cutoffDate
        );

      endDate.setDate(
        endDate.getDate() - 1
      );

      const startDate =
        getHistoricalSeasonStart(
          cutoffDate
        );

      const startDateKey =
        toMlbDate(
          startDate
        );

      const endDateKey =
        toMlbDate(
          endDate
        );

      return cached(
        `historical-team-offense:${teamId}:${startDateKey}:${endDateKey}`,
        async () => {
          const data =
            await mlbGet<MlbTeamStatsResponse>(
              `/teams/${teamId}/stats`,
              {
                stats:
                  "byDateRange",

                group:
                  "hitting",

                startDate:
                  startDateKey,

                endDate:
                  endDateKey,
              }
            );

          return mapTeamOffenseStats(
            data
          );
        }
      );
    }
  );
}

/**
 * Team-Suchergebnis.
 */
export interface TeamLookup {
  id: number;

  name: string;

  venueName:
    string | null;
}

/**
 * Antworttyp der MLB-Team-Suche.
 */
interface MlbTeamsResponse {
  teams: {
    id: number;

    name: string;

    venue?: {
      name: string;
    };
  }[];
}

/**
 * Lädt Team-ID, Teamname und
 * Stadion anhand eines Teilnamens.
 */
export async function findTeamByName(
  name: string
): Promise<TeamLookup | null> {
  return safe(
    async () =>
      cached(
        `team-lookup:${name.toLowerCase()}`,
        async () => {
          const data =
            await mlbGet<MlbTeamsResponse>(
              "/teams",
              {
                sportId:
                  1,
              }
            );

          const match =
            data.teams.find(
              (
                team
              ) =>
                team.name
                  .toLowerCase()
                  .includes(
                    name.toLowerCase()
                  )
            );

          if (
            !match
          ) {
            throw new Error(
              `Team "${name}" nicht gefunden`
            );
          }

          return {
            id:
              match.id,

            name:
              match.name,

            venueName:
              match.venue
                ?.name ??
              null,
          };
        }
      )
  );
}

/**
 * Ergebnis der berechneten
 * Team-Form.
 */
export interface TeamForm {
  /**
   * Erzielte Runs der letzten
   * maximal 10 Spiele.
   */
  last10Runs: number[];

  /**
   * Zugelassene Runs der letzten
   * maximal 10 Spiele.
   */
  last10Allowed: number[];

  /**
   * Erzielte Runs der letzten
   * maximal 20 Spiele.
   */
  last20Runs: number[];

  /**
   * Durchschnittlich erzielte Runs
   * der letzten maximal 20 Spiele.
   */
  avgLast20:
    number | null;

  /**
   * Aktuelle Serie.
   *
   * positiv = Siegesserie
   *
   * negativ = Niederlagenserie
   */
  streak: number;
}

/**
 * Leitet Form-Kennzahlen direkt
 * aus echten Spielergebnissen ab.
 *
 * LIVE-MODUS:
 *
 * fetchTeamForm(teamId)
 *
 * verwendet die letzten Spiele
 * vor dem heutigen Datum.
 *
 * BACKTEST-MODUS:
 *
 * fetchTeamForm(
 *   teamId,
 *   historicalDate
 * )
 *
 * verwendet ausschließlich Spiele,
 * die VOR dem historischen Stichtag
 * stattgefunden haben.
 */
export async function fetchTeamForm(
  teamId: number,
  asOfDate: Date =
    new Date()
): Promise<TeamForm | null> {
  return safe(
    async () => {
      const games =
        await fetchRecentTeamGames(
          teamId,
          20,
          asOfDate
        );

      /**
       * Vollständige historische
       * Last-20-Serie.
       */
      const last20Runs =
        games.map(
          (
            game
          ) =>
            game.runsScored
        );

      /**
       * Die letzten maximal
       * 10 Spiele.
       */
      const last10 =
        games.slice(
          -10
        );

      const last10Runs =
        last10.map(
          (
            game
          ) =>
            game.runsScored
        );

      const last10Allowed =
        last10.map(
          (
            game
          ) =>
            game.runsAllowed
        );

      /**
       * Durchschnittlich erzielte
       * Runs der letzten maximal
       * 20 Spiele.
       */
      const avgLast20 =
        last20Runs.length > 0
          ? last20Runs.reduce(
              (
                total,
                runs
              ) =>
                total +
                runs,
              0
            ) /
            last20Runs.length
          : null;

      /**
       * Aktuelle Serie.
       */
      let streak =
        0;

      if (
        games.length >
        0
      ) {
        const latestResult =
          games[
            games.length -
            1
          ].win;

        for (
          let i =
            games.length -
            1;
          i >=
            0;
          i--
        ) {
          if (
            games[
              i
            ].win !==
            latestResult
          ) {
            break;
          }

          streak +=
            games[
              i
            ].win
              ? 1
              : -1;
        }
      }

      return {
        last10Runs,

        last10Allowed,

        last20Runs,

        avgLast20,

        streak,
      };
    }
  );
}