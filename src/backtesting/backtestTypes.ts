/**
 * Ein einzelnes historisches
 * MLB-Spiel für den Backtest.
 */
export interface BacktestGame {
  /**
   * Eindeutige MLB gamePk.
   */
  gameId: number;

  /**
   * Offizieller MLB-Spieltag
   * im Format YYYY-MM-DD.
   *
   * Dieser Wert wird für:
   *
   * - Datumsbereiche
   * - Monatsstatistiken
   * - Saisonstatistiken
   *
   * verwendet.
   *
   * WICHTIG:
   *
   * officialDate ist der logische
   * MLB-Spieltag.
   *
   * gameDate ist dagegen der exakte
   * UTC-Spielzeitpunkt.
   */
  officialDate: string;

  /**
   * Exakter UTC-Spielzeitpunkt.
   */
  gameDate: string;

  homeTeam: string;
  awayTeam: string;

  homeRuns: number;
  awayRuns: number;

  actualRuns: number;

  line: number;

  /**
   * BacktestGame repräsentiert
   * ausschließlich eine tatsächlich
   * platzierte Modellentscheidung.
   *
   * NO-BET-Spiele werden bewusst
   * nicht in diese Ergebnisstruktur
   * aufgenommen.
   */
  predictedPick:
    | "over"
    | "under";

  confidence: number;

  odds: number;
}

/**
 * Ergebnis eines einzelnen
 * Backtest-Spiels.
 */
export interface BacktestResult
  extends BacktestGame {
  outcome:
    | "win"
    | "loss"
    | "push";

  profit: number;
}

/**
 * Zusammenfassung eines
 * vollständigen Backtests.
 *
 * Diese Werte beziehen sich
 * ausschließlich auf tatsächlich
 * platzierte Wetten.
 */
export interface BacktestSummary {
  totalGames: number;

  wins: number;
  losses: number;
  pushes: number;

  decidedBets: number;

  hitRate: number;

  roi: number;
  yield: number;

  profit: number;
}

/**
 * Diagnose eines einzelnen
 * Analysemoduls.
 */
export interface BacktestDecisionModuleDiagnostic {
  key: string;

  label: string;

  score: number;

  weight: number;

  hasData: boolean;

  expectedRuns:
    number | null;
}

/**
 * Mögliche finale Entscheidung
 * des Analysemodells.
 *
 * NO BET wird nur für die Diagnose
 * verwendet und gelangt nicht in
 * BacktestGame oder BacktestResult.
 */
export type BacktestDecision =
  | "over"
  | "under"
  | "no_bet";

/**
 * Grund, warum keine Wette
 * platziert wurde.
 */
export type BacktestNoBetReason =
  | "no_active_modules"
  | "neutral_consensus"
  | "no_consensus_pick";

/**
 * Diagnose der Entscheidung
 * für ein einzelnes analysiertes Spiel.
 *
 * Diese Struktur enthält sowohl
 * tatsächliche Wetten als auch
 * NO-BET-Entscheidungen.
 */
export interface BacktestDecisionDiagnostic {
  gameId: number;

  officialDate: string;

  gameDate: string;

  homeTeam: string;

  awayTeam: string;

  actualRuns: number;

  line: number;

  /**
   * Finale Modellentscheidung.
   */
  decision:
    BacktestDecision;

  /**
   * Tatsächlicher OVER-/UNDER-Pick.
   *
   * Bei NO BET ist dieser Wert null.
   */
  predictedPick:
    | "over"
    | "under"
    | null;

  /**
   * Grund für NO BET.
   *
   * Bei einer tatsächlichen Wette
   * ist dieser Wert null.
   */
  noBetReason:
    BacktestNoBetReason | null;

  confidence: number;

  consensusFinalScore: number;

  consensusStars: number;

  /**
   * Anzahl der Module,
   * die tatsächlich Daten hatten.
   */
  activeModuleCount: number;

  /**
   * Anzahl der Module,
   * die im gewichteten Konsens
   * tatsächlich berücksichtigt wurden.
   */
  weightedActiveModuleCount: number;

  /**
   * Nur ein einziges gewichtetes
   * Modul war aktiv.
   */
  onlyOneWeightedModuleActive: boolean;

  /**
   * Kein gewichtetes Modul war aktiv.
   */
  noWeightedModulesActive: boolean;

  baselineRuns: number;

  finalExpectedRuns: number;

  poissonExpectedRuns: number;

  poissonOverProbability: number;

  poissonUnderProbability: number;

  poissonPushProbability: number;

  monteCarloMean: number;

  monteCarloMedian: number;

  monteCarloCiLow: number;

  monteCarloCiHigh: number;

  monteCarloOverProbability: number;

  monteCarloUnderProbability: number;

  modules:
    BacktestDecisionModuleDiagnostic[];
}

/**
 * Zusammenfassung der gesamten
 * Entscheidungsdiagnose.
 *
 * analysedGames kann größer sein
 * als placedBets, weil NO-BET-Spiele
 * nicht in den eigentlichen Backtest
 * aufgenommen werden.
 */
export interface BacktestDecisionDiagnosticsSummary {
  analysedGames: number;

  placedBets: number;

  overPicks: number;

  underPicks: number;

  noBets: number;

  noBetNoActiveModules: number;

  noBetNeutralConsensus: number;

  noBetNoConsensusPick: number;

  gamesWithNoWeightedActiveModules: number;

  gamesWithOnlyOneWeightedActiveModule: number;
}