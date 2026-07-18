import type {
  HistoricalMarketSnapshot,
  HistoricalMarketStatus,
} from "@/services/api/historicalMarket";

/**
 * Diagnose eines einzelnen
 * historischen Market-Snapshots.
 */
export interface HistoricalMarketGameDiagnostic {
  gamePk:
    number;

  matchup:
    string;

  gameStart:
    string;

  status:
    HistoricalMarketStatus;

  requestedAt:
    string;

  snapshotTimestamp:
    string |
    null;

  currentLine:
    number |
    null;

  bestOddsOver:
    number |
    null;

  bestOddsUnder:
    number |
    null;

  bookmakerCount:
    number;

  latestBookmakerUpdate:
    string |
    null;

  snapshotBeforeGame:
    boolean;

  latestBookmakerUpdateBeforeGame:
    boolean;

  lookAheadViolation:
    boolean;

  reason:
    string |
    null;
}

/**
 * Coverage-Zusammenfassung.
 */
export interface HistoricalMarketCoverageDiagnostics {
  totalGames:
    number;

  activeGames:
    number;

  noDataGames:
    number;

  accessUnavailableGames:
    number;

  invalidGames:
    number;

  activeCoveragePct:
    number;

  technicalCoveragePct:
    number;

  accessUnavailablePct:
    number;

  lookAheadViolations:
    number;

  games:
    HistoricalMarketGameDiagnostic[];
}

/**
 * Prüft, ob ein Zeitstempel
 * strikt vor Spielbeginn liegt.
 */
function isTimestampBeforeGame(
  timestamp:
    string |
    null,
  gameStart:
    string
): boolean {
  if (
    timestamp ==
    null
  ) {
    return false;
  }

  const timestampMs =
    new Date(
      timestamp
    ).getTime();

  const gameStartMs =
    new Date(
      gameStart
    ).getTime();

  return (
    !Number.isNaN(
      timestampMs
    ) &&
    !Number.isNaN(
      gameStartMs
    ) &&
    timestampMs <
      gameStartMs
  );
}

/**
 * Erstellt die Diagnose eines
 * einzelnen historischen Spiels.
 */
export function createHistoricalMarketGameDiagnostic(
  gamePk:
    number,
  homeTeamName:
    string,
  awayTeamName:
    string,
  market:
    HistoricalMarketSnapshot
): HistoricalMarketGameDiagnostic {
  const snapshotBeforeGame =
    isTimestampBeforeGame(
      market.snapshotTimestamp,
      market.gameStart
    );

  const latestBookmakerUpdateBeforeGame =
    isTimestampBeforeGame(
      market.latestBookmakerUpdate,
      market.gameStart
    );

  /**
   * Nur ACTIVE kann eine echte
   * Look-Ahead-Verletzung besitzen,
   * weil nur ACTIVE tatsächlich
   * Marktdaten verwendet.
   *
   * ACCESS_UNAVAILABLE ist keine
   * Look-Ahead-Verletzung.
   */
  const lookAheadViolation =
    market.status ===
      "ACTIVE" &&
    (
      !snapshotBeforeGame ||
      !latestBookmakerUpdateBeforeGame
    );

  return {
    gamePk,

    matchup:
      `${awayTeamName} @ ${homeTeamName}`,

    gameStart:
      market.gameStart,

    status:
      market.status,

    requestedAt:
      market.requestedAt,

    snapshotTimestamp:
      market.snapshotTimestamp,

    currentLine:
      market.currentLine,

    bestOddsOver:
      market.bestOddsOver,

    bestOddsUnder:
      market.bestOddsUnder,

    bookmakerCount:
      market.bookmakerCount,

    latestBookmakerUpdate:
      market.latestBookmakerUpdate,

    snapshotBeforeGame,

    latestBookmakerUpdateBeforeGame,

    lookAheadViolation,

    reason:
      market.reason,
  };
}

/**
 * Erstellt die Coverage-Diagnose
 * für mehrere Spiele.
 */
export function createHistoricalMarketCoverageDiagnostics(
  games:
    HistoricalMarketGameDiagnostic[]
): HistoricalMarketCoverageDiagnostics {
  const activeGames =
    games.filter(
      (
        game
      ) =>
        game.status ===
        "ACTIVE"
    ).length;

  const noDataGames =
    games.filter(
      (
        game
      ) =>
        game.status ===
        "NO_DATA"
    ).length;

  const accessUnavailableGames =
    games.filter(
      (
        game
      ) =>
        game.status ===
        "ACCESS_UNAVAILABLE"
    ).length;

  const invalidGames =
    games.filter(
      (
        game
      ) =>
        game.status ===
        "INVALID"
    ).length;

  const lookAheadViolations =
    games.filter(
      (
        game
      ) =>
        game.lookAheadViolation
    ).length;

  const totalGames =
    games.length;

  /**
   * ACTIVE:
   *
   * Echte historische Marktdaten
   * wurden erfolgreich verwendet.
   */
  const activeCoveragePct =
    totalGames >
    0
      ? (
          activeGames /
          totalGames
        ) *
        100
      : 0;

  /**
   * Technisch gültig bedeutet:
   *
   * ACTIVE
   * NO_DATA
   * ACCESS_UNAVAILABLE
   *
   * INVALID ist der einzige Status,
   * der einen echten technischen
   * oder zeitlichen Integritätsfehler
   * beschreibt.
   */
  const technicalCoveragePct =
    totalGames >
    0
      ? (
          (
            activeGames +
            noDataGames +
            accessUnavailableGames
          ) /
          totalGames
        ) *
        100
      : 0;

  /**
   * Anteil der Spiele, bei denen
   * Historical Odds wegen der
   * Datenquelle bzw. des API-Zugangs
   * nicht verfügbar waren.
   */
  const accessUnavailablePct =
    totalGames >
    0
      ? (
          accessUnavailableGames /
          totalGames
        ) *
        100
      : 0;

  return {
    totalGames,

    activeGames,

    noDataGames,

    accessUnavailableGames,

    invalidGames,

    activeCoveragePct,

    technicalCoveragePct,

    accessUnavailablePct,

    lookAheadViolations,

    games,
  };
}

