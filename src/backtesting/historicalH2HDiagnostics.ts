import type {
  ScheduledGame,
} from "@/services/api/games";

import type {
  HistoricalGameDataContext,
  HistoricalH2HContext,
} from "./historicalDataContext";

/**
 * Möglicher Status eines historischen
 * H2H-Kontexts.
 *
 * ACTIVE:
 * Mindestens ein gültiges historisches
 * direktes Duell wurde gefunden.
 *
 * NO_HISTORY:
 * Die historische Abfrage war technisch
 * korrekt, aber innerhalb des verfügbaren
 * historischen Fensters existiert kein
 * früheres direktes Duell.
 *
 * INVALID:
 * Der Kontext enthält mindestens eine
 * Point-in-Time-Verletzung.
 */
export type HistoricalH2HDiagnosticStatus =
  | "ACTIVE"
  | "NO_HISTORY"
  | "INVALID";

/**
 * Diagnose eines einzelnen historischen
 * H2H-Spiels.
 */
export interface HistoricalH2HGameEntryDiagnostic {
  gamePk:
    number |
    null;

  gameDate:
    string;

  totalRuns: number;

  timestampValid: boolean;

  isCurrentGame: boolean;

  isBeforeCurrentGame: boolean;

  isLookAheadViolation: boolean;
}

/**
 * Vollständige H2H-Diagnose für ein
 * einzelnes historisches Backtest-Spiel.
 */
export interface HistoricalH2HGameDiagnostic {
  currentGamePk: number;

  currentGameDate: string;

  matchup: string;

  status:
    HistoricalH2HDiagnosticStatus;

  historicalGamesFound: number;

  oldestH2HGameDate:
    string |
    null;

  latestH2HGameDate:
    string |
    null;

  currentGameIncluded: boolean;

  futureGamesFound: number;

  invalidDateGamesFound: number;

  lookAheadViolations: number;

  allGamesStrictlyBeforeCurrentGame: boolean;

  entries:
    HistoricalH2HGameEntryDiagnostic[];
}

/**
 * Zusammenfassung der H2H-Coverage über
 * mehrere historische Backtest-Spiele.
 */
export interface HistoricalH2HCoverageDiagnostics {
  totalGames: number;

  activeGames: number;

  noHistoryGames: number;

  invalidGames: number;

  technicallyValidGames: number;

  activeCoveragePct: number;

  technicalCoveragePct: number;

  totalHistoricalH2HGames: number;

  totalLookAheadViolations: number;

  totalCurrentGameInclusions: number;

  diagnostics:
    HistoricalH2HGameDiagnostic[];
}

/**
 * Formatiert eine Prozentzahl für die
 * Konsolenausgabe.
 */
function calculatePercentage(
  value: number,
  total: number
): number {
  if (
    total <=
    0
  ) {
    return 0;
  }

  return Number(
    (
      (
        value /
        total
      ) *
      100
    ).toFixed(
      2
    )
  );
}

/**
 * Erstellt die Diagnose für einen
 * einzelnen historischen H2H-Kontext.
 *
 * Zentrale Point-in-Time-Regel:
 *
 * historicalH2HGame.gameDate
 * <
 * currentBacktestGame.gameDate
 */
