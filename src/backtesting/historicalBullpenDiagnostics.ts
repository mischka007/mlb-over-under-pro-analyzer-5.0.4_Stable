import type {
  ModuleResult,
} from "@/types";

import type {
  ScheduledGame,
} from "@/services/api/games";

import {
  scoreBullpen,
} from "@/utils/scoring";

import type {
  HistoricalGameDataContext,
} from "./historicalDataContext";

import {
  createHistoricalAnalyzerState,
} from "./historicalAnalyzerState";

/**
 * Diagnose eines einzelnen
 * historischen Team-Bullpens.
 */
export interface HistoricalBullpenDiagnostic {
  teamId:
    number;

  teamName:
    string;

  dataLoaded:
    boolean;

  era:
    number |
    null;

  whip:
    number |
    null;

  fip:
    number |
    null;

  war:
    number |
    null;

  inningsLast3Days:
    number |
    null;

  inningsLast7Days:
    number |
    null;

  closerAvailable:
    boolean |
    null;

  middleReliefAvailable:
    boolean |
    null;
}

/**
 * Vollständige Point-in-Time-
 * Bullpen-Diagnose eines
 * historischen MLB-Spiels.
 */
export interface HistoricalBullpenGameDiagnostic {
  gamePk:
    number;

  officialDate:
    string;

  gameDate:
    string;

  cutoffIso:
    string;

  matchup:
    string;

  home:
    HistoricalBullpenDiagnostic;

  away:
    HistoricalBullpenDiagnostic;

  bullpenModule:
    ModuleResult;

  checks: {
    homeBullpenDataLoaded:
      boolean;

    awayBullpenDataLoaded:
      boolean;

    homeBullpenEraAvailable:
      boolean;

    awayBullpenEraAvailable:
      boolean;

    homeBullpenWhipAvailable:
      boolean;

    awayBullpenWhipAvailable:
      boolean;

    homeRecentUsageAvailable:
      boolean;

    awayRecentUsageAvailable:
      boolean;

    bullpenModuleActive:
      boolean;
  };

  allPassed:
    boolean;
}

/**
 * Erstellt die Diagnose eines
 * einzelnen historischen Bullpens.
 */
function createBullpenDiagnostic(
  context:
    HistoricalGameDataContext["home"]
): HistoricalBullpenDiagnostic {
  return {
    teamId:
      context.teamId,

    teamName:
      context.teamName,

    dataLoaded:
      context.bullpen !==
      null,

    era:
      context.bullpen
        ?.era ??
      null,

    whip:
      context.bullpen
        ?.whip ??
      null,

    fip:
      context.bullpen
        ?.fip ??
      null,

    war:
      context.bullpen
        ?.war ??
      null,

    inningsLast3Days:
      context.bullpen
        ?.inningsLast3Days ??
      null,

    inningsLast7Days:
      context.bullpen
        ?.inningsLast7Days ??
      null,

    closerAvailable:
      context.bullpen
        ?.closerAvailable ??
      null,

    middleReliefAvailable:
      context.bullpen
        ?.middleReliefAvailable ??
      null,
  };
}

/**
 * Erstellt eine vollständige
 * Point-in-Time-Bullpen-Diagnose.
 *
 * Die Funktion lädt selbst keine
 * zusätzlichen Daten.
 *
 * Sie prüft ausschließlich:
 *
 * - den bereits erzeugten
 *   HistoricalGameDataContext
 *
 * - den daraus erzeugten
 *   historischen AnalyzerState
 *
 * - das echte Bullpen-Scoring
 */
