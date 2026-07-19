import type {
  AnalyzerState,
  BullpenInput,
  H2HInput,
  OffenseInput,
  PitcherInput,
  TeamFormInput,
  WeatherInput,
} from "@/types";

import {
  mean,
} from "@/utils/math";

import {
  createEmptyAnalyzerState,
} from "@/hooks/useAnalyzerState";

import type {
  ScheduledGame,
} from "@/services/api/games";

import type {
  TeamOffenseStats,
} from "@/services/api/teams";

import type {
  PitcherStats,
} from "@/services/api/pitchers";

import type {
  BullpenStats,
} from "@/services/api/bullpen";

import type {
  HistoricalGameDataContext,
  HistoricalH2HContext,
  HistoricalWeatherContext,
} from "./historicalDataContext";

import type {
  HistoricalBacktestState,
} from "./historicalBacktestState";

function numbersToStrings(
  values: number[]
): string[] {
  return values.map(
    (
      value
    ) =>
      String(
        value
      )
  );
}

function numberToString(
  value:
    number |
    null
): string {
  return value ==
    null
    ? ""
    : String(
        value
      );
}

function padValues(
  values: string[],
  length: number
): string[] {
  const result =
    values.slice(
      -length
    );

  while (
    result.length <
    length
  ) {
    result.unshift(
      ""
    );
  }

  return result;
}

function createHistoricalTeamFormInput(
  context:
    HistoricalGameDataContext["home"]
): TeamFormInput {
  const last10 =
    numbersToStrings(
      context.last10Runs
    );

  const last10Allowed =
    numbersToStrings(
      context.last10Allowed
    );

  const last20 =
    numbersToStrings(
      context.last20Runs
    );

  return {
    last10:
      padValues(
        last10,
        10
      ),

    last20:
      padValues(
        last20,
        20
      ),

    runsAllowedLast10:
      padValues(
        last10Allowed,
        10
      ),

    streak:
      context.streak,

    homeRunsPerGame:
      "",

    awayRunsPerGame:
      "",
  };
}

function createHistoricalOffenseInput(
  offense:
    TeamOffenseStats |
    null,
  recentRuns: number[]
): OffenseInput {
  const last10Games =
    padValues(
      numbersToStrings(
        recentRuns
      ),
      10
    );

  /**
   * "Last 7 Games" lässt sich aus den bereits vorhandenen, echten
   * `recentRuns`-Daten ableiten (Teilmenge der letzten 10 Spiele) —
   * keine Erfindung neuer Werte. "Last 15/30 Games" liegen im
   * historischen Kontext nicht vor (nur die letzten 10 Spiele werden
   * geladen, siehe `last10Runs`) und bleiben daher konsequent leer,
   * analog zu wrcPlus/woba/iso/hardHitPct/barrelPct unten.
   */
  const last7Runs =
    recentRuns.slice(-7);

  const last7AvgRuns =
    last7Runs.length >=
    7
      ? numberToString(
          mean(
            last7Runs
          )
        )
      : "";

  return {
    runsPerGame:
      numberToString(
        offense?.runsPerGame ??
        null
      ),

    avg:
      numberToString(
        offense?.avg ??
        null
      ),

    obp:
      numberToString(
        offense?.obp ??
        null
      ),

    slg:
      numberToString(
        offense?.slg ??
        null
      ),

    ops:
      numberToString(
        offense?.ops ??
        null
      ),

    kPct:
      numberToString(
        offense?.strikeoutPct ??
        null
      ),

    bbPct:
      numberToString(
        offense?.walkPct ??
        null
      ),

    babip:
      "",

    wrcPlus:
      "",

    woba:
      "",

    iso:
      "",

    hardHitPct:
      "",

    barrelPct:
      "",

    rispAvg:
      "",

    homeSplitRuns:
      "",

    awaySplitRuns:
      "",

    last10Games,

    xwoba:
      "",

    exitVelocity:
      "",

    launchAngle:
      "",

    contactPct:
      "",

    chasePct:
      "",

    zoneContactPct:
      "",

    swingPct:
      "",

    vsLhpOps:
      "",

    vsRhpOps:
      "",

    last7AvgRuns,

    last15AvgRuns:
      "",

    last30AvgRuns:
      "",
  };
}

