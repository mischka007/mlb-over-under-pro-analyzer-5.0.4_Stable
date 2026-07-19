import type {
  BallparkInput,
  BullpenGrade,
  BullpenInput,
  BullpenMetricNote,
  BullpenQualityAssessment,
  H2HInput,
  MarketInput,
  ModuleResult,
  OffenseGrade,
  OffenseInput,
  OffenseMetricNote,
  OffenseQualityAssessment,
  PitcherGrade,
  PitcherInput,
  PitcherMetricNote,
  PitcherQualityAssessment,
  TeamFormInput,
  WeatherInput,
} from "@/types";

import {
  clamp,
  hasAnyValue,
  mean,
  stdDev,
  toNumber,
  toNumberArray,
  weightedAverage,
} from "@/utils/math";

/**
 * Alle Scoring-Funktionen wandeln Rohdaten
 * in zwei Dinge um:
 *
 * 1. einen Score von 0–100
 *
 *    50 = neutral
 *    > 50 = OVER-Signal
 *    < 50 = UNDER-Signal
 *
 * 2. wo sinnvoll:
 *
 *    einen erwarteten Runs-Beitrag
 *    für das Poisson-Modell
 *
 * Score-Umrechnung folgt durchgängig
 * dem Prinzip:
 *
 * score =
 *
 * 50 +
 * relative Abweichung vom Liga-Mittel
 * × Skalierungsfaktor
 *
 * anschließend geklemmt auf:
 *
 * 0 bis 100
 *
 * Fehlende Einzelwerte werden
 * übersprungen.
 *
 * Ist für ein Modul keine ausreichende
 * Datenbasis vorhanden, liefert die
 * Funktion:
 *
 * hasData = false
 *
 * Das Modul wird dadurch im Consensus
 * und bei der Baseline-Berechnung
 * ignoriert.
 */

// ---------------------------------------------------------------------------
// Liga-Durchschnittswerte
// ---------------------------------------------------------------------------

/**
 * MLB-Liga-Durchschnittswerte
 * als Referenzpunkte.
 *
 * Diese Werte sind derzeit feste
 * Modellparameter.
 */
const LEAGUE_AVG = {
  era:
    4.2,

  whip:
    1.28,

  kPct:
    22.5,

  bbPct:
    8.3,

  hr9:
    1.25,

  bullpenEra:
    4.1,

  runsPerGame:
    4.5,

  ops:
    0.72,

  wrcPlus:
    100,

  woba:
    0.315,

  runFactor:
    100,

  hrFactor:
    100,

  /**
   * Starting Pitcher PRO: zusätzliche
   * Liga-Referenzwerte für FIP, BABIP,
   * LOB%, Batted-Ball-Profil sowie
   * Statcast-Kennzahlen. Es handelt
   * sich um allgemein bekannte,
   * über mehrere Saisons stabile
   * MLB-Näherungswerte (keine
   * fingierten Werte).
   */
  fip:
    4.1,

  babip:
    0.297,

  lobPct:
    72.5,

  gbPct:
    43,

  fbPct:
    35,

  hardHitPct:
    35,

  barrelPct:
    7,

  /**
   * Bullpen PRO: zusätzliche Liga-Referenzwerte, spezifisch für
   * Bullpen-Aggregate (weichen von den Starting-Pitcher-Werten ab, da
   * Reliever im Schnitt kürzere, aggressivere Einsätze werfen). Es
   * handelt sich um allgemein bekannte, über mehrere Saisons stabile
   * MLB-Näherungswerte (keine fingierten Werte).
   */
  bullpenFip:
    4.05,

  bullpenXfip:
    4.15,

  bullpenWhip:
    1.31,

  bullpenKPct:
    22.8,

  bullpenBbPct:
    9.2,

  bullpenHr9:
    1.15,

  bullpenLobPct:
    73.5,

  bullpenHardHitPct:
    35.5,

  /** Ungefähres Gesamt-WAR eines durchschnittlichen MLB-Bullpens pro Saison. */
  bullpenWar:
    2,

  /**
   * Offense PRO: zusätzliche Liga-Referenzwerte für die neuen
   * Advanced-Metrics. Allgemein bekannte, über mehrere Saisons stabile
   * MLB-Näherungswerte (keine fingierten Werte).
   */
  xwoba:
    0.32,

  exitVelocityMph:
    89,

  launchAngleDeg:
    12,

  contactPct:
    76,

  chasePct:
    28,

  zoneContactPct:
    85,

  swingPct:
    47,
};

// ---------------------------------------------------------------------------
// Modul 1: Team-Form
// ---------------------------------------------------------------------------

/**
 * Bewertet die aktuelle Form
 * beider Teams.
 *
 * WICHTIG:
 *
 * Das Form-Modul wird nur dann aktiviert,
 * wenn sowohl für das Heimteam als auch
 * für das Auswärtsteam mindestens eine
 * echte historische Formserie vorhanden ist.
 *
 * Dadurch verhindern wir folgende
 * fehlerhafte Situation:
 *
 * Heimteam:
 * historische Daten vorhanden
 *
 * Auswärtsteam:
 * keine historischen Daten
 *
 * Frühere problematische Berechnung:
 *
 * homeAvg + 0
 *
 * Das hätte ein künstliches
 * UNDER-Signal erzeugen können.
 *
 * Neue Logik:
 *
 * Fehlen die Formdaten eines Teams
 * vollständig, wird:
 *
 * hasData = false
 *
 * gesetzt und das komplette Form-Modul
 * aus der Analyse ausgeschlossen.
 */
