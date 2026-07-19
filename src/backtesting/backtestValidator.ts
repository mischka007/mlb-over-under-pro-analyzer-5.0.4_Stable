import type { BacktestResult } from "./backtestTypes";

export type ValidationSeverity =
  | "INFO"
  | "WARNING"
  | "ERROR";

export interface BacktestValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  gameId?: string;
}

export interface BacktestSideStatistics {
  pick: "over" | "under";
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number;
  profit: number;
  roi: number;
}

export interface BacktestConfidenceBucket {
  label: string;
  min: number;
  max: number | null;
  total: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number;
  profit: number;
  roi: number;
}

export interface BacktestValidationSummary {
  totalResults: number;
  uniqueGameIds: number;
  duplicateGameIds: number;
  invalidDates: number;
  invalidScores: number;
  invalidConfidenceValues: number;
  invalidPicks: number;
  invalidOutcomes: number;
  chronological: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
}

export interface BacktestValidationReport {
  summary: BacktestValidationSummary;

  issues: BacktestValidationIssue[];

  sideStatistics: {
    over: BacktestSideStatistics;
    under: BacktestSideStatistics;
  };

  confidenceBuckets: BacktestConfidenceBucket[];
}

/**
 * Normalisiert die Confidence.
 *
 * Unterstützt:
 *
 * 0.55 -> 55
 * 55   -> 55
 */
function normalizeConfidence(
  confidence: number
): number {
  if (
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1
  ) {
    return confidence * 100;
  }

  return confidence;
}

/**
 * Berechnet die Trefferquote.
 *
 * Pushes werden nicht als
 * entschiedene Wetten gezählt.
 */
function calculateHitRate(
  wins: number,
  losses: number
): number {
  const decided =
    wins + losses;

  if (decided === 0) {
    return 0;
  }

  return wins / decided;
}

/**
 * Berechnet ROI / Yield auf Basis
 * von einer Unit Einsatz pro Wette.
 */
function calculateRoi(
  profit: number,
  totalBets: number
): number {
  if (totalBets === 0) {
    return 0;
  }

  return profit / totalBets;
}

/**
 * Erstellt die Statistik für
 * OVER oder UNDER.
 *
 * WICHTIG:
 * Dein BacktestResult verwendet:
 *
 * "over"
 * "under"
 *
 * also Kleinbuchstaben.
 */
function createSideStatistics(
  results: BacktestResult[],
  pick: "over" | "under"
): BacktestSideStatistics {
  const filtered =
    results.filter(
      (result) =>
        result.predictedPick ===
        pick
    );

  const wins =
    filtered.filter(
      (result) =>
        result.outcome ===
        "win"
    ).length;

  const losses =
    filtered.filter(
      (result) =>
        result.outcome ===
        "loss"
    ).length;

  const pushes =
    filtered.filter(
      (result) =>
        result.outcome ===
        "push"
    ).length;

  const profit =
    filtered.reduce(
      (
        total,
        result
      ) =>
        total +
        result.profit,
      0
    );

  return {
    pick,

    total:
      filtered.length,

    wins,

    losses,

    pushes,

    hitRate:
      calculateHitRate(
        wins,
        losses
      ),

    profit,

    roi:
      calculateRoi(
        profit,
        filtered.length
      ),
  };
}

/**
 * Definition der Confidence-Buckets.
 *
 * Die obere Grenze ist exklusiv.
 *
 * Beispiel:
 *
 * 50-52 bedeutet:
 * >= 50 und < 52
 */
const CONFIDENCE_BUCKETS = [
  {
    label: "50-52 %",
    min: 50,
    max: 52,
  },

  {
    label: "52-55 %",
    min: 52,
    max: 55,
  },

  {
    label: "55-58 %",
    min: 55,
    max: 58,
  },

  {
    label: "58-60 %",
    min: 58,
    max: 60,
  },

  {
    label: "60 %+",
    min: 60,
    max: null,
  },
] as const;

