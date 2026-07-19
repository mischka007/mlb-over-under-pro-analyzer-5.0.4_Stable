import {
  mlbGet,
  safe,
} from "@/services/api/mlbStatsClient";

import {
  cached,
} from "@/services/cache/cache";

import {
  fetchSavantPitcherMetrics,
} from "@/services/api/savant";

import {
  fetchFanGraphsPitcherMetrics,
} from "@/services/api/fangraphs";

/**
 * Vollständige Pitcher-Statistiken
 * für Live- und historische Analysen.
 */
export interface PitcherStats {
  fullName: string;

  era: number | null;

  whip: number | null;

  strikeoutPct: number | null;

  walkPct: number | null;

  hr9: number | null;

  groundOutPct: number | null;

  flyOutPct: number | null;

  gamesStarted: number | null;

  inningsPitched: number | null;

  throws:
    "L" |
    "R" |
    null;

  /**
   * Zugelassene Runs der letzten
   * maximal 5 Starts.
   */
  last5Starts: number[];

  /**
   * Zugelassene Runs der letzten
   * maximal 10 Starts (Starting
   * Pitcher PRO).
   */
  last10Starts: number[];

  xera: number | null;

  hardHitPct: number | null;

  barrelPct: number | null;

  /**
   * FIP (Fielding Independent Pitching).
   *
   * Wird aus den öffentlich bekannten
   * Rohkomponenten (HR, BB, HBP, K, IP)
   * der MLB Stats API berechnet, siehe
   * `calculateFip()`. Kein FanGraphs-
   * Scraping, keine erfundenen Werte.
   */
  fip: number | null;

  /**
   * SIERA verwendet eine proprietäre,
   * nicht öffentlich dokumentierte
   * FanGraphs-Formel und kann deshalb
   * über keine der aktuell verwendeten
   * Datenquellen zuverlässig berechnet
   * werden.
   */
  siera: null;

  /**
   * BABIP (Batting Average on Balls
   * in Play), berechnet aus H, HR, AB
   * und K der MLB Stats API, siehe
   * `calculateBabip()`.
   */
  babip: number | null;

  /**
   * LOB% (Left-on-Base-Quote),
   * berechnet aus H, BB, HBP, R und HR
   * der MLB Stats API, siehe
   * `calculateLobPct()`.
   */
  lobPct: number | null;

  /**
   * Über die aktuell verwendeten
   * freien Datenquellen noch nicht
   * zuverlässig verfügbar.
   */
  velocity: null;

  spinRate: null;

  /**
   * Pitch Count aus dem letzten
   * verfügbaren Start.
   */
  pitchCount: number | null;

  /**
   * Pitch Count der letzten maximal
   * 5 Starts (Starting Pitcher PRO).
   */
  pitchCountLast5: number[];

  /**
   * Volle Kalendertage zwischen
   * letztem Start und Stichtag.
   */
  restDays: number | null;
}

/**
 * MLB-Personen-Antwort.
 */
interface MlbPersonResponse {
  people: {
    id: number;

    fullName: string;

    pitchHand?: {
      code: string;
    };
  }[];
}

/**
 * MLB-Saisonstatistik-Antwort.
 */
interface MlbPitchingStatsResponse {
  stats: {
    splits: {
      stat: {
        era?: string;

        whip?: string;

        strikeOuts?: number;

        baseOnBalls?: number;

        battersFaced?: number;

        homeRuns?: number;

        inningsPitched?: string;

        gamesStarted?: number;

        groundOuts?: number;

        airOuts?: number;

        /**
         * Zugelassene Hits. Reales
         * Feld der MLB Stats API,
         * benötigt für BABIP/LOB%.
         */
        hits?: number;

        /**
         * Hit Batsmen. Reales Feld
         * der MLB Stats API,
         * benötigt für FIP/LOB%.
         */
        hitBatsmen?: number;

        /**
         * Gegnerische At-Bats.
         * Reales Feld der MLB
         * Stats API, benötigt
         * für BABIP.
         */
        atBats?: number;

        /**
         * Sacrifice Flies gegen den
         * Pitcher. Reales Feld der
         * MLB Stats API, benötigt
         * für BABIP.
         */
        sacFlies?: number;

        /**
         * Zugelassene Runs (nicht nur
         * Earned Runs). Reales Feld
         * der MLB Stats API, benötigt
         * für LOB%.
         */
        runs?: number;
      };
    }[];
  }[];
}

