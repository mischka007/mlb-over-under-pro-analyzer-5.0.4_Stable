import {
  BacktestManager,
} from "./backtestManager";

import type {
  BacktestResult,
  BacktestSummary,
} from "./backtestTypes";

import type {
  ConfidenceBacktestPerformance,
  MonthlyBacktestPerformance,
  PickBacktestPerformance,
  SeasonBacktestBlock,
  SeasonBacktestBlockResult,
  SeasonBacktestConfig,
  SeasonBacktestFailure,
  SeasonBacktestResult,
  SeasonBacktestRiskStats,
} from "./seasonBacktestTypes";

/**
 * Erstellt eine neue lokale Date-Kopie.
 */
function cloneDate(
  date: Date
): Date {
  return new Date(
    date.getTime()
  );
}

/**
 * Setzt eine Date-Kopie auf
 * lokalen Tagesbeginn.
 */
function startOfDay(
  date: Date
): Date {
  const result =
    cloneDate(
      date
    );

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

/**
 * Liefert den letzten lokalen
 * Kalendertag eines Monats.
 */
function endOfMonth(
  date: Date
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    0,
    0,
    0,
    0
  );
}

/**
 * Formatiert ein Datum als
 * YYYY-MM-DD ohne UTC-Verschiebung.
 */
function formatLocalDate(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}

/**
 * Formatiert einen Monat als YYYY-MM.
 */
