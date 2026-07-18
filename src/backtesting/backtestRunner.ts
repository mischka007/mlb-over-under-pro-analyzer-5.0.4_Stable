import {
  computeFullAnalysis,
} from "@/models/GameModel";

import type {
  BacktestDecisionDiagnostic,
  BacktestDecisionDiagnosticsSummary,
  BacktestGame,
  BacktestNoBetReason,
  BacktestSummary,
} from "./backtestTypes";

import type {
  HistoricalBacktestState,
} from "./historicalBacktestState";

import {
  runBacktest,
} from "./backtestEngine";

/**
 * Globale Erweiterung des Browser-Window-Objekts
 * für die manuelle Untersuchung der
 * Entscheidungsdiagnose in den DevTools.
 */
declare global {
  interface Window {
    __MLB_BACKTEST_DECISION_DIAGNOSTICS__?:
      BacktestDecisionDiagnostic[];

    __MLB_BACKTEST_DECISION_SUMMARY__?:
      BacktestDecisionDiagnosticsSummary;
  }
}

/**
 * Letzte vollständig erzeugte
 * Entscheidungsdiagnose.
 */
let latestDecisionDiagnostics:
  BacktestDecisionDiagnostic[] = [];

/**
 * Letzte Zusammenfassung der
 * Entscheidungsdiagnose.
 */
let latestDecisionDiagnosticsSummary:
  BacktestDecisionDiagnosticsSummary = {
    analysedGames:
      0,

    placedBets:
      0,

    overPicks:
      0,

    underPicks:
      0,

    noBets:
      0,

    noBetNoActiveModules:
      0,

    noBetNeutralConsensus:
      0,

    noBetNoConsensusPick:
      0,

    gamesWithNoWeightedActiveModules:
      0,

    gamesWithOnlyOneWeightedActiveModule:
      0,
  };

/**
 * Gibt die zuletzt erzeugte
 * Entscheidungsdiagnose zurück.
 *
 * Es wird bewusst eine Kopie des Arrays
 * zurückgegeben.
 */
export function getLatestBacktestDecisionDiagnostics():
  BacktestDecisionDiagnostic[] {
  return [
    ...latestDecisionDiagnostics,
  ];
}

/**
 * Gibt die letzte Zusammenfassung
 * der Entscheidungsdiagnose zurück.
 */
export function getLatestBacktestDecisionDiagnosticsSummary():
  BacktestDecisionDiagnosticsSummary {
  return {
    ...latestDecisionDiagnosticsSummary,
  };
}

/**
 * Bestimmt den NO-BET-Grund.
 */
function determineNoBetReason(
  activeModuleCount: number,
  weightedActiveModuleCount: number,
  consensusFinalScore: number
): BacktestNoBetReason {
  if (
    activeModuleCount ===
      0 ||
    weightedActiveModuleCount ===
      0
  ) {
    return "no_active_modules";
  }

  if (
    consensusFinalScore ===
    50
  ) {
    return "neutral_consensus";
  }

  return "no_consensus_pick";
}

/**
 * Erstellt die Zusammenfassung
 * der Entscheidungsdiagnose.
 */
function createDecisionDiagnosticsSummary(
  diagnostics: BacktestDecisionDiagnostic[]
): BacktestDecisionDiagnosticsSummary {
  let overPicks =
    0;

  let underPicks =
    0;

  let noBets =
    0;

  let noBetNoActiveModules =
    0;

  let noBetNeutralConsensus =
    0;

  let noBetNoConsensusPick =
    0;

  let gamesWithNoWeightedActiveModules =
    0;

  let gamesWithOnlyOneWeightedActiveModule =
    0;

  for (
    const diagnostic of diagnostics
  ) {
    if (
      diagnostic.decision ===
      "over"
    ) {
      overPicks +=
        1;
    } else if (
      diagnostic.decision ===
      "under"
    ) {
      underPicks +=
        1;
    } else {
      noBets +=
        1;
    }

    if (
      diagnostic.noBetReason ===
      "no_active_modules"
    ) {
      noBetNoActiveModules +=
        1;
    } else if (
      diagnostic.noBetReason ===
      "neutral_consensus"
    ) {
      noBetNeutralConsensus +=
        1;
    } else if (
      diagnostic.noBetReason ===
      "no_consensus_pick"
    ) {
      noBetNoConsensusPick +=
        1;
    }

    if (
      diagnostic.noWeightedModulesActive
    ) {
      gamesWithNoWeightedActiveModules +=
        1;
    }

    if (
      diagnostic.onlyOneWeightedModuleActive
    ) {
      gamesWithOnlyOneWeightedActiveModule +=
        1;
    }
  }

  return {
    analysedGames:
      diagnostics.length,

    placedBets:
      overPicks +
      underPicks,

    overPicks,

    underPicks,

    noBets,

    noBetNoActiveModules,

    noBetNeutralConsensus,

    noBetNoConsensusPick,

    gamesWithNoWeightedActiveModules,

    gamesWithOnlyOneWeightedActiveModule,
  };
}