/**
 * Einzelner historischer
 * Pitching-Game-Log-Eintrag.
 */
interface MlbPitchingGameLogSplit {
  date: string;

  stat: {
    earnedRuns?: number;

    runs?: number;

    gamesStarted?: number;

    inningsPitched?: string;

    strikeOuts?: number;

    baseOnBalls?: number;

    battersFaced?: number;

    homeRuns?: number;

    groundOuts?: number;

    airOuts?: number;

    numberOfPitches?: number;

    /**
     * Zugelassene Hits. Reales Feld
     * der MLB Stats API, benötigt
     * für BABIP/LOB%.
     */
    hits?: number;

    /**
     * Hit Batsmen. Reales Feld der
     * MLB Stats API, benötigt für
     * FIP/LOB%.
     */
    hitBatsmen?: number;

    /**
     * Gegnerische At-Bats. Reales
     * Feld der MLB Stats API,
     * benötigt für BABIP.
     */
    atBats?: number;

    /**
     * Sacrifice Flies gegen den
     * Pitcher. Reales Feld der MLB
     * Stats API, benötigt für BABIP.
     */
    sacFlies?: number;
  };
}

/**
 * MLB-Game-Log-Antwort.
 */
interface MlbGameLogResponse {
  stats: {
    splits:
      MlbPitchingGameLogSplit[];
  }[];
}

/**
 * Interne aggregierte historische
 * Pitcher-Werte.
 */
interface AggregatedHistoricalPitcherStats {
  era: number | null;

  whip: number | null;

  strikeoutPct: number | null;

  walkPct: number | null;

  hr9: number | null;

  groundOutPct: number | null;

  flyOutPct: number | null;

  gamesStarted: number;

  inningsPitched: number | null;

  last5Starts: number[];

  last10Starts: number[];

  pitchCount: number | null;

  pitchCountLast5: number[];

  restDays: number | null;

  fip: number | null;

  babip: number | null;

  lobPct: number | null;
}

/**
 * Wandelt die MLB-Innings-Notation
 * korrekt in echte Innings um.
 *
 * MLB verwendet:
 *
 * 5.1 = 5 Innings + 1 Out
 * 5.2 = 5 Innings + 2 Outs
 *
 * Deshalb darf Number("5.1") nicht
 * direkt als 5,1 Innings behandelt
 * werden.
 */
function parseInningsPitched(
  value:
    string |
    undefined
): number {
  if (
    !value
  ) {
    return 0;
  }

  const [
    wholePart,
    outPart = "0",
  ] =
    value.split(
      "."
    );

  const wholeInnings =
    Number(
      wholePart
    );

  const outs =
    Number(
      outPart
    );

  if (
    !Number.isFinite(
      wholeInnings
    ) ||
    !Number.isFinite(
      outs
    )
  ) {
    return 0;
  }

  return (
    wholeInnings +
    outs /
      3
  );
}

/**
 * Gibt einen stabilen historischen
 * Cache-Key für einen Stichtag zurück.
 *
 * Wir verwenden den vollständigen
 * ISO-Zeitpunkt, damit unterschiedliche
 * Spiele desselben Tages nicht
 * versehentlich denselben Cache-Eintrag
 * verwenden.
 */
function createHistoricalPitcherCacheKey(
  personId: number,
  asOfDate: Date
): string {
  return [
    "historical-pitcher",
    personId,
    asOfDate.toISOString(),
  ].join(
    ":"
  );
}

