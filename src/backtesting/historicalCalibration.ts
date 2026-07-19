import { computeFullAnalysis } from "@/models/GameModel";
import { applyCalibrationMultipliers } from "@/engine/predictionEngine";
import { computeConsensus } from "@/utils/consensus";
import type { ModuleKey, ModuleResult, ModuleWeightMultipliers } from "@/types";
import type { BacktestGame } from "./backtestTypes";
import type { HistoricalBacktestState } from "./historicalBacktestState";

/**
 * Historical Calibration PRO.
 *
 * Optimiert die Modul-Gewichte der Prediction Engine anhand echter
 * historischer MLB-Spiele — OHNE die Basis-Architektur zu verändern:
 * die Kalibrierung liefert ausschließlich multiplikative Anpassungen
 * (`ModuleWeightMultipliers`), die optional zusätzlich zur bestehenden
 * dynamischen Gewichtung (Paket 2) angewendet werden
 * (`computeFullAnalysis(state, calibrationMultipliers)`).
 *
 * Methodik (bewusst einfach & nachvollziehbar statt eines Black-Box-
 * Optimierers):
 *
 *  1. Chronologischer Train-/Validierungs-Split (Standard 70 % / 30 %) —
 *     kein zufälliges Mischen, um Look-Ahead-Bias zu vermeiden (spätere
 *     Spiele dürfen die Kalibrierung früherer Spiele nicht beeinflussen).
 *  2. Koordinaten-Suche: für jedes der 8 Module wird UNABHÄNGIG von den
 *     anderen der beste Gewichts-Multiplikator aus einem kleinen,
 *     festen Kandidaten-Raster (Standard [0.8, 1.0, 1.2]) ermittelt,
 *     anhand der Trefferquote auf der TRAININGS-Menge. Das hält den
 *     Suchraum klein (8 × 3 = 24 statt 3^8 ≈ 6.561 Kombinationen) und
 *     vermeidet, dass die Suche sich an zufälliges Rauschen in wenigen
 *     Spielen anpasst.
 *  3. Das kombinierte Ergebnis wird ausschließlich auf der zuvor nicht
 *     gesehenen VALIDIERUNGS-Menge bewertet — das ist der eigentliche
 *     Overfitting-Schutz: eine Kalibrierung, die nur auf den
 *     Trainingsdaten besser aussieht, aber auf der Validierungsmenge
 *     nicht nachweisbar besser ist, wird verworfen.
 *  4. Angewendet wird die Kalibrierung nur, wenn sie die
 *     Validierungs-Trefferquote um mindestens `minValidationImprovementPct`
 *     Prozentpunkte (Standard 1.5) gegenüber den unkalibrierten
 *     Basis-Gewichten verbessert. Reicht die Datenbasis nicht aus
 *     (`minGamesRequired`, Standard 60 Spiele) oder ist die Verbesserung
 *     zu gering, bleiben die bestehenden Basis-Gewichte unverändert
 *     bestehen — "keine festen Werte" bedeutet hier: die Gewichte werden
 *     aus Daten hergeleitet, aber niemals ohne belastbaren Nachweis
 *     verändert.
 *
 * Alle Zwischenschritte (getestete Kandidaten, Trainings-/Validierungs-
 * Trefferquoten, Entscheidungsbegründung) werden in `methodologyNotes`
 * dokumentiert.
 */

const ALL_MODULE_KEYS: ModuleKey[] = ["form", "pitcher", "bullpen", "offense", "weather", "ballpark", "h2h", "market"];

const IDENTITY_MULTIPLIERS: ModuleWeightMultipliers = {
  form: 1,
  pitcher: 1,
  bullpen: 1,
  offense: 1,
  weather: 1,
  ballpark: 1,
  h2h: 1,
  market: 1,
};

const DEFAULT_CANDIDATE_GRID = [0.8, 1.0, 1.2];
const DEFAULT_TRAIN_RATIO = 0.7;
const DEFAULT_MIN_VALIDATION_IMPROVEMENT_PCT = 1.5;
const DEFAULT_MIN_GAMES_REQUIRED = 60;