export function createHistoricalBullpenGameDiagnostic(
  game: ScheduledGame,
  context: HistoricalGameDataContext,
  line = 8.5
): HistoricalBullpenGameDiagnostic {
  const state =
    createHistoricalAnalyzerState(
      game,
      context,
      line
    );

  /**
   * Exakt dieselbe Bullpen-
   * Scoring-Funktion wie in der
   * normalen Analyse.
   */
  const bullpenModule =
    scoreBullpen(
      state.home.bullpen,
      state.away.bullpen
    );

  const home =
    createBullpenDiagnostic(
      context.home
    );

  const away =
    createBullpenDiagnostic(
      context.away
    );

  const checks = {
    homeBullpenDataLoaded:
      home.dataLoaded,

    awayBullpenDataLoaded:
      away.dataLoaded,

    homeBullpenEraAvailable:
      home.era !==
      null,

    awayBullpenEraAvailable:
      away.era !==
      null,

    homeBullpenWhipAvailable:
      home.whip !==
      null,

    awayBullpenWhipAvailable:
      away.whip !==
      null,

    homeRecentUsageAvailable:
      (
        home.inningsLast3Days !==
        null
      ) &&
      (
        home.inningsLast7Days !==
        null
      ),

    awayRecentUsageAvailable:
      (
        away.inningsLast3Days !==
        null
      ) &&
      (
        away.inningsLast7Days !==
        null
      ),

    bullpenModuleActive:
      bullpenModule.hasData,
  };

  const allPassed =
    Object.values(
      checks
    ).every(
      Boolean
    );

  return {
    gamePk:
      game.gamePk,

    officialDate:
      game.officialDate,

    gameDate:
      game.gameDate,

    cutoffIso:
      context.asOfDate
        .toISOString(),

    matchup:
      `${game.awayTeamName} @ ${game.homeTeamName}`,

    home,

    away,

    bullpenModule,

    checks,

    allPassed,
  };
}

/**
 * Gibt die Bullpen-Diagnose
 * übersichtlich in der
 * Browser-Konsole aus.
 */
export function logHistoricalBullpenGameDiagnostic(
  diagnostic:
    HistoricalBullpenGameDiagnostic
): void {
  console.group(
    `[Historical Bullpen Diagnostic] ${diagnostic.matchup}`
  );

  console.log(
    "Game PK:",
    diagnostic.gamePk
  );

  console.log(
    "Official Date:",
    diagnostic.officialDate
  );

  console.log(
    "Game Date:",
    diagnostic.gameDate
  );

  console.log(
    "Point-in-Time Cutoff:",
    diagnostic.cutoffIso
  );

  console.table({
    home: {
      teamId:
        diagnostic.home
          .teamId,

      teamName:
        diagnostic.home
          .teamName,

      dataLoaded:
        diagnostic.home
          .dataLoaded,

      era:
        diagnostic.home
          .era,

      whip:
        diagnostic.home
          .whip,

      fip:
        diagnostic.home
          .fip,

      war:
        diagnostic.home
          .war,

      inningsLast3Days:
        diagnostic.home
          .inningsLast3Days,

      inningsLast7Days:
        diagnostic.home
          .inningsLast7Days,

      closerAvailable:
        diagnostic.home
          .closerAvailable,

      middleReliefAvailable:
        diagnostic.home
          .middleReliefAvailable,
    },

    away: {
      teamId:
        diagnostic.away
          .teamId,

      teamName:
        diagnostic.away
          .teamName,

      dataLoaded:
        diagnostic.away
          .dataLoaded,

      era:
        diagnostic.away
          .era,

      whip:
        diagnostic.away
          .whip,

      fip:
        diagnostic.away
          .fip,

      war:
        diagnostic.away
          .war,

      inningsLast3Days:
        diagnostic.away
          .inningsLast3Days,

      inningsLast7Days:
        diagnostic.away
          .inningsLast7Days,

      closerAvailable:
        diagnostic.away
          .closerAvailable,

      middleReliefAvailable:
        diagnostic.away
          .middleReliefAvailable,
    },
  });

  console.log(
    "Bullpen Module:",
    diagnostic.bullpenModule
  );

  console.table(
    diagnostic.checks
  );

  console.log(
    diagnostic.allPassed
      ? "✅ BULLPEN POINT-IN-TIME DIAGNOSTIC PASSED"
      : "❌ BULLPEN POINT-IN-TIME DIAGNOSTIC FAILED"
  );

  console.groupEnd();
}