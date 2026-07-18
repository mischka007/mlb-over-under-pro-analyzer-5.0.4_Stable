import type {
  ScheduledGame,
} from "@/services/api/games";

import type {
  BacktestGame,
} from "./backtestTypes";

/**
 * Gesammelte historische Spiele.
 *
 * Diese Liste kann später mit aufbereiteten
 * historischen Backtest-Spielen gefüllt werden.
 */
export const historicalGames:
  BacktestGame[] = [];

/**
 * Diagnoseinformationen für ein historisches
 * Spiel, das nicht in ein BacktestGame
 * umgewandelt werden konnte.
 */
export interface ExcludedHistoricalGameDiagnostic {
  gamePk: number;

  officialDate: string;

  gameDate: string;

  matchup: string;

  status: string;

  homeRuns:
    number |
    null;

  awayRuns:
    number |
    null;

  isDoubleheader: boolean;

  exclusionReasons:
    string[];
}

/**
 * Letzte Liste aller historischen Spiele,
 * die bei der Umwandlung ausgeschlossen
 * wurden.
 */
let latestExcludedHistoricalGames:
  ExcludedHistoricalGameDiagnostic[] = [];

/**
 * Gibt die zuletzt ausgeschlossenen
 * historischen Spiele zurück.
 *
 * Es wird bewusst eine Kopie erzeugt,
 * damit die intern gespeicherten
 * Diagnosedaten nicht versehentlich
 * verändert werden.
 */
export function getLatestExcludedHistoricalGames():
  ExcludedHistoricalGameDiagnostic[] {
  return latestExcludedHistoricalGames.map(
    (
      diagnostic
    ) => ({
      ...diagnostic,

      exclusionReasons: [
        ...diagnostic.exclusionReasons,
      ],
    })
  );
}

/**
 * Ermittelt alle Gründe, weshalb ein
 * historisches MLB-Spiel nicht in ein
 * BacktestGame umgewandelt werden kann.
 */
function getExclusionReasons(
  game: ScheduledGame
): string[] {
  const reasons:
    string[] = [];

  if (
    game.status !==
    "Final"
  ) {
    reasons.push(
      `Status ist "${game.status}" statt "Final"`
    );
  }

  if (
    game.homeRuns ==
    null
  ) {
    reasons.push(
      "homeRuns fehlt"
    );
  }

  if (
    game.awayRuns ==
    null
  ) {
    reasons.push(
      "awayRuns fehlt"
    );
  }

  return reasons;
}

/**
 * Erstellt einen Diagnoseeintrag
 * für ein ausgeschlossenes Spiel.
 */
function createExcludedGameDiagnostic(
  game: ScheduledGame,
  exclusionReasons: string[]
): ExcludedHistoricalGameDiagnostic {
  return {
    gamePk:
      game.gamePk,

    officialDate:
      game.officialDate,

    gameDate:
      game.gameDate,

    matchup:
      `${game.awayTeamName} @ ${game.homeTeamName}`,

    status:
      game.status,

    homeRuns:
      game.homeRuns,

    awayRuns:
      game.awayRuns,

    isDoubleheader:
      game.isDoubleheader,

    exclusionReasons: [
      ...exclusionReasons,
    ],
  };
}

/**
 * Wandelt ein historisches MLB-Spiel
 * in das Format des Backtesting-Systems um.
 *
 * Gibt null zurück, wenn:
 *
 * - das Spiel nicht abgeschlossen ist
 * - keine Endergebnisse vorhanden sind
 *
 * line und odds werden zunächst als Parameter
 * übergeben, weil sie nicht aus dem normalen
 * MLB-Schedule-Feed stammen.
 *
 * WICHTIG:
 *
 * officialDate ist der offizielle
 * MLB-Spieltag im Format YYYY-MM-DD.
 *
 * gameDate bleibt der exakte
 * UTC-Spielzeitpunkt.
 *
 * Dadurch können spätere Monats- und
 * Saisonstatistiken den korrekten
 * MLB-Spieltag verwenden.
 */
export function convertHistoricalGameToBacktestGame(
  game: ScheduledGame,
  line: number,
  odds: number
): BacktestGame | null {
  const exclusionReasons =
    getExclusionReasons(
      game
    );

  if (
    exclusionReasons.length >
    0
  ) {
    return null;
  }

  /**
   * Nach der Prüfung oben wissen wir,
   * dass beide Endergebnisse vorhanden
   * sind.
   *
   * Die lokalen Konstanten sorgen dafür,
   * dass TypeScript die Werte eindeutig
   * als number behandeln kann.
   */
  const homeRuns =
    game.homeRuns;

  const awayRuns =
    game.awayRuns;

  if (
    homeRuns ==
      null ||
    awayRuns ==
      null
  ) {
    return null;
  }

  const actualRuns =
    homeRuns +
    awayRuns;

  return {
    gameId:
      game.gamePk,

    officialDate:
      game.officialDate,

    gameDate:
      game.gameDate,

    homeTeam:
      game.homeTeamName,

    awayTeam:
      game.awayTeamName,

    homeRuns,

    awayRuns,

    actualRuns,

    line,

    predictedPick:
      "over",

    confidence:
      0,

    odds,
  };
}

/**
 * Wandelt mehrere historische MLB-Spiele
 * in BacktestGame-Datensätze um.
 *
 * Zusätzlich werden alle ausgeschlossenen
 * Spiele vollständig diagnostiziert.
 *
 * Die eigentliche Backtest-Logik wird
 * dadurch NICHT verändert.
 */
export function convertHistoricalGamesToBacktestGames(
  games: ScheduledGame[],
  line: number,
  odds: number
): BacktestGame[] {
  const convertedGames:
    BacktestGame[] = [];

  const excludedGames:
    ExcludedHistoricalGameDiagnostic[] = [];

  for (
    const game of games
  ) {
    const exclusionReasons =
      getExclusionReasons(
        game
      );

    if (
      exclusionReasons.length >
      0
    ) {
      excludedGames.push(
        createExcludedGameDiagnostic(
          game,
          exclusionReasons
        )
      );

      continue;
    }

    const convertedGame =
      convertHistoricalGameToBacktestGame(
        game,
        line,
        odds
      );

    if (
      convertedGame
    ) {
      convertedGames.push(
        convertedGame
      );
    }
  }

  /**
   * Letzte Diagnose intern speichern.
   */
  latestExcludedHistoricalGames =
    excludedGames;

  /**
   * Nur dann eine große Diagnose ausgeben,
   * wenn tatsächlich Spiele ausgeschlossen
   * wurden.
   */
  if (
    excludedGames.length >
    0
  ) {
    console.warn(
      "========================================"
    );

    console.warn(
      "AUSGESCHLOSSENE HISTORISCHE SPIELE"
    );

    console.warn(
      "========================================"
    );

    console.table(
      excludedGames.map(
        (
          game
        ) => ({
          gamePk:
            game.gamePk,

          officialDate:
            game.officialDate,

          gameDate:
            game.gameDate,

          matchup:
            game.matchup,

          status:
            game.status,

          homeRuns:
            game.homeRuns,

          awayRuns:
            game.awayRuns,

          doubleheader:
            game.isDoubleheader
              ? "JA"
              : "NEIN",

          grund:
            game.exclusionReasons.join(
              " | "
            ),
        })
      )
    );

    console.warn(
      "Vollständige ausgeschlossene Spiele:"
    );

    console.warn(
      excludedGames
    );

    console.warn(
      "========================================"
    );
  }

  return convertedGames;
}