export function scoreTeamForm(
  home: TeamFormInput,
  away: TeamFormInput
): ModuleResult {
  const homeLast10 =
    toNumberArray(
      home.last10
    );

  const awayLast10 =
    toNumberArray(
      away.last10
    );

  const homeLast20 =
    toNumberArray(
      home.last20
    );

  const awayLast20 =
    toNumberArray(
      away.last20
    );

  /**
   * Das Heimteam besitzt echte
   * historische Formdaten, wenn
   * mindestens Last-10 oder Last-20
   * Werte vorhanden sind.
   */
  const homeHasData =
    homeLast10.length >
      0 ||
    homeLast20.length >
      0;

  /**
   * Das Auswärtsteam besitzt echte
   * historische Formdaten, wenn
   * mindestens Last-10 oder Last-20
   * Werte vorhanden sind.
   */
  const awayHasData =
    awayLast10.length >
      0 ||
    awayLast20.length >
      0;

  /**
   * Das Modul darf ausschließlich
   * aktiviert werden, wenn BEIDE
   * Teams eine historische Datenbasis
   * besitzen.
   */
  const hasData =
    homeHasData &&
    awayHasData;

  if (
    !hasData
  ) {
    return {
      key:
        "form",

      label:
        "Team-Form",

      score:
        50,

      weight:
        0.1,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  /**
   * Gewichtete Form des Heimteams.
   *
   * Falls nur eine der beiden Serien
   * vorhanden ist, normalisiert
   * weightedAverage() die tatsächlich
   * vorhandenen Werte.
   */
  const homeAvg =
    weightedAverage([
      {
        value:
          homeLast10.length
            ? mean(
                homeLast10
              )
            : null,

        weight:
          0.6,
      },

      {
        value:
          homeLast20.length
            ? mean(
                homeLast20
              )
            : null,

        weight:
          0.4,
      },
    ]);

  /**
   * Gewichtete Form des Auswärtsteams.
   */
  const awayAvg =
    weightedAverage([
      {
        value:
          awayLast10.length
            ? mean(
                awayLast10
              )
            : null,

        weight:
          0.6,
      },

      {
        value:
          awayLast20.length
            ? mean(
                awayLast20
              )
            : null,

        weight:
          0.4,
      },
    ]);

  /**
   * Durch die vorherige Prüfung
   * müssen homeAvg und awayAvg
   * an dieser Stelle vorhanden sein.
   *
   * Die zusätzliche Prüfung macht
   * die Funktion trotzdem robust
   * gegenüber zukünftigen Änderungen
   * an weightedAverage().
   */
  if (
    homeAvg ===
      null ||
    awayAvg ===
      null
  ) {
    return {
      key:
        "form",

      label:
        "Team-Form",

      score:
        50,

      weight:
        0.1,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  /**
   * Erwartete Gesamtruns aus der
   * historischen Form beider Teams.
   *
   * Es gibt hier bewusst keinen
   * ?? 0 Fallback mehr.
   */
  const expectedRuns =
    homeAvg +
    awayAvg;

  const deviation =
    expectedRuns -
    2 *
      LEAGUE_AVG.runsPerGame;

  const score =
    clamp(
      50 +
        deviation *
          6,
      0,
      100
    );

  return {
    key:
      "form",

    label:
      "Team-Form",

    score,

    weight:
      0.1,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Modul 2: Starting Pitcher
// ---------------------------------------------------------------------------

/**
 * Berechnet die erwarteten,
 * vom Pitcher zugelassenen
 * Runs pro Start.
 */
export function pitcherExpectedRunsAllowed(
  p: PitcherInput
): number | null {
  const era =
    toNumber(
      p.era
    );

  const xera =
    toNumber(
      p.xera
    );

  const fip =
    toNumber(
      p.fip
    );

  const siera =
    toNumber(
      p.siera
    );

  const last5Values =
    toNumberArray(
      p.last5Starts
    );

  const last5Avg =
    last5Values.length
      ? mean(
          last5Values
        )
      : null;

  const base =
    weightedAverage([
      {
        value:
          era,

        weight:
          0.3,
      },

      {
        value:
          xera,

        weight:
          0.25,
      },

      {
        value:
          fip,

        weight:
          0.2,
      },

      {
        value:
          siera,

        weight:
          0.15,
      },

      {
        value:
          last5Avg,

        weight:
          0.1,
      },
    ]);

  if (
    base ===
    null
  ) {
    return null;
  }

  const whip =
    toNumber(
      p.whip
    );

  const kPct =
    toNumber(
      p.kPct
    );

  const bbPct =
    toNumber(
      p.bbPct
    );

  const hr9 =
    toNumber(
      p.hr9
    );

  const hardHit =
    toNumber(
      p.hardHitPct
    );

  const barrel =
    toNumber(
      p.barrelPct
    );

  const babip =
    toNumber(
      p.babip
    );

  const gbPct =
    toNumber(
      p.gbPct
    );

  const fbPct =
    toNumber(
      p.fbPct
    );

  const lobPct =
    toNumber(
      p.lobPct
    );

  const adjustments:
    number[] = [];

  if (
    whip !==
    null
  ) {
    adjustments.push(
      whip /
        LEAGUE_AVG.whip
    );
  }

  if (
    kPct !==
    null
  ) {
    adjustments.push(
      1 -
        (
          kPct -
          LEAGUE_AVG.kPct
        ) /
          100
    );
  }

  if (
    bbPct !==
    null
  ) {
    adjustments.push(
      1 +
        (
          bbPct -
          LEAGUE_AVG.bbPct
        ) /
          100
    );
  }

  if (
    hr9 !==
    null
  ) {
    adjustments.push(
      hr9 /
        LEAGUE_AVG.hr9
    );
  }

  if (
    hardHit !==
    null
  ) {
    adjustments.push(
      1 +
        (
          hardHit -
          35
        ) /
          150
    );
  }

  if (
    barrel !==
    null
  ) {
    adjustments.push(
      1 +
        (
          barrel -
          7
        ) /
          80
    );
  }

  if (
    babip !==
    null
  ) {
    adjustments.push(
      babip /
        0.3
    );
  }

  /**
   * Höhere Ground-Ball-Quote senkt
   * tendenziell Extra-Base-Hits und
   * Home Runs.
   */
  if (
    gbPct !==
    null
  ) {
    adjustments.push(
      1 -
        (
          gbPct -
          LEAGUE_AVG.gbPct
        ) /
          200
    );
  }

  /**
   * Höhere Fly-Ball-Quote erhöht
   * tendenziell das Home-Run-Risiko
   * (Ballpark-Effekt wird bereits
   * separat im Ballpark-Modul erfasst).
   */
  if (
    fbPct !==
    null
  ) {
    adjustments.push(
      1 +
        (
          fbPct -
          LEAGUE_AVG.fbPct
        ) /
          200
    );
  }

  /**
   * Höhere LOB% bedeutet, dass der
   * Pitcher überdurchschnittlich viele
   * Baserunner nicht punkten lässt.
   */
  if (
    lobPct !==
    null
  ) {
    adjustments.push(
      1 -
        (
          lobPct -
          LEAGUE_AVG.lobPct
        ) /
          150
    );
  }

  const multiplier =
    adjustments.length >
    0
      ? clamp(
          mean(
            adjustments
          ),
          0.7,
          1.35
        )
      : 1;

  /**
   * Erschöpfungs-Malus bei
   * kurzer Pause bzw. hoher
   * Pitch-Anzahl im letzten Start.
   */
  const restDays =
    toNumber(
      p.restDays
    );

  const pitchCount =
    toNumber(
      p.pitchCount
    );

  let fatigueMultiplier =
    1;

  if (
    restDays !==
      null &&
    restDays <
      4
  ) {
    fatigueMultiplier +=
      (
        4 -
        restDays
      ) *
      0.03;
  }

  if (
    pitchCount !==
      null &&
    pitchCount >
      95
  ) {
    fatigueMultiplier +=
      (
        (
          pitchCount -
          95
        ) /
        100
      ) *
      0.05;
  }

  return clamp(
    base *
      multiplier *
      fatigueMultiplier,
    1,
    11
  );
}

/**
 * Bewertet die Starting Pitcher.
 */
export function scorePitcher(
  home: PitcherInput,
  away: PitcherInput
): ModuleResult {
  const homeRuns =
    pitcherExpectedRunsAllowed(
      home
    );

  const awayRuns =
    pitcherExpectedRunsAllowed(
      away
    );

  const hasData =
    homeRuns !==
      null &&
    awayRuns !==
      null;

  if (
    !hasData
  ) {
    return {
      key:
        "pitcher",

      label:
        "Starting Pitcher",

      score:
        50,

      weight:
        0.35,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  /**
   * Heim-Pitcher lässt Runs für
   * das Auswärtsteam zu und
   * umgekehrt.
   */
  const expectedRuns =
    homeRuns +
    awayRuns;

  const deviation =
    expectedRuns -
    2 *
      LEAGUE_AVG.era;

  const score =
    clamp(
      50 +
        deviation *
          6,
      0,
      100
    );

  return {
    key:
      "pitcher",

    label:
      "Starting Pitcher",

    score,

    weight:
      0.35,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Starting Pitcher PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/**
 * Gewichtung der einzelnen Kennzahlen
 * im individuellen Pitcher Score.
 *
 * Summe = 1.0.
 */
const PITCHER_QUALITY_WEIGHTS = {
  era: 0.22,
  xera: 0.14,
  fip: 0.14,
  whip: 0.12,
  kPct: 0.12,
  bbPct: 0.1,
  hr9: 0.08,
  hardHitPct: 0.04,
  barrelPct: 0.04,
};

/** Schwelle, ab der eine Kennzahl als Stärke bzw. Schwäche gilt. */
const PITCHER_STRENGTH_THRESHOLD = 65;
const PITCHER_WEAKNESS_THRESHOLD = 35;

/** Schwelle für eine erhöhte Walk-Rate-Warnung (Vielfaches des Liga-Schnitts). */
const PITCHER_HIGH_BB_RATE_FACTOR = 1.3;

/** Ruhetage, unterhalb derer eine Erschöpfungswarnung ausgegeben wird. */
const PITCHER_LOW_REST_DAYS_THRESHOLD = 4;

/** Pitch Count, oberhalb dessen eine Erschöpfungswarnung ausgegeben wird. */
const PITCHER_HIGH_PITCH_COUNT_THRESHOLD = 100;

/**
 * Wandelt eine Kennzahl in einen
 * 0–100-Teilscore um.
 *
 * `higherIsBetter = false` (Standard):
 * niedrigere Werte als der
 * Liga-Schnitt ergeben einen höheren
 * Score (z. B. ERA, WHIP, BB%).
 *
 * `higherIsBetter = true`:
 * höhere Werte als der Liga-Schnitt
 * ergeben einen höheren Score
 * (z. B. K%).
 */
function pitcherMetricScore(
  value: number,
  leagueAverage: number,
  scale: number,
  higherIsBetter = false
): number {
  const deviation =
    value -
    leagueAverage;

  const signedDeviation =
    higherIsBetter
      ? deviation
      : -deviation;

  return clamp(
    50 +
      signedDeviation *
        scale,
    0,
    100
  );
}

/**
 * Bewertet einen einzelnen Starting
 * Pitcher unabhängig vom direkten
 * Matchup: individueller Score (0–100),
 * Notenskala, Confidence sowie
 * Stärken/Schwächen/Top-Kennzahlen/
 * Warnungen/positive & negative
 * Faktoren.
 *
 * `opponentOffense` ist optional und
 * fließt ausschließlich in den
 * Confidence-Score (Matchup-Faktor)
 * ein — der individuelle Pitcher
 * Score selbst bleibt unabhängig vom
 * Gegner.
 */
export function assessPitcherQuality(
  pitcher: PitcherInput,
  opponentOffense?: OffenseInput
): PitcherQualityAssessment {
  const era =
    toNumber(
      pitcher.era
    );

  const xera =
    toNumber(
      pitcher.xera
    );

  const fip =
    toNumber(
      pitcher.fip
    );

  const whip =
    toNumber(
      pitcher.whip
    );

  const kPct =
    toNumber(
      pitcher.kPct
    );

  const bbPct =
    toNumber(
      pitcher.bbPct
    );

  const hr9 =
    toNumber(
      pitcher.hr9
    );

  const hardHitPct =
    toNumber(
      pitcher.hardHitPct
    );

  const barrelPct =
    toNumber(
      pitcher.barrelPct
    );

  const restDays =
    toNumber(
      pitcher.restDays
    );

  const pitchCount =
    toNumber(
      pitcher.pitchCount
    );

  const metricEntries: {
    key: keyof typeof PITCHER_QUALITY_WEIGHTS;
    label: string;
    value: number | null;
    format: (v: number) => string;
    subScore: number | null;
  }[] = [
    {
      key: "era",
      label: "ERA",
      value: era,
      format:
        (v) =>
          v.toFixed(2),
      subScore:
        era !==
        null
          ? pitcherMetricScore(
              era,
              LEAGUE_AVG.era,
              18
            )
          : null,
    },
    {
      key: "xera",
      label: "xERA",
      value: xera,
      format:
        (v) =>
          v.toFixed(2),
      subScore:
        xera !==
        null
          ? pitcherMetricScore(
              xera,
              LEAGUE_AVG.era,
              16
            )
          : null,
    },
    {
      key: "fip",
      label: "FIP",
      value: fip,
      format:
        (v) =>
          v.toFixed(2),
      subScore:
        fip !==
        null
          ? pitcherMetricScore(
              fip,
              LEAGUE_AVG.fip,
              16
            )
          : null,
    },
    {
      key: "whip",
      label: "WHIP",
      value: whip,
      format:
        (v) =>
          v.toFixed(2),
      subScore:
        whip !==
        null
          ? pitcherMetricScore(
              whip,
              LEAGUE_AVG.whip,
              55
            )
          : null,
    },
    {
      key: "kPct",
      label: "K %",
      value: kPct,
      format:
        (v) =>
          `${v.toFixed(1)} %`,
      subScore:
        kPct !==
        null
          ? pitcherMetricScore(
              kPct,
              LEAGUE_AVG.kPct,
              2.2,
              true
            )
          : null,
    },
    {
      key: "bbPct",
      label: "BB %",
      value: bbPct,
      format:
        (v) =>
          `${v.toFixed(1)} %`,
      subScore:
        bbPct !==
        null
          ? pitcherMetricScore(
              bbPct,
              LEAGUE_AVG.bbPct,
              3.5
            )
          : null,
    },
    {
      key: "hr9",
      label: "HR/9",
      value: hr9,
      format:
        (v) =>
          v.toFixed(2),
      subScore:
        hr9 !==
        null
          ? pitcherMetricScore(
              hr9,
              LEAGUE_AVG.hr9,
              20
            )
          : null,
    },
    {
      key: "hardHitPct",
      label: "Hard-Hit %",
      value: hardHitPct,
      format:
        (v) =>
          `${v.toFixed(1)} %`,
      subScore:
        hardHitPct !==
        null
          ? pitcherMetricScore(
              hardHitPct,
              LEAGUE_AVG.hardHitPct,
              2.2
            )
          : null,
    },
    {
      key: "barrelPct",
      label: "Barrel %",
      value: barrelPct,
      format:
        (v) =>
          `${v.toFixed(1)} %`,
      subScore:
        barrelPct !==
        null
          ? pitcherMetricScore(
              barrelPct,
              LEAGUE_AVG.barrelPct,
              5
            )
          : null,
    },
  ];

  const presentMetrics =
    metricEntries.filter(
      (
        entry
      ) =>
        entry.subScore !==
        null
    );

  const hasData =
    presentMetrics.length >=
    3;

  if (
    !hasData
  ) {
    return {
      score: 50,
      grade:
        "Durchschnitt",
      confidence: 0,
      hasData: false,
      strengths: [],
      weaknesses: [],
      topMetrics: [],
      warnings: [
        "Unvollständige Datenbasis: mindestens 3 Advanced-Metrics werden für eine belastbare Pitcher-PRO-Bewertung benötigt.",
      ],
      positiveFactors: [],
      negativeFactors: [],
    };
  }

  const score =
    clamp(
      Math.round(
        weightedAverage(
          presentMetrics.map(
            (
              entry
            ) => ({
              value:
                entry.subScore,

              weight:
                PITCHER_QUALITY_WEIGHTS[
                  entry.key
                ],
            })
          )
        ) ??
          50
      ),
      0,
      100
    );

  const grade =
    calculatePitcherGrade(
      score
    );

  const strengths: PitcherMetricNote[] =
    presentMetrics
      .filter(
        (
          entry
        ) =>
          (
            entry.subScore ??
            0
          ) >=
          PITCHER_STRENGTH_THRESHOLD
      )
      .map(
        (
          entry
        ) => ({
          metric:
            entry.label,

          value:
            entry.format(
              entry.value as number
            ),

          note:
            "Deutlich besser als der Liga-Schnitt.",
        })
      );

  const weaknesses: PitcherMetricNote[] =
    presentMetrics
      .filter(
        (
          entry
        ) =>
          (
            entry.subScore ??
            100
          ) <=
          PITCHER_WEAKNESS_THRESHOLD
      )
      .map(
        (
          entry
        ) => ({
          metric:
            entry.label,

          value:
            entry.format(
              entry.value as number
            ),

          note:
            "Deutlich schwächer als der Liga-Schnitt.",
        })
      );

  const topMetrics =
    [...presentMetrics]
      .sort(
        (
          a,
          b
        ) =>
          (
            b.subScore ??
            0
          ) -
          (
            a.subScore ??
            0
          )
      )
      .slice(
        0,
        3
      )
      .map(
        (
          entry
        ) =>
          `${entry.label}: ${entry.format(
            entry.value as number
          )}`
      );

  // -------------------------------------------------------------------------
  // Confidence Score
  // -------------------------------------------------------------------------

  const dataCompletenessScore =
    (
      presentMetrics.length /
      metricEntries.length
    ) *
    100;

  const last5Values =
    toNumberArray(
      pitcher.last5Starts
    );

  const last10Values =
    toNumberArray(
      pitcher.last10Starts ??
        []
    );

  const consistencyValues =
    last10Values.length >
    0
      ? last10Values
      : last5Values;

  const consistencyScore =
    consistencyValues.length >=
    2
      ? clamp(
          100 -
            stdDev(
              consistencyValues
            ) *
              20,
          0,
          100
        )
      : 50;

  const restScore =
    restDays ===
    null
      ? 50
      : restDays >=
        PITCHER_LOW_REST_DAYS_THRESHOLD
      ? 100
      : restDays >=
        2
      ? 60
      : 20;

  const pitchCountScore =
    pitchCount ===
    null
      ? 50
      : pitchCount <=
        90
      ? 100
      : pitchCount <=
        PITCHER_HIGH_PITCH_COUNT_THRESHOLD
      ? 70
      : 40;

  const commandScore =
    kPct !==
      null &&
    bbPct !==
      null
      ? clamp(
          50 +
            (
              (
                kPct -
                bbPct
              ) -
              (
                LEAGUE_AVG.kPct -
                LEAGUE_AVG.bbPct
              )
            ) *
              2.5,
          0,
          100
        )
      : 50;

  const opponentKPct =
    opponentOffense
      ? toNumber(
          opponentOffense.kPct
        )
      : null;

  const opponentBbPct =
    opponentOffense
      ? toNumber(
          opponentOffense.bbPct
        )
      : null;

  const matchupScore =
    opponentKPct !==
      null ||
    opponentBbPct !==
      null
      ? clamp(
          50 +
            (
              (
                opponentKPct ??
                LEAGUE_AVG.kPct
              ) -
              LEAGUE_AVG.kPct
            ) *
              2 -
            (
              (
                opponentBbPct ??
                LEAGUE_AVG.bbPct
              ) -
              LEAGUE_AVG.bbPct
            ) *
              2,
          0,
          100
        )
      : null;

  const confidenceParts: {
    value:
      number |
      null;
    weight: number;
  }[] = [
    {
      value:
        dataCompletenessScore,
      weight: 0.3,
    },
    {
      value:
        consistencyScore,
      weight: 0.2,
    },
    {
      value:
        restScore,
      weight: 0.15,
    },
    {
      value:
        pitchCountScore,
      weight: 0.1,
    },
    {
      value:
        commandScore,
      weight: 0.15,
    },
    {
      value:
        matchupScore,
      weight: 0.1,
    },
  ];

  const confidence =
    clamp(
      Math.round(
        weightedAverage(
          confidenceParts
        ) ??
          50
      ),
      0,
      100
    );

  // -------------------------------------------------------------------------
  // Warnungen sowie positive/negative Faktoren
  // -------------------------------------------------------------------------

  const warnings: string[] =
    [];

  if (
    restDays !==
      null &&
    restDays <
      PITCHER_LOW_REST_DAYS_THRESHOLD
  ) {
    warnings.push(
      `Kurze Pause: nur ${restDays} Ruhetage seit dem letzten Start.`
    );
  }

  if (
    pitchCount !==
      null &&
    pitchCount >
      PITCHER_HIGH_PITCH_COUNT_THRESHOLD
  ) {
    warnings.push(
      `Hohe Pitch-Anzahl im letzten Start (${pitchCount}).`
    );
  }

  if (
    bbPct !==
      null &&
    bbPct >
      LEAGUE_AVG.bbPct *
        PITCHER_HIGH_BB_RATE_FACTOR
  ) {
    warnings.push(
      `Erhöhte Walk-Rate (${bbPct.toFixed(
        1
      )} %) deutet auf Kontrollprobleme hin.`
    );
  }

  if (
    presentMetrics.length <
    metricEntries.length /
      2
  ) {
    warnings.push(
      `Unvollständige Datenbasis: nur ${presentMetrics.length} von ${metricEntries.length} Advanced-Metrics vorhanden.`
    );
  }

  if (
    last5Values.length >=
    3 &&
    mean(
      last5Values
    ) >
      4
  ) {
    warnings.push(
      `Erhöhte Run-Zulassung in den letzten Starts (Ø ${mean(
        last5Values
      ).toFixed(
        1
      )} Runs).`
    );
  }

  const positiveFactors: string[] =
    [];

  const negativeFactors: string[] =
    [];

  if (
    restDays !==
    null
  ) {
    if (
      restDays >=
      PITCHER_LOW_REST_DAYS_THRESHOLD
    ) {
      positiveFactors.push(
        `Gute Erholung: ${restDays} Ruhetage seit dem letzten Start.`
      );
    } else {
      negativeFactors.push(
        `Verkürzte Erholung: nur ${restDays} Ruhetage seit dem letzten Start.`
      );
    }
  }

  if (
    commandScore >=
    PITCHER_STRENGTH_THRESHOLD
  ) {
    positiveFactors.push(
      "Starke Kontrolle: K%-BB%-Differenz liegt über dem Liga-Schnitt."
    );
  } else if (
    commandScore <=
    PITCHER_WEAKNESS_THRESHOLD
  ) {
    negativeFactors.push(
      "Schwache Kontrolle: K%-BB%-Differenz liegt unter dem Liga-Schnitt."
    );
  }

  if (
    consistencyValues.length >=
    2
  ) {
    if (
      consistencyScore >=
      PITCHER_STRENGTH_THRESHOLD
    ) {
      positiveFactors.push(
        "Konstante letzte Starts: geringe Streuung der zugelassenen Runs."
      );
    } else if (
      consistencyScore <=
      PITCHER_WEAKNESS_THRESHOLD
    ) {
      negativeFactors.push(
        "Unbeständige letzte Starts: hohe Streuung der zugelassenen Runs."
      );
    }
  }

  if (
    matchupScore !==
    null
  ) {
    if (
      matchupScore >=
      PITCHER_STRENGTH_THRESHOLD
    ) {
      positiveFactors.push(
        "Günstiger Matchup: Gegner-Offense mit erhöhter Strikeout- bzw. reduzierter Walk-Rate."
      );
    } else if (
      matchupScore <=
      PITCHER_WEAKNESS_THRESHOLD
    ) {
      negativeFactors.push(
        "Ungünstiger Matchup: geduldige, kontaktstarke Gegner-Offense (niedrige K%, hohe BB%)."
      );
    }
  }

  return {
    score,
    grade,
    confidence,
    hasData: true,
    strengths,
    weaknesses,
    topMetrics,
    warnings,
    positiveFactors,
    negativeFactors,
  };
}

/**
 * Leitet aus dem individuellen
 * Pitcher Score (0–100) die
 * entsprechende Notenskala ab.
 *
 * 90–100 = Elite
 * 80–89  = Sehr gut
 * 70–79  = Gut
 * 60–69  = Durchschnitt
 * 40–59  = Schwach
 * 0–39   = Sehr schwach
 */
function calculatePitcherGrade(
  score: number
): PitcherGrade {
  if (
    score >=
    90
  ) {
    return "Elite";
  }

  if (
    score >=
    80
  ) {
    return "Sehr gut";
  }

  if (
    score >=
    70
  ) {
    return "Gut";
  }

  if (
    score >=
    60
  ) {
    return "Durchschnitt";
  }

  if (
    score >=
    40
  ) {
    return "Schwach";
  }

  return "Sehr schwach";
}

// ---------------------------------------------------------------------------
// Modul 3: Bullpen
// ---------------------------------------------------------------------------

/**
 * Bullpen PRO: berechnet den erwarteten Runs-Beitrag eines Bullpens.
 *
 * Basis (Runs-Skala, ERA-äquivalent):
 *   gewichteter Mix aus ERA / FIP / xFIP.
 *
 * Qualitäts-Korrektur (kleine additive Anpassung in Runs-Einheiten):
 *   WHIP, K%, BB%, HR/9, LOB%, Hard-Hit % — jede vorhandene Kennzahl
 *   trägt proportional zu ihrer Abweichung vom Liga-Schnitt bei. Fehlt
 *   eine Kennzahl, wird sie einfach übersprungen (keine Erfindung von
 *   Werten, keine Verzerrung durch fehlende Felder).
 *
 * Ermüdungs-/Verfügbarkeits-Multiplikator:
 *   Belastung der letzten 3/7 Tage sowie die Verfügbarkeit von Closer,
 *   High-Leverage-Reliever und Middle Relief erhöhen den erwarteten
 *   Runs-Beitrag multiplikativ (ein ermüdeter/ausgedünnter Bullpen
 *   lässt im Schnitt mehr Runs zu).
 */
export function bullpenExpectedRuns(
  b: BullpenInput
): number | null {
  const era =
    toNumber(
      b.era
    );

  const fip =
    toNumber(
      b.fip
    );

  const xfip =
    toNumber(
      b.xfip
    );

  if (
    era ===
      null &&
    fip ===
      null &&
    xfip ===
      null
  ) {
    return null;
  }

  const base =
    weightedAverage([
      {
        value:
          era,

        weight:
          0.5,
      },

      {
        value:
          fip,

        weight:
          0.3,
      },

      {
        value:
          xfip,

        weight:
          0.2,
      },
    ]);

  if (
    base ===
    null
  ) {
    return null;
  }

  // -------------------------------------------------------------------
  // Qualitäts-Korrektur aus WHIP/K%/BB%/HR9/LOB%/Hard-Hit %
  // -------------------------------------------------------------------

  const whip =
    toNumber(
      b.whip
    );

  const kPct =
    toNumber(
      b.kPct
    );

  const bbPct =
    toNumber(
      b.bbPct
    );

  const hr9 =
    toNumber(
      b.hr9
    );

  const lobPct =
    toNumber(
      b.lobPct
    );

  const hardHitPct =
    toNumber(
      b.hardHitPct
    );

  let qualityAdjustment = 0;

  if (whip !== null) {
    qualityAdjustment += (whip - LEAGUE_AVG.bullpenWhip) * 0.9;
  }

  if (kPct !== null) {
    qualityAdjustment += -(kPct - LEAGUE_AVG.bullpenKPct) * 0.03;
  }

  if (bbPct !== null) {
    qualityAdjustment += (bbPct - LEAGUE_AVG.bullpenBbPct) * 0.045;
  }

  if (hr9 !== null) {
    qualityAdjustment += (hr9 - LEAGUE_AVG.bullpenHr9) * 0.3;
  }

  if (lobPct !== null) {
    qualityAdjustment += -(lobPct - LEAGUE_AVG.bullpenLobPct) * 0.02;
  }

  if (hardHitPct !== null) {
    qualityAdjustment += (hardHitPct - LEAGUE_AVG.bullpenHardHitPct) * 0.025;
  }

  const adjustedBase =
    clamp(
      base +
        qualityAdjustment,
      1,
      8
    );

  // -------------------------------------------------------------------
  // Ermüdungs-/Verfügbarkeits-Multiplikator
  // -------------------------------------------------------------------

  const ip3 =
    toNumber(
      b.inningsLast3Days
    );

  const ip7 =
    toNumber(
      b.inningsLast7Days
    );

  let fatigue =
    1;

  if (
    ip3 !==
    null
  ) {
    fatigue =
      1 +
      clamp(
        ip3 -
          6,
        0,
        12
      ) *
        0.025;
  }

  if (
    ip7 !==
    null
  ) {
    fatigue +=
      clamp(
        ip7 -
          14,
        0,
        20
      ) *
        0.01;
  }

  if (
    !b.closerAvailable
  ) {
    fatigue +=
      0.05;
  }

  if (
    !b.middleReliefAvailable
  ) {
    fatigue +=
      0.03;
  }

  if (
    !b.highLeverageAvailable
  ) {
    fatigue +=
      0.04;
  }

  /**
   * Bullpen deckt im Schnitt
   * ungefähr ein Drittel der
   * Spielinnings ab.
   */
  return clamp(
    adjustedBase *
      fatigue *
      (
        3 /
        9
      ),
    0.3,
    6
  );
}

/**
 * Bewertet beide Bullpens.
 */
export function scoreBullpen(
  home: BullpenInput,
  away: BullpenInput
): ModuleResult {
  const homeRuns =
    bullpenExpectedRuns(
      home
    );

  const awayRuns =
    bullpenExpectedRuns(
      away
    );

  const hasData =
    homeRuns !==
      null &&
    awayRuns !==
      null;

  if (
    !hasData
  ) {
    return {
      key:
        "bullpen",

      label:
        "Bullpen",

      score:
        50,

      weight:
        0.15,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  const expectedRuns =
    homeRuns +
    awayRuns;

  const baselineBullpenContribution =
    2 *
    LEAGUE_AVG.bullpenEra *
    (
      3 /
      9
    );

  const deviation =
    expectedRuns -
    baselineBullpenContribution;

  const score =
    clamp(
      50 +
        deviation *
          14,
      0,
      100
    );

  return {
    key:
      "bullpen",

    label:
      "Bullpen",

    score,

    weight:
      0.15,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Bullpen PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/**
 * Gewichtung der einzelnen Kennzahlen im individuellen Bullpen Score.
 * Summe = 1.0.
 */
const BULLPEN_QUALITY_WEIGHTS = {
  era: 0.2,
  fip: 0.14,
  xfip: 0.12,
  whip: 0.12,
  kPct: 0.12,
  bbPct: 0.09,
  hr9: 0.08,
  lobPct: 0.06,
  hardHitPct: 0.05,
  war: 0.02,
};

/** Schwelle, ab der eine Kennzahl als Stärke bzw. Schwäche gilt. */
const BULLPEN_STRENGTH_THRESHOLD = 65;
const BULLPEN_WEAKNESS_THRESHOLD = 35;

/** Schwelle für eine erhöhte Walk-Rate-Warnung (Vielfaches des Liga-Schnitts). */
const BULLPEN_HIGH_BB_RATE_FACTOR = 1.3;

/** Innings in den letzten 3 Tagen, oberhalb derer eine Ermüdungswarnung ausgegeben wird. */
export const BULLPEN_HIGH_WORKLOAD_IP3_THRESHOLD = 9;

/** Innings in den letzten 7 Tagen, oberhalb derer eine Ermüdungswarnung ausgegeben wird. */
export const BULLPEN_HIGH_WORKLOAD_IP7_THRESHOLD = 15;

/**
 * Leitet aus dem individuellen Bullpen Score (0–100) die entsprechende
 * Notenskala ab.
 *
 * 90–100 = Elite
 * 80–89  = Sehr gut
 * 70–79  = Gut
 * 60–69  = Durchschnitt
 * 40–59  = Schwach
 * 0–39   = Sehr schwach
 */
function calculateBullpenGrade(score: number): BullpenGrade {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Sehr gut";
  if (score >= 70) return "Gut";
  if (score >= 60) return "Durchschnitt";
  if (score >= 40) return "Schwach";
  return "Sehr schwach";
}

/**
 * Bewertet die Belastung eines Bullpens der letzten 3/7 Tage als
 * 0–100-Score (100 = frisch/ausgeruht, 0 = stark überlastet).
 * Fehlen beide Werte, wird ein neutraler Score (50) zurückgegeben.
 */
function bullpenWorkloadScore(ip3: number | null, ip7: number | null): number {
  const score3 = ip3 === null ? null : clamp(100 - clamp(ip3 - 5, 0, 10) * 8, 0, 100);
  const score7 = ip7 === null ? null : clamp(100 - clamp(ip7 - 10, 0, 15) * 6, 0, 100);

  return (
    weightedAverage([
      { value: score3, weight: 0.6 },
      { value: score7, weight: 0.4 },
    ]) ?? 50
  );
}

/**
 * Bewertet einen einzelnen Team-Bullpen unabhängig vom direkten Matchup:
 * individueller Score (0–100), Notenskala, Confidence sowie
 * Stärken/Schwächen/Top-Kennzahlen/Warnungen/positive & negative Faktoren.
 *
 * Fließen in den Score ein: ERA, FIP, xFIP, WHIP, K%, BB%, HR/9, LOB%,
 * Hard-Hit % sowie WAR (`BULLPEN_QUALITY_WEIGHTS`).
 *
 * Fließen zusätzlich in die Confidence ein: Datenvollständigkeit,
 * aktuelle Belastung (Innings letzte 3/7 Tage → "Bullpen Workload" /
 * "Fatigue"), Verfügbarkeit von Closer, High-Leverage-Reliever und
 * Middle Relief sowie die K%-BB%-Kontrolle.
 */
export function assessBullpenQuality(bullpen: BullpenInput): BullpenQualityAssessment {
  const era = toNumber(bullpen.era);
  const fip = toNumber(bullpen.fip);
  const xfip = toNumber(bullpen.xfip);
  const whip = toNumber(bullpen.whip);
  const kPct = toNumber(bullpen.kPct);
  const bbPct = toNumber(bullpen.bbPct);
  const hr9 = toNumber(bullpen.hr9);
  const lobPct = toNumber(bullpen.lobPct);
  const hardHitPct = toNumber(bullpen.hardHitPct);
  const war = toNumber(bullpen.war);

  const ip3 = toNumber(bullpen.inningsLast3Days);
  const ip7 = toNumber(bullpen.inningsLast7Days);

  const metricEntries: {
    key: keyof typeof BULLPEN_QUALITY_WEIGHTS;
    label: string;
    value: number | null;
    format: (v: number) => string;
    subScore: number | null;
  }[] = [
    {
      key: "era",
      label: "ERA",
      value: era,
      format: (v) => v.toFixed(2),
      subScore: era !== null ? pitcherMetricScore(era, LEAGUE_AVG.bullpenEra, 18) : null,
    },
    {
      key: "fip",
      label: "FIP",
      value: fip,
      format: (v) => v.toFixed(2),
      subScore: fip !== null ? pitcherMetricScore(fip, LEAGUE_AVG.bullpenFip, 16) : null,
    },
    {
      key: "xfip",
      label: "xFIP",
      value: xfip,
      format: (v) => v.toFixed(2),
      subScore: xfip !== null ? pitcherMetricScore(xfip, LEAGUE_AVG.bullpenXfip, 15) : null,
    },
    {
      key: "whip",
      label: "WHIP",
      value: whip,
      format: (v) => v.toFixed(2),
      subScore: whip !== null ? pitcherMetricScore(whip, LEAGUE_AVG.bullpenWhip, 50) : null,
    },
    {
      key: "kPct",
      label: "K %",
      value: kPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: kPct !== null ? pitcherMetricScore(kPct, LEAGUE_AVG.bullpenKPct, 2.2, true) : null,
    },
    {
      key: "bbPct",
      label: "BB %",
      value: bbPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: bbPct !== null ? pitcherMetricScore(bbPct, LEAGUE_AVG.bullpenBbPct, 3.2) : null,
    },
    {
      key: "hr9",
      label: "HR/9",
      value: hr9,
      format: (v) => v.toFixed(2),
      subScore: hr9 !== null ? pitcherMetricScore(hr9, LEAGUE_AVG.bullpenHr9, 18) : null,
    },
    {
      key: "lobPct",
      label: "LOB %",
      value: lobPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: lobPct !== null ? pitcherMetricScore(lobPct, LEAGUE_AVG.bullpenLobPct, 1.4, true) : null,
    },
    {
      key: "hardHitPct",
      label: "Hard-Hit %",
      value: hardHitPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: hardHitPct !== null ? pitcherMetricScore(hardHitPct, LEAGUE_AVG.bullpenHardHitPct, 2) : null,
    },
    {
      key: "war",
      label: "WAR",
      value: war,
      format: (v) => v.toFixed(1),
      subScore: war !== null ? pitcherMetricScore(war, LEAGUE_AVG.bullpenWar, 10, true) : null,
    },
  ];

  const presentMetrics = metricEntries.filter((entry) => entry.subScore !== null);

  const hasData = presentMetrics.length >= 3;

  if (!hasData) {
    return {
      score: 50,
      grade: "Durchschnitt",
      confidence: 0,
      hasData: false,
      strengths: [],
      weaknesses: [],
      topMetrics: [],
      warnings: ["Unvollständige Datenbasis: mindestens 3 Advanced-Metrics werden für eine belastbare Bullpen-PRO-Bewertung benötigt."],
      positiveFactors: [],
      negativeFactors: [],
    };
  }

  const score = clamp(
    Math.round(
      weightedAverage(
        presentMetrics.map((entry) => ({
          value: entry.subScore,
          weight: BULLPEN_QUALITY_WEIGHTS[entry.key],
        }))
      ) ?? 50
    ),
    0,
    100
  );

  const grade = calculateBullpenGrade(score);

  const strengths: BullpenMetricNote[] = presentMetrics
    .filter((entry) => (entry.subScore ?? 0) >= BULLPEN_STRENGTH_THRESHOLD)
    .map((entry) => ({
      metric: entry.label,
      value: entry.format(entry.value as number),
      note: "Deutlich besser als der Liga-Schnitt.",
    }));

  const weaknesses: BullpenMetricNote[] = presentMetrics
    .filter((entry) => (entry.subScore ?? 100) <= BULLPEN_WEAKNESS_THRESHOLD)
    .map((entry) => ({
      metric: entry.label,
      value: entry.format(entry.value as number),
      note: "Deutlich schwächer als der Liga-Schnitt.",
    }));

  const topMetrics = [...presentMetrics]
    .sort((a, b) => (b.subScore ?? 0) - (a.subScore ?? 0))
    .slice(0, 3)
    .map((entry) => `${entry.label}: ${entry.format(entry.value as number)}`);

  // -------------------------------------------------------------------------
  // Confidence Score
  // -------------------------------------------------------------------------

  const dataCompletenessScore = (presentMetrics.length / metricEntries.length) * 100;

  const workloadScore = bullpenWorkloadScore(ip3, ip7);

  const closerScore = bullpen.closerAvailable ? 100 : 20;
  const highLeverageScore = bullpen.highLeverageAvailable ? 100 : 30;
  const middleReliefScore = bullpen.middleReliefAvailable ? 100 : 40;

  const commandScore =
    kPct !== null && bbPct !== null
      ? clamp(50 + (kPct - bbPct - (LEAGUE_AVG.bullpenKPct - LEAGUE_AVG.bullpenBbPct)) * 2.5, 0, 100)
      : 50;

  const availabilityScore =
    weightedAverage([
      { value: closerScore, weight: 0.5 },
      { value: highLeverageScore, weight: 0.3 },
      { value: middleReliefScore, weight: 0.2 },
    ]) ?? 50;

  const confidenceParts: { value: number | null; weight: number }[] = [
    { value: dataCompletenessScore, weight: 0.25 },
    { value: workloadScore, weight: 0.2 },
    { value: availabilityScore, weight: 0.35 },
    { value: commandScore, weight: 0.2 },
  ];

  const confidence = clamp(Math.round(weightedAverage(confidenceParts) ?? 50), 0, 100);

  // -------------------------------------------------------------------------
  // Warnungen sowie positive/negative Faktoren
  // -------------------------------------------------------------------------

  const warnings: string[] = [];

  if (ip3 !== null && ip3 > BULLPEN_HIGH_WORKLOAD_IP3_THRESHOLD) {
    warnings.push(`Hohe Bullpen-Belastung: ${ip3.toFixed(1)} IP in den letzten 3 Tagen.`);
  }

  if (ip7 !== null && ip7 > BULLPEN_HIGH_WORKLOAD_IP7_THRESHOLD) {
    warnings.push(`Erhöhte Wochenbelastung: ${ip7.toFixed(1)} IP in den letzten 7 Tagen.`);
  }

  if (!bullpen.closerAvailable) {
    warnings.push("Closer nicht verfügbar.");
  }

  if (!bullpen.highLeverageAvailable) {
    warnings.push("Kein ausgeruhter High-Leverage-Reliever verfügbar.");
  }

  if (!bullpen.middleReliefAvailable) {
    warnings.push("Middle Relief nicht verfügbar.");
  }

  if (bbPct !== null && bbPct > LEAGUE_AVG.bullpenBbPct * BULLPEN_HIGH_BB_RATE_FACTOR) {
    warnings.push(`Erhöhte Walk-Rate (${bbPct.toFixed(1)} %) deutet auf Kontrollprobleme im Bullpen hin.`);
  }

  if (presentMetrics.length < metricEntries.length / 2) {
    warnings.push(`Unvollständige Datenbasis: nur ${presentMetrics.length} von ${metricEntries.length} Advanced-Metrics vorhanden.`);
  }

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (ip3 !== null || ip7 !== null) {
    if (workloadScore >= BULLPEN_STRENGTH_THRESHOLD) {
      positiveFactors.push("Frischer Bullpen: geringe Belastung in den letzten 3/7 Tagen.");
    } else if (workloadScore <= BULLPEN_WEAKNESS_THRESHOLD) {
      negativeFactors.push("Ermüdeter Bullpen: hohe Belastung in den letzten 3/7 Tagen.");
    }
  }

  if (bullpen.closerAvailable) {
    positiveFactors.push("Closer verfügbar für den 9. Inning.");
  } else {
    negativeFactors.push("Kein Closer verfügbar — erhöhtes Risiko in Save-Situationen.");
  }

  if (bullpen.highLeverageAvailable) {
    positiveFactors.push("Ausgeruhter High-Leverage-Reliever einsatzbereit.");
  } else {
    negativeFactors.push("Kein ausgeruhter High-Leverage-Reliever einsatzbereit.");
  }

  if (!bullpen.middleReliefAvailable) {
    negativeFactors.push("Middle Relief geschwächt — erhöhtes Risiko bei frühem Pitcher-Ausfall.");
  }

  if (commandScore >= BULLPEN_STRENGTH_THRESHOLD) {
    positiveFactors.push("Starke Bullpen-Kontrolle: K%-BB%-Differenz liegt über dem Liga-Schnitt.");
  } else if (commandScore <= BULLPEN_WEAKNESS_THRESHOLD) {
    negativeFactors.push("Schwache Bullpen-Kontrolle: K%-BB%-Differenz liegt unter dem Liga-Schnitt.");
  }

  return {
    score,
    grade,
    confidence,
    hasData: true,
    strengths,
    weaknesses,
    topMetrics,
    warnings,
    positiveFactors,
    negativeFactors,
  };
}

/**
 * Bullpen PRO → Prediction Engine: passt die Gewichtung des
 * Bullpen-Moduls im Gesamtmodell dynamisch an die Confidence der
 * individuellen Bullpen-PRO-Bewertung beider Teams an.
 *
 * Idee: ein Bullpen-Signal, das auf einer breiten, konsistenten
 * Datenbasis beruht (viele vorhandene Advanced-Metrics, aktuelle
 * Workload-Daten, bekannte Verfügbarkeit von Closer/High-Leverage/
 * Middle Relief), verdient mehr Vertrauen im Konsens-Modell als ein
 * Bullpen-Signal, das nur auf ERA/FIP beruht. Die durchschnittliche
 * Confidence beider Bullpens (0–100) wird linear auf einen
 * Zuverlässigkeitsfaktor zwischen 0.75 (niedrige Confidence) und 1.25
 * (hohe Confidence) abgebildet und mit dem Basis-Gewicht des
 * Bullpen-Moduls multipliziert.
 *
 * Der Score selbst (`ModuleResult.score`, aus den erwarteten Runs
 * abgeleitet) bleibt unverändert — nur das Vertrauen, mit dem dieser
 * Score in den Gesamtkonsens eingeht, wird angepasst. Das verhindert
 * eine doppelte Verrechnung derselben Rohdaten (einmal im Score, kein
 * zweites Mal als Score-Verschiebung).
 */
export function applyBullpenQualityWeighting(
  moduleResult: ModuleResult,
  homeQuality: BullpenQualityAssessment,
  awayQuality: BullpenQualityAssessment
): ModuleResult {
  if (!moduleResult.hasData) {
    return moduleResult;
  }

  const confidences = [homeQuality, awayQuality].filter((q) => q.hasData).map((q) => q.confidence);

  if (confidences.length === 0) {
    return moduleResult;
  }

  const avgConfidence = mean(confidences);
  const reliabilityFactor = clamp(0.75 + (avgConfidence / 100) * 0.5, 0.75, 1.25);

  return {
    ...moduleResult,
    weight: clamp(moduleResult.weight * reliabilityFactor, 0, 1),
  };
}

// ---------------------------------------------------------------------------
// Modul 4: Offense
// ---------------------------------------------------------------------------

export function offenseExpectedRuns(
  o: OffenseInput
): number | null {
  const rpg =
    toNumber(
      o.runsPerGame
    );

  const formValues =
    toNumberArray(
      o.last10Games
    );

  const formAvg =
    formValues.length
      ? mean(
          formValues
        )
      : null;

  const coreBase =
    weightedAverage([
      {
        value:
          rpg,

        weight:
          0.5,
      },

      {
        value:
          formAvg,

        weight:
          0.5,
      },
    ]);

  if (
    coreBase ===
    null
  ) {
    return null;
  }

  /**
   * Offense PRO: "Last 7 / Last 15 / Last 30 Games" verfeinern die
   * Form-Basis zusätzlich, sofern vorhanden. Fehlen sie (wie bei allen
   * bisherigen Datensätzen), bleibt `base` exakt gleich `coreBase` —
   * keine Verhaltensänderung für bestehende Daten.
   */
  const last7 =
    toNumber(
      o.last7AvgRuns
    );

  const last15 =
    toNumber(
      o.last15AvgRuns
    );

  const last30 =
    toNumber(
      o.last30AvgRuns
    );

  const recentFormRefinement =
    weightedAverage([
      {
        value:
          last7,

        weight:
          0.5,
      },

      {
        value:
          last15,

        weight:
          0.3,
      },

      {
        value:
          last30,

        weight:
          0.2,
      },
    ]);

  const base =
    recentFormRefinement ===
    null
      ? coreBase
      : (
          weightedAverage([
            {
              value:
                coreBase,

              weight:
                0.7,
            },

            {
              value:
                recentFormRefinement,

              weight:
                0.3,
            },
          ]) ??
          coreBase
        );

  const ops =
    toNumber(
      o.ops
    );

  const wrc =
    toNumber(
      o.wrcPlus
    );

  const woba =
    toNumber(
      o.woba
    );

  const iso =
    toNumber(
      o.iso
    );

  const hardHit =
    toNumber(
      o.hardHitPct
    );

  const barrel =
    toNumber(
      o.barrelPct
    );

  const risp =
    toNumber(
      o.rispAvg
    );

  const xwoba =
    toNumber(
      o.xwoba
    );

  const exitVelocity =
    toNumber(
      o.exitVelocity
    );

  const launchAngle =
    toNumber(
      o.launchAngle
    );

  const contactPct =
    toNumber(
      o.contactPct
    );

  const chasePct =
    toNumber(
      o.chasePct
    );

  const kPct =
    toNumber(
      o.kPct
    );

  const bbPct =
    toNumber(
      o.bbPct
    );

  const qualityFactors:
    number[] = [];

  if (
    ops !==
    null
  ) {
    qualityFactors.push(
      ops /
        LEAGUE_AVG.ops
    );
  }

  if (
    wrc !==
    null
  ) {
    qualityFactors.push(
      wrc /
        LEAGUE_AVG.wrcPlus
    );
  }

  if (
    woba !==
    null
  ) {
    qualityFactors.push(
      woba /
        LEAGUE_AVG.woba
    );
  }

  if (
    xwoba !==
    null
  ) {
    qualityFactors.push(
      xwoba /
        LEAGUE_AVG.xwoba
    );
  }

  if (
    iso !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          iso -
          0.16
        ) /
          0.5
    );
  }

  if (
    hardHit !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          hardHit -
          35
        ) /
          150
    );
  }

  if (
    barrel !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          barrel -
          7
        ) /
          80
    );
  }

  if (
    risp !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          risp -
          0.25
        ) /
          0.6
    );
  }

  if (
    exitVelocity !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          exitVelocity -
          LEAGUE_AVG.exitVelocityMph
        ) /
          60
    );
  }

  if (
    launchAngle !==
    null
  ) {
    /**
     * Sweet Spot liegt bei ca. 8-32 Grad; die Abweichung vom Optimum
     * (~16 Grad) wirkt sich in beide Richtungen leicht dämpfend aus.
     */
    qualityFactors.push(
      1 -
        clamp(
          Math.abs(
            launchAngle -
              16
          ),
          0,
          25
        ) /
          250
    );
  }

  if (
    contactPct !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          contactPct -
          LEAGUE_AVG.contactPct
        ) /
          300
    );
  }

  if (
    chasePct !==
    null
  ) {
    qualityFactors.push(
      1 -
        (
          chasePct -
          LEAGUE_AVG.chasePct
        ) /
          200
    );
  }

  if (
    kPct !==
    null
  ) {
    qualityFactors.push(
      1 -
        (
          kPct -
          LEAGUE_AVG.kPct
        ) /
          150
    );
  }

  if (
    bbPct !==
    null
  ) {
    qualityFactors.push(
      1 +
        (
          bbPct -
          LEAGUE_AVG.bbPct
        ) /
          150
    );
  }

  const qualityMultiplier =
    qualityFactors.length >
    0
      ? clamp(
          mean(
            qualityFactors
          ),
          0.7,
          1.35
        )
      : 1;

  return clamp(
    base *
      qualityMultiplier,
    0,
    14
  );
}

/**
 * Bewertet die Offense beider Teams.
 */
export function scoreOffense(
  home: OffenseInput,
  away: OffenseInput
): ModuleResult {
  const homeRuns =
    offenseExpectedRuns(
      home
    );

  const awayRuns =
    offenseExpectedRuns(
      away
    );

  const hasData =
    homeRuns !==
      null &&
    awayRuns !==
      null;

  if (
    !hasData
  ) {
    return {
      key:
        "offense",

      label:
        "Offense",

      score:
        50,

      weight:
        0.15,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  const expectedRuns =
    homeRuns +
    awayRuns;

  const deviation =
    expectedRuns -
    2 *
      LEAGUE_AVG.runsPerGame;

  const score =
    clamp(
      50 +
        deviation *
          6,
      0,
      100
    );

  return {
    key:
      "offense",

    label:
      "Offense",

    score,

    weight:
      0.15,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Offense PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/**
 * Gewichtung der einzelnen Kennzahlen im individuellen Offense Score.
 * Summe = 1.0.
 */
const OFFENSE_QUALITY_WEIGHTS = {
  ops: 0.14,
  wrcPlus: 0.12,
  woba: 0.1,
  xwoba: 0.1,
  iso: 0.08,
  babip: 0.03,
  hardHitPct: 0.07,
  barrelPct: 0.07,
  exitVelocity: 0.06,
  kPct: 0.06,
  bbPct: 0.05,
  contactPct: 0.04,
  chasePct: 0.03,
  rispAvg: 0.05,
};

/** Schwelle, ab der eine Kennzahl als Stärke bzw. Schwäche gilt. */
const OFFENSE_STRENGTH_THRESHOLD = 65;
const OFFENSE_WEAKNESS_THRESHOLD = 35;

/** Schwelle für eine Warnung bei erhöhter Strikeout-Rate (Vielfaches des Liga-Schnitts). */
const OFFENSE_HIGH_K_RATE_FACTOR = 1.25;

/** Schwelle für eine Warnung bei erhöhter Chase-Rate (Vielfaches des Liga-Schnitts). */
const OFFENSE_HIGH_CHASE_RATE_FACTOR = 1.2;

/**
 * Leitet aus dem individuellen Offense Score (0–100) die entsprechende
 * Notenskala ab.
 *
 * 90–100 = Elite
 * 80–89  = Sehr gut
 * 70–79  = Gut
 * 60–69  = Durchschnitt
 * 40–59  = Schwach
 * 0–39   = Sehr schwach
 */
function calculateOffenseGrade(score: number): OffenseGrade {
  if (score >= 90) return "Elite";
  if (score >= 80) return "Sehr gut";
  if (score >= 70) return "Gut";
  if (score >= 60) return "Durchschnitt";
  if (score >= 40) return "Schwach";
  return "Sehr schwach";
}

/**
 * Ermittelt den "Recent Trend" einer Offense aus der Runs-Sequenz der
 * letzten Spiele: vergleicht die zweite Hälfte der Sequenz mit der
 * ersten Hälfte. Gibt `null` zurück, wenn zu wenige Datenpunkte
 * vorliegen, um einen Trend belastbar zu bestimmen.
 */
function offenseRecentTrend(games: string[]): "steigend" | "fallend" | "stabil" | null {
  const values = toNumberArray(games);
  if (values.length < 4) return null;

  const mid = Math.floor(values.length / 2);
  const firstHalf = mean(values.slice(0, mid));
  const secondHalf = mean(values.slice(mid));
  const delta = secondHalf - firstHalf;

  if (delta > 0.6) return "steigend";
  if (delta < -0.6) return "fallend";
  return "stabil";
}

/**
 * Bewertet eine einzelne Team-Offense unabhängig vom direkten Matchup:
 * individueller Score (0–100), Notenskala, Confidence sowie
 * Stärken/Schwächen/Top-Kennzahlen/Warnungen/positive & negative
 * Faktoren.
 *
 * Fließen in den Score ein: OPS, wRC+, wOBA, xwOBA, ISO, BABIP,
 * Hard-Hit %, Barrel %, Exit Velocity, K %, BB %, Contact %, Chase %
 * sowie RISP AVG (`OFFENSE_QUALITY_WEIGHTS`).
 *
 * Fließen zusätzlich in die Confidence ein: Datenvollständigkeit,
 * Konsistenz der jüngsten Form ("Last 7/15/30 Games", Recent Trend),
 * Abdeckung der Splits (Heim/Auswärts, vs LHP/RHP) sowie die
 * K%-BB%-Kontrolle (Plate Discipline).
 */
export function assessOffenseQuality(offense: OffenseInput): OffenseQualityAssessment {
  const ops = toNumber(offense.ops);
  const wrcPlus = toNumber(offense.wrcPlus);
  const woba = toNumber(offense.woba);
  const xwoba = toNumber(offense.xwoba);
  const iso = toNumber(offense.iso);
  const babip = toNumber(offense.babip);
  const hardHitPct = toNumber(offense.hardHitPct);
  const barrelPct = toNumber(offense.barrelPct);
  const exitVelocity = toNumber(offense.exitVelocity);
  const kPct = toNumber(offense.kPct);
  const bbPct = toNumber(offense.bbPct);
  const contactPct = toNumber(offense.contactPct);
  const chasePct = toNumber(offense.chasePct);
  const rispAvg = toNumber(offense.rispAvg);
  const avg = toNumber(offense.avg);

  const homeSplitRuns = toNumber(offense.homeSplitRuns);
  const awaySplitRuns = toNumber(offense.awaySplitRuns);
  const vsLhpOps = toNumber(offense.vsLhpOps);
  const vsRhpOps = toNumber(offense.vsRhpOps);
  const last7 = toNumber(offense.last7AvgRuns);
  const last15 = toNumber(offense.last15AvgRuns);
  const last30 = toNumber(offense.last30AvgRuns);

  const metricEntries: {
    key: keyof typeof OFFENSE_QUALITY_WEIGHTS;
    label: string;
    value: number | null;
    format: (v: number) => string;
    subScore: number | null;
  }[] = [
    {
      key: "ops",
      label: "OPS",
      value: ops,
      format: (v) => v.toFixed(3),
      subScore: ops !== null ? pitcherMetricScore(ops, LEAGUE_AVG.ops, 0.14, true) : null,
    },
    {
      key: "wrcPlus",
      label: "wRC+",
      value: wrcPlus,
      format: (v) => v.toFixed(0),
      subScore: wrcPlus !== null ? pitcherMetricScore(wrcPlus, LEAGUE_AVG.wrcPlus, 22, true) : null,
    },
    {
      key: "woba",
      label: "wOBA",
      value: woba,
      format: (v) => v.toFixed(3),
      subScore: woba !== null ? pitcherMetricScore(woba, LEAGUE_AVG.woba, 0.06, true) : null,
    },
    {
      key: "xwoba",
      label: "xwOBA",
      value: xwoba,
      format: (v) => v.toFixed(3),
      subScore: xwoba !== null ? pitcherMetricScore(xwoba, LEAGUE_AVG.xwoba, 0.06, true) : null,
    },
    {
      key: "iso",
      label: "ISO",
      value: iso,
      format: (v) => v.toFixed(3),
      subScore: iso !== null ? pitcherMetricScore(iso, 0.16, 0.09, true) : null,
    },
    {
      key: "babip",
      label: "BABIP",
      value: babip,
      format: (v) => v.toFixed(3),
      subScore: babip !== null ? pitcherMetricScore(babip, LEAGUE_AVG.babip, 0.05, true) : null,
    },
    {
      key: "hardHitPct",
      label: "Hard-Hit %",
      value: hardHitPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: hardHitPct !== null ? pitcherMetricScore(hardHitPct, LEAGUE_AVG.hardHitPct, 15, true) : null,
    },
    {
      key: "barrelPct",
      label: "Barrel %",
      value: barrelPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: barrelPct !== null ? pitcherMetricScore(barrelPct, LEAGUE_AVG.barrelPct, 5, true) : null,
    },
    {
      key: "exitVelocity",
      label: "Exit Velocity",
      value: exitVelocity,
      format: (v) => `${v.toFixed(1)} mph`,
      subScore: exitVelocity !== null ? pitcherMetricScore(exitVelocity, LEAGUE_AVG.exitVelocityMph, 4, true) : null,
    },
    {
      key: "kPct",
      label: "K %",
      value: kPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: kPct !== null ? pitcherMetricScore(kPct, LEAGUE_AVG.kPct, 6) : null,
    },
    {
      key: "bbPct",
      label: "BB %",
      value: bbPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: bbPct !== null ? pitcherMetricScore(bbPct, LEAGUE_AVG.bbPct, 4, true) : null,
    },
    {
      key: "contactPct",
      label: "Contact %",
      value: contactPct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: contactPct !== null ? pitcherMetricScore(contactPct, LEAGUE_AVG.contactPct, 8, true) : null,
    },
    {
      key: "chasePct",
      label: "Chase %",
      value: chasePct,
      format: (v) => `${v.toFixed(1)} %`,
      subScore: chasePct !== null ? pitcherMetricScore(chasePct, LEAGUE_AVG.chasePct, 6) : null,
    },
    {
      key: "rispAvg",
      label: "RISP AVG",
      value: rispAvg,
      format: (v) => v.toFixed(3),
      subScore: rispAvg !== null ? pitcherMetricScore(rispAvg, 0.25, 0.06, true) : null,
    },
  ];

  const presentMetrics = metricEntries.filter((entry) => entry.subScore !== null);

  const hasData = presentMetrics.length >= 4;

  if (!hasData) {
    return {
      score: 50,
      grade: "Durchschnitt",
      confidence: 0,
      hasData: false,
      strengths: [],
      weaknesses: [],
      topMetrics: [],
      warnings: ["Unvollständige Datenbasis: mindestens 4 Advanced-Metrics werden für eine belastbare Offense-PRO-Bewertung benötigt."],
      positiveFactors: [],
      negativeFactors: [],
    };
  }

  const score = clamp(
    Math.round(
      weightedAverage(
        presentMetrics.map((entry) => ({
          value: entry.subScore,
          weight: OFFENSE_QUALITY_WEIGHTS[entry.key],
        }))
      ) ?? 50
    ),
    0,
    100
  );

  const grade = calculateOffenseGrade(score);

  const strengths: OffenseMetricNote[] = presentMetrics
    .filter((entry) => (entry.subScore ?? 0) >= OFFENSE_STRENGTH_THRESHOLD)
    .map((entry) => ({
      metric: entry.label,
      value: entry.format(entry.value as number),
      note: "Deutlich besser als der Liga-Schnitt.",
    }));

  const weaknesses: OffenseMetricNote[] = presentMetrics
    .filter((entry) => (entry.subScore ?? 100) <= OFFENSE_WEAKNESS_THRESHOLD)
    .map((entry) => ({
      metric: entry.label,
      value: entry.format(entry.value as number),
      note: "Deutlich schwächer als der Liga-Schnitt.",
    }));

  const topMetrics = [...presentMetrics]
    .sort((a, b) => (b.subScore ?? 0) - (a.subScore ?? 0))
    .slice(0, 3)
    .map((entry) => `${entry.label}: ${entry.format(entry.value as number)}`);

  // -------------------------------------------------------------------------
  // Confidence Score
  // -------------------------------------------------------------------------

  const dataCompletenessScore = (presentMetrics.length / metricEntries.length) * 100;

  const recentFormValues = toNumberArray(offense.last10Games);
  const formConsistencyScore =
    recentFormValues.length >= 4
      ? clamp(100 - (stdDev(recentFormValues) / Math.max(mean(recentFormValues), 1)) * 60, 0, 100)
      : 50;

  const splitFieldsPresent = [homeSplitRuns, awaySplitRuns, vsLhpOps, vsRhpOps, last7, last15, last30].filter(
    (v) => v !== null
  ).length;

  const splitCoverageScore = (splitFieldsPresent / 7) * 100;

  const disciplineScore =
    kPct !== null && bbPct !== null
      ? clamp(50 + (bbPct - kPct - (LEAGUE_AVG.bbPct - LEAGUE_AVG.kPct)) * 2.5, 0, 100)
      : 50;

  const confidenceParts: { value: number | null; weight: number }[] = [
    { value: dataCompletenessScore, weight: 0.3 },
    { value: formConsistencyScore, weight: 0.25 },
    { value: splitCoverageScore, weight: 0.25 },
    { value: disciplineScore, weight: 0.2 },
  ];

  const confidence = clamp(Math.round(weightedAverage(confidenceParts) ?? 50), 0, 100);

  // -------------------------------------------------------------------------
  // Warnungen sowie positive/negative Faktoren
  // -------------------------------------------------------------------------

  const warnings: string[] = [];

  if (kPct !== null && kPct > LEAGUE_AVG.kPct * OFFENSE_HIGH_K_RATE_FACTOR) {
    warnings.push(`Erhöhte Strikeout-Rate (${kPct.toFixed(1)} %) deutet auf Kontaktprobleme hin.`);
  }

  if (chasePct !== null && chasePct > LEAGUE_AVG.chasePct * OFFENSE_HIGH_CHASE_RATE_FACTOR) {
    warnings.push(`Erhöhte Chase-Rate (${chasePct.toFixed(1)} %) deutet auf schwache Zone-Disziplin hin.`);
  }

  const trend = offenseRecentTrend(offense.last10Games);

  if (trend === "fallend") {
    warnings.push("Abwärtstrend in der jüngsten Offensiv-Form (letzte 10 Spiele).");
  }

  if (splitFieldsPresent < 3) {
    warnings.push("Wenige Split-Daten vorhanden (Heim/Auswärts, vs LHP/RHP, Last 7/15/30) — Bewertung stützt sich primär auf Saisonwerte.");
  }

  if (presentMetrics.length < metricEntries.length / 2) {
    warnings.push(`Unvollständige Datenbasis: nur ${presentMetrics.length} von ${metricEntries.length} Advanced-Metrics vorhanden.`);
  }

  const positiveFactors: string[] = [];
  const negativeFactors: string[] = [];

  if (trend === "steigend") {
    positiveFactors.push("Aufwärtstrend: Offense ist in den letzten Spielen deutlich produktiver als zu Beginn der Sequenz.");
  } else if (trend === "fallend") {
    negativeFactors.push("Abwärtstrend: Offense ist in den letzten Spielen deutlich weniger produktiv als zu Beginn der Sequenz.");
  }

  if (rispAvg !== null && avg !== null) {
    const clutchDelta = rispAvg - avg;
    if (clutchDelta >= 0.02) {
      positiveFactors.push(`Starke Clutch-Performance: RISP AVG (${rispAvg.toFixed(3)}) liegt deutlich über der Saison-AVG (${avg.toFixed(3)}).`);
    } else if (clutchDelta <= -0.02) {
      negativeFactors.push(`Schwache Clutch-Performance: RISP AVG (${rispAvg.toFixed(3)}) liegt deutlich unter der Saison-AVG (${avg.toFixed(3)}).`);
    }
  }

  if (vsLhpOps !== null && vsRhpOps !== null) {
    const platoonDelta = Math.abs(vsLhpOps - vsRhpOps);
    if (platoonDelta >= 0.08) {
      const weakerSide = vsLhpOps < vsRhpOps ? "Linkshänder" : "Rechtshänder";
      negativeFactors.push(`Deutlicher Platoon-Split: schwächer gegen ${weakerSide} (Differenz ${platoonDelta.toFixed(3)} OPS).`);
    } else {
      positiveFactors.push("Ausgeglichene Platoon-Splits gegen Links- und Rechtshänder.");
    }
  }

  if (disciplineScore >= OFFENSE_STRENGTH_THRESHOLD) {
    positiveFactors.push("Starke Plate Discipline: BB%-K%-Differenz liegt über dem Liga-Schnitt.");
  } else if (disciplineScore <= OFFENSE_WEAKNESS_THRESHOLD) {
    negativeFactors.push("Schwache Plate Discipline: BB%-K%-Differenz liegt unter dem Liga-Schnitt.");
  }

  if (barrelPct !== null && barrelPct >= LEAGUE_AVG.barrelPct * 1.3) {
    positiveFactors.push("Überdurchschnittliche Power-Produktion (Barrel %).");
  }

  if (hardHitPct !== null && hardHitPct <= LEAGUE_AVG.hardHitPct * 0.85) {
    negativeFactors.push("Unterdurchschnittliche Batted-Ball-Qualität (Hard-Hit %).");
  }

  return {
    score,
    grade,
    confidence,
    hasData: true,
    strengths,
    weaknesses,
    topMetrics,
    warnings,
    positiveFactors,
    negativeFactors,
  };
}

/**
 * Offense PRO → Prediction Engine: passt die Gewichtung des
 * Offense-Moduls im Gesamtmodell dynamisch an die Confidence der
 * individuellen Offense-PRO-Bewertung beider Teams an. Analoges Prinzip
 * zu `applyBullpenQualityWeighting()`: die durchschnittliche Confidence
 * beider Offense-Bewertungen (0–100) wird linear auf einen
 * Zuverlässigkeitsfaktor zwischen 0.75 (niedrige Confidence) und 1.25
 * (hohe Confidence) abgebildet und mit dem Basis-Gewicht des
 * Offense-Moduls multipliziert. Der Score selbst bleibt unverändert —
 * es wird nur das Vertrauen justiert, mit dem er in den Gesamtkonsens
 * eingeht.
 */
export function applyOffenseQualityWeighting(
  moduleResult: ModuleResult,
  homeQuality: OffenseQualityAssessment,
  awayQuality: OffenseQualityAssessment
): ModuleResult {
  if (!moduleResult.hasData) {
    return moduleResult;
  }

  const confidences = [homeQuality, awayQuality].filter((q) => q.hasData).map((q) => q.confidence);

  if (confidences.length === 0) {
    return moduleResult;
  }

  const avgConfidence = mean(confidences);
  const reliabilityFactor = clamp(0.75 + (avgConfidence / 100) * 0.5, 0.75, 1.25);

  return {
    ...moduleResult,
    weight: clamp(moduleResult.weight * reliabilityFactor, 0, 1),
  };
}

// ---------------------------------------------------------------------------
// Modul 5: Wetter
// ---------------------------------------------------------------------------

/**
 * Bewertet den Einfluss des Wetters
 * auf die aktuelle Baseline.
 */
export function scoreWeather(
  w: WeatherInput,
  baselineRuns: number | null
): ModuleResult {
  const temp =
    toNumber(
      w.temperatureC
    );

  const windSpeed =
    toNumber(
      w.windSpeedMph
    );

  const humidity =
    toNumber(
      w.humidityPct
    );

  const pressure =
    toNumber(
      w.pressureHpa
    );

  const hasData =
    temp !==
      null ||
    windSpeed !==
      null ||
    humidity !==
      null ||
    pressure !==
      null;

  if (
    !hasData ||
    baselineRuns ===
      null
  ) {
    return {
      key:
        "weather",

      label:
        "Wetter",

      score:
        50,

      weight:
        0.1,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  let multiplier =
    1;

  if (
    windSpeed !==
      null &&
    w.windDirection ===
      "out"
  ) {
    multiplier *=
      1 +
      (
        windSpeed /
        10
      ) *
        0.03;
  }

  if (
    windSpeed !==
      null &&
    w.windDirection ===
      "in"
  ) {
    multiplier *=
      1 -
      (
        windSpeed /
        10
      ) *
        0.03;
  }

  if (
    temp !==
    null
  ) {
    multiplier *=
      1 +
      (
        (
          temp -
          21
        ) /
        10
      ) *
        0.015;
  }

  if (
    humidity !==
    null
  ) {
    multiplier *=
      1 +
      (
        (
          humidity -
          50
        ) /
        10
      ) *
        0.005;
  }

  if (
    pressure !==
    null
  ) {
    multiplier *=
      1 +
      (
        (
          1013 -
          pressure
        ) /
        100
      ) *
        0.01;
  }

  if (
    w.roofState ===
    "closed"
  ) {
    multiplier *=
      0.97;
  }

  multiplier =
    clamp(
      multiplier,
      0.8,
      1.25
    );

  const expectedRuns =
    baselineRuns *
    multiplier;

  const score =
    clamp(
      50 +
        (
          multiplier -
          1
        ) *
          220,
      0,
      100
    );

  return {
    key:
      "weather",

    label:
      "Wetter",

    score,

    weight:
      0.1,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Modul 6: Ballpark
// ---------------------------------------------------------------------------

/**
 * Bewertet den Einfluss des Ballparks
 * auf die aktuelle Baseline.
 */
export function scoreBallpark(
  bp: BallparkInput,
  baselineRuns: number | null
): ModuleResult {
  const runFactor =
    toNumber(
      bp.runFactor
    );

  const hrFactor =
    toNumber(
      bp.hrFactor
    );

  const hasData =
    runFactor !==
      null ||
    hrFactor !==
      null;

  if (
    !hasData ||
    baselineRuns ===
      null
  ) {
    return {
      key:
        "ballpark",

      label:
        "Ballpark",

      score:
        50,

      weight:
        0.05,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  const parts:
    number[] = [];

  if (
    runFactor !==
    null
  ) {
    parts.push(
      runFactor /
        LEAGUE_AVG.runFactor
    );
  }

  if (
    hrFactor !==
    null
  ) {
    parts.push(
      hrFactor /
        LEAGUE_AVG.hrFactor
    );
  }

  let multiplier =
    mean(
      parts
    );

  if (
    bp.dayNight ===
    "day"
  ) {
    multiplier *=
      1.02;
  }

  multiplier =
    clamp(
      multiplier,
      0.75,
      1.3
    );

  const expectedRuns =
    baselineRuns *
    multiplier;

  const score =
    clamp(
      50 +
        (
          multiplier -
          1
        ) *
          180,
      0,
      100
    );

  return {
    key:
      "ballpark",

    label:
      "Ballpark",

    score,

    weight:
      0.05,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Modul 7: Head-to-Head
// ---------------------------------------------------------------------------

/**
 * Bewertet historische direkte
 * Duelle der beiden Teams.
 */
export function scoreH2H(
  h2h: H2HInput
): ModuleResult {
  const last10 =
    toNumberArray(
      h2h.last10TotalRuns
    );

  const last20 =
    toNumberArray(
      h2h.last20TotalRuns
    );

  const hasData =
    last10.length >
      0 ||
    last20.length >
      0;

  if (
    !hasData
  ) {
    return {
      key:
        "h2h",

      label:
        "Head-to-Head",

      score:
        50,

      weight:
        0.1,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  const expectedRuns =
    weightedAverage([
      {
        value:
          last10.length
            ? mean(
                last10
              )
            : null,

        weight:
          0.65,
      },

      {
        value:
          last20.length
            ? mean(
                last20
              )
            : null,

        weight:
          0.35,
      },
    ]);

  if (
    expectedRuns ===
    null
  ) {
    return {
      key:
        "h2h",

      label:
        "Head-to-Head",

      score:
        50,

      weight:
        0.1,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  const deviation =
    expectedRuns -
    2 *
      LEAGUE_AVG.runsPerGame;

  const score =
    clamp(
      50 +
        deviation *
          6,
      0,
      100
    );

  return {
    key:
      "h2h",

    label:
      "Head-to-Head",

    score,

    weight:
      0.1,

    hasData:
      true,

    expectedRuns,
  };
}

// ---------------------------------------------------------------------------
// Modul 8: Marktanalyse
// ---------------------------------------------------------------------------

/**
 * Bewertet Linienbewegungen
 * und optionale Marktinformationen.
 */
export function scoreMarket(
  m: MarketInput
): ModuleResult {
  const opening =
    toNumber(
      m.openingLine
    );

  const current =
    toNumber(
      m.currentLine
    );

  const publicOver =
    toNumber(
      m.publicOverPct
    );

  const sharpOver =
    toNumber(
      m.sharpOverPct
    );

  const hasData =
    opening !==
      null &&
    current !==
      null;

  if (
    !hasData
  ) {
    return {
      key:
        "market",

      label:
        "Marktanalyse",

      score:
        50,

      weight:
        0,

      hasData:
        false,

      expectedRuns:
        null,
    };
  }

  /**
   * Steam-Move:
   *
   * deutliche Linienbewegung
   * seit Eröffnung.
   */
  const lineMovement =
    current -
    opening;

  let score =
    50 +
    lineMovement *
      20;

  /**
   * Reverse Line Movement:
   *
   * Linie bewegt sich gegen
   * die öffentliche Meinung.
   *
   * Dies kann auf Sharp Money
   * auf der Gegenseite der
   * Öffentlichkeit hindeuten.
   */
  if (
    publicOver !==
      null &&
    sharpOver !==
      null
  ) {
    const sharpVsPublic =
      sharpOver -
      publicOver;

    score +=
      sharpVsPublic *
      0.3;
  }

  score =
    clamp(
      score,
      0,
      100
    );

  return {
    key:
      "market",

    label:
      "Marktanalyse",

    score,

    weight:
      0,

    hasData:
      hasAnyValue([
        m.openingLine,
        m.currentLine,
      ]),

    expectedRuns:
      null,
  };
}