/**
 * Erstellt die Performance-Auswertung
 * nach Confidence-Buckets.
 */
function createConfidenceBuckets(
  results: BacktestResult[]
): BacktestConfidenceBucket[] {
  return CONFIDENCE_BUCKETS.map(
    (
      bucket
    ): BacktestConfidenceBucket => {
      const filtered =
        results.filter(
          (result) => {
            const confidence =
              normalizeConfidence(
                result.confidence
              );

            const aboveMinimum =
              confidence >=
              bucket.min;

            const belowMaximum =
              bucket.max ===
                null ||
              confidence <
                bucket.max;

            return (
              aboveMinimum &&
              belowMaximum
            );
          }
        );

      const wins =
        filtered.filter(
          (result) =>
            result.outcome ===
            "win"
        ).length;

      const losses =
        filtered.filter(
          (result) =>
            result.outcome ===
            "loss"
        ).length;

      const pushes =
        filtered.filter(
          (result) =>
            result.outcome ===
            "push"
        ).length;

      const profit =
        filtered.reduce(
          (
            total,
            result
          ) =>
            total +
            result.profit,
          0
        );

      return {
        label:
          bucket.label,

        min:
          bucket.min,

        max:
          bucket.max,

        total:
          filtered.length,

        wins,

        losses,

        pushes,

        hitRate:
          calculateHitRate(
            wins,
            losses
          ),

        profit,

        roi:
          calculateRoi(
            profit,
            filtered.length
          ),
      };
    }
  );
}

/**
 * Prüft einen vollständigen
 * historischen Backtest.
 */