export function createHistoricalH2HGameDiagnostic(
  game: ScheduledGame,
  context: HistoricalGameDataContext
): HistoricalH2HGameDiagnostic {
  const currentGameTimestamp =
    new Date(
      game.gameDate
    ).getTime();

  const entries:
    HistoricalH2HGameEntryDiagnostic[] =
    context.h2h.games.map(
      (
        h2hGame
      ) => {
        const h2hTimestamp =
          new Date(
            h2hGame.date
          ).getTime();

        const timestampValid =
          !Number.isNaN(
            h2hTimestamp
          );

        const isCurrentGame =
          h2hGame.gamePk !=
            null &&
          h2hGame.gamePk ===
            game.gamePk;

        const isBeforeCurrentGame =
          timestampValid &&
          !Number.isNaN(
            currentGameTimestamp
          ) &&
          h2hTimestamp <
            currentGameTimestamp;

        const isLookAheadViolation =
          !timestampValid ||
          !isBeforeCurrentGame ||
          isCurrentGame;

        return {
          gamePk:
            h2hGame.gamePk,

          gameDate:
            h2hGame.date,

          totalRuns:
            h2hGame.totalRuns,

          timestampValid,

          isCurrentGame,

          isBeforeCurrentGame,

          isLookAheadViolation,
        };
      }
    );

  const currentGameIncluded =
    entries.some(
      (
        entry
      ) =>
        entry.isCurrentGame
    );

  const futureGamesFound =
    entries.filter(
      (
        entry
      ) =>
        entry.timestampValid &&
        !entry.isCurrentGame &&
        !entry.isBeforeCurrentGame
    ).length;

  const invalidDateGamesFound =
    entries.filter(
      (
        entry
      ) =>
        !entry.timestampValid
    ).length;

  const lookAheadViolations =
    entries.filter(
      (
        entry
      ) =>
        entry.isLookAheadViolation
    ).length;

  const validEntries =
    entries.filter(
      (
        entry
      ) =>
        entry.timestampValid
    );

  const sortedValidEntries =
    [
      ...validEntries,
    ].sort(
      (
        firstEntry,
        secondEntry
      ) =>
        new Date(
          firstEntry.gameDate
        ).getTime() -
        new Date(
          secondEntry.gameDate
        ).getTime()
    );

  const oldestH2HGameDate =
    sortedValidEntries.length >
    0
      ? sortedValidEntries[
          0
        ].gameDate
      : null;

  const latestH2HGameDate =
    sortedValidEntries.length >
    0
      ? sortedValidEntries[
          sortedValidEntries.length -
          1
        ].gameDate
      : null;

  const allGamesStrictlyBeforeCurrentGame =
    lookAheadViolations ===
    0;

  let status:
    HistoricalH2HDiagnosticStatus;

  if (
    lookAheadViolations >
    0
  ) {
    status =
      "INVALID";
  } else if (
    entries.length ===
    0
  ) {
    status =
      "NO_HISTORY";
  } else {
    status =
      "ACTIVE";
  }

  return {
    currentGamePk:
      game.gamePk,

    currentGameDate:
      game.gameDate,

    matchup:
      `${game.awayTeamName} @ ${game.homeTeamName}`,

    status,

    historicalGamesFound:
      entries.length,

    oldestH2HGameDate,

    latestH2HGameDate,

    currentGameIncluded,

    futureGamesFound,

    invalidDateGamesFound,

    lookAheadViolations,

    allGamesStrictlyBeforeCurrentGame,

    entries,
  };
}

/**
 * Erstellt die H2H-Coverage-Diagnose für
 * alle historischen Backtest-Spiele.
 */
export function createHistoricalH2HCoverageDiagnostics(
  games: ScheduledGame[],
  contexts: HistoricalGameDataContext[]
): HistoricalH2HCoverageDiagnostics {
  const contextByGamePk =
    new Map(
      contexts.map(
        (
          context
        ) => [
          context.gamePk,
          context,
        ]
      )
    );

  const diagnostics:
    HistoricalH2HGameDiagnostic[] =
    [];

  for (
    const game of games
  ) {
    const context =
      contextByGamePk.get(
        game.gamePk
      );

    /**
     * Ein fehlender Datenkontext ist
     * technisch ungültig.
     *
     * Normalerweise sollte dieser Fall
     * in der aktuellen Pipeline nicht
     * auftreten.
     */
    if (
      !context
    ) {
      diagnostics.push({
        currentGamePk:
          game.gamePk,

        currentGameDate:
          game.gameDate,

        matchup:
          `${game.awayTeamName} @ ${game.homeTeamName}`,

        status:
          "INVALID",

        historicalGamesFound:
          0,

        oldestH2HGameDate:
          null,

        latestH2HGameDate:
          null,

        currentGameIncluded:
          false,

        futureGamesFound:
          0,

        invalidDateGamesFound:
          0,

        lookAheadViolations:
          1,

        allGamesStrictlyBeforeCurrentGame:
          false,

        entries:
          [],
      });

      continue;
    }

    diagnostics.push(
      createHistoricalH2HGameDiagnostic(
        game,
        context
      )
    );
  }

  const activeGames =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        diagnostic.status ===
        "ACTIVE"
    ).length;

  const noHistoryGames =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        diagnostic.status ===
        "NO_HISTORY"
    ).length;

  const invalidGames =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        diagnostic.status ===
        "INVALID"
    ).length;

  const technicallyValidGames =
    activeGames +
    noHistoryGames;

  const totalHistoricalH2HGames =
    diagnostics.reduce(
      (
        sum,
        diagnostic
      ) =>
        sum +
        diagnostic.historicalGamesFound,
      0
    );

  const totalLookAheadViolations =
    diagnostics.reduce(
      (
        sum,
        diagnostic
      ) =>
        sum +
        diagnostic.lookAheadViolations,
      0
    );

  const totalCurrentGameInclusions =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        diagnostic.currentGameIncluded
    ).length;

  return {
    totalGames:
      diagnostics.length,

    activeGames,

    noHistoryGames,

    invalidGames,

    technicallyValidGames,

    activeCoveragePct:
      calculatePercentage(
        activeGames,
        diagnostics.length
      ),

    technicalCoveragePct:
      calculatePercentage(
        technicallyValidGames,
        diagnostics.length
      ),

    totalHistoricalH2HGames,

    totalLookAheadViolations,

    totalCurrentGameInclusions,

    diagnostics,
  };
}

