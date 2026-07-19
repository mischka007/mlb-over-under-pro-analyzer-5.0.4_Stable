import type {
  BacktestResult,
  BacktestSummary,
} from "./backtestTypes";

/**
 * Konfiguration für einen
 * Multi-Month- oder Saison-Backtest.
 */
export interface SeasonBacktestConfig {
  startDate: Date;

  endDate: Date;

  line: number;

  odds: number;
}

/**
 * Ein einzelner Monatsblock,
 * der vom Saison-Runner verarbeitet wird.
 */
export interface SeasonBacktestBlock {
  key: string;

  label: string;

  startDate: Date;

  endDate: Date;
}

/**
 * Ergebnis eines erfolgreich
 * abgeschlossenen Monatsblocks.
 */
export interface SeasonBacktestBlockResult {
  block:
    SeasonBacktestBlock;

  summary:
    BacktestSummary;

  results:
    BacktestResult[];

  durationSeconds:
    number;
}

/**
 * Informationen über einen
 * fehlgeschlagenen Monatsblock.
 */
export interface SeasonBacktestFailure {
  block:
    SeasonBacktestBlock;

  error:
    unknown;
}

/**
 * Performance eines Kalendermonats.
 */
export interface MonthlyBacktestPerformance {
  month: string;

  bets: number;

  wins: number;

  losses: number;

  pushes: number;

  decidedBets: number;

  hitRate: number;

  profit: number;

  roi: number;
}

/**
 * Performance nach Pick-Richtung.
 */
export interface PickBacktestPerformance {
  pick:
    "over" |
    "under";

  bets: number;

  wins: number;

  losses: number;

  pushes: number;

  decidedBets: number;

  hitRate: number;

  profit: number;

  roi: number;
}

/**
 * Performance eines
 * Confidence-Buckets.
 */
export interface ConfidenceBacktestPerformance {
  bucket: string;

  minInclusive: number;

  maxExclusive:
    number | null;

  bets: number;

  wins: number;

  losses: number;

  pushes: number;

  decidedBets: number;

  hitRate: number;

  profit: number;

  roi: number;
}

/**
 * Drawdown- und Serienstatistiken.
 */
export interface SeasonBacktestRiskStats {
  longestWinStreak: number;

  longestLossStreak: number;

  maximumDrawdown: number;

  maximumDrawdownPct: number;

  peakEquity: number;

  finalEquity: number;
}

/**
 * Technische Diagnostik des
 * Saison-Backtests.
 */
export interface SeasonBacktestDiagnostics {
  requestedStartDate: string;

  requestedEndDate: string;

  requestedBlocks: number;

  successfulBlocks: number;

  failedBlocks: number;

  rawResults: number;

  uniqueResults: number;

  removedDuplicates: number;

  chronological: boolean;
}

/**
 * Vollständiges Ergebnis eines
 * Saison- oder Multi-Month-Backtests.
 */
export interface SeasonBacktestResult {
  config:
    SeasonBacktestConfig;

  summary:
    BacktestSummary;

  results:
    BacktestResult[];

  blocks:
    SeasonBacktestBlockResult[];

  failures:
    SeasonBacktestFailure[];

  monthlyPerformance:
    MonthlyBacktestPerformance[];

  pickPerformance:
    PickBacktestPerformance[];

  confidencePerformance:
    ConfidenceBacktestPerformance[];

  risk:
    SeasonBacktestRiskStats;

  diagnostics:
    SeasonBacktestDiagnostics;

  durationSeconds:
    number;
}