export interface CalibrationOptions {
  /** Anteil der Spiele, der für das Training verwendet wird (0–1). Standard 0.7. */
  trainRatio?: number;
  /** Kandidaten-Multiplikatoren, die je Modul getestet werden. Standard [0.8, 1.0, 1.2]. */
  candidateGrid?: number[];
  /** Mindest-Verbesserung der Validierungs-Trefferquote in Prozentpunkten, damit die Kalibrierung übernommen wird. Standard 1.5. */
  minValidationImprovementPct?: number;
  /** Mindestanzahl auswertbarer historischer Spiele, unterhalb derer keine Kalibrierung versucht wird. Standard 60. */
  minGamesRequired?: number;
}

export interface CalibrationCandidateResult {
  multipliers: ModuleWeightMultipliers;
  trainAccuracy: number | null;
  trainDecidedBets: number;
  validationAccuracy: number | null;
  validationDecidedBets: number;
}

export interface CalibrationResult {
  trainGameCount: number;
  validationGameCount: number;
  /** Ergebnis mit unveränderten Basis-Gewichten (Multiplikatoren = 1). */
  baseline: CalibrationCandidateResult;
  /** Ergebnis mit den kalibrierten Gewichten — identisch zu `baseline`, wenn `applied === false`. */
  calibrated: CalibrationCandidateResult;
  /** Ob die Kalibrierung die Mindestschwelle überschritten hat und angewendet wurde. */
  applied: boolean;
  /** Ergebnis der Koordinaten-Suche je Modul (nur informativ — die tatsächlich übernommenen Multiplikatoren stehen in `calibrated.multipliers`). */
  perModuleSearch: { moduleKey: ModuleKey; bestMultiplier: number; trainAccuracy: number | null }[];
  /** Vollständige, menschlich lesbare Dokumentation der Methodik und Entscheidung. */
  methodologyNotes: string[];
}

interface PrecomputedGame {
  game: BacktestGame;
  modules: ModuleResult[];
}

/** Ermittelt das tatsächliche Über-/Unter-Ergebnis eines historischen Spiels. */
function determineActualOutcome(game: BacktestGame): "over" | "under" | "push" {
  if (game.actualRuns > game.line) return "over";
  if (game.actualRuns < game.line) return "under";
  return "push";
}

/**
 * Berechnet für jedes historische Spiel EINMAL die vollständige Analyse
 * (inkl. der teuren Monte-Carlo-PRO-Simulation) und behält davon nur die
 * Modul-Ergebnisse. Alle nachfolgenden Kandidaten-Bewertungen wenden
 * lediglich Gewichts-Multiplikatoren auf diese bereits berechneten
 * Module an und berechnen den (günstigen) Konsens neu — die teure
 * Simulation wird dadurch nur einmal pro Spiel ausgeführt, unabhängig
 * davon, wie viele Kandidaten getestet werden.
 */
function precomputeGames(states: HistoricalBacktestState[], games: BacktestGame[]): PrecomputedGame[] {
  const stateByGameId = new Map(states.map((entry) => [entry.gameId, entry.state]));
  const precomputed: PrecomputedGame[] = [];

  for (const game of games) {
    const state = stateByGameId.get(game.gameId);
    if (!state) continue;
    const analysis = computeFullAnalysis(state);
    precomputed.push({ game, modules: analysis.modules });
  }

  return precomputed;
}

/** Chronologischer Split (nach `officialDate`), kein zufälliges Mischen. */
function splitTrainValidation(entries: PrecomputedGame[], trainRatio: number): { train: PrecomputedGame[]; validation: PrecomputedGame[] } {
  const sorted = [...entries].sort((a, b) => a.game.officialDate.localeCompare(b.game.officialDate));
  const splitIndex = Math.round(sorted.length * trainRatio);
  return { train: sorted.slice(0, splitIndex), validation: sorted.slice(splitIndex) };
}

/**
 * Bewertet einen Multiplikator-Kandidaten gegen eine Menge historischer
 * Spiele: wendet die Multiplikatoren auf die bereits vorberechneten
 * Modul-Ergebnisse an, berechnet den Konsens neu und vergleicht den
 * resultierenden Pick mit dem tatsächlichen Ergebnis. Pushes fließen
 * nicht in die Trefferquote ein (konsistent mit dem bestehenden
 * Backtesting-Ansatz, siehe `backtestEngine.ts`).
 */