function formatMonthKey(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}`
  );
}

/**
 * Prüft, ob ein officialDate
 * dem erwarteten Format YYYY-MM-DD
 * entspricht.
 */
function isValidOfficialDate(
  officialDate: string
): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(
      officialDate
    )
  );
}

/**
 * Liefert aus einem officialDate
 * den Monatsschlüssel YYYY-MM.
 *
 * WICHTIG:
 *
 * officialDate ist bereits der
 * logische MLB-Spieltag.
 *
 * Deshalb wird der Wert bewusst
 * NICHT erneut mit new Date()
 * interpretiert.
 *
 * Dadurch verhindern wir
 * UTC-/Zeitzonenverschiebungen.
 */
function getMonthFromOfficialDate(
  officialDate: string
): string {
  if (
    !isValidOfficialDate(
      officialDate
    )
  ) {
    return "INVALID";
  }

  return officialDate.slice(
    0,
    7
  );
}

/**
 * Vergleicht zwei Backtest-Ergebnisse
 * chronologisch.
 *
 * Sortierreihenfolge:
 *
 * 1. offizieller MLB-Spieltag
 * 2. exakter UTC-Spielzeitpunkt
 * 3. gameId als stabiler Tie-Breaker
 *
 * Dadurch bleibt der logische Spieltag
 * unabhängig von Zeitzonen korrekt.
 */
function compareBacktestResultsChronologically(
  a: BacktestResult,
  b: BacktestResult
): number {
  const officialDateDifference =
    a.officialDate.localeCompare(
      b.officialDate
    );

  if (
    officialDateDifference !==
    0
  ) {
    return officialDateDifference;
  }

  const aGameTime =
    new Date(
      a.gameDate
    ).getTime();

  const bGameTime =
    new Date(
      b.gameDate
    ).getTime();

  const aHasValidGameTime =
    !Number.isNaN(
      aGameTime
    );

  const bHasValidGameTime =
    !Number.isNaN(
      bGameTime
    );

  if (
    aHasValidGameTime &&
    bHasValidGameTime
  ) {
    const gameTimeDifference =
      aGameTime -
      bGameTime;

    if (
      gameTimeDifference !==
      0
    ) {
      return gameTimeDifference;
    }
  } else if (
    aHasValidGameTime
  ) {
    return -1;
  } else if (
    bHasValidGameTime
  ) {
    return 1;
  }

  return (
    a.gameId -
    b.gameId
  );
}

/**
 * Erstellt Monatsblöcke für
 * einen beliebigen Datumsbereich.
 *
 * Beispiel:
 *
 * 2025-03-27 bis 2025-05-10
 *
 * wird zu:
 *
 * 2025-03-27 bis 2025-03-31
 * 2025-04-01 bis 2025-04-30
 * 2025-05-01 bis 2025-05-10
 */
export function createSeasonBacktestBlocks(
  startDate: Date,
  endDate: Date
): SeasonBacktestBlock[] {
  const start =
    startOfDay(
      startDate
    );

  const end =
    startOfDay(
      endDate
    );

  if (
    start.getTime() >
    end.getTime()
  ) {
    throw new Error(
      "Das Startdatum darf nicht nach dem Enddatum liegen."
    );
  }

  const blocks:
    SeasonBacktestBlock[] = [];

  let current =
    cloneDate(
      start
    );

  while (
    current.getTime() <=
    end.getTime()
  ) {
    const monthEnd =
      endOfMonth(
        current
      );

    const blockEnd =
      monthEnd.getTime() <
      end.getTime()
        ? monthEnd
        : cloneDate(
            end
          );

    const key =
      formatMonthKey(
        current
      );

    blocks.push({
      key,

      label:
        `${formatLocalDate(
          current
        )} bis ${formatLocalDate(
          blockEnd
        )}`,

      startDate:
        cloneDate(
          current
        ),

      endDate:
        cloneDate(
          blockEnd
        ),
    });

    current =
      new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        1,
        0,
        0,
        0,
        0
      );
  }

  return blocks;
}

/**
 * Sortiert Backtest-Ergebnisse
 * chronologisch.
 *
 * Primäre Datumsquelle ist
 * officialDate.
 *
 * gameDate dient nur innerhalb
 * desselben offiziellen Spieltags
 * zur exakten zeitlichen Sortierung.
 *
 * Bei identischem Zeitpunkt dient
 * gameId als stabiler Tie-Breaker.
 */
function sortResultsChronologically(
  results: BacktestResult[]
): BacktestResult[] {
  return [
    ...results,
  ].sort(
    compareBacktestResultsChronologically
  );
}

/**
 * Entfernt doppelte gameIds.
 *
 * Der erste Datensatz bleibt erhalten.
 */
function deduplicateResults(
  results: BacktestResult[]
): {
  results: BacktestResult[];

  removedDuplicates: number;
} {
  const seen =
    new Set<number>();

  const unique:
    BacktestResult[] = [];

  let removedDuplicates =
    0;

  for (
    const result of results
  ) {
    if (
      seen.has(
        result.gameId
      )
    ) {
      removedDuplicates +=
        1;

      continue;
    }

    seen.add(
      result.gameId
    );

    unique.push(
      result
    );
  }

  return {
    results:
      unique,

    removedDuplicates,
  };
}

/**
 * Berechnet eine Summary direkt
 * aus bereits ausgewerteten
 * BacktestResult-Datensätzen.
 *
 * Dadurch werden die Prognosen
 * NICHT erneut berechnet.
 */
function createSummaryFromResults(
  results: BacktestResult[]
): BacktestSummary {
  let wins =
    0;

  let losses =
    0;

  let pushes =
    0;

  let profit =
    0;

  for (
    const result of results
  ) {
    if (
      result.outcome ===
      "win"
    ) {
      wins +=
        1;
    } else if (
      result.outcome ===
      "loss"
    ) {
      losses +=
        1;
    } else {
      pushes +=
        1;
    }

    profit +=
      result.profit;
  }

  const totalGames =
    results.length;

  const decidedBets =
    wins +
    losses;

  const hitRate =
    decidedBets > 0
      ? wins /
        decidedBets
      : 0;

  /**
   * Das bestehende Backtest-System
   * verwendet eine Unit pro Spiel.
   *
   * Deshalb entspricht der ROI:
   *
   * Gesamtprofit / Anzahl aller Wetten.
   */
  const roi =
    totalGames > 0
      ? profit /
        totalGames
      : 0;

  const yieldValue =
    roi;

  return {
    totalGames,

    wins,

    losses,

    pushes,

    decidedBets,

    hitRate,

    roi,

    yield:
      yieldValue,

    profit,
  };
}

/**
 * Berechnet Performance für
 * eine beliebige Ergebnisgruppe.
 */
function createPerformanceStats(
  results: BacktestResult[]
): {
  bets: number;

  wins: number;

  losses: number;

  pushes: number;

  decidedBets: number;

  hitRate: number;

  profit: number;

  roi: number;
} {
  const summary =
    createSummaryFromResults(
      results
    );

  return {
    bets:
      summary.totalGames,

    wins:
      summary.wins,

    losses:
      summary.losses,

    pushes:
      summary.pushes,

    decidedBets:
      summary.decidedBets,

    hitRate:
      summary.hitRate,

    profit:
      summary.profit,

    roi:
      summary.roi,
  };
}

/**
 * Gruppiert Ergebnisse nach
 * tatsächlichem offiziellen
 * MLB-Spielmonat.
 *
 * WICHTIG:
 *
 * Die Monatszuordnung erfolgt
 * ausschließlich über officialDate.
 *
 * Beispiel:
 *
 * officialDate = "2025-07-31"
 *
 * gehört immer zu:
 *
 * 2025-07
 *
 * unabhängig davon, auf welchen
 * UTC- oder lokalen Kalendertag
 * gameDate fällt.
 */
export function createMonthlyPerformance(
  results: BacktestResult[]
): MonthlyBacktestPerformance[] {
  const groups =
    new Map<
      string,
      BacktestResult[]
    >();

  for (
    const result of results
  ) {
    const month =
      getMonthFromOfficialDate(
        result.officialDate
      );

    const current =
      groups.get(
        month
      ) ?? [];

    current.push(
      result
    );

    groups.set(
      month,
      current
    );
  }

  return Array.from(
    groups.entries()
  )
    .sort(
      (
        [a],
        [b]
      ) =>
        a.localeCompare(
          b
        )
    )
    .map(
      (
        [
          month,
          monthResults,
        ]
      ) => {
        const stats =
          createPerformanceStats(
            monthResults
          );

        return {
          month,

          ...stats,
        };
      }
    );
}

/**
 * Berechnet OVER- und UNDER-Performance.
 */
export function createPickPerformance(
  results: BacktestResult[]
): PickBacktestPerformance[] {
  const picks:
    Array<
      "over" |
      "under"
    > = [
      "over",
      "under",
    ];

  return picks.map(
    (
      pick
    ) => {
      const filtered =
        results.filter(
          (
            result
          ) =>
            result.predictedPick ===
            pick
        );

      const stats =
        createPerformanceStats(
          filtered
        );

      return {
        pick,

        ...stats,
      };
    }
  );
}

/**
 * Definition der Confidence-Buckets.
 *
 * Die Grenzen entsprechen der bisherigen
 * Validator-Auswertung.
 */
const CONFIDENCE_BUCKETS = [
  {
    bucket:
      "50-52 %",

    minInclusive:
      50,

    maxExclusive:
      52,
  },

  {
    bucket:
      "52-55 %",

    minInclusive:
      52,

    maxExclusive:
      55,
  },

  {
    bucket:
      "55-58 %",

    minInclusive:
      55,

    maxExclusive:
      58,
  },

  {
    bucket:
      "58-60 %",

    minInclusive:
      58,

    maxExclusive:
      60,
  },

  {
    bucket:
      "60 % +",

    minInclusive:
      60,

    maxExclusive:
      null,
  },
] as const;

/**
 * Normalisiert Confidence-Werte.
 *
 * Falls der Analyzer später statt
 * Prozentwerten Werte zwischen 0 und 1
 * liefert, bleibt die Auswertung robust.
 */
function normalizeConfidence(
  confidence: number
): number {
  return confidence <= 1
    ? confidence *
      100
    : confidence;
}

/**
 * Berechnet die Performance
 * je Confidence-Bucket.
 */
export function createConfidencePerformance(
  results: BacktestResult[]
): ConfidenceBacktestPerformance[] {
  return CONFIDENCE_BUCKETS.map(
    (
      definition
    ) => {
      const filtered =
        results.filter(
          (
            result
          ) => {
            const confidence =
              normalizeConfidence(
                result.confidence
              );

            const aboveMinimum =
              confidence >=
              definition.minInclusive;

            const belowMaximum =
              definition.maxExclusive ===
              null ||
              confidence <
                definition.maxExclusive;

            return (
              aboveMinimum &&
              belowMaximum
            );
          }
        );

      const stats =
        createPerformanceStats(
          filtered
        );

      return {
        bucket:
          definition.bucket,

        minInclusive:
          definition.minInclusive,

        maxExclusive:
          definition.maxExclusive,

        ...stats,
      };
    }
  );
}

/**
 * Berechnet Gewinn-/Verlustserien
 * und Maximum Drawdown.
 *
 * Die Equity startet bei 0 Units.
 *
 * Maximum Drawdown:
 *
 * bisheriger Equity-Höchststand
 * minus aktueller Equity-Stand.
 */
export function createRiskStats(
  results: BacktestResult[]
): SeasonBacktestRiskStats {
  let currentWinStreak =
    0;

  let currentLossStreak =
    0;

  let longestWinStreak =
    0;

  let longestLossStreak =
    0;

  let equity =
    0;

  let peakEquity =
    0;

  let maximumDrawdown =
    0;

  for (
    const result of results
  ) {
    if (
      result.outcome ===
      "win"
    ) {
      currentWinStreak +=
        1;

      currentLossStreak =
        0;

      longestWinStreak =
        Math.max(
          longestWinStreak,
          currentWinStreak
        );
    } else if (
      result.outcome ===
      "loss"
    ) {
      currentLossStreak +=
        1;

      currentWinStreak =
        0;

      longestLossStreak =
        Math.max(
          longestLossStreak,
          currentLossStreak
        );
    } else {
      currentWinStreak =
        0;

      currentLossStreak =
        0;
    }

    equity +=
      result.profit;

    peakEquity =
      Math.max(
        peakEquity,
        equity
      );

    const drawdown =
      peakEquity -
      equity;

    maximumDrawdown =
      Math.max(
        maximumDrawdown,
        drawdown
      );
  }

  /**
   * Da der Backtest in Units arbeitet
   * und keine feste Startbankroll kennt,
   * ist ein klassischer prozentualer
   * Drawdown nicht eindeutig definiert.
   *
   * Wir verwenden deshalb als
   * Zusatzkennzahl:
   *
   * Max Drawdown / Anzahl Wetten.
   */
  const maximumDrawdownPct =
    results.length > 0
      ? maximumDrawdown /
        results.length
      : 0;

  return {
    longestWinStreak,

    longestLossStreak,

    maximumDrawdown,

    maximumDrawdownPct,

    peakEquity,

    finalEquity:
      equity,
  };
}

/**
 * Prüft, ob die finalen Ergebnisse
 * vollständig chronologisch sortiert sind.
 *
 * Verwendet exakt dieselbe
 * Sortierlogik wie die eigentliche
 * Ergebnissortierung.
 */
function isChronological(
  results: BacktestResult[]
): boolean {
  for (
    let i =
      1;
    i <
    results.length;
    i++
  ) {
    const previous =
      results[
        i - 1
      ];

    const current =
      results[
        i
      ];

    if (
      compareBacktestResultsChronologically(
        previous,
        current
      ) >
      0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Führt einen kompletten Saison-
 * oder Multi-Month-Backtest aus.
 *
 * Die Verarbeitung erfolgt
 * blockweise pro Kalendermonat.
 *
 * Vorteile:
 *
 * - sichtbarer Fortschritt
 * - geringere Fehleranfälligkeit
 * - einzelne Fehlerblöcke können
 *   protokolliert werden
 * - Ergebnisse können am Ende
 *   zentral zusammengeführt werden
 *
 * WICHTIG:
 *
 * Für die spätere Monatsauswertung
 * wird officialDate verwendet.
 *
 * Dadurch bleibt der offizielle
 * MLB-Spieltag unabhängig von
 * UTC- und lokalen Zeitzonen erhalten.
 */
export async function runSeasonBacktest(
  config: SeasonBacktestConfig
): Promise<SeasonBacktestResult> {
  const manager =
    new BacktestManager();

  const blocks =
    createSeasonBacktestBlocks(
      config.startDate,
      config.endDate
    );

  const successfulBlocks:
    SeasonBacktestBlockResult[] = [];

  const failures:
    SeasonBacktestFailure[] = [];

  const rawResults:
    BacktestResult[] = [];

  const startedAt =
    performance.now();

  console.log(
    "========================================"
  );

  console.log(
    "MLB SEASON BACKTEST"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Zeitraum:",
    formatLocalDate(
      config.startDate
    ),
    "bis",
    formatLocalDate(
      config.endDate
    )
  );

  console.log(
    "Total Line:",
    config.line
  );

  console.log(
    "Quote:",
    config.odds
  );

  console.log(
    "Monatsblöcke:",
    blocks.length
  );

  console.log(
    "========================================"
  );

  for (
    let index =
      0;
    index <
    blocks.length;
    index++
  ) {
    const block =
      blocks[
        index
      ];

    console.log(
      `BLOCK ${index + 1}/${blocks.length}`
    );

    console.log(
      block.label
    );

    console.log(
      "Block wird gestartet ..."
    );

    const blockStartedAt =
      performance.now();

    try {
      const result =
        await manager.runHistoricalBacktest(
          block.startDate,
          block.endDate,
          config.line,
          config.odds
        );

      const blockFinishedAt =
        performance.now();

      const durationSeconds =
        (
          blockFinishedAt -
          blockStartedAt
        ) /
        1000;

      successfulBlocks.push({
        block,

        summary:
          result.summary,

        results:
          result.results,

        durationSeconds,
      });

      rawResults.push(
        ...result.results
      );

      console.log(
        "Block erfolgreich."
      );

      console.log(
        "Spiele:",
        result.summary.totalGames
      );

      console.log(
        "Trefferquote:",
        (
          result.summary.hitRate *
          100
        ).toFixed(
          2
        ) +
          " %"
      );

      console.log(
        "Profit:",
        result.summary.profit.toFixed(
          2
        ),
        "Units"
      );

      console.log(
        "ROI:",
        (
          result.summary.roi *
          100
        ).toFixed(
          2
        ) +
          " %"
      );
    } catch (
      error
    ) {
      failures.push({
        block,

        error,
      });

      console.error(
        "Block fehlgeschlagen:",
        block.label
      );

      console.error(
        error
      );
    }

    console.log(
      "----------------------------------------"
    );
  }

  /**
   * Zuerst chronologisch sortieren,
   * danach doppelte gameIds entfernen.
   *
   * Die Sortierung basiert primär
   * auf officialDate.
   */
  const sortedRawResults =
    sortResultsChronologically(
      rawResults
    );

  const deduplicated =
    deduplicateResults(
      sortedRawResults
    );

  const finalResults =
    sortResultsChronologically(
      deduplicated.results
    );

  const summary =
    createSummaryFromResults(
      finalResults
    );

  /**
   * Die Monatsauswertung basiert
   * ausschließlich auf officialDate.
   */
  const monthlyPerformance =
    createMonthlyPerformance(
      finalResults
    );

  const pickPerformance =
    createPickPerformance(
      finalResults
    );

  const confidencePerformance =
    createConfidencePerformance(
      finalResults
    );

  const risk =
    createRiskStats(
      finalResults
    );

  const finishedAt =
    performance.now();

  const durationSeconds =
    (
      finishedAt -
      startedAt
    ) /
      1000;

  const diagnostics = {
    requestedStartDate:
      formatLocalDate(
        config.startDate
      ),

    requestedEndDate:
      formatLocalDate(
        config.endDate
      ),

    requestedBlocks:
      blocks.length,

    successfulBlocks:
      successfulBlocks.length,

    failedBlocks:
      failures.length,

    rawResults:
      rawResults.length,

    uniqueResults:
      finalResults.length,

    removedDuplicates:
      deduplicated.removedDuplicates,

    chronological:
      isChronological(
        finalResults
      ),
  };

  return {
    config,

    summary,

    results:
      finalResults,

    blocks:
      successfulBlocks,

    failures,

    monthlyPerformance,

    pickPerformance,

    confidencePerformance,

    risk,

    diagnostics,

    durationSeconds,
  };
}