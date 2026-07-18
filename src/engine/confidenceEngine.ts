import type {
  BullpenQualityAssessment,
  ConfidenceBreakdown,
  ConfidenceFactor,
  ConsensusResult,
  MarketInput,
  ModuleResult,
  MonteCarloResult,
  OffenseQualityAssessment,
  PitcherQualityAssessment,
  QualityGrade,
  WeatherInput,
} from "@/types";
import { clamp, mean, stdDev, toNumber, weightedAverage } from "@/utils/math";

/**
 * Confidence Engine PRO.
 *
 * Ersetzt die einfache, rein modul-score-basierte Confidence-Berechnung
 * durch eine vollständige, mehrdimensionale Bewertung, die berücksichtigt:
 *
 *  - Pitcher-/Bullpen-/Offense-Datenqualität (aus den jeweiligen PRO-Bewertungen)
 *  - Weather-/Market-Datenqualität (Vollständigkeit der Eingabefelder)
 *  - API-/Modul-Vollständigkeit (wie viele der 8 Module tatsächlich Daten haben)
 *  - Simulationsqualität (Monte-Carlo-PRO-Stabilität & Poisson-Übereinstimmung)
 *  - Modul-Konsens (wie einig sich die einzelnen Module sind)
 *  - optional: Historical Accuracy (aus dem Backtesting, falls verfügbar)
 *  - Konsens-Stärke (wie eindeutig der Gesamtscore von 50 abweicht)
 *
 * Auf die daraus resultierende gewichtete Basis-Confidence werden
 * anschließend ausschließlich VERRINGERNDE, harte Penalties angewendet
 * (fehlende Lineup-Bestätigung, Verletzungssorgen, fehlende Kernmodul-
 * Daten, eine gegen den Modell-Pick laufende Linienbewegung). Dadurch
 * kann die Confidence niemals künstlich hoch ausfallen: selbst bei
 * exzellenter Datenqualität drückt jedes operative Risiko den finalen
 * Wert spürbar nach unten, nie umgekehrt.
 */

/** Leitet aus der Confidence (0–1) die Buchstaben-Note ab (wiederverwendet `QualityGrade`). */
export function calculatePredictionGrade(confidence: number): QualityGrade {
  if (confidence >= 0.92) return "A+";
  if (confidence >= 0.85) return "A";
  if (confidence >= 0.78) return "A-";
  if (confidence >= 0.7) return "B+";
  if (confidence >= 0.62) return "B";
  if (confidence >= 0.55) return "C";
  return "D";
}

/**
 * Anteil der übergebenen String-Werte, die sich zu einer gültigen Zahl
 * parsen lassen — als 0–100-Vollständigkeits-Score.
 */
function fieldsPresentRatio(values: string[]): number {
  if (values.length === 0) return 0;
  const present = values.filter((v) => toNumber(v) !== null).length;
  return (present / values.length) * 100;
}

/**
 * Bewertet, wie einig sich die aktiven Module (mit Daten) in ihrem
 * jeweiligen 0–100-Score sind. Geringe Streuung (alle Module zeigen in
 * dieselbe Richtung) bedeutet hohen Konsens; große Streuung (Module
 * widersprechen sich) bedeutet niedrigen Konsens und damit weniger
 * Vertrauen in die Gesamtprognose.
 */
function computeModuleAgreement(modules: ModuleResult[]): number {
  const activeScores = modules.filter((m) => m.hasData).map((m) => m.score);
  if (activeScores.length < 2) return 50; // zu wenige Module für eine belastbare Konsens-Aussage
  const spread = stdDev(activeScores);
  // stdDev 0 (völlige Einigkeit) → 100. Ab stdDev 30 (starke Uneinigkeit) → 0.
  return clamp(100 - (spread / 30) * 100, 0, 100);
}

/**
 * Bewertet die Linienbewegung im Verhältnis zum Modell-Pick ("Closing
 * Line Movement"). Bewegt sich die Linie MIT dem Pick, bestätigt der
 * Markt tendenziell die Modellmeinung (positiv). Bewegt sie sich
 * dagegen, ist das ein Warnsignal (negativ). Ohne Marktdaten oder ohne
 * Pick bleibt der Faktor neutral.
 */