function evaluatePickAccuracy(entries: PrecomputedGame[], multipliers: ModuleWeightMultipliers): { accuracy: number | null; decidedBets: number } {
  let correct = 0;
  let decided = 0;

  for (const { game, modules } of entries) {
    const adjustedModules = applyCalibrationMultipliers(modules, multipliers);
    const consensus = computeConsensus(adjustedModules);
    if (consensus.pick === null) continue;

    const actual = determineActualOutcome(game);
    if (actual === "push") continue;

    decided += 1;
    if (consensus.pick === actual) correct += 1;
  }

  return { accuracy: decided > 0 ? correct / decided : null, decidedBets: decided };
}

function evaluateMultipliers(
  train: PrecomputedGame[],
  validation: PrecomputedGame[],
  multipliers: ModuleWeightMultipliers
): CalibrationCandidateResult {
  const trainResult = evaluatePickAccuracy(train, multipliers);
  const validationResult = evaluatePickAccuracy(validation, multipliers);

  return {
    multipliers,
    trainAccuracy: trainResult.accuracy,
    trainDecidedBets: trainResult.decidedBets,
    validationAccuracy: validationResult.accuracy,
    validationDecidedBets: validationResult.decidedBets,
  };
}

/**
 * Führt die vollständige Historical-Calibration-PRO-Kalibrierung aus.
 *
 * `states` und `games` stammen aus der bestehenden Backtest-
 * Infrastruktur (z. B. `BacktestManager.prepareHistoricalBacktestDataset()`)
 * — diese Funktion selbst lädt keine Daten, sondern kalibriert rein auf
 * Basis der übergebenen historischen Spiele.
 */
export function runHistoricalCalibration(
  states: HistoricalBacktestState[],
  games: BacktestGame[],
  options?: CalibrationOptions
): CalibrationResult {
  const trainRatio = options?.trainRatio ?? DEFAULT_TRAIN_RATIO;
  const candidateGrid = options?.candidateGrid ?? DEFAULT_CANDIDATE_GRID;
  const minValidationImprovementPct = options?.minValidationImprovementPct ?? DEFAULT_MIN_VALIDATION_IMPROVEMENT_PCT;
  const minGamesRequired = options?.minGamesRequired ?? DEFAULT_MIN_GAMES_REQUIRED;

  const entries = precomputeGames(states, games);
  const { train, validation } = splitTrainValidation(entries, trainRatio);

  const methodologyNotes: string[] = [
    `Datenbasis: ${entries.length} auswertbare historische Spiele (chronologisch sortiert nach Spieltag).`,
    `Aufteilung: ${train.length} Spiele Training (${Math.round(trainRatio * 100)} %), ${validation.length} Spiele Validierung (${Math.round(
      (1 - trainRatio) * 100
    )} %) — zeitlich getrennt (keine zufällige Durchmischung), um Look-Ahead-Bias zu vermeiden.`,
    `Suchverfahren: Koordinaten-Suche je Modul unabhängig über die Kandidaten [${candidateGrid.join(", ")}] (multiplikativ auf das bestehende Basis-Gewicht), ausgewählt anhand der Trainings-Trefferquote.`,
    `Overfitting-Schutz: das kombinierte Ergebnis aus der Koordinaten-Suche wird ausschließlich auf der Validierungsmenge bewertet; angewendet wird die Kalibrierung nur, wenn sie die Validierungs-Trefferquote um mindestens ${minValidationImprovementPct} Prozentpunkte gegenüber den unkalibrierten Basis-Gewichten verbessert.`,
  ];

  if (entries.length < minGamesRequired) {
    methodologyNotes.push(
      `Zu wenige auswertbare historische Spiele (${entries.length} < ${minGamesRequired}) für eine belastbare Kalibrierung — die unveränderten Basis-Gewichte werden beibehalten.`
    );

    const baseline = evaluateMultipliers(train, validation, IDENTITY_MULTIPLIERS);

    return {
      trainGameCount: train.length,
      validationGameCount: validation.length,
      baseline,
      calibrated: baseline,
      applied: false,
      perModuleSearch: [],
      methodologyNotes,
    };
  }

  const perModuleSearch: { moduleKey: ModuleKey; bestMultiplier: number; trainAccuracy: number | null }[] = [];
  const calibratedMultipliers: ModuleWeightMultipliers = { ...IDENTITY_MULTIPLIERS };

  for (const key of ALL_MODULE_KEYS) {
    let bestMultiplier = 1;
    let bestAccuracy = -1;
    let bestAccuracyNullable: number | null = null;

    for (const candidate of candidateGrid) {
      const testMultipliers: ModuleWeightMultipliers = { ...calibratedMultipliers, [key]: candidate };
      const { accuracy } = evaluatePickAccuracy(train, testMultipliers);
      if (accuracy !== null && accuracy > bestAccuracy) {
        bestAccuracy = accuracy;
        bestAccuracyNullable = accuracy;
        bestMultiplier = candidate;
      }
    }

    calibratedMultipliers[key] = bestMultiplier;
    perModuleSearch.push({ moduleKey: key, bestMultiplier, trainAccuracy: bestAccuracyNullable });
  }

  const baseline = evaluateMultipliers(train, validation, IDENTITY_MULTIPLIERS);
  const calibratedCandidate = evaluateMultipliers(train, validation, calibratedMultipliers);

  const baselineValidationPct = (baseline.validationAccuracy ?? 0) * 100;
  const calibratedValidationPct = (calibratedCandidate.validationAccuracy ?? 0) * 100;
  const improvementPct = calibratedValidationPct - baselineValidationPct;

  const applied =
    baseline.validationAccuracy !== null &&
    calibratedCandidate.validationAccuracy !== null &&
    improvementPct >= minValidationImprovementPct;

  methodologyNotes.push(
    `Ergebnis: Basis-Trefferquote (Validierung) ${baselineValidationPct.toFixed(1)} % vs. kalibrierte Trefferquote ${calibratedValidationPct.toFixed(
      1
    )} % (Δ ${improvementPct.toFixed(1)} Prozentpunkte, ${baseline.validationDecidedBets} bzw. ${calibratedCandidate.validationDecidedBets} entschiedene Wetten auf der Validierungsmenge). ` +
      (applied
        ? "Verbesserung überschreitet die Mindestschwelle — Kalibrierung wird übernommen."
        : "Verbesserung unterschreitet die Mindestschwelle oder es liegen keine auswertbaren Validierungs-Wetten vor — Basis-Gewichte werden beibehalten.")
  );

  return {
    trainGameCount: train.length,
    validationGameCount: validation.length,
    baseline,
    calibrated: applied ? calibratedCandidate : baseline,
    applied,
    perModuleSearch,
    methodologyNotes,
  };
}