export function validateBacktestResults(
  results: BacktestResult[]
): BacktestValidationReport {
  const issues:
    BacktestValidationIssue[] =
      [];

  const gameIdCounts =
    new Map<
      string,
      number
    >();

  let invalidDates = 0;
  let invalidScores = 0;

  let invalidConfidenceValues =
    0;

  let invalidPicks = 0;
  let invalidOutcomes = 0;

  let chronological = true;

  let previousTimestamp:
    number | null = null;

  for (
    const result of results
  ) {
    /**
     * GAME ID
     */
    const gameId =
      String(
        result.gameId
      );

    gameIdCounts.set(
      gameId,
      (
        gameIdCounts.get(
          gameId
        ) ?? 0
      ) + 1
    );

    /**
     * DATUM
     */
    const timestamp =
      new Date(
        result.gameDate
      ).getTime();

    if (
      Number.isNaN(
        timestamp
      )
    ) {
      invalidDates += 1;

      issues.push({
        severity:
          "ERROR",

        code:
          "INVALID_DATE",

        message:
          `Ungültiges Spieldatum: ${String(
            result.gameDate
          )}`,

        gameId,
      });
    } else {
      if (
        previousTimestamp !==
          null &&
        timestamp <
          previousTimestamp
      ) {
        chronological =
          false;
      }

      previousTimestamp =
        timestamp;
    }

    /**
     * SCORES
     */
    const validAwayRuns =
      Number.isFinite(
        result.awayRuns
      ) &&
      result.awayRuns >= 0;

    const validHomeRuns =
      Number.isFinite(
        result.homeRuns
      ) &&
      result.homeRuns >= 0;

    const validActualRuns =
      Number.isFinite(
        result.actualRuns
      ) &&
      result.actualRuns >= 0;

    const totalMatchesScore =
      validAwayRuns &&
      validHomeRuns &&
      validActualRuns &&
      result.actualRuns ===
        result.awayRuns +
          result.homeRuns;

    if (
      !validAwayRuns ||
      !validHomeRuns ||
      !validActualRuns ||
      !totalMatchesScore
    ) {
      invalidScores += 1;

      issues.push({
        severity:
          "ERROR",

        code:
          "INVALID_SCORE",

        message:
          `Ungültiger Score oder Total stimmt nicht überein: ${result.awayRuns}:${result.homeRuns}, Total ${result.actualRuns}`,

        gameId,
      });
    }

    /**
     * CONFIDENCE
     */
    const confidence =
      normalizeConfidence(
        result.confidence
      );

    if (
      !Number.isFinite(
        confidence
      ) ||
      confidence < 0 ||
      confidence > 100
    ) {
      invalidConfidenceValues +=
        1;

      issues.push({
        severity:
          "ERROR",

        code:
          "INVALID_CONFIDENCE",

        message:
          `Ungültige Confidence: ${String(
            result.confidence
          )}`,

        gameId,
      });
    }

    /**
     * PICK
     *
     * Dein Typ erlaubt:
     *
     * "over"
     * "under"
     */
    if (
      result.predictedPick !==
        "over" &&
      result.predictedPick !==
        "under"
    ) {
      invalidPicks += 1;

      issues.push({
        severity:
          "ERROR",

        code:
          "INVALID_PICK",

        message:
          `Ungültiger Pick: ${String(
            result.predictedPick
          )}`,

        gameId,
      });
    }

    /**
     * OUTCOME
     *
     * Dein Typ erlaubt:
     *
     * "win"
     * "loss"
     * "push"
     */
    if (
      result.outcome !==
        "win" &&
      result.outcome !==
        "loss" &&
      result.outcome !==
        "push"
    ) {
      invalidOutcomes += 1;

      issues.push({
        severity:
          "ERROR",

        code:
          "INVALID_OUTCOME",

        message:
          `Ungültiges Outcome: ${String(
            result.outcome
          )}`,

        gameId,
      });
    }
  }

  /**
   * DUPLIKATE
   */
  let duplicateGameIds = 0;

  for (
    const [
      gameId,
      count,
    ] of gameIdCounts
  ) {
    if (count > 1) {
      duplicateGameIds += 1;

      issues.push({
        severity:
          "WARNING",

        code:
          "DUPLICATE_GAME_ID",

        message:
          `Game ID ${gameId} kommt ${count} Mal vor.`,

        gameId,
      });
    }
  }

  /**
   * CHRONOLOGIE
   */
  if (!chronological) {
    issues.push({
      severity:
        "WARNING",

      code:
        "NOT_CHRONOLOGICAL",

      message:
        "Die Backtest-Ergebnisse sind nicht vollständig chronologisch sortiert.",
    });
  }

  /**
   * LEERER BACKTEST
   */
  if (
    results.length === 0
  ) {
    issues.push({
      severity:
        "WARNING",

      code:
        "EMPTY_BACKTEST",

      message:
        "Der Backtest enthält keine Ergebnisse.",
    });
  }

  const uniqueGameIds =
    gameIdCounts.size;

  const hasErrors =
    issues.some(
      (issue) =>
        issue.severity ===
        "ERROR"
    );

  const hasWarnings =
    issues.some(
      (issue) =>
        issue.severity ===
        "WARNING"
    );

  return {
    summary: {
      totalResults:
        results.length,

      uniqueGameIds,

      duplicateGameIds,

      invalidDates,

      invalidScores,

      invalidConfidenceValues,

      invalidPicks,

      invalidOutcomes,

      chronological,

      hasErrors,

      hasWarnings,
    },

    issues,

    sideStatistics: {
      over:
        createSideStatistics(
          results,
          "over"
        ),

      under:
        createSideStatistics(
          results,
          "under"
        ),
    },

    confidenceBuckets:
      createConfidenceBuckets(
        results
      ),
  };
}

/**
 * Gibt den Validierungsbericht
 * übersichtlich in der Browser-Konsole aus.
 */
