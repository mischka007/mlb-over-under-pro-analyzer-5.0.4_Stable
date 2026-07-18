import type {
  TeamOffenseStats,
} from "@/services/api/teams";

import type {
  PitcherStats,
} from "@/services/api/pitchers";

import type {
  BullpenStats,
} from "@/services/api/bullpen";

import {
  clamp,
} from "@/utils/math";

import type {
  HistoricalGameDataContext,
  HistoricalH2HContext,
  HistoricalTeamFormContext,
  HistoricalWeatherContext,
} from "./historicalDataContext";

/**
 * Status eines einzelnen historischen
 * Datenqualitäts-Moduls.
 *
 * OK:
 * Das Modul verfügt über eine
 * vollständige, verwendbare
 * Datenbasis.
 *
 * WARNING:
 * Das Modul verfügt über eine
 * teilweise verwendbare, aber
 * unvollständige Datenbasis.
 *
 * NO_DATA:
 * Für das Modul konnten keine
 * verwendbaren historischen Daten
 * geladen werden.
 *
 * ACCESS_UNAVAILABLE:
 * Die zugrunde liegende historische
 * Datenquelle ist mit dem aktuellen
 * API-Zugang grundsätzlich nicht
 * verfügbar.
 *
 * Dieser Status ist ausdrücklich
 * KEIN Datenintegritätsfehler.
 *
 * INVALID:
 * Technischer oder zeitlicher
 * Datenintegritätsfehler
 * (z. B. Look-Ahead-Verletzung).
 */
export enum HistoricalDataQualityStatus {
  OK = "OK",
  WARNING = "WARNING",
  NO_DATA = "NO_DATA",
  ACCESS_UNAVAILABLE = "ACCESS_UNAVAILABLE",
  INVALID = "INVALID",
}

/**
 * Gesamtbewertung der historischen
 * Datenqualität eines Spiels.
 *
 * Die Grenzen entsprechen exakt:
 *
 * 95–100 = EXCELLENT
 * 85–94  = GOOD
 * 70–84  = FAIR
 * 50–69  = POOR
 * 0–49   = CRITICAL
 */
export enum HistoricalDataQualitySeverity {
  EXCELLENT = "EXCELLENT",
  GOOD = "GOOD",
  FAIR = "FAIR",
  POOR = "POOR",
  CRITICAL = "CRITICAL",
}

/**
 * Qualitätsbewertung eines einzelnen
 * historischen Datenmoduls
 * (z. B. Home Team, Offense, Weather).
 *
 * Sport-agnostisch: Dieses Interface
 * wird ausschließlich von konkreten,
 * sportspezifischen Bewertungsfunktionen
 * befüllt (aktuell MLB über
 * `HistoricalGameDataContext`), kann
 * aber unverändert für NBA, NHL und NFL
 * wiederverwendet werden.
 */
export interface HistoricalDataQualityModule {
  /**
   * Anzeigename des Moduls,
   * z. B. "New York Yankees (Home Offense)".
   */
  name: string;

  status:
    HistoricalDataQualityStatus;

  /**
   * Score von 0 (keine verwendbaren
   * Daten) bis 100 (vollständige
   * Datenbasis).
   */
  score: number;

  /**
   * Menschenlesbare Erklärung des
   * ermittelten Status.
   */
  message: string;
}

/**
 * Vollständiger Historical-Data-Quality-
 * Report eines einzelnen Spiels.
 */
export interface HistoricalDataQualityReport {
  /**
   * MLB gamePk des bewerteten Spiels.
   */
  gamePk:
    number;

  /**
   * Offizieller Spieltermin des
   * bewerteten Spiels.
   */
  gameDate:
    string;

  /**
   * "Away @ Home"-Darstellung
   * des bewerteten Spiels.
   */
  matchup:
    string;

  /**
   * Gesamtqualitäts-Score
   * zwischen 0 % und 100 %.
   */
  overallScore: number;