function computeClosingLineFactor(pick: ConsensusResult["pick"], openingLine: number | null, currentLine: number | null): number {
  if (pick === null || openingLine === null || currentLine === null) return 60;

  const movement = currentLine - openingLine;
  if (Math.abs(movement) < 0.1) return 60; // kaum Bewegung — kein Warnsignal

  const aligned = pick === "over" ? movement > 0 : movement < 0;
  const magnitude = clamp(Math.abs(movement) / 1.5, 0, 1); // volle Wirkung ab 1.5 Runs Bewegung

  return aligned ? clamp(60 + magnitude * 40, 0, 100) : clamp(60 - magnitude * 60, 0, 100);
}

/**
 * Berechnet die vollständige Confidence-Aufschlüsselung.
 */
export function computeConfidenceBreakdown(params: {
  modules: ModuleResult[];
  consensus: ConsensusResult;
  montecarlo: MonteCarloResult;
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weather: WeatherInput;
  market: MarketInput;
  setup: { lineupsConfirmed: boolean; noInjuryConcerns?: boolean };
  /** Trefferquote (%) vergleichbarer historischer Backtests, falls verfügbar (siehe Paket 7). `null` = nicht verfügbar, fließt dann NICHT als künstlicher Wert ein. */
  historicalAccuracyPct: number | null;
}): ConfidenceBreakdown {
  const activeModuleCount = params.modules.filter((m) => m.hasData).length;
  const dataCompleteness = params.modules.length > 0 ? (activeModuleCount / params.modules.length) * 100 : 0;

  const pitcherConfidences = [params.homePitcherQuality, params.awayPitcherQuality].filter((q) => q.hasData).map((q) => q.confidence);
  const bullpenConfidences = [params.homeBullpenQuality, params.awayBullpenQuality].filter((q) => q.hasData).map((q) => q.confidence);
  const offenseConfidences = [params.homeOffenseQuality, params.awayOffenseQuality].filter((q) => q.hasData).map((q) => q.confidence);

  const pitcherDataQuality = pitcherConfidences.length > 0 ? mean(pitcherConfidences) : 0;
  const bullpenDataQuality = bullpenConfidences.length > 0 ? mean(bullpenConfidences) : 0;
  const offenseDataQuality = offenseConfidences.length > 0 ? mean(offenseConfidences) : 0;

  const weatherDataQuality = fieldsPresentRatio([
    params.weather.temperatureC,
    params.weather.windSpeedMph,
    params.weather.humidityPct,
    params.weather.pressureHpa,
    params.weather.rainChancePct,
  ]);

  const marketDataQuality = fieldsPresentRatio([
    params.market.openingLine,
    params.market.currentLine,
    params.market.closingLine,
    params.market.publicOverPct,
    params.market.sharpOverPct,
  ]);

  const simulationQuality = mean([params.montecarlo.simulationConfidence, params.montecarlo.simulationAgreement]);

  const moduleAgreement = computeModuleAgreement(params.modules);

  const consensusStrength = clamp(Math.abs(params.consensus.finalScore - 50) * 2, 0, 100);

  const factors: ConfidenceFactor[] = [
    {
      key: "dataCompleteness",
      label: "API-/Modul-Vollständigkeit",
      score: dataCompleteness,
      weight: 0.15,
      note: `${activeModuleCount} von ${params.modules.length} Modulen mit ausreichender Datenbasis.`,
    },
    {
      key: "pitcherDataQuality",
      label: "Pitcher-Datenqualität",
      score: pitcherDataQuality,
      weight: 0.12,
      note: pitcherConfidences.length > 0 ? "Aus der Pitcher-PRO-Bewertung beider Starter." : "Keine Pitcher-PRO-Daten vorhanden.",
    },
    {
      key: "bullpenDataQuality",
      label: "Bullpen-Datenqualität",
      score: bullpenDataQuality,
      weight: 0.1,
      note: bullpenConfidences.length > 0 ? "Aus der Bullpen-PRO-Bewertung beider Teams." : "Keine Bullpen-PRO-Daten vorhanden.",
    },
    {
      key: "offenseDataQuality",
      label: "Offense-Datenqualität",
      score: offenseDataQuality,
      weight: 0.1,
      note: offenseConfidences.length > 0 ? "Aus der Offense-PRO-Bewertung beider Teams." : "Keine Offense-PRO-Daten vorhanden.",
    },
    {
      key: "weatherDataQuality",
      label: "Weather-Datenqualität",
      score: weatherDataQuality,
      weight: 0.06,
      note: "Anteil ausgefüllter Wetterfelder.",
    },
    {
      key: "marketDataQuality",
      label: "Market-Datenqualität",
      score: marketDataQuality,
      weight: 0.06,
      note: "Anteil ausgefüllter Marktfelder.",
    },
    {
      key: "simulation",
      label: "Simulationsqualität",
      score: simulationQuality,
      weight: 0.12,
      note: "Monte-Carlo-PRO-Stabilität (Split-Half) & Übereinstimmung mit dem Poisson-Modell.",
    },
    {
      key: "moduleAgreement",
      label: "Modul-Konsens",
      score: moduleAgreement,
      weight: 0.14,
      note: "Streuung der Einzel-Modul-Scores untereinander.",
    },
    {
      key: "consensusStrength",
      label: "Konsens-Stärke",
      score: consensusStrength,
      weight: 0.05,
      note: "Wie deutlich der Gesamtscore von der neutralen 50 abweicht.",
    },
  ];

  if (params.historicalAccuracyPct !== null) {
    factors.push({
      key: "historicalAccuracy",
      label: "Historical Accuracy",
      score: clamp(params.historicalAccuracyPct, 0, 100),
      weight: 0.1,
      note: "Trefferquote vergleichbarer historischer Backtests.",
    });
  }

  const baseScore = clamp(weightedAverage(factors.map((f) => ({ value: f.score, weight: f.weight }))) ?? 50, 0, 100);

  // ---------------------------------------------------------------------
  // Harte, ausschließlich verringernde Penalties.
  //
  // Diese können den Score NUR senken, nie erhöhen — genau das
  // verhindert eine künstlich hohe Confidence: selbst bei exzellenter
  // Datenqualität drückt ein unbestätigtes Lineup, eine bekannte
  // Verletzungssorge, eine fehlende Kernmodul-Datenbasis oder eine gegen
  // den Modell-Pick laufende Linienbewegung den finalen Score spürbar
  // nach unten.
  // ---------------------------------------------------------------------
  const penalties: string[] = [];
  let penaltyFactor = 1;

  if (!params.setup.lineupsConfirmed) {
    penaltyFactor *= 0.9;
    penalties.push("Lineup noch nicht final bestätigt — Confidence reduziert.");
  }

  const hasInjuryConcern = params.setup.noInjuryConcerns === false;
  if (hasInjuryConcern) {
    penaltyFactor *= 0.85;
    penalties.push("Bekannte Verletzungssorge bei einem Schlüsselspieler — Confidence reduziert.");
  }

  const pitcherModuleHasData = params.modules.find((m) => m.key === "pitcher")?.hasData ?? false;
  const offenseModuleHasData = params.modules.find((m) => m.key === "offense")?.hasData ?? false;

  if (!pitcherModuleHasData || !offenseModuleHasData) {
    penaltyFactor *= 0.8;
    penalties.push("Kernmodul (Pitcher oder Offense) ohne ausreichende Datenbasis — Confidence deutlich reduziert.");
  }

  const closingLineFactor = computeClosingLineFactor(
    params.consensus.pick,
    toNumber(params.market.openingLine),
    toNumber(params.market.currentLine)
  );

  if (closingLineFactor < 45 && params.consensus.pick !== null) {
    penaltyFactor *= 0.9;
    penalties.push("Linienbewegung läuft dem Modell-Pick entgegen — Confidence reduziert.");
  }

  const finalScore = clamp(baseScore * penaltyFactor, 0, 100);
  const confidence = finalScore / 100;
  const grade = calculatePredictionGrade(confidence);

  return {
    score: Math.round(finalScore),
    confidence,
    grade,
    factors,
    penalties,
  };
}
