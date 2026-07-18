import {
  BacktestManager,
} from "./backtestManager";

import {
  runSeasonBacktest,
} from "./seasonBacktestRunner";

import type {
  SeasonBacktestResult,
} from "./seasonBacktestTypes";

/**
 * Konfiguration für einen manuellen
 * historischen Backtest-Lauf.
 */
export interface HistoricalBacktestTestConfig {
  startDate: Date;

  endDate: Date;

  line: number;

  odds: number;
}

/**
 * Hilfsfunktion für eine
 * lokale YYYY-MM-DD-Datumsdarstellung.
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
 * Erstellt ein lokales Datum aus
 * einem String im Format YYYY-MM-DD.
 *
 * Dadurch vermeiden wir die typische
 * UTC-Verschiebung von:
 *
 * new Date("2025-06-01")
 */
function parseLocalDate(
  value: string
): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (
    !match
  ) {
    throw new Error(
      `Ungültiges Datum "${value}". Erwartet wird YYYY-MM-DD.`
    );
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  const date =
    new Date(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0
    );

  /**
   * Verhindert, dass ungültige Daten
   * wie 2025-02-31 automatisch in
   * den nächsten Monat verschoben werden.
   */
  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    throw new Error(
      `Ungültiges Kalenderdatum "${value}".`
    );
  }

  return date;
}

/**
 * Führt einen echten historischen
 * Backtest-Lauf aus und gibt alle
 * wichtigen Informationen in der
 * Browser-Konsole aus.
 *
 * Diese Funktion ist zunächst nur
 * für Entwicklung und Validierung
 * gedacht.
 */