/**
 * Gibt eine kompakte Übersicht der
 * Entscheidungsdiagnose in der
 * Browser-Konsole aus.
 */
function printDecisionDiagnostics(
  diagnostics: BacktestDecisionDiagnostic[],
  summary: BacktestDecisionDiagnosticsSummary
): void {
  console.log(
    "========================================"
  );

  console.log(
    "BACKTEST DECISION DIAGNOSTICS"
  );

  console.log(
    "========================================"
  );

  console.table(
    diagnostics.map(
      (
        diagnostic
      ) => ({
        gameId:
          diagnostic.gameId,

        officialDate:
          diagnostic.officialDate,

        matchup:
          `${diagnostic.awayTeam} @ ${diagnostic.homeTeam}`,

        actualRuns:
          diagnostic.actualRuns,

        line:
          diagnostic.line,

        decision:
          diagnostic.decision.toUpperCase(),

        noBetReason:
          diagnostic.noBetReason ??
          "",

        confidence:
          (
            diagnostic.confidence *
            100
          ).toFixed(
            2
          ) +
          " %",

        consensusScore:
          diagnostic.consensusFinalScore.toFixed(
            2
          ),

        stars:
          diagnostic.consensusStars,

        activeModules:
          diagnostic.activeModuleCount,

        weightedModules:
          diagnostic.weightedActiveModuleCount,

        baselineRuns:
          diagnostic.baselineRuns.toFixed(
            2
          ),

        expectedRuns:
          diagnostic.finalExpectedRuns.toFixed(
            2
          ),

        poissonExpected:
          diagnostic.poissonExpectedRuns.toFixed(
            2
          ),

        poissonOver:
          (
            diagnostic.poissonOverProbability *
            100
          ).toFixed(
            2
          ) +
          " %",

        poissonUnder:
          (
            diagnostic.poissonUnderProbability *
            100
          ).toFixed(
            2
          ) +
          " %",

        monteCarloMean:
          diagnostic.monteCarloMean.toFixed(
            2
          ),

        monteCarloOver:
          (
            diagnostic.monteCarloOverProbability *
            100
          ).toFixed(
            2
          ) +
          " %",

        monteCarloUnder:
          (
            diagnostic.monteCarloUnderProbability *
            100
          ).toFixed(
            2
          ) +
          " %",
      })
    )
  );

  /**
   * Modul-Coverage über alle analysierten
   * historischen Spiele.
   *
   * Dadurch sehen wir nicht nur die Anzahl
   * aktiver Module, sondern exakt, welche
   * Module im Backtest tatsächlich Daten
   * erhalten haben.
   */
  const moduleCoverage =
    new Map<
      string,
      {
        key: string;

        label: string;

        activeGames: number;

        inactiveGames: number;

        weightedActiveGames: number;
      }
    >();

  for (
    const diagnostic of diagnostics
  ) {
    for (
      const module of diagnostic.modules
    ) {
      const existing =
        moduleCoverage.get(
          module.key
        ) ?? {
          key:
            module.key,

          label:
            module.label,

          activeGames:
            0,

          inactiveGames:
            0,

          weightedActiveGames:
            0,
        };

      if (
        module.hasData
      ) {
        existing.activeGames +=
          1;

        if (
          module.weight >
          0
        ) {
          existing.weightedActiveGames +=
            1;
        }
      } else {
        existing.inactiveGames +=
          1;
      }

      moduleCoverage.set(
        module.key,
        existing
      );
    }
  }

  console.log(
    "========================================"
  );

  console.log(
    "HISTORICAL MODULE COVERAGE SUMMARY"
  );

  console.log(
    "========================================"
  );

  console.table(
    Array.from(
      moduleCoverage.values()
    ).map(
      (
        module
      ) => ({
        key:
          module.key,

        module:
          module.label,

        status:
          module.activeGames ===
          diagnostics.length
            ? "ACTIVE"
            : module.activeGames ===
              0
              ? "INACTIVE"
              : "PARTIAL",

        activeGames:
          module.activeGames,

        inactiveGames:
          module.inactiveGames,

        weightedActiveGames:
          module.weightedActiveGames,

        coverage:
          diagnostics.length >
          0
            ? (
                (
                  module.activeGames /
                  diagnostics.length
                ) *
                100
              ).toFixed(
                2
              ) +
              " %"
            : "0.00 %",
      })
    )
  );

  console.log(
    "========================================"
  );

  console.log(
    "BACKTEST DECISION SUMMARY"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Kennzahl:
        "Analysierte Spiele",

      Anzahl:
        summary.analysedGames,
    },

    {
      Kennzahl:
        "Platzierte Wetten",

      Anzahl:
        summary.placedBets,
    },

    {
      Kennzahl:
        "OVER-Picks",

      Anzahl:
        summary.overPicks,
    },

    {
      Kennzahl:
        "UNDER-Picks",

      Anzahl:
        summary.underPicks,
    },

    {
      Kennzahl:
        "NO BET",

      Anzahl:
        summary.noBets,
    },

    {
      Kennzahl:
        "NO BET: keine aktiven Module",

      Anzahl:
        summary.noBetNoActiveModules,
    },

    {
      Kennzahl:
        "NO BET: neutraler Konsens",

      Anzahl:
        summary.noBetNeutralConsensus,
    },

    {
      Kennzahl:
        "NO BET: kein Consensus-Pick",

      Anzahl:
        summary.noBetNoConsensusPick,
    },

    {
      Kennzahl:
        "Keine gewichteten Module aktiv",

      Anzahl:
        summary.gamesWithNoWeightedActiveModules,
    },

    {
      Kennzahl:
        "Nur ein gewichtetes Modul aktiv",

      Anzahl:
        summary.gamesWithOnlyOneWeightedActiveModule,
    },
  ]);

  console.log(
    "Vollständige Diagnosedaten:"
  );

  console.log(
    diagnostics
  );

  console.log(
    "Browser-Zugriff:"
  );

  console.log(
    "window.__MLB_BACKTEST_DECISION_DIAGNOSTICS__"
  );

  console.log(
    "window.__MLB_BACKTEST_DECISION_SUMMARY__"
  );

  console.log(
    "========================================"
  );
}