function createHistoricalPitcherInput(
  pitcher:
    PitcherStats |
    null
): PitcherInput {
  return {
    era:
      numberToString(
        pitcher?.era ??
        null
      ),

    xera:
      numberToString(
        pitcher?.xera ??
        null
      ),

    fip:
      numberToString(
        pitcher?.fip ??
        null
      ),

    siera:
      numberToString(
        pitcher?.siera ??
        null
      ),

    whip:
      numberToString(
        pitcher?.whip ??
        null
      ),

    babip:
      numberToString(
        pitcher?.babip ??
        null
      ),

    kPct:
      numberToString(
        pitcher?.strikeoutPct ??
        null
      ),

    bbPct:
      numberToString(
        pitcher?.walkPct ??
        null
      ),

    hr9:
      numberToString(
        pitcher?.hr9 ??
        null
      ),

    gbPct:
      numberToString(
        pitcher?.groundOutPct ??
        null
      ),

    fbPct:
      numberToString(
        pitcher?.flyOutPct ??
        null
      ),

    lobPct:
      numberToString(
        pitcher?.lobPct ??
        null
      ),

    hardHitPct:
      numberToString(
        pitcher?.hardHitPct ??
        null
      ),

    barrelPct:
      numberToString(
        pitcher?.barrelPct ??
        null
      ),

    pitchCount:
      numberToString(
        pitcher?.pitchCount ??
        null
      ),

    restDays:
      numberToString(
        pitcher?.restDays ??
        null
      ),

    last5Starts:
      padValues(
        numbersToStrings(
          pitcher?.last5Starts ??
          []
        ),
        5
      ),

    /**
     * Starting Pitcher PRO: reale,
     * point-in-time berechnete
     * Erweiterungen (siehe
     * pitchers.ts). Fallen leer aus,
     * wenn kein Pitcher vorhanden ist,
     * statt Werte zu erfinden.
     */
    last10Starts:
      padValues(
        numbersToStrings(
          pitcher?.last10Starts ??
          []
        ),
        10
      ),

    pitchCountLast5:
      padValues(
        numbersToStrings(
          pitcher?.pitchCountLast5 ??
          []
        ),
        5
      ),

    velocity:
      numberToString(
        pitcher?.velocity ??
        null
      ),

    spinRate:
      numberToString(
        pitcher?.spinRate ??
        null
      ),

    throwsHand:
      pitcher?.throws ===
      "L"
        ? "L"
        : "R",

    dayEraSplit:
      "",

    nightEraSplit:
      "",

    homeEraSplit:
      "",

    awayEraSplit:
      "",
  };
}

function createHistoricalBullpenInput(
  bullpen:
    BullpenStats |
    null
): BullpenInput {
  return {
    era:
      numberToString(
        bullpen?.era ??
        null
      ),

    whip:
      numberToString(
        bullpen?.whip ??
        null
      ),

    fip:
      numberToString(
        bullpen?.fip ??
        null
      ),

    war:
      numberToString(
        bullpen?.war ??
        null
      ),

    closerAvailable:
      bullpen
        ?.closerAvailable ??
      true,

    middleReliefAvailable:
      bullpen
        ?.middleReliefAvailable ??
      true,

    inningsLast3Days:
      numberToString(
        bullpen
          ?.inningsLast3Days ??
        null
      ),

    inningsLast7Days:
      numberToString(
        bullpen
          ?.inningsLast7Days ??
        null
      ),

    /**
     * Bullpen PRO: xFIP/K%/BB%/HR9/LOB%/Hard-Hit % sind über die aktuell
     * verwendete öffentliche MLB-Datenquelle nicht zuverlässig verfügbar
     * (analog zu FIP/WAR oben) und werden daher — konsistent mit der
     * bestehenden Architektur — nicht erfunden, sondern als leer
     * initialisiert. High-Leverage-Verfügbarkeit ist historisch nicht
     * rekonstruierbar und wird konservativ mit `true` angenommen (analog
     * zu closerAvailable/middleReliefAvailable oben).
     */
    xfip:
      numberToString(
        null
      ),

    kPct:
      numberToString(
        null
      ),

    bbPct:
      numberToString(
        null
      ),

    hr9:
      numberToString(
        null
      ),

    lobPct:
      numberToString(
        null
      ),

    hardHitPct:
      numberToString(
        null
      ),

    highLeverageAvailable:
      true,
  };
}

/**
 * Wandelt historische Wetterdaten
 * in WeatherInput um.
 */