/**
 * Prüft, ob ein Game-Log-Eintrag
 * sicher VOR dem historischen
 * Stichtag liegt.
 *
 * Die MLB-Game-Logs liefern hier
 * normalerweise nur ein Datum.
 *
 * Deshalb wird der aktuelle Spieltag
 * bewusst vollständig ausgeschlossen.
 *
 * Das verhindert, dass das zu
 * prognostizierende Spiel selbst
 * versehentlich in die historischen
 * Pitcher-Daten gelangt.
 */
function isBeforeHistoricalCutoff(
  splitDate: string,
  asOfDate: Date
): boolean {
  const cutoffDate =
    asOfDate
      .toISOString()
      .slice(
        0,
        10
      );

  return (
    splitDate <
    cutoffDate
  );
}

/**
 * FIP-Konstante.
 *
 * Die offizielle FIP-Formel gleicht
 * FIP jede Saison über eine Konstante
 * an den Liga-ERA-Durchschnitt an.
 *
 * Diese saisonale Konstante wird
 * offiziell nur von FanGraphs
 * veröffentlicht (Scraping laut
 * Nutzungsbedingungen untersagt,
 * siehe `fangraphs.ts`).
 *
 * Wir verwenden deshalb bewusst einen
 * festen, über mehrere Saisons hinweg
 * stabilen Näherungswert, statt einen
 * saisonspezifischen Wert zu erfinden.
 */
const FIP_CONSTANT = 3.10;

/**
 * Berechnet FIP (Fielding Independent
 * Pitching) aus den öffentlich
 * bekannten Rohkomponenten der MLB
 * Stats API.
 *
 * FIP =
 * ((13×HR) + (3×(BB+HBP)) − (2×K))
 * / IP + FIP_CONSTANT
 */
function calculateFip(
  homeRuns: number,
  baseOnBalls: number,
  hitBatsmen: number,
  strikeOuts: number,
  inningsPitched: number
): number | null {
  if (inningsPitched <= 0) {
    return null;
  }

  return (
    (
      13 * homeRuns +
      3 * (baseOnBalls + hitBatsmen) -
      2 * strikeOuts
    ) /
      inningsPitched +
    FIP_CONSTANT
  );
}

/**
 * Berechnet BABIP (Batting Average
 * on Balls In Play) gegen den
 * Pitcher aus den Rohkomponenten der
 * MLB Stats API.
 *
 * BABIP = (H − HR) / (AB − K − HR + SF)
 */
function calculateBabip(
  hits: number,
  homeRuns: number,
  atBats: number,
  strikeOuts: number,
  sacFlies: number
): number | null {
  const denominator =
    atBats - strikeOuts - homeRuns + sacFlies;

  if (denominator <= 0) {
    return null;
  }

  return (hits - homeRuns) / denominator;
}

/**
 * Berechnet LOB% (Left-on-Base-Quote)
 * aus den Rohkomponenten der MLB
 * Stats API.
 *
 * LOB% =
 * (H + BB + HBP − R) /
 * (H + BB + HBP − 1.4×HR)
 */
function calculateLobPct(
  hits: number,
  baseOnBalls: number,
  hitBatsmen: number,
  runs: number,
  homeRuns: number
): number | null {
  const denominator =
    hits + baseOnBalls + hitBatsmen - 1.4 * homeRuns;

  if (denominator <= 0) {
    return null;
  }

  return (
    (hits + baseOnBalls + hitBatsmen - runs) /
      denominator
  ) * 100;
}

/**
 * Berechnet die Anzahl voller
 * Kalendertage zwischen dem letzten
 * historischen Start und dem
 * Stichtag.
 */
