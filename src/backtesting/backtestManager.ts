import type {
  BacktestGame,
  BacktestResult,
  BacktestSummary,
} from "./backtestTypes";

import type {
  HistoricalBacktestState,
} from "./historicalBacktestState";

import {
  createPredictedBacktestGames,
  runAnalyzerBacktest,
} from "./backtestRunner";

import {
  evaluateBacktestGames,
  runBacktest,
} from "./backtestEngine";

import {
  createBacktestReport,
} from "./backtestReport";

import {
  fetchHistoricalGames,
} from "@/services/api/games";

import type {
  ScheduledGame,
} from "@/services/api/games";

import {
  convertHistoricalGamesToBacktestGames,
} from "./historicalGames";

import {
  createHistoricalGameDataContexts,
} from "./historicalDataContext";

import {
  createHistoricalAnalyzerStates,
} from "./historicalAnalyzerState";

import {
  createHistoricalPitcherGameDiagnostic,
  logHistoricalPitcherGameDiagnostic,
} from "./historicalPitcherDiagnostics";

import {
  createHistoricalBullpenGameDiagnostic,
  logHistoricalBullpenGameDiagnostic,
} from "./historicalBullpenDiagnostics";

import {
  createHistoricalWeatherCoverageDiagnostics,
  createHistoricalWeatherGameDiagnostic,
  logHistoricalWeatherCoverageDiagnostics,
  logHistoricalWeatherGameDiagnostic,
} from "./historicalWeatherDiagnostics";

import {
  createHistoricalH2HCoverageDiagnostics,
  createHistoricalH2HGameDiagnostic,
  logHistoricalH2HCoverageDiagnostics,
  logHistoricalH2HGameDiagnostic,
} from "./historicalH2HDiagnostics";

/**
 * Diagnoseinformationen über die vollständige
 * historische Backtest-Pipeline.
 */
export interface BacktestPipelineDiagnostics {
  requestedDays: number;

  rawLoadedGames: number;

  removedDuplicates: number;

  uniqueHistoricalGames: number;

  backtestGames: number;

  historicalContexts: number;

  historicalStates: number;

  gamesWithoutState: number;

  statesWithoutGame: number;

  predictedGames: number;

  finalResults: number;
}

/**
 * Vollständiges Ergebnis eines
 * detaillierten Backtests.
 */
export interface DetailedBacktestResult {
  summary: BacktestSummary;

  results: BacktestResult[];

  report: string;

  diagnostics: BacktestPipelineDiagnostics;
}

/**
 * Vollständige vorbereitete historische
 * Datenbasis für einen automatischen Backtest.
 */
export interface HistoricalBacktestDataset {
  /**
   * Bereinigte und chronologisch sortierte
   * historische MLB-Spiele.
   *
   * Diese Liste enthält weiterhin alle
   * eindeutigen Schedule-Spiele des
   * angeforderten Zeitraums.
   *
   * Dazu können beispielsweise auch
   * verschobene Spiele gehören.
   */
  historicalGames: ScheduledGame[];

  /**
   * Historische Spielergebnisse im
   * BacktestGame-Format.
   *
   * Diese Liste enthält ausschließlich
   * tatsächlich auswertbare Spiele.
   */
  backtestGames: BacktestGame[];

  /**
   * Point-in-Time AnalyzerStates mit
   * eindeutiger MLB gamePk / gameId.
   *
   * States werden ausschließlich für
   * tatsächlich auswertbare BacktestGames
   * erzeugt.
   */
  states: HistoricalBacktestState[];

  /**
   * Diagnoseinformationen aus der
   * Datenvorbereitung.
   */
  diagnostics: BacktestPipelineDiagnostics;
}

/**
 * Ergebnis der Bereinigung historischer Spiele.
 */
interface NormalizedHistoricalGames {
  games: ScheduledGame[];

  removedDuplicates: number;
}

/**
 * Internes Ergebnis beim Laden eines
 * historischen Datumsbereichs.
 */
interface HistoricalDateRangeLoadResult {
  games: ScheduledGame[];

  requestedDays: number;

  rawLoadedGames: number;

  removedDuplicates: number;
}

/**
 * Bereinigt historische MLB-Spiele.
 *
 * 1. Doppelte gamePk werden entfernt.
 * 2. Spiele werden chronologisch nach
 *    gameDate sortiert.
 *
 * Die erste gefundene Version einer gamePk
 * bleibt erhalten.
 */