  severity:
    HistoricalDataQualitySeverity;

  /**
   * Anzahl der Module mit
   * Status WARNING.
   */
  warningCount: number;

  /**
   * Anzahl der Module mit
   * Status NO_DATA, INVALID oder
   * ACCESS_UNAVAILABLE.
   */
  errorCount: number;

  /**
   * Namen aller Module ohne
   * verwendbare bzw. gültige
   * historische Daten.
   */
  missingModules: string[];

  modules:
    HistoricalDataQualityModule[];
}

/**
 * Oberer Score-Wert bei
 * vollständiger Datenbasis.
 */
const SCORE_FULL = 100;

/**
 * Score-Wert, wenn für ein Modul
 * keinerlei verwendbare Daten
 * vorliegen.
 */
const SCORE_NONE = 0;

/**
 * Anzahl der Spiele, die für eine
 * belastbare Form-Historie
 * (Last10) erwartet werden.
 */
const FORM_EXPECTED_RECENT_GAMES = 10;

/**
 * Maximale Anzahl direkter Duelle,
 * die als vollständige H2H-Historie
 * gewertet werden.
 */
const H2H_EXPECTED_GAMES = 20;

/**
 * Mindestanzahl direkter Duelle,
 * ab der die H2H-Historie als
 * statistisch belastbar gilt.
 */
const H2H_MINIMUM_RELIABLE_GAMES = 5;

/**
 * Untere Score-Grenze je
 * Severity-Stufe.
 */
const SEVERITY_EXCELLENT_MIN_SCORE = 95;
const SEVERITY_GOOD_MIN_SCORE = 85;
const SEVERITY_FAIR_MIN_SCORE = 70;
const SEVERITY_POOR_MIN_SCORE = 50;

/**
 * Rundet einen Wert kaufmännisch
 * auf zwei Nachkommastellen.
 */
function roundToTwoDecimals(
  value: number
): number {
  return (
    Math.round(
      value *
      100
    ) /
    100
  );
}

/**
 * Erstellt ein einzelnes
 * `HistoricalDataQualityModule`.
 */
function buildQualityModule(
  name: string,
  status:
    HistoricalDataQualityStatus,
  score: number,
  message: string
): HistoricalDataQualityModule {
  return {
    name,

    status,

    score:
      roundToTwoDecimals(
        clamp(
          score,
          SCORE_NONE,
          SCORE_FULL
        )
      ),

    message,
  };
}

/**
 * Berechnet den Anteil tatsächlich
 * vorhandener (nicht-null) Werte
 * innerhalb einer Menge von
 * Kennzahlen.
 *
 * Liefert einen Wert zwischen
 * 0 (keine Kennzahl vorhanden)
 * und 1 (alle Kennzahlen vorhanden).
 */
function calculateFieldCompletionRatio(
  fields: ReadonlyArray<
    number |
    boolean |
    null
  >
): number {
  if (
    fields.length ===
    0
  ) {
    return 0;
  }

  const presentCount =
    fields.filter(
      (
        field
      ) =>
        field !==
        null
    ).length;

  return (
    presentCount /
    fields.length
  );
}

/**
 * Leitet aus einem Vollständigkeits-
 * Anteil (0–1) den passenden
 * `HistoricalDataQualityStatus` ab.
 *
 * 0    -> NO_DATA
 * 0..1 -> WARNING
 * 1    -> OK
 */
function deriveStatusFromCompletionRatio(
  ratio: number
): HistoricalDataQualityStatus {
  if (
    ratio <=
    0
  ) {
    return HistoricalDataQualityStatus.NO_DATA;
  }

  if (
    ratio >=
    1
  ) {
    return HistoricalDataQualityStatus.OK;
  }

  return HistoricalDataQualityStatus.WARNING;
}

