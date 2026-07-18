import type {
  AnalyzerState,
} from "@/types";

/**
 * Verbindet einen historischen AnalyzerState
 * eindeutig mit der MLB gamePk / Backtest gameId.
 *
 * Dadurch hängt der Backtest nicht mehr von
 * der Reihenfolge zweier Arrays ab.
 */
export interface HistoricalBacktestState {
  gameId: number;

  state: AnalyzerState;
}