export function printBacktestValidationReport(
  report: BacktestValidationReport
): void {
  console.log(
    "========================================"
  );

  console.log(
    "BACKTEST VALIDATION REPORT"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Ergebnisse gesamt:",
    report.summary.totalResults
  );

  console.log(
    "Eindeutige Game IDs:",
    report.summary.uniqueGameIds
  );

  console.log(
    "Doppelte Game IDs:",
    report.summary.duplicateGameIds
  );

  console.log(
    "Ungültige Datumswerte:",
    report.summary.invalidDates
  );

  console.log(
    "Ungültige Scores:",
    report.summary.invalidScores
  );

  console.log(
    "Ungültige Confidence-Werte:",
    report.summary
      .invalidConfidenceValues
  );

  console.log(
    "Ungültige Picks:",
    report.summary.invalidPicks
  );

  console.log(
    "Ungültige Outcomes:",
    report.summary.invalidOutcomes
  );

  console.log(
    "Chronologisch:",
    report.summary
      .chronological
      ? "JA"
      : "NEIN"
  );

  console.log(
    "Fehler vorhanden:",
    report.summary.hasErrors
      ? "JA"
      : "NEIN"
  );

  console.log(
    "Warnungen vorhanden:",
    report.summary.hasWarnings
      ? "JA"
      : "NEIN"
  );

  console.log(
    "========================================"
  );

  console.log(
    "OVER / UNDER PERFORMANCE"
  );

  console.log(
    "========================================"
  );

  console.table([
    {
      Pick:
        report.sideStatistics
          .over.pick
          .toUpperCase(),

      Bets:
        report.sideStatistics
          .over.total,

      Wins:
        report.sideStatistics
          .over.wins,

      Losses:
        report.sideStatistics
          .over.losses,

      Pushes:
        report.sideStatistics
          .over.pushes,

      HitRate:
        `${(
          report.sideStatistics
            .over.hitRate *
          100
        ).toFixed(2)} %`,

      Profit:
        report.sideStatistics
          .over.profit.toFixed(
            2
          ),

      ROI:
        `${(
          report.sideStatistics
            .over.roi *
          100
        ).toFixed(2)} %`,
    },

    {
      Pick:
        report.sideStatistics
          .under.pick
          .toUpperCase(),

      Bets:
        report.sideStatistics
          .under.total,

      Wins:
        report.sideStatistics
          .under.wins,

      Losses:
        report.sideStatistics
          .under.losses,

      Pushes:
        report.sideStatistics
          .under.pushes,

      HitRate:
        `${(
          report.sideStatistics
            .under.hitRate *
          100
        ).toFixed(2)} %`,

      Profit:
        report.sideStatistics
          .under.profit.toFixed(
            2
          ),

      ROI:
        `${(
          report.sideStatistics
            .under.roi *
          100
        ).toFixed(2)} %`,
    },
  ]);

  console.log(
    "========================================"
  );

  console.log(
    "CONFIDENCE BUCKETS"
  );

  console.log(
    "========================================"
  );

  console.table(
    report.confidenceBuckets.map(
      (bucket) => ({
        Bucket:
          bucket.label,

        Bets:
          bucket.total,

        Wins:
          bucket.wins,

        Losses:
          bucket.losses,

        Pushes:
          bucket.pushes,

        HitRate:
          `${(
            bucket.hitRate *
            100
          ).toFixed(2)} %`,

        Profit:
          bucket.profit.toFixed(
            2
          ),

        ROI:
          `${(
            bucket.roi *
            100
          ).toFixed(2)} %`,
      })
    )
  );

  if (
    report.issues.length >
    0
  ) {
    console.log(
      "========================================"
    );

    console.log(
      "VALIDATION ISSUES"
    );

    console.log(
      "========================================"
    );

    console.table(
      report.issues.map(
        (issue) => ({
          Severity:
            issue.severity,

          Code:
            issue.code,

          GameId:
            issue.gameId ??
            "-",

          Message:
            issue.message,
        })
      )
    );
  } else {
    console.log(
      "Keine Validierungsprobleme gefunden."
    );
  }

  console.log(
    "========================================"
  );
}