/**
 * Gibt die Diagnose eines einzelnen
 * historischen H2H-Spiels aus.
 */
export function logHistoricalH2HGameDiagnostic(
  diagnostic: HistoricalH2HGameDiagnostic
): void {
  console.log(
    "========================================"
  );

  console.log(
    "H2H POINT-IN-TIME DIAGNOSTIC"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Feld:
        "Matchup",

      Wert:
        diagnostic.matchup,
    },

    {
      Feld:
        "Current Game PK",

      Wert:
        diagnostic.currentGamePk,
    },

    {
      Feld:
        "Current Game Date",

      Wert:
        diagnostic.currentGameDate,
    },

    {
      Feld:
        "Status",

      Wert:
        diagnostic.status,
    },

    {
      Feld:
        "Historical H2H Games",

      Wert:
        diagnostic.historicalGamesFound,
    },

    {
      Feld:
        "Oldest H2H Game",

      Wert:
        diagnostic.oldestH2HGameDate ??
        "NONE",
    },

    {
      Feld:
        "Latest H2H Game",

      Wert:
        diagnostic.latestH2HGameDate ??
        "NONE",
    },

    {
      Feld:
        "Current Game Included",

      Wert:
        diagnostic.currentGameIncluded,
    },

    {
      Feld:
        "Future Games Found",

      Wert:
        diagnostic.futureGamesFound,
    },

    {
      Feld:
        "Invalid Date Games",

      Wert:
        diagnostic.invalidDateGamesFound,
    },

    {
      Feld:
        "Look-Ahead Violations",

      Wert:
        diagnostic.lookAheadViolations,
    },

    {
      Feld:
        "All H2H Games Strictly Before Current Game",

      Wert:
        diagnostic.allGamesStrictlyBeforeCurrentGame,
    },
  ]);

  if (
    diagnostic.entries.length >
    0
  ) {
    console.log(
      "Verwendete historische H2H-Spiele:"
    );

    console.table(
      diagnostic.entries.map(
        (
          entry
        ) => ({
          gamePk:
            entry.gamePk,

          gameDate:
            entry.gameDate,

          totalRuns:
            entry.totalRuns,

          timestampValid:
            entry.timestampValid,

          isCurrentGame:
            entry.isCurrentGame,

          isBeforeCurrentGame:
            entry.isBeforeCurrentGame,

          lookAheadViolation:
            entry.isLookAheadViolation,
        })
      )
    );
  } else {
    console.log(
      "Keine früheren direkten Duelle im historischen H2H-Fenster gefunden."
    );
  }

  if (
    diagnostic.status ===
    "INVALID"
  ) {
    console.error(
      "❌ H2H POINT-IN-TIME INVALID: Mindestens eine Look-Ahead-Verletzung wurde gefunden."
    );
  } else if (
    diagnostic.status ===
    "NO_HISTORY"
  ) {
    console.log(
      "ℹ️ H2H POINT-IN-TIME VALID: Keine frühere H2H-Historie vorhanden."
    );
  } else {
    console.log(
      "✅ H2H POINT-IN-TIME VALID: Alle verwendeten direkten Duelle liegen strikt vor dem aktuellen Spiel."
    );
  }

  console.log(
    "========================================"
  );
}