function normalizeHistoricalGames(
  games: ScheduledGame[]
): NormalizedHistoricalGames {
  const gameById =
    new Map<
      number,
      ScheduledGame
    >();

  let removedDuplicates =
    0;

  for (
    const game of games
  ) {
    if (
      gameById.has(
        game.gamePk
      )
    ) {
      removedDuplicates +=
        1;

      continue;
    }

    gameById.set(
      game.gamePk,
      game
    );
  }

  const normalizedGames =
    Array.from(
      gameById.values()
    );

  normalizedGames.sort(
    (
      firstGame,
      secondGame
    ) => {
      const firstTimestamp =
        new Date(
          firstGame.gameDate
        ).getTime();

      const secondTimestamp =
        new Date(
          secondGame.gameDate
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
          firstGame.gamePk -
          secondGame.gamePk
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
          firstGame.gamePk -
          secondGame.gamePk
        );
      }

      return (
        firstTimestamp -
        secondTimestamp
      );
    }
  );

  return {
    games:
      normalizedGames,

    removedDuplicates,
  };
}

/**
 * Gibt die kompakte Pipeline-Zusammenfassung
 * am Ende eines historischen Backtests aus.
 */
function printPipelineSummary(
  diagnostics: BacktestPipelineDiagnostics
): void {
  console.log(
    "========================================"
  );

  console.log(
    "BACKTEST PIPELINE SUMMARY"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Schritt:
        "Angefragte Kalendertage",

      Anzahl:
        diagnostics.requestedDays,
    },

    {
      Schritt:
        "Roh geladene Spiele",

      Anzahl:
        diagnostics.rawLoadedGames,
    },

    {
      Schritt:
        "Entfernte Duplikate",

      Anzahl:
        diagnostics.removedDuplicates,
    },

    {
      Schritt:
        "Eindeutige historische Spiele",

      Anzahl:
        diagnostics.uniqueHistoricalGames,
    },

    {
      Schritt:
        "Erzeugte BacktestGames",

      Anzahl:
        diagnostics.backtestGames,
    },

    {
      Schritt:
        "Historische Datenkontexte",

      Anzahl:
        diagnostics.historicalContexts,
    },

    {
      Schritt:
        "HistoricalBacktestStates",

      Anzahl:
        diagnostics.historicalStates,
    },

    {
      Schritt:
        "BacktestGames ohne State",

      Anzahl:
        diagnostics.gamesWithoutState,
    },

    {
      Schritt:
        "States ohne BacktestGame",

      Anzahl:
        diagnostics.statesWithoutGame,
    },

    {
      Schritt:
        "Prognostizierte Spiele",

      Anzahl:
        diagnostics.predictedGames,
    },

    {
      Schritt:
        "Finale Ergebnisse",

      Anzahl:
        diagnostics.finalResults,
    },
  ]);

  console.log(
    "========================================"
  );
}

export class BacktestManager {
  /**
   * Führt einen normalen historischen
   * Analyzer-Backtest aus.
   */
  run(
    states: HistoricalBacktestState[],
    games: BacktestGame[]
  ): BacktestSummary {
    return runAnalyzerBacktest(
      states,
      games
    );
  }

  /**
   * Führt einen detaillierten historischen
   * Backtest aus.
   *
   * Die Diagnoseinformationen aus der
   * Datenvorbereitung werden ergänzt um
   * die tatsächliche Matching- und
   * Ergebnisstufe.
   */
  runDetailed(
    states: HistoricalBacktestState[],
    games: BacktestGame[],
    baseDiagnostics?: BacktestPipelineDiagnostics
  ): DetailedBacktestResult {
    const stateGameIds =
      new Set(
        states.map(
          (
            entry
          ) =>
            entry.gameId
        )
      );

    const backtestGameIds =
      new Set(
        games.map(
          (
            game
          ) =>
            game.gameId
        )
      );

    const gamesWithoutState =
      games.filter(
        (
          game
        ) =>
          !stateGameIds.has(
            game.gameId
          )
      );

    const statesWithoutGame =
      states.filter(
        (
          entry
        ) =>
          !backtestGameIds.has(
            entry.gameId
          )
      );

    const predictedGames =
      createPredictedBacktestGames(
        states,
        games
      );

    const sortedPredictedGames =
      [
        ...predictedGames,
      ].sort(
        (
          firstGame,
          secondGame
        ) => {
          const firstTimestamp =
            new Date(
              firstGame.gameDate
            ).getTime();

          const secondTimestamp =
            new Date(
              secondGame.gameDate
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
              firstGame.gameId -
              secondGame.gameId
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
              firstGame.gameId -
              secondGame.gameId
            );
          }

          return (
            firstTimestamp -
            secondTimestamp
          );
        }
      );