/**
 * Wandelt einen Vollständigkeits-
 * Anteil (0–1) in einen Score
 * zwischen 0 und 100 um.
 */
function deriveScoreFromCompletionRatio(
  ratio: number
): number {
  return (
    ratio *
    SCORE_FULL
  );
}

/**
 * Bewertet die historische
 * Form-Historie (Last10/Last20)
 * eines Teams.
 */
function assessHistoricalTeamFormModule(
  name: string,
  form:
    HistoricalTeamFormContext
): HistoricalDataQualityModule {
  const availableGames =
    Math.min(
      form.last10Runs
        .length,
      FORM_EXPECTED_RECENT_GAMES
    );

  const ratio =
    availableGames /
    FORM_EXPECTED_RECENT_GAMES;

  const status =
    deriveStatusFromCompletionRatio(
      ratio
    );

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  if (
    status ===
    HistoricalDataQualityStatus.NO_DATA
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Keine historischen Form-Daten (Last10/Last20) für ${form.teamName} vorhanden.`
    );
  }

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Unvollständige Form-Historie für ${form.teamName}: ${form.last10Runs.length} von ${FORM_EXPECTED_RECENT_GAMES} erwarteten Spielen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Vollständige Form-Historie für ${form.teamName} vorhanden (${form.last10Runs.length} von ${FORM_EXPECTED_RECENT_GAMES} erwarteten Spielen).`
  );
}

/**
 * Bewertet die historischen
 * Offense-Statistiken eines Teams.
 */
function assessHistoricalOffenseModule(
  name: string,
  offense:
    TeamOffenseStats |
    null
): HistoricalDataQualityModule {
  if (
    offense ===
    null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      "Keine historischen Offense-Statistiken vorhanden."
    );
  }

  const fields: ReadonlyArray<
    number |
    null
  > = [
    offense.runsPerGame,
    offense.avg,
    offense.obp,
    offense.slg,
    offense.ops,
    offense.strikeoutPct,
    offense.walkPct,
  ];

  const ratio =
    calculateFieldCompletionRatio(
      fields
    );

  const status =
    deriveStatusFromCompletionRatio(
      ratio
    );

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  const presentCount =
    fields.filter(
      (
        field
      ) =>
        field !==
        null
    ).length;

  if (
    status ===
    HistoricalDataQualityStatus.NO_DATA
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      "Offense-Datensatz vorhanden, aber alle Kennzahlen sind leer."
    );
  }

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Unvollständige Offense-Statistiken: ${presentCount} von ${fields.length} Kennzahlen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Vollständige Offense-Statistiken vorhanden (${presentCount} von ${fields.length} Kennzahlen).`
  );
}

/**
 * Bewertet die historischen
 * Pitcher-Statistiken eines Teams.
 *
 * Berücksichtigt bewusst nur
 * Kennzahlen, die über die aktuell
 * verwendete Datenquelle tatsächlich
 * befüllt werden können.
 */
function assessHistoricalPitcherModule(
  name: string,
  pitcherId:
    number |
    null,
  pitcherName:
    string |
    null,
  pitcher:
    PitcherStats |
    null
): HistoricalDataQualityModule {
  if (
    pitcherId ===
    null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      "Kein bestätigter Starting Pitcher für dieses Spiel bekannt."
    );
  }

  if (
    pitcher ===
    null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      `Pitcher-ID vorhanden (${pitcherName ?? pitcherId}), aber keine historischen Pitcher-Statistiken geladen.`
    );
  }

  const fields: ReadonlyArray<
    number |
    null
  > = [
    pitcher.era,
    pitcher.whip,
    pitcher.strikeoutPct,
    pitcher.walkPct,
    pitcher.hr9,
    pitcher.inningsPitched,
  ];

  const ratio =
    calculateFieldCompletionRatio(
      fields
    );

  const status =
    deriveStatusFromCompletionRatio(
      ratio
    );

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  const presentCount =
    fields.filter(
      (
        field
      ) =>
        field !==
        null
    ).length;

  if (
    status ===
    HistoricalDataQualityStatus.NO_DATA
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Pitcher-Datensatz für ${pitcher.fullName} vorhanden, aber alle Kennzahlen sind leer.`
    );
  }

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Unvollständige Pitcher-Statistiken für ${pitcher.fullName}: ${presentCount} von ${fields.length} Kennzahlen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Vollständige Pitcher-Statistiken für ${pitcher.fullName} vorhanden (${presentCount} von ${fields.length} Kennzahlen).`
  );
}

/**
 * Bewertet die historischen
 * Bullpen-Statistiken eines Teams.
 */
function assessHistoricalBullpenModule(
  name: string,
  bullpen:
    BullpenStats |
    null
): HistoricalDataQualityModule {
  if (
    bullpen ===
    null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      "Keine historischen Bullpen-Statistiken vorhanden."
    );
  }

  const fields: ReadonlyArray<
    number |
    boolean |
    null
  > = [
    bullpen.era,
    bullpen.whip,
    bullpen.inningsLast3Days,
    bullpen.inningsLast7Days,
    bullpen.closerAvailable,
    bullpen.middleReliefAvailable,
  ];

  const ratio =
    calculateFieldCompletionRatio(
      fields
    );

  const status =
    deriveStatusFromCompletionRatio(
      ratio
    );

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  const presentCount =
    fields.filter(
      (
        field
      ) =>
        field !==
        null
    ).length;

  if (
    status ===
    HistoricalDataQualityStatus.NO_DATA
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      "Bullpen-Datensatz vorhanden, aber alle Kennzahlen sind leer."
    );
  }

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Unvollständige Bullpen-Statistiken: ${presentCount} von ${fields.length} Kennzahlen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Vollständige Bullpen-Statistiken vorhanden (${presentCount} von ${fields.length} Kennzahlen).`
  );
}