/**
 * Konsolenausgabe für ein
 * einzelnes historisches Spiel.
 */
export function logHistoricalMarketGameDiagnostic(
  diagnostic:
    HistoricalMarketGameDiagnostic
): void {
  console.log(
    "========================================"
  );

  console.log(
    "HISTORICAL MARKET POINT-IN-TIME DIAGNOSTIC"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Feld:
        "gamePk",

      Wert:
        diagnostic.gamePk,
    },

    {
      Feld:
        "Matchup",

      Wert:
        diagnostic.matchup,
    },

    {
      Feld:
        "Game Start",

      Wert:
        diagnostic.gameStart,
    },

    {
      Feld:
        "Status",

      Wert:
        diagnostic.status,
    },

    {
      Feld:
        "Requested At",

      Wert:
        diagnostic.requestedAt,
    },

    {
      Feld:
        "Snapshot Timestamp",

      Wert:
        diagnostic.snapshotTimestamp,
    },

    {
      Feld:
        "Total Line",

      Wert:
        diagnostic.currentLine,
    },

    {
      Feld:
        "Best Odds Over",

      Wert:
        diagnostic.bestOddsOver,
    },

    {
      Feld:
        "Best Odds Under",

      Wert:
        diagnostic.bestOddsUnder,
    },

    {
      Feld:
        "Bookmaker Count",

      Wert:
        diagnostic.bookmakerCount,
    },

    {
      Feld:
        "Latest Bookmaker Update",

      Wert:
        diagnostic.latestBookmakerUpdate,
    },

    {
      Feld:
        "Snapshot Before Game",

      Wert:
        diagnostic.snapshotBeforeGame
          ? "JA"
          : "NEIN",
    },

    {
      Feld:
        "Latest Update Before Game",

      Wert:
        diagnostic.latestBookmakerUpdateBeforeGame
          ? "JA"
          : "NEIN",
    },

    {
      Feld:
        "Look-Ahead Violation",

      Wert:
        diagnostic.lookAheadViolation
          ? "JA"
          : "NEIN",
    },

    {
      Feld:
        "Reason",

      Wert:
        diagnostic.reason,
    },
  ]);

  /**
   * Zusätzliche klare Statusmeldung.
   */
  if (
    diagnostic.status ===
    "ACCESS_UNAVAILABLE"
  ) {
    console.warn(
      "⚠️ HISTORICAL MARKET ACCESS UNAVAILABLE: Die historische Datenquelle ist mit dem aktuellen API-Zugang nicht verfügbar."
    );
  }

  console.log(
    "========================================"
  );
}

/**
 * Konsolenausgabe der vollständigen
 * Market-Coverage.
 */
export function logHistoricalMarketCoverageDiagnostics(
  diagnostics:
    HistoricalMarketCoverageDiagnostics
): void {
  console.log(
    "========================================"
  );

  console.log(
    "HISTORICAL MARKET COVERAGE DIAGNOSTIC"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Kennzahl:
        "Total Games",

      Wert:
        diagnostics.totalGames,
    },

    {
      Kennzahl:
        "ACTIVE",

      Wert:
        diagnostics.activeGames,
    },

    {
      Kennzahl:
        "NO_DATA",

      Wert:
        diagnostics.noDataGames,
    },

    {
      Kennzahl:
        "ACCESS_UNAVAILABLE",

      Wert:
        diagnostics.accessUnavailableGames,
    },

    {
      Kennzahl:
        "INVALID",

      Wert:
        diagnostics.invalidGames,
    },

    {
      Kennzahl:
        "ACTIVE Coverage",

      Wert:
        `${diagnostics.activeCoveragePct.toFixed(
          2
        )} %`,
    },

    {
      Kennzahl:
        "Technical Coverage",

      Wert:
        `${diagnostics.technicalCoveragePct.toFixed(
          2
        )} %`,
    },

    {
      Kennzahl:
        "Access Unavailable",

      Wert:
        `${diagnostics.accessUnavailablePct.toFixed(
          2
        )} %`,
    },

    {
      Kennzahl:
        "Look-Ahead Violations",

      Wert:
        diagnostics.lookAheadViolations,
    },
  ]);

  console.table(
    diagnostics.games.map(
      (
        game
      ) => ({
        gamePk:
          game.gamePk,

        matchup:
          game.matchup,

        status:
          game.status,

        line:
          game.currentLine,

        over:
          game.bestOddsOver,

        under:
          game.bestOddsUnder,

        bookmakers:
          game.bookmakerCount,

        lookAhead:
          game.lookAheadViolation
            ? "JA"
            : "NEIN",

        reason:
          game.reason,
      })
    )
  );

  if (
    diagnostics.lookAheadViolations >
    0
  ) {
    console.error(
      `❌ HISTORICAL MARKET LOOK-AHEAD VIOLATIONS: ${diagnostics.lookAheadViolations}`
    );
  } else {
    console.log(
      "✅ HISTORICAL MARKET: 0 LOOK-AHEAD VIOLATIONS"
    );
  }

  if (
    diagnostics.accessUnavailableGames >
    0
  ) {
    console.warn(
      `⚠️ HISTORICAL MARKET ACCESS UNAVAILABLE: ${diagnostics.accessUnavailableGames} Spiel(e).`
    );
  }

  console.log(
    "========================================"
  );
}