/**
 * Erzeugt die tatsächlichen historischen
 * Prognosen des Analysemodells.
 *
 * Die Zuordnung zwischen AnalyzerState
 * und historischem Spielergebnis erfolgt
 * ausschließlich über gameId.
 *
 * WICHTIG:
 *
 * Ein fehlender Consensus-Pick wird
 * NICHT mehr künstlich zu OVER.
 *
 * Stattdessen:
 *
 * - OVER -> BacktestGame
 * - UNDER -> BacktestGame
 * - null -> NO BET nur in der Diagnose
 */
export function createPredictedBacktestGames(
  states: HistoricalBacktestState[],
  results: BacktestGame[]
): BacktestGame[] {
  /**
   * gameId -> historischer AnalyzerState
   */
  const stateByGameId =
    new Map(
      states.map(
        (
          entry
        ) => [
          entry.gameId,
          entry.state,
        ]
      )
    );

  const predictedGames:
    BacktestGame[] = [];

  const diagnostics:
    BacktestDecisionDiagnostic[] = [];

  for (
    const result of results
  ) {
    const state =
      stateByGameId.get(
        result.gameId
      );

    /**
     * Ohne passenden historischen
     * AnalyzerState darf das Spiel
     * nicht ausgewertet werden.
     */
    if (
      !state
    ) {
      continue;
    }

    /**
     * Zentrale Analysefunktion.
     */
    const analysis =
      computeFullAnalysis(
        state
      );

    /**
     * Alle Module mit vorhandenen Daten.
     */
    const activeModules =
      analysis.modules.filter(
        (
          module
        ) =>
          module.hasData
      );

    /**
     * Nur Module, die tatsächlich
     * in den gewichteten Consensus
     * eingehen.
     */
    const weightedActiveModules =
      analysis.modules.filter(
        (
          module
        ) =>
          module.hasData &&
          module.weight >
            0
      );

    const activeModuleCount =
      activeModules.length;

    const weightedActiveModuleCount =
      weightedActiveModules.length;

    /**
     * Der Analyzer darf null liefern.
     *
     * Dieser Zustand wird ausdrücklich
     * als NO BET behandelt.
     */
    const predictedPick =
      analysis.consensus.pick;

    const noBetReason =
      predictedPick ===
      null
        ? determineNoBetReason(
            activeModuleCount,
            weightedActiveModuleCount,
            analysis.consensus.finalScore
          )
        : null;

    /**
     * Nur echte OVER-/UNDER-Picks
     * gelangen in den eigentlichen
     * Backtest.
     */
    if (
      predictedPick !==
      null
    ) {
      predictedGames.push({
        ...result,

        predictedPick,

        confidence:
          analysis.consensus.confidence,
      });
    }

    /**
     * Die Diagnose enthält dagegen
     * jedes analysierte Spiel.
     */
    diagnostics.push({
      gameId:
        result.gameId,

      officialDate:
        result.officialDate,

      gameDate:
        result.gameDate,

      homeTeam:
        result.homeTeam,

      awayTeam:
        result.awayTeam,

      actualRuns:
        result.actualRuns,

      line:
        result.line,

      decision:
        predictedPick ??
        "no_bet",

      predictedPick,

      noBetReason,

      confidence:
        analysis.consensus.confidence,

      consensusFinalScore:
        analysis.consensus.finalScore,

      consensusStars:
        analysis.consensus.stars,

      activeModuleCount,

      weightedActiveModuleCount,

      onlyOneWeightedModuleActive:
        weightedActiveModuleCount ===
        1,

      noWeightedModulesActive:
        weightedActiveModuleCount ===
        0,

      baselineRuns:
        analysis.baselineRuns,

      finalExpectedRuns:
        analysis.finalExpectedRuns,

      poissonExpectedRuns:
        analysis.poisson.expectedRuns,

      poissonOverProbability:
        analysis.poisson.overProbability,

      poissonUnderProbability:
        analysis.poisson.underProbability,

      poissonPushProbability:
        analysis.poisson.pushProbability,

      monteCarloMean:
        analysis.montecarlo.mean,

      monteCarloMedian:
        analysis.montecarlo.median,

      monteCarloCiLow:
        analysis.montecarlo.ciLow,

      monteCarloCiHigh:
        analysis.montecarlo.ciHigh,

      monteCarloOverProbability:
        analysis.montecarlo.overProbability,

      monteCarloUnderProbability:
        analysis.montecarlo.underProbability,

      modules:
        analysis.modules.map(
          (
            module
          ) => ({
            key:
              module.key,

            label:
              module.label,

            score:
              module.score,

            weight:
              module.weight,

            hasData:
              module.hasData,

            expectedRuns:
              module.expectedRuns,
          })
        ),
    });
  }

  /**
   * Diagnose-Zusammenfassung erzeugen.
   */
  const diagnosticsSummary =
    createDecisionDiagnosticsSummary(
      diagnostics
    );

  /**
   * Letzte Diagnose intern speichern.
   */
  latestDecisionDiagnostics =
    diagnostics;

  latestDecisionDiagnosticsSummary =
    diagnosticsSummary;

  /**
   * Im Browser zusätzlich global
   * verfügbar machen.
   */
  if (
    typeof window !==
    "undefined"
  ) {
    window.__MLB_BACKTEST_DECISION_DIAGNOSTICS__ =
      diagnostics;

    window.__MLB_BACKTEST_DECISION_SUMMARY__ =
      diagnosticsSummary;
  }

  /**
   * Diagnose direkt ausgeben.
   */
  printDecisionDiagnostics(
    diagnostics,
    diagnosticsSummary
  );

  return predictedGames;
}

/**
 * Führt den Analyzer-Backtest aus.
 *
 * Nur tatsächliche OVER-/UNDER-Picks
 * werden an die Ergebnisberechnung
 * weitergegeben.
 *
 * NO-BET-Spiele beeinflussen deshalb:
 *
 * - Trefferquote
 * - ROI
 * - Yield
 * - Profit
 *
 * nicht.
 */
export function runAnalyzerBacktest(
  states: HistoricalBacktestState[],
  results: BacktestGame[]
): BacktestSummary {
  const predictedGames =
    createPredictedBacktestGames(
      states,
      results
    );

  return runBacktest(
    predictedGames
  );
}