import type {
  BacktestResult,
  BacktestSummary,
} from "./backtestTypes";

/**
 * Erstellt einen lesbaren Bericht
 * über einen vollständigen Backtest.
 *
 * Optional können zusätzlich die
 * einzelnen Spielergebnisse ausgegeben werden.
 */
export function createBacktestReport(
  summary: BacktestSummary,
  results: BacktestResult[] = []
): string {
  const lines: string[] = [];

  lines.push(
    "========== BACKTEST REPORT =========="
  );
  lines.push("");

  lines.push(
    "Spiele gesamt: " +
      summary.totalGames
  );

  lines.push(
    "Entschiedene Wetten: " +
      summary.decidedBets
  );

  lines.push("");

  lines.push(
    "Gewonnen: " +
      summary.wins
  );

  lines.push(
    "Verloren: " +
      summary.losses
  );

  lines.push(
    "Pushes: " +
      summary.pushes
  );

  lines.push("");

  lines.push(
    "Trefferquote: " +
      (
        summary.hitRate * 100
      ).toFixed(2) +
      " %"
  );

  lines.push(
    "ROI: " +
      (
        summary.roi * 100
      ).toFixed(2) +
      " %"
  );

  lines.push(
    "Yield: " +
      (
        summary.yield * 100
      ).toFixed(2) +
      " %"
  );

  lines.push(
    "Profit: " +
      summary.profit.toFixed(2) +
      " Units"
  );

  if (results.length > 0) {
    lines.push("");
    lines.push(
      "========== EINZELSPIELE =========="
    );
    lines.push("");

    for (const result of results) {
      lines.push(
        result.awayTeam +
          " @ " +
          result.homeTeam
      );

      lines.push(
        "Datum: " +
          result.gameDate
      );

      lines.push(
        "Ergebnis: " +
          result.awayRuns +
          ":" +
          result.homeRuns +
          " | Total: " +
          result.actualRuns
      );

      lines.push(
        "Tipp: " +
          result.predictedPick.toUpperCase() +
          " " +
          result.line
      );

      lines.push(
        "Confidence: " +
          result.confidence.toFixed(2)
      );

      lines.push(
        "Outcome: " +
          result.outcome.toUpperCase()
      );

      lines.push(
        "Profit: " +
          result.profit.toFixed(2) +
          " Units"
      );

      lines.push("");
    }
  }

  lines.push(
    "===================================="
  );

  return lines.join("\n");
}