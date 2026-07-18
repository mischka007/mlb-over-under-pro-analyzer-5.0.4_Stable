import {
  mlbGet,
  mlbGetV11,
  safe,
  toMlbDate,
} from "@/services/api/mlbStatsClient";

import {
  cached,
} from "@/services/cache/cache";

/**
 * Einheitliches Bullpen-Datenmodell.
 *
 * Es wird sowohl von der normalen
 * Live-/Current-Pipeline als auch von
 * der historischen Point-in-Time-
 * Pipeline verwendet.
 */
export interface BullpenStats {
  era:
    number |
    null;

  whip:
    number |
    null;

  inningsLast3Days:
    number |
    null;

  inningsLast7Days:
    number |
    null;

  closerAvailable:
    boolean |
    null;

  middleReliefAvailable:
    boolean |
    null;

  /**
   * Über die aktuell verwendete
   * öffentliche MLB-Datenquelle
   * nicht zuverlässig verfügbar.
   */
  fip:
    null;

  war:
    null;
}

/**
 * MLB-Roster-Antwort.
 */
interface MlbRosterResponse {
  roster: {
    person: {
      id: number;

      fullName: string;
    };

    position: {
      abbreviation: string;
    };
  }[];
}

/**
 * MLB-Pitching-Statistik.
 */
interface MlbPitchingStatsResponse {
  stats: {
    splits: {
      stat: {
        era?: string;

        whip?: string;
      };
    }[];
  }[];
}

/**
 * Schedule-Antwort für historische
 * Teamspiele.
 */
interface MlbHistoricalScheduleResponse {
  dates?: {
    date?: string;

    games?: {
      gamePk: number;

      gameDate: string;

      status?: {
        detailedState?: string;
      };

      teams?: {
        home?: {
          team?: {
            id?: number;
          };
        };

        away?: {
          team?: {
            id?: number;
          };
        };
      };
    }[];
  }[];
}

/**
 * Relevanter Ausschnitt aus einem
 * MLB-Live-Feed.
 *
 * Wir benötigen ausschließlich:
 *
 * - Home-/Away-Team-ID
 * - verwendete Pitcher
 * - Pitcher-Boxscore-Statistiken
 */
interface MlbGameFeedResponse {
  gameData?: {
    teams?: {
      home?: {
        id?: number;
      };

      away?: {
        id?: number;
      };
    };
  };

  liveData?: {
    boxscore?: {
      teams?: {
        home?: MlbBoxscoreTeam;

        away?: MlbBoxscoreTeam;
      };
    };
  };
}

/**
 * Team-Ausschnitt eines MLB-Boxscores.
 */
interface MlbBoxscoreTeam {
  pitchers?: number[];

  players?: Record<
    string,
    {
      person?: {
        id?: number;

        fullName?: string;
      };

      stats?: {
        pitching?: {
          inningsPitched?: string;

          hits?: number;

          baseOnBalls?: number;

          earnedRuns?: number;

          gamesStarted?: number;
        };
      };
    }
  >;
}

/**
 * Eine einzelne historische
 * Bullpen-Spielbelastung.
 */
interface HistoricalBullpenGame {
  gamePk: number;

  gameDate: string;

  inningsPitched: number;

  hits: number;

  walks: number;

  earnedRuns: number;

  relieverAppearances: number;
}

/**
 * Wandelt einen möglichen Zahlenwert
 * sicher in number um.
 */