/**
 * Bewertet den historischen
 * Wetterkontext eines Spiels.
 */
function assessHistoricalWeatherModule(
  weather:
    HistoricalWeatherContext
): HistoricalDataQualityModule {
  const name =
    "Weather";

  if (
    weather.roofType ===
    "dome"
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.OK,
      SCORE_FULL,
      "Dome-Stadion: Außenwetter nicht spielrelevant, neutrale Referenzwerte verwendet."
    );
  }

  if (
    weather.latitude ===
      null ||
    weather.longitude ===
      null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      "Keine Stadion-Koordinaten verfügbar, historische Wetterdaten konnten nicht geladen werden."
    );
  }

  const snapshot =
    weather.snapshot;

  if (
    snapshot ===
    null
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.NO_DATA,
      SCORE_NONE,
      "Stadion-Koordinaten vorhanden, aber keine historischen Wetterdaten geladen."
    );
  }

  const fields: ReadonlyArray<
    number |
    null
  > = [
    snapshot.temperatureC,
    snapshot.windSpeedMph,
    snapshot.windDegrees,
    snapshot.humidityPct,
    snapshot.pressureHpa,
    snapshot.rainChancePct,
  ];

  const ratio =
    calculateFieldCompletionRatio(
      fields
    );

  const status =
    deriveStatusFromCompletionRatio(
      ratio
    );

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  const presentCount =
    fields.filter(
      (
        field
      ) =>
        field !==
        null
    ).length;

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Unvollständige historische Wetterdaten: ${presentCount} von ${fields.length} Kennzahlen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Vollständige historische Wetterdaten vorhanden (${presentCount} von ${fields.length} Kennzahlen).`
  );
}

/**
 * Bewertet die historischen
 * direkten Duelle (H2H) zwischen
 * Home und Away.
 *
 * Ein Fehlen direkter Duelle wird
 * bewusst als WARNING und nicht als
 * NO_DATA behandelt, da dies bei
 * selten aufeinandertreffenden
 * Teams ein legitimer, technisch
 * korrekter Zustand sein kann.
 */
function assessHistoricalH2HModule(
  h2h:
    HistoricalH2HContext
): HistoricalDataQualityModule {
  const name =
    "H2H";

  const gamesCount =
    h2h.games.length;

  if (
    gamesCount ===
    0
  ) {
    return buildQualityModule(
      name,
      HistoricalDataQualityStatus.WARNING,
      SCORE_NONE,
      "Keine direkten historischen Duelle vor dem Stichtag gefunden."
    );
  }

  const cappedGames =
    Math.min(
      gamesCount,
      H2H_EXPECTED_GAMES
    );

  const ratio =
    cappedGames /
    H2H_EXPECTED_GAMES;

  const score =
    deriveScoreFromCompletionRatio(
      ratio
    );

  const status =
    gamesCount <
    H2H_MINIMUM_RELIABLE_GAMES
      ? HistoricalDataQualityStatus.WARNING
      : HistoricalDataQualityStatus.OK;

  if (
    status ===
    HistoricalDataQualityStatus.WARNING
  ) {
    return buildQualityModule(
      name,
      status,
      score,
      `Geringe H2H-Historie: nur ${gamesCount} von ${H2H_EXPECTED_GAMES} erwarteten direkten Duellen vorhanden.`
    );
  }

  return buildQualityModule(
    name,
    status,
    score,
    `Ausreichende H2H-Historie vorhanden (${gamesCount} von ${H2H_EXPECTED_GAMES} erwarteten direkten Duellen).`
  );
}

/**
 * Bewertet automatisch sämtliche
 * historischen Datenmodule eines
 * `HistoricalGameDataContext`
 * (Home Team, Away Team, Offense,
 * Pitcher, Bullpen, Weather, H2H).
 *
 * Es werden ausschließlich Module
 * bewertet, die tatsächlich Teil
 * des übergebenen Kontexts sind.
 */
export function calculateHistoricalDataQuality(
  context:
    HistoricalGameDataContext
): HistoricalDataQualityReport {
  const modules: HistoricalDataQualityModule[] = [
    assessHistoricalTeamFormModule(
      `${context.home.teamName} (Home Team)`,
      context.home
    ),

    assessHistoricalTeamFormModule(
      `${context.away.teamName} (Away Team)`,
      context.away
    ),

    assessHistoricalOffenseModule(
      `${context.home.teamName} (Home Offense)`,
      context.home.offense
    ),

    assessHistoricalOffenseModule(
      `${context.away.teamName} (Away Offense)`,
      context.away.offense
    ),

    assessHistoricalPitcherModule(
      `${context.home.teamName} (Home Pitcher)`,
      context.home.pitcherId,
      context.home.pitcherName,
      context.home.pitcher
    ),

    assessHistoricalPitcherModule(
      `${context.away.teamName} (Away Pitcher)`,
      context.away.pitcherId,
      context.away.pitcherName,
      context.away.pitcher
    ),

    assessHistoricalBullpenModule(
      `${context.home.teamName} (Home Bullpen)`,
      context.home.bullpen
    ),

    assessHistoricalBullpenModule(
      `${context.away.teamName} (Away Bullpen)`,
      context.away.bullpen
    ),

    assessHistoricalWeatherModule(
      context.weather
    ),

    assessHistoricalH2HModule(
      context.h2h
    ),
  ];

  const missingModules =
    modules
      .filter(
        (
          module
        ) =>
          module.status ===
            HistoricalDataQualityStatus.NO_DATA ||
          module.status ===
            HistoricalDataQualityStatus.ACCESS_UNAVAILABLE ||
          module.status ===
            HistoricalDataQualityStatus.INVALID
      )
      .map(
        (
          module
        ) =>
          module.name
      );

  const warningCount =
    modules.filter(
      (
        module
      ) =>
        module.status ===
        HistoricalDataQualityStatus.WARNING
    ).length;

  const errorCount =
    modules.filter(
      (
        module
      ) =>
        module.status ===
          HistoricalDataQualityStatus.NO_DATA ||
        module.status ===
          HistoricalDataQualityStatus.INVALID ||
        module.status ===
          HistoricalDataQualityStatus.ACCESS_UNAVAILABLE
    ).length;

  const overallScore =
    calculateOverallScore(
      modules
    );

  const severity =
    calculateSeverity(
      overallScore
    );

  return {
    gamePk:
      context.gamePk,

    gameDate:
      context.gameDate,

    matchup:
      `${context.away.teamName} @ ${context.home.teamName}`,

    overallScore,

    severity,

    warningCount,

    errorCount,

    missingModules,

    modules,
  };
}

/**
 * Berechnet den Gesamtqualitäts-
 * Score (0–100 %) als arithmetisches
 * Mittel aller Modul-Scores.
 */
export function calculateOverallScore(
  modules: ReadonlyArray<
    HistoricalDataQualityModule
  >
): number {
  if (
    modules.length ===
    0
  ) {
    return SCORE_NONE;
  }

  const totalScore =
    modules.reduce(
      (
        sum,
        module
      ) =>
        sum +
        module.score,
      0
    );

  return roundToTwoDecimals(
    clamp(
      totalScore /
        modules.length,
      SCORE_NONE,
      SCORE_FULL
    )
  );
}

/**
 * Leitet aus dem Gesamtqualitäts-
 * Score die entsprechende
 * `HistoricalDataQualitySeverity`
 * ab.
 *
 * 95–100 = EXCELLENT
 * 85–94  = GOOD
 * 70–84  = FAIR
 * 50–69  = POOR
 * 0–49   = CRITICAL
 */
export function calculateSeverity(
  overallScore: number
): HistoricalDataQualitySeverity {
  if (
    overallScore >=
    SEVERITY_EXCELLENT_MIN_SCORE
  ) {
    return HistoricalDataQualitySeverity.EXCELLENT;
  }

  if (
    overallScore >=
    SEVERITY_GOOD_MIN_SCORE
  ) {
    return HistoricalDataQualitySeverity.GOOD;
  }

  if (
    overallScore >=
    SEVERITY_FAIR_MIN_SCORE
  ) {
    return HistoricalDataQualitySeverity.FAIR;
  }

  if (
    overallScore >=
    SEVERITY_POOR_MIN_SCORE
  ) {
    return HistoricalDataQualitySeverity.POOR;
  }

  return HistoricalDataQualitySeverity.CRITICAL;
}

/**
 * Gibt den vollständigen Historical-
 * Data-Quality-Report professionell
 * in der Konsole aus.
 */
export function logHistoricalDataQuality(
  report:
    HistoricalDataQualityReport
): void {
  console.log(
    "========================================"
  );

  console.log(
    "HISTORICAL DATA QUALITY"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Game PK:",
    report.gamePk
  );

  console.log(
    "Matchup:",
    report.matchup
  );

  console.log(
    "Game Date:",
    report.gameDate
  );

  console.table(
    report.modules.map(
      (
        module
      ) => ({
        Name:
          module.name,

        Status:
          module.status,

        Score:
          `${module.score.toFixed(2)} %`,

        Message:
          module.message,
      })
    )
  );

  console.log(
    "Overall Score:",
    `${report.overallScore.toFixed(2)} %`
  );

  console.log(
    "Severity:",
    report.severity
  );

  console.log(
    "Warnings:",
    report.warningCount
  );

  console.log(
    "Errors:",
    report.errorCount
  );

  console.log(
    "Missing Modules:",
    report.missingModules.length >
      0
      ? report.missingModules.join(
          ", "
        )
      : "Keine"
  );

  console.log(
    "========================================"
  );
}
