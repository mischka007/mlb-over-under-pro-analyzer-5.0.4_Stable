import { computeFullAnalysis } from "@/models/GameModel";
import { evaluateBacktestGame } from "./backtestEngine";
import { computeRunLineAnalysis } from "@/engine/runLineEngine";
import type { BacktestDatasetRecord, ModuleInfluence } from "@/types";
import type { BacktestGame } from "./backtestTypes";
import type { HistoricalBacktestState } from "./historicalBacktestState";
import { toNumber } from "@/utils/math";

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

  // Version 7.0: Run-Line-Backtest für dasselbe Spiel — nutzt dieselbe
  // bereits oben berechnete `analysis` (kein zweiter `computeFullAnalysis()`-
  // Aufruf, keine doppelte Berechnung).
  const runLineAnalysis = computeRunLineAnalysis({
    state,
    finalExpectedRuns: analysis.finalExpectedRuns,
    expectedRunsHome: advancedPrediction.expectedRunsHome,
    expectedRunsAway: advancedPrediction.expectedRunsAway,
  });
  const { recommendation: runLineRecommendation } = runLineAnalysis;

  // Echter Trefferstatus aus den tatsächlich gespeicherten Endständen
  // (`game.homeRuns`/`game.awayRuns`) — keine Schätzung.
  const actualDifferential = game.homeRuns - game.awayRuns;
  const teamDifferential = runLineRecommendation.team === "home" ? actualDifferential : -actualDifferential;
  const requiredMargin = runLineRecommendation.side === "favorite" ? runLineRecommendation.line : -runLineRecommendation.line;
  const runLineHit = teamDifferential > requiredMargin;

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
    season: game.officialDate.slice(0, 4),
    league: "MLB",
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    line: game.line,
    prediction,
    overProbability: advancedPrediction.probabilityOver,
    underProbability: advancedPrediction.probabilityUnder,
    expectedRunsHome: advancedPrediction.expectedRunsHome,
    expectedRunsAway: advancedPrediction.expectedRunsAway,
    expectedRuns: advancedPrediction.expectedTotal,
    expectedRunDifferential: advancedPrediction.expectedRunDifferential,
    fairOdds,
    modelFairLine: advancedPrediction.fairTotalLine,
    edge: advancedPrediction.expectedEdge,
    valuePct: advancedPrediction.valueEdge,
    kellyPct: analysis.bankroll.kellyFraction * 100,
    confidence: advancedPrediction.confidence,
    premiumRating: premiumBetAssessment.tier,
    premiumFilterPassed: analysis.premiumFilter.allPassed,
    actualResult,
    actualRuns: game.actualRuns,
    hit,
    profitLoss,
    moduleInfluences,

    // Version 6.0 (Paket 4): siehe Typ-Dokumentation — bei Bulk-Backtests
    // ist `state.market` unbefüllt (keine historischen Multi-Buchmacher-
    // Daten verfügbar), daher konsequent `null`/`false` statt erfunden.
    marketOpeningLine: toNumber(state.market.openingLine),
    marketClosingLine: toNumber(state.market.closingLine),
    marketScore: toNumber(state.market.marketScore),
    sharpMovementDetected: false,
    reverseLineMovementDetected: false,
    steamMoveDetected: false,
    clv: null,

    // Version 7.0: getrennte Run-Line-Statistik (siehe Typ-Dokumentation).
    runLineFavorite: runLineAnalysis.favoriteTeam,
    runLineRecommendedSide: runLineRecommendation.side,
    runLineRecommendedLine: runLineRecommendation.line,
    runLineProbability: runLineRecommendation.probability,
    runLineHit,
    runLineProfitLoss: null,
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