/**
 * Formatiert ein `CalibrationResult` als lesbaren Text-Report (für
 * Browser-Konsole / Dev-Tools, konsistent mit den bestehenden
 * Backtest-Diagnose-Ausgaben in `backtestRunner.ts`).
 */
export function formatCalibrationReport(result: CalibrationResult): string {
  const lines: string[] = [];

  lines.push("========================================");
  lines.push("HISTORICAL CALIBRATION PRO");
  lines.push("========================================");
  lines.push("");
  lines.push(`Trainings-Spiele: ${result.trainGameCount}`);
  lines.push(`Validierungs-Spiele: ${result.validationGameCount}`);
  lines.push("");

  for (const note of result.methodologyNotes) {
    lines.push(`- ${note}`);
  }

  lines.push("");
  lines.push("Koordinaten-Suche je Modul (Trainings-Trefferquote):");
  for (const entry of result.perModuleSearch) {
    const accuracyText = entry.trainAccuracy !== null ? `${(entry.trainAccuracy * 100).toFixed(1)} %` : "n/a";
    lines.push(`  ${entry.moduleKey.padEnd(10, " ")} → Multiplikator ${entry.bestMultiplier.toFixed(2)} (Training: ${accuracyText})`);
  }

  lines.push("");
  lines.push(`Status: ${result.applied ? "KALIBRIERUNG ÜBERNOMMEN" : "BASIS-GEWICHTE BEIBEHALTEN"}`);
  lines.push("");
  lines.push("Finale Multiplikatoren:");
  for (const key of ALL_MODULE_KEYS) {
    lines.push(`  ${key.padEnd(10, " ")} → ${result.calibrated.multipliers[key].toFixed(2)}`);
  }

  lines.push("========================================");

  return lines.join("\n");
}