export async function runHistoricalBacktestTest(
  config: HistoricalBacktestTestConfig
): Promise<void> {
  const manager =
    new BacktestManager();

  console.log(
    "========================================"
  );

  console.log(
    "MLB HISTORICAL BACKTEST TEST"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Startdatum:",
    config.startDate.toISOString()
  );

  console.log(
    "Enddatum:",
    config.endDate.toISOString()
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
    "Backtest wird gestartet ..."
  );

  const startedAt =
    performance.now();

  try {
    const result =
      await manager.runHistoricalBacktest(
        config.startDate,
        config.endDate,
        config.line,
        config.odds
      );

    const finishedAt =
      performance.now();

    const durationSeconds =
      (
        (
          finishedAt -
          startedAt
        ) /
        1000
      ).toFixed(
        2
      );

    console.log(
      "========================================"
    );

    console.log(
      "BACKTEST ERFOLGREICH"
    );

    console.log(
      "========================================"
    );

    console.log(
      "Dauer:",
      durationSeconds,
      "Sekunden"
    );

    console.log(
      "Spiele gesamt:",
      result.summary.totalGames
    );

    console.log(
      "Entschiedene Wetten:",
      result.summary.decidedBets
    );

    console.log(
      "Gewonnen:",
      result.summary.wins
    );

    console.log(
      "Verloren:",
      result.summary.losses
    );

    console.log(
      "Pushes:",
      result.summary.pushes
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
      "ROI:",
      (
        result.summary.roi *
        100
      ).toFixed(
        2
      ) +
        " %"
    );

    console.log(
      "Yield:",
      (
        result.summary.yield *
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
      "========================================"
    );

    console.log(
      "EINZELSPIELE"
    );

    console.log(
      "========================================"
    );

    console.table(
      result.results.map(
        (
          game
        ) => ({
          gameId:
            game.gameId,

          date:
            game.gameDate,

          matchup:
            `${game.awayTeam} @ ${game.homeTeam}`,

          score:
            `${game.awayRuns}:${game.homeRuns}`,

          total:
            game.actualRuns,

          line:
            game.line,

          pick:
            game.predictedPick,

          confidence:
            game.confidence,

          outcome:
            game.outcome,

          profit:
            game.profit,
        })
      )
    );

    console.log(
      result.report
    );

    /**
     * Ergebnis zusätzlich global
     * verfügbar machen.
     */
    (
      window as Window & {
        __MLB_BACKTEST_RESULT__?:
          typeof result;
      }
    ).__MLB_BACKTEST_RESULT__ =
      result;
  } catch (
    error
  ) {
    console.error(
      "========================================"
    );

    console.error(
      "BACKTEST FEHLGESCHLAGEN"
    );

    console.error(
      "========================================"
    );

    console.error(
      error
    );

    throw error;
  }
}

/**
 * Kleiner reproduzierbarer Testlauf
 * über drei abgeschlossene Spieltage.
 *
 * Wir verwenden bewusst 2025.
 */
export async function runDefaultHistoricalBacktestTest(): Promise<void> {
  return runHistoricalBacktestTest({
    startDate:
      new Date(
        "2025-07-01T12:00:00"
      ),

    endDate:
      new Date(
        "2025-07-03T12:00:00"
      ),

    line:
      8.5,

    odds:
      1.9,
  });
}

/**
 * Führt einen flexiblen Saison-
 * oder Multi-Month-Backtest aus.
 *
 * Beispiel:
 *
 * runMLBSeasonBacktest(
 *   "2025-03-27",
 *   "2025-09-28",
 *   8.5,
 *   1.9
 * )
 */
export async function runMLBSeasonBacktest(
  startDate: string,
  endDate: string,
  line = 8.5,
  odds = 1.9
): Promise<SeasonBacktestResult> {
  const parsedStartDate =
    parseLocalDate(
      startDate
    );

  const parsedEndDate =
    parseLocalDate(
      endDate
    );

  if (
    parsedStartDate.getTime() >
    parsedEndDate.getTime()
  ) {
    throw new Error(
      "Das Startdatum darf nicht nach dem Enddatum liegen."
    );
  }

  console.log(
    "========================================"
  );

  console.log(
    "SAISON-BACKTEST WIRD VORBEREITET"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Start:",
    formatLocalDate(
      parsedStartDate
    )
  );

  console.log(
    "Ende:",
    formatLocalDate(
      parsedEndDate
    )
  );

  console.log(
    "Line:",
    line
  );

  console.log(
    "Quote:",
    odds
  );

  const result =
    await runSeasonBacktest({
      startDate:
        parsedStartDate,

      endDate:
        parsedEndDate,

      line,

      odds,
    });

  console.log(
    "========================================"
  );

  console.log(
    "SAISON-BACKTEST ABGESCHLOSSEN"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Dauer:",
    result.durationSeconds.toFixed(
      2
    ),
    "Sekunden"
  );

  console.log(
    "Spiele gesamt:",
    result.summary.totalGames
  );

  console.log(
    "Entschiedene Wetten:",
    result.summary.decidedBets
  );

  console.log(
    "Gewonnen:",
    result.summary.wins
  );

  console.log(
    "Verloren:",
    result.summary.losses
  );

  console.log(
    "Pushes:",
    result.summary.pushes
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

  console.log(
    "Yield:",
    (
      result.summary.yield *
      100
    ).toFixed(
      2
    ) +
      " %"
  );

  console.log(
    "========================================"
  );

  console.log(
    "MONATSPERFORMANCE"
  );

  console.log(
    "========================================"
  );

  console.table(
    result.monthlyPerformance.map(
      (
        month
      ) => ({
          Monat:
            month.month,

          Wetten:
            month.bets,

          Siege:
            month.wins,

          Niederlagen:
            month.losses,

          Pushes:
            month.pushes,

          Trefferquote:
            (
              month.hitRate *
              100
            ).toFixed(
              2
            ) +
              " %",

          Profit:
            month.profit.toFixed(
              2
            ),

          ROI:
            (
              month.roi *
              100
            ).toFixed(
              2
            ) +
              " %",
        })
      )
  );

  console.log(
    "========================================"
  );

  console.log(
    "OVER / UNDER PERFORMANCE"
  );

  console.log(
    "========================================"
  );

  console.table(
    result.pickPerformance.map(
      (
        pick
      ) => ({
          Pick:
            pick.pick.toUpperCase(),

          Wetten:
            pick.bets,

          Siege:
            pick.wins,

          Niederlagen:
            pick.losses,

          Pushes:
            pick.pushes,

          Trefferquote:
            (
              pick.hitRate *
              100
            ).toFixed(
              2
            ) +
              " %",

          Profit:
            pick.profit.toFixed(
              2
            ),

          ROI:
            (
              pick.roi *
              100
            ).toFixed(
              2
            ) +
              " %",
        })
      )
  );

  console.log(
    "========================================"
  );

  console.log(
    "CONFIDENCE BUCKETS"
  );

  console.log(
    "========================================"
  );

  console.table(
    result.confidencePerformance.map(
      (
        bucket
      ) => ({
          Bucket:
            bucket.bucket,

          Wetten:
            bucket.bets,

          Siege:
            bucket.wins,

          Niederlagen:
            bucket.losses,

          Pushes:
            bucket.pushes,

          Trefferquote:
            (
              bucket.hitRate *
              100
            ).toFixed(
              2
            ) +
              " %",

          Profit:
            bucket.profit.toFixed(
              2
            ),

          ROI:
            (
              bucket.roi *
              100
            ).toFixed(
              2
            ) +
              " %",
        })
      )
  );

  console.log(
    "========================================"
  );

  console.log(
    "RISIKO / DRAWDOWN"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Längste Gewinnserie:",
    result.risk.longestWinStreak
  );

  console.log(
    "Längste Verlustserie:",
    result.risk.longestLossStreak
  );

  console.log(
    "Maximum Drawdown:",
    result.risk.maximumDrawdown.toFixed(
      2
    ),
    "Units"
  );

  console.log(
    "Maximum Drawdown relativ:",
    (
      result.risk.maximumDrawdownPct *
      100
    ).toFixed(
      2
    ) +
      " %"
  );

  console.log(
    "Peak Equity:",
    result.risk.peakEquity.toFixed(
      2
    ),
    "Units"
  );

  console.log(
    "Final Equity:",
    result.risk.finalEquity.toFixed(
      2
    ),
    "Units"
  );

  console.log(
    "========================================"
  );

  console.log(
    "DIAGNOSTIK"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Angeforderte Blöcke:",
    result.diagnostics.requestedBlocks
  );

  console.log(
    "Erfolgreiche Blöcke:",
    result.diagnostics.successfulBlocks
  );

  console.log(
    "Fehlgeschlagene Blöcke:",
    result.diagnostics.failedBlocks
  );

  console.log(
    "Rohergebnisse:",
    result.diagnostics.rawResults
  );

  console.log(
    "Eindeutige Ergebnisse:",
    result.diagnostics.uniqueResults
  );

  console.log(
    "Entfernte Duplikate:",
    result.diagnostics.removedDuplicates
  );

  console.log(
    "Chronologisch:",
    result.diagnostics.chronological
      ? "JA"
      : "NEIN"
  );

  if (
    result.failures.length >
    0
  ) {
    console.log(
      "========================================"
    );

    console.log(
      "FEHLGESCHLAGENE BLÖCKE"
    );

    console.log(
      "========================================"
    );

    console.table(
      result.failures.map(
        (
          failure
        ) => ({
            Block:
              failure.block.key,

            Zeitraum:
              failure.block.label,

            Fehler:
              failure.error instanceof
              Error
                ? failure.error.message
                : String(
                    failure.error
                  ),
          })
        )
    );
  }

  /**
   * Vollständiges Saison-Ergebnis
   * global verfügbar machen.
   */
  (
    window as Window & {
      __MLB_SEASON_BACKTEST_RESULT__?:
        SeasonBacktestResult;
    }
  ).__MLB_SEASON_BACKTEST_RESULT__ =
    result;

  console.log(
    "========================================"
  );

  console.log(
    "VOLLSTÄNDIGES ERGEBNIS"
  );

  console.log(
    "========================================"
  );

  console.log(
    "window.__MLB_SEASON_BACKTEST_RESULT__"
  );

  return result;
}

/**
 * Vordefinierter Backtest für
 * die MLB Regular Season 2025.
 */
export async function runMLBSeasonBacktest2025(): Promise<SeasonBacktestResult> {
  return runMLBSeasonBacktest(
    "2025-03-27",
    "2025-09-28",
    8.5,
    1.9
  );
}

/**
 * Browser-Console-Helfer.
 *
 * Dadurch können die Saison-Backtests
 * direkt über die Browser-DevTools
 * gestartet werden.
 */
declare global {
  interface Window {
    runMLBSeasonBacktest:
      typeof runMLBSeasonBacktest;

    runMLBSeasonBacktest2025:
      typeof runMLBSeasonBacktest2025;

    __MLB_SEASON_BACKTEST_RESULT__?:
      SeasonBacktestResult;
  }
}

/**
 * Funktionen global auf window
 * registrieren.
 */
window.runMLBSeasonBacktest =
  runMLBSeasonBacktest;

window.runMLBSeasonBacktest2025 =
  runMLBSeasonBacktest2025;