function calculateRestDays(
  lastStartDate: string | null,
  asOfDate: Date
): number | null {
  if (
    !lastStartDate
  ) {
    return null;
  }

  const lastStart =
    new Date(
      `${lastStartDate}T00:00:00Z`
    );

  const cutoff =
    new Date(
      `${asOfDate
        .toISOString()
        .slice(
          0,
          10
        )}T00:00:00Z`
    );

  const differenceMs =
    cutoff.getTime() -
    lastStart.getTime();

  if (
    differenceMs <=
    0
  ) {
    return null;
  }

  return Math.floor(
    differenceMs /
      (
        24 *
        60 *
        60 *
        1000
      )
  );
}

/**
 * Aggregiert ausschließlich historische
 * Pitching-Game-Logs VOR dem Stichtag.
 */
function aggregateHistoricalPitcherStats(
  splits: MlbPitchingGameLogSplit[],
  asOfDate: Date
): AggregatedHistoricalPitcherStats {
  /**
   * Nur Einträge VOR dem historischen
   * Spieltag verwenden.
   */
  const historicalSplits =
    splits
      .filter(
        (
          split
        ) =>
          isBeforeHistoricalCutoff(
            split.date,
            asOfDate
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          first.date.localeCompare(
            second.date
          )
      );

  let earnedRuns = 0;

  let inningsPitched = 0;

  let strikeOuts = 0;

  let baseOnBalls = 0;

  let battersFaced = 0;

  let homeRuns = 0;

  let groundOuts = 0;

  let airOuts = 0;

  let hits = 0;

  let hitBatsmen = 0;

  let atBats = 0;

  let sacFlies = 0;

  let runsAllowed = 0;

  for (
    const split of
    historicalSplits
  ) {
    earnedRuns +=
      split.stat.earnedRuns ??
      0;

    inningsPitched +=
      parseInningsPitched(
        split.stat.inningsPitched
      );

    strikeOuts +=
      split.stat.strikeOuts ??
      0;

    baseOnBalls +=
      split.stat.baseOnBalls ??
      0;

    battersFaced +=
      split.stat.battersFaced ??
      0;

    homeRuns +=
      split.stat.homeRuns ??
      0;

    groundOuts +=
      split.stat.groundOuts ??
      0;

    airOuts +=
      split.stat.airOuts ??
      0;

    hits +=
      split.stat.hits ??
      0;

    hitBatsmen +=
      split.stat.hitBatsmen ??
      0;

    atBats +=
      split.stat.atBats ??
      0;

    sacFlies +=
      split.stat.sacFlies ??
      0;

    runsAllowed +=
      split.stat.runs ??
      0;
  }

  /**
   * Nur tatsächliche Starts.
   */
  const starts =
    historicalSplits.filter(
      (
        split
      ) =>
        (
          split.stat.gamesStarted ??
          0
        ) >
        0
    );

  const last5Starts =
    starts
      .slice(
        -5
      )
      .map(
        (
          split
        ) =>
          split.stat.runs ??
          split.stat.earnedRuns ??
          0
      );

  const last10Starts =
    starts
      .slice(
        -10
      )
      .map(
        (
          split
        ) =>
          split.stat.runs ??
          split.stat.earnedRuns ??
          0
      );

  const pitchCountLast5 =
    starts
      .slice(
        -5
      )
      .map(
        (
          split
        ) =>
          split.stat
            .numberOfPitches ??
          0
      );

  const latestStart =
    starts.length >
    0
      ? starts[
          starts.length -
          1
        ]
      : null;

  /**
   * ERA =
   * Earned Runs * 9 / Innings.
   */
  const era =
    inningsPitched >
    0
      ? (
          earnedRuns *
          9
        ) /
        inningsPitched
      : null;

  /**
   * WHIP =
   * (Walks + Hits) / Innings.
   *
   * Die MLB-Game-Log-Struktur liefert
   * pro Start tatsächlich zugelassene
   * Hits (`hits`), daher wird WHIP
   * jetzt real aus Summenwerten
   * berechnet statt leer zu bleiben.
   */
  const whip =
    inningsPitched >
    0
      ? (
          baseOnBalls +
          hits
        ) /
        inningsPitched
      : null;

  const fip =
    calculateFip(
      homeRuns,
      baseOnBalls,
      hitBatsmen,
      strikeOuts,
      inningsPitched
    );

  const babip =
    calculateBabip(
      hits,
      homeRuns,
      atBats,
      strikeOuts,
      sacFlies
    );

  const lobPct =
    calculateLobPct(
      hits,
      baseOnBalls,
      hitBatsmen,
      runsAllowed,
      homeRuns
    );

  const strikeoutPct =
    battersFaced >
    0
      ? (
          strikeOuts /
          battersFaced
        ) *
        100
      : null;

  const walkPct =
    battersFaced >
    0
      ? (
          baseOnBalls /
          battersFaced
        ) *
        100
      : null;

  const hr9 =
    inningsPitched >
    0
      ? (
          homeRuns /
          inningsPitched
        ) *
        9
      : null;

  const groundOutPct =
    battersFaced >
    0
      ? (
          groundOuts /
          battersFaced
        ) *
        100
      : null;

  const flyOutPct =
    battersFaced >
    0
      ? (
          airOuts /
          battersFaced
        ) *
        100
      : null;

  return {
    era,

    whip,

    strikeoutPct,

    walkPct,

    hr9,

    groundOutPct,

    flyOutPct,

    gamesStarted:
      starts.length,

    inningsPitched:
      inningsPitched >
      0
        ? inningsPitched
        : null,

    last5Starts,

    last10Starts,

    pitchCount:
      latestStart
        ?.stat
        .numberOfPitches ??
      null,

    pitchCountLast5,

    restDays:
      calculateRestDays(
        latestStart
          ?.date ??
        null,
        asOfDate
      ),

    fip,

    babip,

    lobPct,
  };
}

/**
 * Lädt Saison-Kennzahlen eines Pitchers
 * für den bestehenden Live-Modus.
 *
 * Diese Funktion bleibt bewusst
 * kompatibel mit dem bisherigen System.
 */
export async function fetchPitcherSeasonStats(
  personId: number,
  season: number =
    new Date()
      .getFullYear()
): Promise<PitcherStats | null> {
  return safe(
    async () =>
      cached(
        `pitcher-stats:${personId}:${season}`,
        async () => {
          const [
            personData,
            statsData,
            logData,
          ] =
            await Promise.all([
              mlbGet<MlbPersonResponse>(
                `/people/${personId}`
              ),

              mlbGet<MlbPitchingStatsResponse>(
                `/people/${personId}/stats`,
                {
                  stats:
                    "season",

                  group:
                    "pitching",

                  season,
                }
              ),

              mlbGet<MlbGameLogResponse>(
                `/people/${personId}/stats`,
                {
                  stats:
                    "gameLog",

                  group:
                    "pitching",

                  season,
                }
              ),
            ]);

          const person =
            personData.people
              ?.[0];

          const stat =
            statsData.stats
              ?.[0]
              ?.splits
              ?.[0]
              ?.stat;

          if (
            !person
          ) {
            throw new Error(
              "Pitcher nicht gefunden"
            );
          }

          const bf =
            stat?.battersFaced ??
            null;

          const strikeoutPct =
            stat?.strikeOuts !=
              null &&
            bf
              ? (
                  stat.strikeOuts /
                  bf
                ) *
                100
              : null;

          const walkPct =
            stat?.baseOnBalls !=
              null &&
            bf
              ? (
                  stat.baseOnBalls /
                  bf
                ) *
                100
              : null;

          const ip =
            stat?.inningsPitched
              ? parseInningsPitched(
                  stat.inningsPitched
                )
              : null;

          const hr9 =
            stat?.homeRuns !=
              null &&
            ip
              ? (
                  stat.homeRuns /
                  ip
                ) *
                9
              : null;

          const groundOutPct =
            stat?.groundOuts !=
              null &&
            bf
              ? (
                  stat.groundOuts /
                  bf
                ) *
                100
              : null;

          const flyOutPct =
            stat?.airOuts !=
              null &&
            bf
              ? (
                  stat.airOuts /
                  bf
                ) *
                100
              : null;

          const starts =
            (
              logData.stats
                ?.[0]
                ?.splits ??
              []
            )
              .filter(
                (
                  split
                ) =>
                  (
                    split.stat
                      .gamesStarted ??
                    0
                  ) >
                  0
              )
              .sort(
                (
                  first,
                  second
                ) =>
                  first.date
                    .localeCompare(
                      second.date
                    )
              );

          const last5Starts =
            starts
              .slice(
                -5
              )
              .map(
                (
                  split
                ) =>
                  split.stat.runs ??
                  split.stat
                    .earnedRuns ??
                  0
              );

          const last10Starts =
            starts
              .slice(
                -10
              )
              .map(
                (
                  split
                ) =>
                  split.stat.runs ??
                  split.stat
                    .earnedRuns ??
                  0
              );

          const pitchCountLast5 =
            starts
              .slice(
                -5
              )
              .map(
                (
                  split
                ) =>
                  split.stat
                    .numberOfPitches ??
                  0
              );

          const latestStart =
            starts.length >
            0
              ? starts[
                  starts.length -
                  1
                ]
              : null;

          /**
           * FIP/BABIP/LOB% werden aus
           * den Saison-Summenwerten der
           * MLB Stats API berechnet
           * (echte Rohkomponenten,
           * keine erfundenen Werte).
           */
          const fip =
            stat?.homeRuns !=
              null &&
            stat?.baseOnBalls !=
              null &&
            stat?.strikeOuts !=
              null &&
            ip
              ? calculateFip(
                  stat.homeRuns,
                  stat.baseOnBalls,
                  stat.hitBatsmen ??
                    0,
                  stat.strikeOuts,
                  ip
                )
              : null;

          const babip =
            stat?.hits !=
              null &&
            stat?.homeRuns !=
              null &&
            stat?.atBats !=
              null &&
            stat?.strikeOuts !=
              null
              ? calculateBabip(
                  stat.hits,
                  stat.homeRuns,
                  stat.atBats,
                  stat.strikeOuts,
                  stat.sacFlies ??
                    0
                )
              : null;

          const lobPct =
            stat?.hits !=
              null &&
            stat?.baseOnBalls !=
              null &&
            stat?.runs !=
              null &&
            stat?.homeRuns !=
              null
              ? calculateLobPct(
                  stat.hits,
                  stat.baseOnBalls,
                  stat.hitBatsmen ??
                    0,
                  stat.runs,
                  stat.homeRuns
                )
              : null;

          const restDays =
            calculateRestDays(
              latestStart
                ?.date ??
              null,
              new Date()
            );

          const savant =
            await fetchSavantPitcherMetrics(
              person.fullName,
              season
            );

          await fetchFanGraphsPitcherMetrics();

          return {
            fullName:
              person.fullName,

            era:
              stat?.era !=
              null
                ? Number(
                    stat.era
                  )
                : null,

            whip:
              stat?.whip !=
              null
                ? Number(
                    stat.whip
                  )
                : null,

            strikeoutPct,

            walkPct,

            hr9,

            groundOutPct,

            flyOutPct,

            gamesStarted:
              stat?.gamesStarted ??
              null,

            inningsPitched:
              ip,

            throws:
              (
                person.pitchHand
                  ?.code as
                  | "L"
                  | "R"
                  | undefined
              ) ??
              null,

            last5Starts,

            last10Starts,

            xera:
              savant?.xera ??
              null,

            hardHitPct:
              savant
                ?.hardHitPct ??
              null,

            barrelPct:
              savant
                ?.barrelPct ??
              null,

            fip,

            siera:
              null,

            babip,

            lobPct,

            velocity:
              null,

            spinRate:
              null,

            pitchCount:
              latestStart
                ?.stat
                .numberOfPitches ??
              null,

            pitchCountLast5,

            restDays,
          } satisfies PitcherStats;
        }
      )
  );
}

/**
 * Lädt echte historische
 * Point-in-Time-Pitcher-Daten.
 *
 * WICHTIG:
 *
 * Es werden ausschließlich Game-Log-
 * Einträge verwendet, deren Datum
 * VOR dem historischen Spieltag liegt.
 *
 * Dadurch werden:
 *
 * - das zu prognostizierende Spiel
 * - spätere Spiele
 *
 * vollständig ausgeschlossen.
 *
 * Erweiterte Savant-Saisonmetriken
 * werden hier bewusst NICHT verwendet,
 * solange keine echte historische
 * Point-in-Time-Abfrage garantiert ist.
 */
export async function fetchHistoricalPitcherStats(
  personId: number,
  asOfDate: Date
): Promise<PitcherStats | null> {
  return safe(
    async () =>
      cached(
        createHistoricalPitcherCacheKey(
          personId,
          asOfDate
        ),
        async () => {
          const season =
            asOfDate.getUTCFullYear();

          const [
            personData,
            logData,
          ] =
            await Promise.all([
              mlbGet<MlbPersonResponse>(
                `/people/${personId}`
              ),

              mlbGet<MlbGameLogResponse>(
                `/people/${personId}/stats`,
                {
                  stats:
                    "gameLog",

                  group:
                    "pitching",

                  season,
                }
              ),
            ]);

          const person =
            personData.people
              ?.[0];

          if (
            !person
          ) {
            throw new Error(
              "Historischer Pitcher nicht gefunden"
            );
          }

          const aggregated =
            aggregateHistoricalPitcherStats(
              logData.stats
                ?.[0]
                ?.splits ??
                [],
              asOfDate
            );

          return {
            fullName:
              person.fullName,

            era:
              aggregated.era,

            /**
             * Aus realen, point-in-time
             * summierten Game-Log-Werten
             * (BB + H) / IP berechnet.
             */
            whip:
              aggregated.whip,

            strikeoutPct:
              aggregated
                .strikeoutPct,

            walkPct:
              aggregated
                .walkPct,

            hr9:
              aggregated.hr9,

            groundOutPct:
              aggregated
                .groundOutPct,

            flyOutPct:
              aggregated
                .flyOutPct,

            gamesStarted:
              aggregated
                .gamesStarted,

            inningsPitched:
              aggregated
                .inningsPitched,

            throws:
              (
                person.pitchHand
                  ?.code as
                  | "L"
                  | "R"
                  | undefined
              ) ??
              null,

            last5Starts:
              aggregated
                .last5Starts,

            last10Starts:
              aggregated
                .last10Starts,

            /**
             * Keine nicht-historischen
             * Saisonmetriken in den
             * Point-in-Time-Backtest
             * übernehmen.
             */
            xera:
              null,

            hardHitPct:
              null,

            barrelPct:
              null,

            /**
             * FIP/BABIP/LOB% werden aus
             * denselben point-in-time
             * summierten Game-Log-Werten
             * wie ERA/WHIP berechnet und
             * verletzen daher keine
             * Look-Ahead-Garantie.
             */
            fip:
              aggregated.fip,

            siera:
              null,

            babip:
              aggregated.babip,

            lobPct:
              aggregated.lobPct,

            velocity:
              null,

            spinRate:
              null,

            pitchCount:
              aggregated
                .pitchCount,

            pitchCountLast5:
              aggregated
                .pitchCountLast5,

            restDays:
              aggregated
                .restDays,
          } satisfies PitcherStats;
        }
      )
  );
}