/**
 * Gibt die vollständige H2H-Coverage-
 * Diagnose aller Backtest-Spiele aus.
 */
export function logHistoricalH2HCoverageDiagnostics(
  coverage:
    HistoricalH2HCoverageDiagnostics
): void {
  console.log(
    "========================================"
  );

  console.log(
    "H2H COVERAGE DIAGNOSTIC"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Metrik:
        "H2H-Spiele gesamt",

      Wert:
        coverage.totalGames,
    },

    {
      Metrik:
        "H2H ACTIVE",

      Wert:
        coverage.activeGames,
    },

    {
      Metrik:
        "H2H NO_HISTORY",

      Wert:
        coverage.noHistoryGames,
    },

    {
      Metrik:
        "H2H INVALID",

      Wert:
        coverage.invalidGames,
    },

    {
      Metrik:
        "Technisch gültige Spiele",

      Wert:
        coverage.technicallyValidGames,
    },

    {
      Metrik:
        "ACTIVE Coverage",

      Wert:
        `${coverage.activeCoveragePct.toFixed(
          2
        )} %`,
    },

    {
      Metrik:
        "Technical Coverage",

      Wert:
        `${coverage.technicalCoveragePct.toFixed(
          2
        )} %`,
    },

    {
      Metrik:
        "Historische H2H-Spiele geladen",

      Wert:
        coverage.totalHistoricalH2HGames,
    },

    {
      Metrik:
        "Look-Ahead Violations",

      Wert:
        coverage.totalLookAheadViolations,
    },

    {
      Metrik:
        "Current Game Inclusions",

      Wert:
        coverage.totalCurrentGameInclusions,
    },
  ]);

  console.log(
    "H2H-Einzeldiagnosen:"
  );

  console.table(
    coverage.diagnostics.map(
      (
        diagnostic
      ) => ({
        gamePk:
          diagnostic.currentGamePk,

        gameDate:
          diagnostic.currentGameDate,

        matchup:
          diagnostic.matchup,

        status:
          diagnostic.status,

        h2hGames:
          diagnostic.historicalGamesFound,

        oldestH2H:
          diagnostic.oldestH2HGameDate ??
          "NONE",

        latestH2H:
          diagnostic.latestH2HGameDate ??
          "NONE",

        currentGameIncluded:
          diagnostic.currentGameIncluded,

        futureGames:
          diagnostic.futureGamesFound,

        lookAheadViolations:
          diagnostic.lookAheadViolations,
      })
    )
  );

  if (
    coverage.invalidGames ===
      0 &&
    coverage.totalLookAheadViolations ===
      0 &&
    coverage.totalCurrentGameInclusions ===
      0 &&
    coverage.technicalCoveragePct ===
      100
  ) {
    console.log(
      "✅ H2H POINT-IN-TIME COVERAGE COMPLETE: 100.00 % technisch gültig, keine Look-Ahead-Verletzungen."
    );
  } else {
    console.error(
      "❌ H2H POINT-IN-TIME COVERAGE INCOMPLETE: Mindestens ein technischer oder zeitlicher Fehler wurde gefunden."
    );
  }

  console.log(
    "========================================"
  );
}

/**
 * Hilfsfunktion für spätere direkte
 * Diagnosen eines H2H-Kontexts.
 *
 * Dadurch kann der Kontext auch außerhalb
 * des BacktestManagers separat geprüft
 * werden.
 */
export function validateHistoricalH2HContext(
  game: ScheduledGame,
  h2h: HistoricalH2HContext
): boolean {
  const currentGameTimestamp =
    new Date(
      game.gameDate
    ).getTime();

  if (
    Number.isNaN(
      currentGameTimestamp
    )
  ) {
    return false;
  }

  return h2h.games.every(
    (
      historicalGame
    ) => {
      if (
        historicalGame.gamePk !=
          null &&
        historicalGame.gamePk ===
          game.gamePk
      ) {
        return false;
      }

      const historicalTimestamp =
        new Date(
          historicalGame.date
        ).getTime();

      return (
        !Number.isNaN(
          historicalTimestamp
        ) &&
        historicalTimestamp <
          currentGameTimestamp
      );
    }
  );
}