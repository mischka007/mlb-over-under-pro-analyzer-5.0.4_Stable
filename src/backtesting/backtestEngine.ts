import type {
  BacktestGame,
  BacktestResult,
  BacktestSummary,
} from "./backtestTypes";

/**
 * Wertet ein einzelnes Backtest-Spiel aus.
 */
export function evaluateBacktestGame(
  game: BacktestGame
): BacktestResult {
  const isPush =
    game.actualRuns === game.line;

  if (isPush) {
    return {
      ...game,
      outcome: "push",
      profit: 0,
    };
  }

  const isWin =
    (game.predictedPick === "over" &&
      game.actualRuns > game.line) ||
    (game.predictedPick === "under" &&
      game.actualRuns < game.line);

  if (isWin) {
    return {
      ...game,
      outcome: "win",
      profit: game.odds - 1,
    };
  }

  return {
    ...game,
    outcome: "loss",
    profit: -1,
  };
}

/**
 * Wertet mehrere Spiele einzeln aus.
 */
export function evaluateBacktestGames(
  games: BacktestGame[]
): BacktestResult[] {
  return games.map(
    evaluateBacktestGame
  );
}

/**
 * Führt einen vollständigen Backtest aus
 * und erstellt die Gesamtstatistik.
 */
export function runBacktest(
  games: BacktestGame[]
): BacktestSummary {
  const results =
    evaluateBacktestGames(games);

  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let profit = 0;

  for (const result of results) {
    if (result.outcome === "win") {
      wins++;
    } else if (
      result.outcome === "loss"
    ) {
      losses++;
    } else {
      pushes++;
    }

    profit += result.profit;
  }

  const totalGames = results.length;
  const decidedBets = wins + losses;

  const hitRate =
    decidedBets > 0
      ? wins / decidedBets
      : 0;

  const roi =
    totalGames > 0
      ? profit / totalGames
      : 0;

  const yieldValue =
    decidedBets > 0
      ? profit / decidedBets
      : 0;

  return {
    totalGames,
    wins,
    losses,
    pushes,
    decidedBets,
    hitRate,
    roi,
    yield: yieldValue,
    profit,
  };
}