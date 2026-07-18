import type {
  ModuleResult,
} from "@/types";

import type {
  ScheduledGame,
} from "@/services/api/games";

import {
  scorePitcher,
} from "@/utils/scoring";

import type {
  HistoricalGameDataContext,
} from "./historicalDataContext";

import {
  createHistoricalAnalyzerState,
} from "./historicalAnalyzerState";

/**
 * Diagnose eines einzelnen
 * historischen Starting Pitchers.
 */
export interface HistoricalPitcherDiagnostic {
  pitcherId:
    number |
    null;

  pitcherName:
    string |
    null;

  dataLoaded:
    boolean;

  era:
    number |
    null;

  whip:
    number |
    null;

  strikeoutPct:
    number |
    null;

  walkPct:
    number |
    null;

  hr9:
    number |
    null;

  gamesStarted:
    number |
    null;

  inningsPitched:
    number |
    null;

  last5Starts:
    number[];

  pitchCount:
    number |
    null;

  restDays:
    number |
    null;
}

/**
 * Vollständige Point-in-Time-Diagnose
 * eines historischen Spiels.
 */
export interface HistoricalPitcherGameDiagnostic {
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
    HistoricalPitcherDiagnostic;

  away:
    HistoricalPitcherDiagnostic;

  pitcherModule:
    ModuleResult;

  checks: {
    homePitcherIdAvailable:
      boolean;

    awayPitcherIdAvailable:
      boolean;

    homePitcherDataLoaded:
      boolean;

    awayPitcherDataLoaded:
      boolean;

    homeHasHistoricalStarts:
      boolean;

    awayHasHistoricalStarts:
      boolean;

    pitcherModuleActive:
      boolean;
  };

  allPassed:
    boolean;
}

/**
 * Erstellt die Diagnose eines
 * einzelnen Pitchers aus dem
 * historischen Datenkontext.
 */
function createPitcherDiagnostic(
  context:
    HistoricalGameDataContext["home"]
): HistoricalPitcherDiagnostic {
  return {
    pitcherId:
      context.pitcherId,

    pitcherName:
      context.pitcher
        ?.fullName ??
      context.pitcherName,

    dataLoaded:
      context.pitcher !==
      null,

    era:
      context.pitcher
        ?.era ??
      null,

    whip:
      context.pitcher
        ?.whip ??
      null,

    strikeoutPct:
      context.pitcher
        ?.strikeoutPct ??
      null,

    walkPct:
      context.pitcher
        ?.walkPct ??
      null,

    hr9:
      context.pitcher
        ?.hr9 ??
      null,

    gamesStarted:
      context.pitcher
        ?.gamesStarted ??
      null,

    inningsPitched:
      context.pitcher
        ?.inningsPitched ??
      null,

    last5Starts:
      context.pitcher
        ?.last5Starts ??
      [],

    pitchCount:
      context.pitcher
        ?.pitchCount ??
      null,

    restDays:
      context.pitcher
        ?.restDays ??
      null,
  };
}

/**
 * Erstellt eine vollständige
 * Point-in-Time-Diagnose.
 *
 * WICHTIG:
 *
 * Diese Funktion lädt selbst keine
 * neuen Daten.
 *
 * Sie prüft den bereits erzeugten
 * HistoricalGameDataContext und den
 * daraus erzeugten AnalyzerState.
 */
export function createHistoricalPitcherGameDiagnostic(
  game: ScheduledGame,
  context: HistoricalGameDataContext,
  line = 8.5
): HistoricalPitcherGameDiagnostic {
  const state =
    createHistoricalAnalyzerState(
      game,
      context,
      line
    );

  /**
   * Wir rufen exakt dieselbe
   * Pitcher-Scoring-Funktion auf,
   * die auch die normale Analyse
   * verwendet.
   */
  const pitcherModule =
    scorePitcher(
      state.home.pitcher,
      state.away.pitcher
    );

  const home =
    createPitcherDiagnostic(
      context.home
    );

  const away =
    createPitcherDiagnostic(
      context.away
    );

  const checks = {
    homePitcherIdAvailable:
      home.pitcherId !==
      null,

    awayPitcherIdAvailable:
      away.pitcherId !==
      null,

    homePitcherDataLoaded:
      home.dataLoaded,

    awayPitcherDataLoaded:
      away.dataLoaded,

    homeHasHistoricalStarts:
      (
        home.gamesStarted ??
        0
      ) >
      0,

    awayHasHistoricalStarts:
      (
        away.gamesStarted ??
        0
      ) >
      0,

    pitcherModuleActive:
      pitcherModule.hasData,
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

    pitcherModule,

    checks,

    allPassed,
  };
}

/**
 * Gibt eine gut lesbare Diagnose
 * in der Browser-Konsole aus.
 */
export function logHistoricalPitcherGameDiagnostic(
  diagnostic:
    HistoricalPitcherGameDiagnostic
): void {
  console.group(
    `[Historical Pitcher Diagnostic] ${diagnostic.matchup}`
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
      pitcherId:
        diagnostic.home
          .pitcherId,

      pitcherName:
        diagnostic.home
          .pitcherName,

      dataLoaded:
        diagnostic.home
          .dataLoaded,

      era:
        diagnostic.home
          .era,

      whip:
        diagnostic.home
          .whip,

      strikeoutPct:
        diagnostic.home
          .strikeoutPct,

      walkPct:
        diagnostic.home
          .walkPct,

      hr9:
        diagnostic.home
          .hr9,

      gamesStarted:
        diagnostic.home
          .gamesStarted,

      inningsPitched:
        diagnostic.home
          .inningsPitched,

      last5Starts:
        diagnostic.home
          .last5Starts
          .join(
            ", "
          ),

      pitchCount:
        diagnostic.home
          .pitchCount,

      restDays:
        diagnostic.home
          .restDays,
    },

    away: {
      pitcherId:
        diagnostic.away
          .pitcherId,

      pitcherName:
        diagnostic.away
          .pitcherName,

      dataLoaded:
        diagnostic.away
          .dataLoaded,

      era:
        diagnostic.away
          .era,

      whip:
        diagnostic.away
          .whip,

      strikeoutPct:
        diagnostic.away
          .strikeoutPct,

      walkPct:
        diagnostic.away
          .walkPct,

      hr9:
        diagnostic.away
          .hr9,

      gamesStarted:
        diagnostic.away
          .gamesStarted,

      inningsPitched:
        diagnostic.away
          .inningsPitched,

      last5Starts:
        diagnostic.away
          .last5Starts
          .join(
            ", "
          ),

      pitchCount:
        diagnostic.away
          .pitchCount,

      restDays:
        diagnostic.away
          .restDays,
    },
  });

  console.log(
    "Pitcher Module:",
    diagnostic.pitcherModule
  );

  console.table(
    diagnostic.checks
  );

  console.log(
    diagnostic.allPassed
      ? "✅ PITCHER POINT-IN-TIME DIAGNOSTIC PASSED"
      : "❌ PITCHER POINT-IN-TIME DIAGNOSTIC FAILED"
  );

  console.groupEnd();
}