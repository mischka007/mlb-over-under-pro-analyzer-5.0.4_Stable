import type {
  ModuleResult,
} from "@/types";

import type {
  ScheduledGame,
} from "@/services/api/games";

import {
  scoreWeather,
} from "@/utils/scoring";

import type {
  HistoricalGameDataContext,
} from "./historicalDataContext";

import {
  createHistoricalAnalyzerState,
} from "./historicalAnalyzerState";

/**
 * Diagnose der historischen
 * Wetterversorgung eines Spiels.
 */
export interface HistoricalWeatherGameDiagnostic {
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

  venueName:
    string;

  latitude:
    number |
    null;

  longitude:
    number |
    null;

  roofType:
    "open" |
    "retractable" |
    "dome" |
    null;

  weatherDataLoaded:
    boolean;

  temperatureC:
    number |
    null;

  windSpeedMph:
    number |
    null;

  windDegrees:
    number |
    null;

  humidityPct:
    number |
    null;

  pressureHpa:
    number |
    null;

  rainChancePct:
    number |
    null;

  weatherModule:
    ModuleResult;

  checks: {
    venueAvailable:
      boolean;

    coordinatesAvailable:
      boolean;

    weatherOrDomeAvailable:
      boolean;

    weatherModuleActive:
      boolean;
  };

  reason:
    string;

  allPassed:
    boolean;
}

/**
 * Kompakte Coverage-Zeile für
 * ein historisches Spiel.
 */
export interface HistoricalWeatherCoverageDiagnostic {
  gamePk:
    number;

  officialDate:
    string;

  matchup:
    string;

  venueName:
    string;

  roofType:
    string;

  coordinatesAvailable:
    boolean;

  weatherDataLoaded:
    boolean;

  weatherModuleActive:
    boolean;

  temperatureC:
    number |
    null;

  windSpeedMph:
    number |
    null;

  humidityPct:
    number |
    null;

  pressureHpa:
    number |
    null;

  reason:
    string;
}

/**
 * Ermittelt einen möglichst konkreten
 * Grund für einen inaktiven
 * historischen Weather-State.
 */
function determineWeatherDiagnosticReason(
  diagnostic: {
    venueName:
      string;

    latitude:
      number |
      null;

    longitude:
      number |
      null;

    roofType:
      "open" |
      "retractable" |
      "dome" |
      null;

    weatherDataLoaded:
      boolean;

    weatherModuleActive:
      boolean;
  }
): string {
  if (
    diagnostic.weatherModuleActive
  ) {
    return "OK";
  }

  if (
    diagnostic.venueName
      .trim()
      .length ===
    0
  ) {
    return "Venue-Name fehlt";
  }

  if (
    diagnostic.latitude ===
      null ||
    diagnostic.longitude ===
      null
  ) {
    return "Keine Stadion-Koordinaten gefunden";
  }

  if (
    diagnostic.roofType ===
      "dome"
  ) {
    return "Dome erkannt, Weather-Modul aber trotzdem inaktiv";
  }

  if (
    !diagnostic.weatherDataLoaded
  ) {
    return "Historische Wetterdaten konnten nicht geladen werden";
  }

  return "Wetterdaten vorhanden, aber scoreWeather() meldet hasData = false";
}

/**
 * Erstellt die historische
 * Wetterdiagnose eines Spiels.
 */
export function createHistoricalWeatherGameDiagnostic(
  game: ScheduledGame,
  context: HistoricalGameDataContext,
  line = 8.5
): HistoricalWeatherGameDiagnostic {
  const state =
    createHistoricalAnalyzerState(
      game,
      context,
      line
    );

  /**
   * Technische Baseline für die
   * isolierte Weather-Diagnose.
   */
  const weatherModule =
    scoreWeather(
      state.weather,
      9
    );

  const weather =
    context.weather;

  const snapshot =
    weather.snapshot;

  const weatherDataLoaded =
    snapshot !==
    null;

  const weatherOrDomeAvailable =
    weatherDataLoaded ||
    weather.roofType ===
      "dome";

  const checks = {
    venueAvailable:
      weather.venueName
        .trim()
        .length >
      0,

    coordinatesAvailable:
      weather.latitude !==
        null &&
      weather.longitude !==
        null,

    weatherOrDomeAvailable,

    weatherModuleActive:
      weatherModule.hasData,
  };

  const reason =
    determineWeatherDiagnosticReason({
      venueName:
        weather.venueName,

      latitude:
        weather.latitude,

      longitude:
        weather.longitude,

      roofType:
        weather.roofType,

      weatherDataLoaded,

      weatherModuleActive:
        weatherModule.hasData,
    });

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

    venueName:
      weather.venueName,

    latitude:
      weather.latitude,

    longitude:
      weather.longitude,

    roofType:
      weather.roofType,

    weatherDataLoaded,

    temperatureC:
      snapshot
        ?.temperatureC ??
      null,

    windSpeedMph:
      snapshot
        ?.windSpeedMph ??
      null,

    windDegrees:
      snapshot
        ?.windDegrees ??
      null,

    humidityPct:
      snapshot
        ?.humidityPct ??
      null,

    pressureHpa:
      snapshot
        ?.pressureHpa ??
      null,

    rainChancePct:
      snapshot
        ?.rainChancePct ??
      null,

    weatherModule,

    checks,

    reason,

    allPassed,
  };
}

/**
 * Erstellt eine kompakte
 * Weather-Coverage-Diagnose für
 * alle historischen Spiele.
 */