function createHistoricalWeatherInput(
  weather:
    HistoricalWeatherContext
): WeatherInput {
  /**
   * Permanenter Dome:
   *
   * Außenwetter ist nicht relevant.
   * Wir verwenden neutrale Indoor-
   * Referenzwerte und markieren das
   * Dach als geschlossen.
   */
  if (
    weather.roofType ===
    "dome"
  ) {
    return {
      temperatureC:
        "21",

      windSpeedMph:
        "0",

      windDirection:
        "none",

      humidityPct:
        "50",

      pressureHpa:
        "1013",

      rainChancePct:
        "0",

      roofState:
        "closed",
    };
  }

  const snapshot =
    weather.snapshot;

  if (
    !snapshot
  ) {
    return {
      temperatureC:
        "",

      windSpeedMph:
        "",

      windDirection:
        "none",

      humidityPct:
        "",

      pressureHpa:
        "",

      rainChancePct:
        "",

      /**
       * Bei einem Retractable Roof
       * kennen wir den historischen
       * tatsächlichen Dachstatus nicht.
       *
       * Deshalb wird kein geschlossener
       * Zustand erfunden.
       */
      roofState:
        "none",
    };
  }

  return {
    temperatureC:
      numberToString(
        snapshot.temperatureC
      ),

    windSpeedMph:
      numberToString(
        snapshot.windSpeedMph
      ),

    /**
     * Ohne exakte Stadionausrichtung
     * kann die Kompassrichtung nicht
     * belastbar in "in" oder "out"
     * übersetzt werden.
     */
    windDirection:
      snapshot.windSpeedMph >
      0
        ? "cross"
        : "none",

    humidityPct:
      numberToString(
        snapshot.humidityPct
      ),

    pressureHpa:
      numberToString(
        snapshot.pressureHpa
      ),

    rainChancePct:
      numberToString(
        snapshot.rainChancePct
      ),

    roofState:
      "none",
  };
}

/**
 * Wandelt historische direkte Duelle
 * in das bestehende H2HInput-Format
 * des Analyzers um.
 *
 * Die H2H-Spiele liegen chronologisch
 * vor:
 *
 * ältestes -> neuestes
 *
 * `padValues()` behält deshalb korrekt
 * die jeweils letzten 10 bzw. 20 Duelle.
 */
function createHistoricalH2HInput(
  h2h:
    HistoricalH2HContext
): H2HInput {
  const totalRuns =
    h2h.games.map(
      (
        game
      ) =>
        String(
          game.totalRuns
        )
    );

  return {
    last10TotalRuns:
      padValues(
        totalRuns,
        10
      ),

    last20TotalRuns:
      padValues(
        totalRuns,
        20
      ),

    /**
     * Diese beiden Werte können aus dem
     * aktuellen H2H-Schedule-Response
     * nicht belastbar rekonstruiert werden.
     *
     * Deshalb bleiben sie bewusst leer,
     * statt historische Werte zu erfinden.
     */
    firstFiveInningsAvg:
      "",

    extraInningsGames:
      "",
  };
}

export function createHistoricalAnalyzerState(
  game: ScheduledGame,
  context: HistoricalGameDataContext,
  line = 8.5
): AnalyzerState {
  const state =
    createEmptyAnalyzerState();

  return {
    ...state,

    setup: {
      ...state.setup,

      homeTeamName:
        game.homeTeamName,

      awayTeamName:
        game.awayTeamName,

      line:
        String(
          line
        ),

      isDoubleheader:
        game.isDoubleheader,
    },

    home: {
      ...state.home,

      form:
        createHistoricalTeamFormInput(
          context.home
        ),

      offense:
        createHistoricalOffenseInput(
          context.home.offense,
          context.home.last10Runs
        ),

      pitcher:
        createHistoricalPitcherInput(
          context.home.pitcher
        ),

      bullpen:
        createHistoricalBullpenInput(
          context.home.bullpen
        ),
    },

    away: {
      ...state.away,

      form:
        createHistoricalTeamFormInput(
          context.away
        ),

      offense:
        createHistoricalOffenseInput(
          context.away.offense,
          context.away.last10Runs
        ),

      pitcher:
        createHistoricalPitcherInput(
          context.away.pitcher
        ),

      bullpen:
        createHistoricalBullpenInput(
          context.away.bullpen
        ),
    },

    weather:
      createHistoricalWeatherInput(
        context.weather
      ),

    /**
     * Historische direkte Duelle
     * ausschließlich aus der Zeit
     * vor dem aktuellen Backtest-Spiel.
     */
    h2h:
      createHistoricalH2HInput(
        context.h2h
      ),
  };
}

export function createHistoricalAnalyzerStates(
  games: ScheduledGame[],
  contexts: HistoricalGameDataContext[],
  line = 8.5
): HistoricalBacktestState[] {
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

  const states:
    HistoricalBacktestState[] = [];

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
      continue;
    }

    states.push({
      gameId:
        game.gamePk,

      state:
        createHistoricalAnalyzerState(
          game,
          context,
          line
        ),
    });
  }

  return states;
}