function parseNumber(
  value:
    string |
    number |
    null |
    undefined
): number | null {
  if (
    value == null
  ) {
    return null;
  }

  const parsed =
    Number(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}

/**
 * Addiert Zahlenwerte.
 */
function sum(
  values: number[]
): number {
  return values.reduce(
    (
      total,
      value
    ) =>
      total +
      value,
    0
  );
}

/**
 * Erzeugt eine Kopie eines Datums
 * und zieht eine Anzahl von Tagen ab.
 */
function subtractDays(
  date: Date,
  days: number
): Date {
  const result =
    new Date(
      date
    );

  result.setDate(
    result.getDate() -
    days
  );

  return result;
}

/**
 * Prüft, ob ein Zeitpunkt strikt
 * VOR dem Point-in-Time-Stichtag liegt.
 *
 * Das zu analysierende Spiel selbst
 * wird dadurch ausgeschlossen.
 */
function isBeforeCutoff(
  gameDate: string,
  asOfDate: Date
): boolean {
  const timestamp =
    new Date(
      gameDate
    ).getTime();

  const cutoff =
    asOfDate.getTime();

  return (
    Number.isFinite(
      timestamp
    ) &&
    timestamp <
      cutoff
  );
}

/**
 * Prüft, ob ein historisches Spiel
 * abgeschlossen wurde.
 */
function isFinalStatus(
  status:
    string |
    undefined
): boolean {
  if (
    !status
  ) {
    return false;
  }

  const normalized =
    status
      .trim()
      .toLowerCase();

  return (
    normalized ===
      "final" ||
    normalized ===
      "game over" ||
    normalized ===
      "completed early"
  );
}

/**
 * Ermittelt aus einem Boxscore die
 * Teamseite für die angegebene Team-ID.
 */
function getTeamBoxscore(
  feed: MlbGameFeedResponse,
  teamId: number
): MlbBoxscoreTeam | null {
  const homeTeamId =
    feed.gameData
      ?.teams
      ?.home
      ?.id;

  const awayTeamId =
    feed.gameData
      ?.teams
      ?.away
      ?.id;

  if (
    homeTeamId ===
    teamId
  ) {
    return (
      feed.liveData
        ?.boxscore
        ?.teams
        ?.home ??
      null
    );
  }

  if (
    awayTeamId ===
    teamId
  ) {
    return (
      feed.liveData
        ?.boxscore
        ?.teams
        ?.away ??
      null
    );
  }

  return null;
}

/**
 * Extrahiert die Bullpen-Leistung
 * eines Teams aus einem historischen
 * MLB-Boxscore.
 *
 * Annahme:
 *
 * Der erste verwendete Pitcher des
 * Teams ist der Starting Pitcher.
 *
 * Alle danach eingesetzten Pitcher
 * werden als Bullpen gewertet.
 *
 * Diese Methode basiert auf dem
 * tatsächlichen historischen Boxscore
 * des Spiels und verwendet deshalb
 * keine zukünftigen Kaderinformationen.
 */
function extractHistoricalBullpenGame(
  feed: MlbGameFeedResponse,
  teamId: number,
  gamePk: number,
  gameDate: string
): HistoricalBullpenGame | null {
  const team =
    getTeamBoxscore(
      feed,
      teamId
    );

  const pitcherIds =
    team?.pitchers ??
    [];

  /**
   * Ohne mindestens zwei Pitcher
   * gab es keine eindeutig messbare
   * Bullpen-Leistung.
   */
  if (
    pitcherIds.length <
    2
  ) {
    return null;
  }

  /**
   * Der erste Pitcher ist der Starter.
   * Alle weiteren Pitcher gehören
   * zur Bullpen-Auswertung.
   */
  const relieverIds =
    pitcherIds.slice(
      1
    );

  let inningsPitched =
    0;

  let hits =
    0;

  let walks =
    0;

  let earnedRuns =
    0;

  let relieverAppearances =
    0;

  for (
    const pitcherId of relieverIds
  ) {
    const player =
      team?.players?.[
        `ID${pitcherId}`
      ];

    const pitching =
      player
        ?.stats
        ?.pitching;

    if (
      !pitching
    ) {
      continue;
    }

    const innings =
      parseNumber(
        pitching.inningsPitched
      );

    /**
     * Pitcher ohne tatsächlich
     * verbuchte Innings werden nicht
     * als belastbare Bullpen-Leistung
     * gewertet.
     */
    if (
      innings == null
    ) {
      continue;
    }

    inningsPitched +=
      innings;

    hits +=
      pitching.hits ??
      0;

    walks +=
      pitching.baseOnBalls ??
      0;

    earnedRuns +=
      pitching.earnedRuns ??
      0;

    relieverAppearances +=
      1;
  }

  if (
    inningsPitched <=
    0
  ) {
    return null;
  }

  return {
    gamePk,

    gameDate,

    inningsPitched,

    hits,

    walks,

    earnedRuns,

    relieverAppearances,
  };
}

/**
 * Berechnet die Anzahl der Stunden
 * zwischen einem historischen Spiel
 * und dem Point-in-Time-Stichtag.
 */
function hoursBeforeCutoff(
  gameDate: string,
  asOfDate: Date
): number | null {
  const gameTimestamp =
    new Date(
      gameDate
    ).getTime();

  const cutoffTimestamp =
    asOfDate.getTime();

  if (
    !Number.isFinite(
      gameTimestamp
    ) ||
    !Number.isFinite(
      cutoffTimestamp
    )
  ) {
    return null;
  }

  return (
    cutoffTimestamp -
    gameTimestamp
  ) /
    (
      1000 *
      60 *
      60
    );
}

/**
 * Lädt die aktuellen Bullpen-Statistiken.
 *
 * Diese Funktion bleibt für die normale
 * Live-/Current-Analyse erhalten.
 */
export async function fetchBullpenStats(
  teamId: number,
  season:
    number =
    new Date()
      .getFullYear()
): Promise<
  BullpenStats |
  null
> {
  return safe(
    async () =>
      cached(
        `bullpen-stats:${teamId}:${season}`,
        async () => {
          const roster =
            await mlbGet<MlbRosterResponse>(
              `/teams/${teamId}/roster`,
              {
                rosterType:
                  "active",
              }
            );

          const pitchers =
            roster.roster.filter(
              (
                player
              ) =>
                player
                  .position
                  .abbreviation ===
                "P"
            );

          const statsPerPitcher =
            await Promise.all(
              pitchers.map(
                (
                  pitcher
                ) =>
                  mlbGet<MlbPitchingStatsResponse>(
                    `/people/${pitcher.person.id}/stats`,
                    {
                      stats:
                        "season",

                      group:
                        "pitching",

                      season,
                    }
                  ).catch(
                    () =>
                      null
                  )
              )
            );

          const relieverEras:
            number[] = [];

          const relieverWhips:
            number[] = [];

          statsPerPitcher.forEach(
            (
              response
            ) => {
              const stat =
                response
                  ?.stats
                  ?.[0]
                  ?.splits
                  ?.[0]
                  ?.stat;

              const era =
                parseNumber(
                  stat?.era
                );

              const whip =
                parseNumber(
                  stat?.whip
                );

              if (
                era != null
              ) {
                relieverEras.push(
                  era
                );
              }

              if (
                whip != null
              ) {
                relieverWhips.push(
                  whip
                );
              }
            }
          );

          const era =
            relieverEras.length >
            0
              ? sum(
                  relieverEras
                ) /
                relieverEras.length
              : null;

          const whip =
            relieverWhips.length >
            0
              ? sum(
                  relieverWhips
                ) /
                relieverWhips.length
              : null;

          return {
            era,

            whip,

            inningsLast3Days:
              null,

            inningsLast7Days:
              null,

            closerAvailable:
              null,

            middleReliefAvailable:
              null,

            fip:
              null,

            war:
              null,
          } satisfies BullpenStats;
        }
      )
  );
}

/**
 * Lädt historische Point-in-Time-
 * Bullpen-Statistiken.
 *
 * WICHTIG:
 *
 * Es werden ausschließlich Spiele
 * verwendet, deren Spielzeitpunkt
 * strikt VOR asOfDate liegt.
 *
 * Dadurch werden ausgeschlossen:
 *
 * - das aktuell getestete Spiel
 * - spätere Spiele
 * - zukünftige Bullpen-Leistungen
 *
 * Die Bullpen-ERA und der WHIP werden
 * aus tatsächlichen historischen
 * Relief-Pitcher-Boxscores berechnet.
 *
 * Zusätzlich werden die tatsächlich
 * geworfenen Bullpen-Innings der
 * letzten 3 und 7 Tage berechnet.
 */
export async function fetchHistoricalBullpenStats(
  teamId: number,
  asOfDate: Date
): Promise<
  BullpenStats |
  null
> {
  const cutoffTimestamp =
    asOfDate.getTime();

  if (
    !Number.isFinite(
      cutoffTimestamp
    )
  ) {
    return null;
  }

  const season =
    asOfDate.getFullYear();

  const cacheKey =
    [
      "historical-bullpen",
      teamId,
      asOfDate.toISOString(),
    ].join(
      ":"
    );

  return safe(
    async () =>
      cached(
        cacheKey,
        async () => {
          /**
           * Für die grundlegende Bullpen-
           * Qualität verwenden wir die
           * letzten 30 Kalendertage.
           *
           * Die kurzfristige Belastung
           * wird separat über 3 und 7 Tage
           * berechnet.
           */
          const startDate =
            subtractDays(
              asOfDate,
              30
            );

          const schedule =
            await mlbGet<MlbHistoricalScheduleResponse>(
              "/schedule",
              {
                sportId:
                  1,

                teamId,

                season,

                startDate:
                  toMlbDate(
                    startDate
                  ),

                endDate:
                  toMlbDate(
                    asOfDate
                  ),
              }
            );

          const historicalGames =
            (
              schedule.dates ??
              []
            )
              .flatMap(
                (
                  date
                ) =>
                  (
                    date.games ??
                    []
                  ).map(
                    (
                      game
                    ) => ({
                      gamePk:
                        game.gamePk,

                      gameDate:
                        game.gameDate,

                      status:
                        game.status
                          ?.detailedState,
                    })
                  )
              )
              .filter(
                (
                  game
                ) =>
                  isFinalStatus(
                    game.status
                  ) &&
                  isBeforeCutoff(
                    game.gameDate,
                    asOfDate
                  )
              )
              .sort(
                (
                  firstGame,
                  secondGame
                ) =>
                  new Date(
                    firstGame.gameDate
                  ).getTime() -
                  new Date(
                    secondGame.gameDate
                  ).getTime()
              );

          if (
            historicalGames.length ===
            0
          ) {
            return null;
          }

          /**
           * Wir laden nur die letzten
           * maximal 20 abgeschlossenen
           * Spiele.
           *
           * Das hält die API-Last
           * kontrollierbar und bildet
           * die aktuelle Bullpen-Qualität
           * besser ab als eine komplette
           * Saisonaggregation.
           */
          const recentGames =
            historicalGames.slice(
              -20
            );

          const bullpenGames:
            HistoricalBullpenGame[] = [];

          /**
           * Bewusst sequenziell:
           *
           * Ein Team kann in kurzer Zeit
           * viele Spiele haben. Durch die
           * sequenzielle Verarbeitung
           * vermeiden wir große Request-
           * Spitzen gegen die MLB-API.
           */
          for (
            const game of recentGames
          ) {
            const feed =
              await mlbGetV11<MlbGameFeedResponse>(
                `/game/${game.gamePk}/feed/live`
              ).catch(
                () =>
                  null
              );

            if (
              !feed
            ) {
              continue;
            }

            const bullpenGame =
              extractHistoricalBullpenGame(
                feed,
                teamId,
                game.gamePk,
                game.gameDate
              );

            if (
              bullpenGame
            ) {
              bullpenGames.push(
                bullpenGame
              );
            }
          }

          if (
            bullpenGames.length ===
            0
          ) {
            return null;
          }

          const totalInnings =
            sum(
              bullpenGames.map(
                (
                  game
                ) =>
                  game.inningsPitched
              )
            );

          if (
            totalInnings <=
            0
          ) {
            return null;
          }

          const totalEarnedRuns =
            sum(
              bullpenGames.map(
                (
                  game
                ) =>
                  game.earnedRuns
              )
            );

          const totalHits =
            sum(
              bullpenGames.map(
                (
                  game
                ) =>
                  game.hits
              )
            );

          const totalWalks =
            sum(
              bullpenGames.map(
                (
                  game
                ) =>
                  game.walks
              )
            );

          /**
           * Klassische ERA:
           *
           * ER * 9 / IP
           */
          const era =
            (
              totalEarnedRuns *
              9
            ) /
            totalInnings;

          /**
           * Klassischer WHIP:
           *
           * (BB + H) / IP
           */
          const whip =
            (
              totalWalks +
              totalHits
            ) /
            totalInnings;

          const inningsLast3Days =
            sum(
              bullpenGames
                .filter(
                  (
                    game
                  ) => {
                    const hours =
                      hoursBeforeCutoff(
                        game.gameDate,
                        asOfDate
                      );

                    return (
                      hours !=
                        null &&
                      hours >
                        0 &&
                      hours <=
                        72
                    );
                  }
                )
                .map(
                  (
                    game
                  ) =>
                    game.inningsPitched
                )
            );

          const inningsLast7Days =
            sum(
              bullpenGames
                .filter(
                  (
                    game
                  ) => {
                    const hours =
                      hoursBeforeCutoff(
                        game.gameDate,
                        asOfDate
                      );

                    return (
                      hours !=
                        null &&
                      hours >
                        0 &&
                      hours <=
                        168
                    );
                  }
                )
                .map(
                  (
                    game
                  ) =>
                    game.inningsPitched
                )
            );

          /**
           * Die öffentliche API liefert
           * keine zuverlässige historische
           * Rolleninformation für:
           *
           * - Closer verfügbar
           * - Middle Relief verfügbar
           *
           * Deshalb werden diese Werte
           * nicht erfunden.
           *
           * null bedeutet:
           * unbekannt.
           */
          return {
            era,

            whip,

            inningsLast3Days,

            inningsLast7Days,

            closerAvailable:
              null,

            middleReliefAvailable:
              null,

            fip:
              null,

            war:
              null,
          } satisfies BullpenStats;
        }
      )
  );
}