export function createHistoricalWeatherCoverageDiagnostics(
  games: ScheduledGame[],
  contexts: HistoricalGameDataContext[],
  line = 8.5
): HistoricalWeatherCoverageDiagnostic[] {
  const contextByGamePk =
    new Map(
      contexts.map(
        (
          context
        ) => [
          context.gamePk,
          context,
        ]
      )
    );

  const diagnostics:
    HistoricalWeatherCoverageDiagnostic[] = [];

  for (
    const game of games
  ) {
    const context =
      contextByGamePk.get(
        game.gamePk
      );

    if (
      !context
    ) {
      diagnostics.push({
        gamePk:
          game.gamePk,

        officialDate:
          game.officialDate,

        matchup:
          `${game.awayTeamName} @ ${game.homeTeamName}`,

        venueName:
          game.venueName,

        roofType:
          "UNKNOWN",

        coordinatesAvailable:
          false,

        weatherDataLoaded:
          false,

        weatherModuleActive:
          false,

        temperatureC:
          null,

        windSpeedMph:
          null,

        humidityPct:
          null,

        pressureHpa:
          null,

        reason:
          "HistoricalGameDataContext fehlt",
      });

      continue;
    }

    const diagnostic =
      createHistoricalWeatherGameDiagnostic(
        game,
        context,
        line
      );

    diagnostics.push({
      gamePk:
        diagnostic.gamePk,

      officialDate:
        diagnostic.officialDate,

      matchup:
        diagnostic.matchup,

      venueName:
        diagnostic.venueName,

      roofType:
        diagnostic.roofType ??
        "UNKNOWN",

      coordinatesAvailable:
        diagnostic.checks
          .coordinatesAvailable,

      weatherDataLoaded:
        diagnostic.weatherDataLoaded,

      weatherModuleActive:
        diagnostic.weatherModule
          .hasData,

      temperatureC:
        diagnostic.temperatureC,

      windSpeedMph:
        diagnostic.windSpeedMph,

      humidityPct:
        diagnostic.humidityPct,

      pressureHpa:
        diagnostic.pressureHpa,

      reason:
        diagnostic.reason,
    });
  }

  return diagnostics;
}

/**
 * Gibt die Coverage aller historischen
 * Weather-Module aus.
 *
 * Zusätzlich werden alle inaktiven
 * Spiele separat hervorgehoben.
 */
export function logHistoricalWeatherCoverageDiagnostics(
  diagnostics:
    HistoricalWeatherCoverageDiagnostic[]
): void {
  const activeGames =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        diagnostic.weatherModuleActive
    );

  const inactiveGames =
    diagnostics.filter(
      (
        diagnostic
      ) =>
        !diagnostic.weatherModuleActive
    );

  const coverage =
    diagnostics.length >
    0
      ? (
          activeGames.length /
          diagnostics.length
        ) *
        100
      : 0;

  console.log(
    "========================================"
  );

  console.log(
    "HISTORICAL WEATHER COVERAGE DIAGNOSTICS"
  );

  console.log(
    "========================================"
  );

  console.table(
    diagnostics
  );

  console.log(
    "Weather-Spiele gesamt:",
    diagnostics.length
  );

  console.log(
    "Weather ACTIVE:",
    activeGames.length
  );

  console.log(
    "Weather INACTIVE:",
    inactiveGames.length
  );

  console.log(
    "Weather Coverage:",
    `${coverage.toFixed(2)} %`
  );

  if (
    inactiveGames.length >
    0
  ) {
    console.warn(
      "========================================"
    );

    console.warn(
      "WEATHER COVERAGE GAPS"
    );

    console.warn(
      "========================================"
    );

    console.table(
      inactiveGames
    );

    console.warn(
      "Vollständige inaktive Weather-Spiele:",
      inactiveGames
    );
  } else {
    console.log(
      "✅ WEATHER COVERAGE COMPLETE: 100.00 %"
    );
  }

  console.log(
    "========================================"
  );
}

/**
 * Gibt die historische Wetterdiagnose
 * eines einzelnen Spiels aus.
 */
export function logHistoricalWeatherGameDiagnostic(
  diagnostic:
    HistoricalWeatherGameDiagnostic
): void {
  console.group(
    `[Historical Weather Diagnostic] ${diagnostic.matchup}`
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

  console.log(
    "Venue:",
    diagnostic.venueName
  );

  console.table({
    weather: {
      latitude:
        diagnostic.latitude,

      longitude:
        diagnostic.longitude,

      roofType:
        diagnostic.roofType,

      weatherDataLoaded:
        diagnostic.weatherDataLoaded,

      temperatureC:
        diagnostic.temperatureC,

      windSpeedMph:
        diagnostic.windSpeedMph,

      windDegrees:
        diagnostic.windDegrees,

      humidityPct:
        diagnostic.humidityPct,

      pressureHpa:
        diagnostic.pressureHpa,

      rainChancePct:
        diagnostic.rainChancePct,
    },
  });

  console.log(
    "Weather Module:",
    diagnostic.weatherModule
  );

  console.table(
    diagnostic.checks
  );

  console.log(
    "Diagnostic Reason:",
    diagnostic.reason
  );

  console.log(
    diagnostic.allPassed
      ? "✅ WEATHER POINT-IN-TIME DIAGNOSTIC PASSED"
      : "❌ WEATHER POINT-IN-TIME DIAGNOSTIC FAILED"
  );

  console.groupEnd();
}