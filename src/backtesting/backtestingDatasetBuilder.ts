import { computeFullAnalysis } from "@/models/GameModel";
import { evaluateBacktestGame } from "./backtestEngine";
import type { BacktestDatasetRecord, ModuleInfluence } from "@/types";
import type { BacktestGame } from "./backtestTypes";
import type { HistoricalBacktestState } from "./historicalBacktestState";

/**
 * Backtesting PRO Phase 3: Dataset Builder.
 *
 * Baut aus historischen Spielzuständen (`HistoricalBacktestState`, Point-
 * in-Time-Daten aus der bestehenden Backtest-Infrastruktur) und den
 * tatsächlichen Ergebnissen (`BacktestGame`) den vollständigen,
 * strukturierten Backtest-Datensatz je Spiel auf. Nutzt dafür
 * ausschließlich die bereits bestehende Prediction Engine PRO
 * (`computeFullAnalysis`) — es wird keine neue Prognoselogik eingeführt,
 * nur deren Ergebnisse strukturiert für die Auswertung aufbereitet.
 */

function determineActualOutcome(actualRuns: number, line: number): "over" | "under" | "push" {
  if (actualRuns > line) return "over";
  if (actualRuns < line) return "under";
  return "push";
}

/**
 * Baut für ein einzelnes historisches Spiel den vollständigen
 * `BacktestDatasetRecord` auf.
 */
function buildRecordForGame(state: HistoricalBacktestState["state"], game: BacktestGame): BacktestDatasetRecord {
  const analysis = computeFullAnalysis(state);
  const { consensus, advancedPrediction, premiumBetAssessment } = analysis;

  const moduleInfluences: ModuleInfluence[] = analysis.modules
    .filter((m) => m.hasData)
    .map((m) => {
      const influence = m.weight * (m.score - 50);
      const direction: ModuleInfluence["direction"] = influence > 0.5 ? "over" : influence < -0.5 ? "under" : "neutral";
      return { moduleKey: m.key, label: m.label, score: m.score, weight: m.weight, influence, direction };
    });

  const actualResult = determineActualOutcome(game.actualRuns, game.line);

  const prediction = consensus.pick;

  const fairOdds = prediction === "over" ? advancedPrediction.fairOddsOver : prediction === "under" ? advancedPrediction.fairOddsUnder : null;

  let hit: boolean | null = null;
  let profitLoss = 0;

  if (prediction !== null && game.odds > 0) {
    const evaluated = evaluateBacktestGame({
      gameId: game.gameId,
      officialDate: game.officialDate,
      gameDate: game.gameDate,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeRuns: game.homeRuns,
      awayRuns: game.awayRuns,
      actualRuns: game.actualRuns,
      line: game.line,
      predictedPick: prediction,
      confidence: consensus.confidence,
      odds: game.odds,
    });
    hit = evaluated.outcome === "push" ? null : evaluated.outcome === "win";
    profitLoss = evaluated.profit;
  }

  return {
    gameId: game.gameId,
    date: game.officialDate,
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    line: game.line,
    prediction,
    overProbability: advancedPrediction.probabilityOver,
    underProbability: advancedPrediction.probabilityUnder,
    expectedRuns: advancedPrediction.expectedTotal,
    expectedRunDifferential: advancedPrediction.expectedRunDifferential,
    fairOdds,
    edge: advancedPrediction.expectedEdge,
    valuePct: advancedPrediction.valueEdge,
    kellyPct: analysis.bankroll.kellyFraction * 100,
    confidence: advancedPrediction.confidence,
    premiumRating: premiumBetAssessment.tier,
    actualResult,
    actualRuns: game.actualRuns,
    hit,
    profitLoss,
    moduleInfluences,
  };
}

/**
 * Baut den vollständigen Backtest-Datensatz für alle übergebenen
 * historischen Spiele auf. Spiele ohne passenden `HistoricalBacktestState`
 * (per `gameId` verknüpft) werden übersprungen.
 */
export function buildBacktestDataset(states: HistoricalBacktestState[], games: BacktestGame[]): BacktestDatasetRecord[] {
  const stateByGameId = new Map(states.map((entry) => [entry.gameId, entry.state]));
  const records: BacktestDatasetRecord[] = [];

  for (const game of games) {
    const state = stateByGameId.get(game.gameId);
    if (!state) continue;
    records.push(buildRecordForGame(state, game));
  }

  return records;
}