    const summary =
      runBacktest(
        sortedPredictedGames
      );

    const results =
      evaluateBacktestGames(
        sortedPredictedGames
      );

    const report =
      createBacktestReport(
        summary,
        results
      );

    const diagnostics:
      BacktestPipelineDiagnostics = {
        requestedDays:
          baseDiagnostics
            ?.requestedDays ??
          0,

        rawLoadedGames:
          baseDiagnostics
            ?.rawLoadedGames ??
          games.length,

        removedDuplicates:
          baseDiagnostics
            ?.removedDuplicates ??
          0,

        uniqueHistoricalGames:
          baseDiagnostics
            ?.uniqueHistoricalGames ??
          games.length,

        backtestGames:
          games.length,

        historicalContexts:
          baseDiagnostics
            ?.historicalContexts ??
          states.length,

        historicalStates:
          states.length,

        gamesWithoutState:
          gamesWithoutState.length,

        statesWithoutGame:
          statesWithoutGame.length,

        predictedGames:
          predictedGames.length,

        finalResults:
          results.length,
      };

    printPipelineSummary(
      diagnostics
    );

    return {
      summary,

      results,

      report,

      diagnostics,
    };
  }

  /**
   * Lädt historische MLB-Spiele
   * für ein bestimmtes Datum.
   */
  async loadHistoricalGames(
    date: Date
  ): Promise<ScheduledGame[]> {
    return fetchHistoricalGames(
      date
    );
  }

  /**
   * Lädt historische MLB-Spiele eines
   * Datums und wandelt abgeschlossene
   * Spiele in BacktestGame-Datensätze um.
   */
  async loadBacktestGamesForDate(
    date: Date,
    line: number,
    odds: number
  ): Promise<BacktestGame[]> {
    const games =
      await fetchHistoricalGames(
        date
      );

    const normalized =
      normalizeHistoricalGames(
        games
      );

    return convertHistoricalGamesToBacktestGames(
      normalized.games,
      line,
      odds
    );
  }

  /**
   * Interne Ladefunktion für einen
   * kompletten Datumsbereich.
   */
  private async loadHistoricalDateRangeWithDiagnostics(
    startDate: Date,
    endDate: Date
  ): Promise<HistoricalDateRangeLoadResult> {
    const allGames:
      ScheduledGame[] = [];

    const currentDate =
      new Date(
        startDate
      );

    const finalDate =
      new Date(
        endDate
      );

    currentDate.setHours(
      0,
      0,
      0,
      0
    );

    finalDate.setHours(
      0,
      0,
      0,
      0
    );

    let requestedDays =
      0;

    while (
      currentDate.getTime() <=
      finalDate.getTime()
    ) {
      const gamesForDate =
        await fetchHistoricalGames(
          new Date(
            currentDate
          )
        );

      requestedDays +=
        1;

      allGames.push(
        ...gamesForDate
      );

      currentDate.setDate(
        currentDate.getDate() +
        1
      );
    }

    const normalized =
      normalizeHistoricalGames(
        allGames
      );

    return {
      games:
        normalized.games,

      requestedDays,

      rawLoadedGames:
        allGames.length,

      removedDuplicates:
        normalized.removedDuplicates,
    };
  }

  /**
   * Lädt historische MLB-Spiele für
   * einen kompletten Datumsbereich.
   */
  async loadHistoricalGamesForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ScheduledGame[]> {
    const loaded =
      await this.loadHistoricalDateRangeWithDiagnostics(
        startDate,
        endDate
      );

    return loaded.games;
  }

  /**
   * Lädt historische BacktestGames
   * für einen kompletten Datumsbereich.
   */
  async loadBacktestGamesForDateRange(
    startDate: Date,
    endDate: Date,
    line: number,
    odds: number
  ): Promise<BacktestGame[]> {
    const historicalGames =
      await this.loadHistoricalGamesForDateRange(
        startDate,
        endDate
      );

    return convertHistoricalGamesToBacktestGames(
      historicalGames,
      line,
      odds
    );
  }

  /**
   * Erstellt die vollständige historische
   * Datenbasis für einen Backtest.
   */
  async prepareHistoricalBacktestDataset(
    startDate: Date,
    endDate: Date,
    line: number,
    odds: number
  ): Promise<HistoricalBacktestDataset> {
    const loaded =
      await this.loadHistoricalDateRangeWithDiagnostics(
        startDate,
        endDate
      );

    const historicalGames =
      loaded.games;

    const backtestGames =
      convertHistoricalGamesToBacktestGames(
        historicalGames,
        line,
        odds
      );

    const backtestGameIds =
      new Set(
        backtestGames.map(
          (
            game
          ) =>
            game.gameId
        )
      );

    const analyzableHistoricalGames =
      historicalGames.filter(
        (
          game
        ) =>
          backtestGameIds.has(
            game.gamePk
          )
      );

    /**
     * Point-in-Time-Kontexte erzeugen.
     *
     * Aktuell enthalten:
     *
     * - Team-Form
     * - Offense
     * - Starting Pitcher
     * - Bullpen
     * - Weather
     * - H2H
     */
    const contexts =
      await createHistoricalGameDataContexts(
        analyzableHistoricalGames
      );

    /**
     * ========================================
     * STARTING-PITCHER-DIAGNOSE
     * ========================================
     */
    const pitcherDiagnosticGame =
      analyzableHistoricalGames.find(
        (
          game
        ) => {
          const context =
            contexts.find(
              (
                entry
              ) =>
                entry.gamePk ===
                game.gamePk
            );

          return (
            context !=
              null &&
            context.home
                .pitcherId !=
              null &&
            context.away
                .pitcherId !=
              null &&
            context.home
                .pitcher !=
              null &&
            context.away
                .pitcher !=
              null
          );
        }
      );

    if (
      pitcherDiagnosticGame
    ) {
      const pitcherDiagnosticContext =
        contexts.find(
          (
            context
          ) =>
            context.gamePk ===
            pitcherDiagnosticGame.gamePk
        );

      if (
        pitcherDiagnosticContext
      ) {
        const pitcherDiagnostic =
          createHistoricalPitcherGameDiagnostic(
            pitcherDiagnosticGame,
            pitcherDiagnosticContext,
            line
          );

        logHistoricalPitcherGameDiagnostic(
          pitcherDiagnostic
        );
      }
    } else {
      console.warn(
        "[Historical Pitcher Diagnostic] Kein geeignetes Spiel mit vollständigen Home- und Away-Pitcher-Daten gefunden."
      );
    }

    /**
     * ========================================
     * BULLPEN-DIAGNOSE
     * ========================================
     */
    const bullpenDiagnosticGame =
      analyzableHistoricalGames.find(
        (
          game
        ) => {
          const context =
            contexts.find(
              (
                entry
              ) =>
                entry.gamePk ===
                game.gamePk
            );

          return (
            context !=
              null &&
            context.home
                .bullpen !=
              null &&
            context.away
                .bullpen !=
              null &&
            context.home
                .bullpen
                ?.era !=
              null &&
            context.away
                .bullpen
                ?.era !=
              null &&
            context.home
                .bullpen
                ?.whip !=
              null &&
            context.away
                .bullpen
                ?.whip !=
              null
          );
        }
      );

    if (
      bullpenDiagnosticGame
    ) {
      const bullpenDiagnosticContext =
        contexts.find(
          (
            context
          ) =>
            context.gamePk ===
            bullpenDiagnosticGame.gamePk
        );

      if (
        bullpenDiagnosticContext
      ) {
        const bullpenDiagnostic =
          createHistoricalBullpenGameDiagnostic(
            bullpenDiagnosticGame,
            bullpenDiagnosticContext,
            line
          );

        logHistoricalBullpenGameDiagnostic(
          bullpenDiagnostic
        );
      }
    } else {
      console.warn(
        "[Historical Bullpen Diagnostic] Kein geeignetes Spiel mit vollständigen Home- und Away-Bullpen-Daten gefunden."
      );
    }

    /**
     * ========================================
     * WEATHER-DIAGNOSE
     * ========================================
     *
     * Wir suchen das erste historische
     * Spiel mit verwertbaren historischen
     * Wetterdaten.
     *
     * Permanente Dome-Stadien gelten
     * ebenfalls als verwertbar.
     */
    const weatherDiagnosticGame =
      analyzableHistoricalGames.find(
        (
          game
        ) => {
          const context =
            contexts.find(
              (
                entry
              ) =>
                entry.gamePk ===
                game.gamePk
            );

          return (
            context !=
              null &&
            (
              context.weather
                .snapshot !=
                null ||
              context.weather
                .roofType ===
                "dome"
            )
          );
        }
      );

    if (
      weatherDiagnosticGame
    ) {
      const weatherDiagnosticContext =
        contexts.find(
          (
            context
          ) =>
            context.gamePk ===
            weatherDiagnosticGame.gamePk
        );

      if (
        weatherDiagnosticContext
      ) {
        const weatherDiagnostic =
          createHistoricalWeatherGameDiagnostic(
            weatherDiagnosticGame,
            weatherDiagnosticContext,
            line
          );

        logHistoricalWeatherGameDiagnostic(
          weatherDiagnostic
        );
      }
    } else {
      console.warn(
        "[Historical Weather Diagnostic] Kein geeignetes Spiel mit historischen Wetterdaten oder Dome-Kontext gefunden."
      );
    }

    /**
     * ========================================
     * WEATHER-COVERAGE-DIAGNOSE
     * ========================================
     *
     * Prüft jedes einzelne historische
     * Backtest-Spiel und zeigt exakt,
     * welches Spiel kein aktives
     * Weather-Modul besitzt.
     */
    const weatherCoverageDiagnostics =
      createHistoricalWeatherCoverageDiagnostics(
        analyzableHistoricalGames,
        contexts,
        line
      );

    logHistoricalWeatherCoverageDiagnostics(
      weatherCoverageDiagnostics
    );

    /**
     * ========================================
     * H2H POINT-IN-TIME-DIAGNOSE
     * ========================================
     *
     * Wir suchen bevorzugt ein Spiel mit
     * mindestens einem historischen direkten
     * Duell.
     *
     * Dadurch können wir in der Konsole
     * konkret prüfen:
     *
     * - aktuelles Spiel ausgeschlossen
     * - keine zukünftigen Spiele
     * - keine Look-Ahead-Verletzung
     * - alle H2H-Spiele strikt vor dem
     *   aktuellen Backtest-Spiel
     */
    const h2hDiagnosticGame =
      analyzableHistoricalGames.find(
        (
          game
        ) => {
          const context =
            contexts.find(
              (
                entry
              ) =>
                entry.gamePk ===
                game.gamePk
            );

          return (
            context !=
              null &&
            context.h2h
                .games
                .length >
              0
          );
        }
      ) ??
      analyzableHistoricalGames[
        0
      ];

    if (
      h2hDiagnosticGame
    ) {
      const h2hDiagnosticContext =
        contexts.find(
          (
            context
          ) =>
            context.gamePk ===
            h2hDiagnosticGame.gamePk
        );

      if (
        h2hDiagnosticContext
      ) {
        const h2hDiagnostic =
          createHistoricalH2HGameDiagnostic(
            h2hDiagnosticGame,
            h2hDiagnosticContext
          );

        logHistoricalH2HGameDiagnostic(
          h2hDiagnostic
        );
      }
    } else {
      console.warn(
        "[Historical H2H Diagnostic] Kein historisches Backtest-Spiel für die H2H-Diagnose gefunden."
      );
    }

    /**
     * ========================================
     * H2H-COVERAGE-DIAGNOSE
     * ========================================
     *
     * Prüft jedes einzelne historische
     * Backtest-Spiel.
     *
     * ACTIVE:
     * Echte frühere direkte Duelle vorhanden.
     *
     * NO_HISTORY:
     * Technisch korrekt, aber keine früheren
     * direkten Duelle im historischen Fenster.
     *
     * INVALID:
     * Point-in-Time-Verletzung oder fehlender
     * Datenkontext.
     */
    const h2hCoverageDiagnostics =
      createHistoricalH2HCoverageDiagnostics(
        analyzableHistoricalGames,
        contexts
      );

    logHistoricalH2HCoverageDiagnostics(
      h2hCoverageDiagnostics
    );

    /**
     * HistoricalBacktestStates erzeugen.
     */
    const states =
      createHistoricalAnalyzerStates(
        analyzableHistoricalGames,
        contexts,
        line
      );

    const diagnostics:
      BacktestPipelineDiagnostics = {
        requestedDays:
          loaded.requestedDays,

        rawLoadedGames:
          loaded.rawLoadedGames,

        removedDuplicates:
          loaded.removedDuplicates,

        uniqueHistoricalGames:
          historicalGames.length,

        backtestGames:
          backtestGames.length,

        historicalContexts:
          contexts.length,

        historicalStates:
          states.length,

        gamesWithoutState:
          0,

        statesWithoutGame:
          0,

        predictedGames:
          0,

        finalResults:
          0,
      };

    return {
      historicalGames,

      backtestGames,

      states,

      diagnostics,
    };
  }

  /**
   * Führt die vollständige automatische
   * historische Backtest-Pipeline aus.
   */
  async runHistoricalBacktest(
    startDate: Date,
    endDate: Date,
    line: number,
    odds: number
  ): Promise<DetailedBacktestResult> {
    const dataset =
      await this.prepareHistoricalBacktestDataset(
        startDate,
        endDate,
        line,
        odds
      );

    return this.runDetailed(
      dataset.states,
      dataset.backtestGames,
      dataset.diagnostics
    );
  }
}