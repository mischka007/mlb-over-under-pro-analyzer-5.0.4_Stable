import type {
  BallparkInput,
  BullpenQualityAssessment,
  ConflictAnalysis,
  DetectedConflict,
  EnvironmentalSignal,
  ExtremeCaseFlag,
  ModuleResult,
  MonteCarloResult,
  OffenseQualityAssessment,
  PitcherQualityAssessment,
  PoissonResult,
  PredictionIntelligenceProResult,
  SignalStrengthAssessment,
  WeatherInput,
} from "@/types";
import { clamp, toNumber } from "@/utils/math";

/**
 * Version 6.0 — Paket 3: Prediction Intelligence PRO.
 *
 * WICHTIG: Vollständig additiv. Ersetzt NICHTS Bestehendes — weder
 * `computeConsensus()`, noch Prediction Engine 2.0
 * (`@/engine/predictionEngine2`), noch die Adaptive Intelligence Engine
 * (`@/engine/adaptiveIntelligenceEngine`), noch Monte Carlo/Poisson/
 * Confidence Engine. Alle bleiben unverändert die maßgebliche Quelle
 * ihrer jeweiligen Werte.
 *
 * Schritt 5 (Prediction Calibration) ergab bei der mathematischen
 * Analyse einen echten, konkreten Befund: Die in Prediction Engine 2.0
 * eingeführte Signal-Amplifikation (Potenzfunktion je Einzelmodul,
 * GAMMA=1.35) bewertet ausschließlich, WIE STARK ein einzelnes Modul
 * von neutral abweicht — nicht, WIE VIELE Module gleichzeitig
 * übereinstimmen. Dadurch werden Spiele, bei denen viele Module
 * MODERAT, aber KONSISTENT in dieselbe Richtung zeigen, unter Umständen
 * sogar SCHWÄCHER getrennt als beim einfachen linearen Mittel — das
 * genaue Gegenteil des beabsichtigten Effekts. Numerisch nachgewiesen
 * (Beispiel: 7 Module 55–66, alle Richtung Over → linear 62.65,
 * amplifiziert nur 57.93). Schritt 2 dieser Datei behebt das gezielt
 * über einen Konsens-Breiten-Faktor, statt neue feste Regeln
 * hinzuzufügen.
 */

// ---------------------------------------------------------------------------
// Schritt 5 (echter Befund) + Schritt 2 (erweiterte Synergien, ohne Hardcodes):
// Konsens-Breiten-Korrektur
// ---------------------------------------------------------------------------

/** Ab welchem Anteil übereinstimmender Module ein Konsens-Bonus greift. */
const BREADTH_AGREEMENT_THRESHOLD = 0.6;
const MAX_BREADTH_BOOST = 0.35;
const BREADTH_SHAPING_GAMMA = 1.3;
/** Mindestanzahl aktiver Module, unterhalb derer keine belastbare Breiten-Aussage möglich ist. */
const MIN_MODULES_FOR_BREADTH = 3;

/**
 * Berechnet einen Multiplikator (≥ 1), der die bestehende Prediction-
 * Engine-2.0-Amplifikation um die Anzahl übereinstimmender Module
 * ergänzt — behebt den oben dokumentierten Befund. Keine feste Regel,
 * welche Module übereinstimmen müssen: der Faktor ergibt sich
 * ausschließlich aus dem tatsächlichen Anteil aktiver Module, die in
 * dieselbe Richtung zeigen (> 60 % Mehrheit erforderlich).
 */
function computeConsensusBreadthFactor(modules: ModuleResult[]): number {
  const active = modules.filter((m) => m.hasData);
  if (active.length < MIN_MODULES_FOR_BREADTH) return 1;

  const overCount = active.filter((m) => m.score > 52).length;
  const underCount = active.filter((m) => m.score < 48).length;
  const majorityCount = Math.max(overCount, underCount);
  const agreementRatio = majorityCount / active.length;

  if (agreementRatio <= BREADTH_AGREEMENT_THRESHOLD) return 1;

  const excess = (agreementRatio - BREADTH_AGREEMENT_THRESHOLD) / (1 - BREADTH_AGREEMENT_THRESHOLD);
  return 1 + MAX_BREADTH_BOOST * excess ** BREADTH_SHAPING_GAMMA;
}

// ---------------------------------------------------------------------------
// Schritt 2: kontinuierliches Umfeld-Signal (Offense/Pitcher/Bullpen/Ballpark/Wind/Temperatur)
// ---------------------------------------------------------------------------

/** Gewichte je Umfeld-Faktor — spiegeln die reale, bereits an anderer Stelle im Projekt etablierte relative Bedeutung wider. */
const ENVIRONMENTAL_FACTOR_WEIGHTS: Record<string, number> = {
  Offense: 0.25,
  Pitcher: 0.25,
  Bullpen: 0.15,
  Ballpark: 0.15,
  Wind: 0.12,
  Temperatur: 0.08,
};

/**
 * Verallgemeinert die in Prediction Engine 2.0 fest programmierten
 * Referenz-Synergien (starke Offense + schwacher Pitcher + ... → Over)
 * zu einer kontinuierlichen, gewichteten Umfeld-Bewertung — inklusive
 * der neu hinzugekommenen Temperatur-Dimension (wärmere Luft = weniger
 * Luftwiderstand = mehr Runs, physikalisch begründet). Kein
 * Alles-oder-Nichts-Muster mehr: jeder Faktor trägt proportional zu
 * seiner tatsächlichen Ausprägung bei, statt eine feste
 * Bedingungs-Kombination zu verlangen.
 */
export function computeEnvironmentalSignal(params: {
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weather: WeatherInput;
  ballpark: BallparkInput;
}): EnvironmentalSignal {
  const factors: { name: string; leaning: number }[] = [];

  const strongestOffense = Math.max(
    params.homeOffenseQuality.hasData ? params.homeOffenseQuality.score : 50,
    params.awayOffenseQuality.hasData ? params.awayOffenseQuality.score : 50
  );
  factors.push({ name: "Offense", leaning: clamp((strongestOffense - 50) / 30, -1, 1) });

  const weakestPitcher = Math.min(
    params.homePitcherQuality.hasData ? params.homePitcherQuality.score : 50,
    params.awayPitcherQuality.hasData ? params.awayPitcherQuality.score : 50
  );
  factors.push({ name: "Pitcher", leaning: clamp((50 - weakestPitcher) / 30, -1, 1) });

  const weakestBullpen = Math.min(
    params.homeBullpenQuality.hasData ? params.homeBullpenQuality.score : 50,
    params.awayBullpenQuality.hasData ? params.awayBullpenQuality.score : 50
  );
  factors.push({ name: "Bullpen", leaning: clamp((50 - weakestBullpen) / 30, -1, 1) });

  const runFactor = toNumber(params.ballpark.runFactor);
  if (runFactor !== null) {
    factors.push({ name: "Ballpark", leaning: clamp((runFactor - 100) / 15, -1, 1) });
  }

  const windSpeed = toNumber(params.weather.windSpeedMph);
  if (windSpeed !== null && (params.weather.windDirection === "out" || params.weather.windDirection === "in")) {
    // "cross" (Seitenwind) hat keinen eindeutigen Run-Effekt und bleibt
    // daher bewusst neutral (kein Faktor) — nur "out"/"in" haben eine
    // klare, physikalisch begründete Richtung.
    const windLeaning = params.weather.windDirection === "out" ? clamp(windSpeed / 15, 0, 1) : -clamp(windSpeed / 15, 0, 1);
    factors.push({ name: "Wind", leaning: windLeaning });
  }

  const temperature = toNumber(params.weather.temperatureC);
  if (temperature !== null) {
    factors.push({ name: "Temperatur", leaning: clamp((temperature - 20) / 15, -1, 1) });
  }

  const weightSum = factors.reduce((sum, f) => sum + (ENVIRONMENTAL_FACTOR_WEIGHTS[f.name] ?? 0.1), 0) || 1;
  const leaning = clamp(
    factors.reduce((sum, f) => sum + f.leaning * (ENVIRONMENTAL_FACTOR_WEIGHTS[f.name] ?? 0.1), 0) / weightSum,
    -1,
    1
  );

  const direction: EnvironmentalSignal["direction"] = leaning > 0.1 ? "over" : leaning < -0.1 ? "under" : "neutral";

  const contributingFactors = factors
    .filter((f) => Math.abs(f.leaning) >= 0.3)
    .sort((a, b) => Math.abs(b.leaning) - Math.abs(a.leaning))
    .map((f) => `${f.name}: Richtung ${f.leaning > 0 ? "Over" : "Under"} (${Math.abs(f.leaning * 100).toFixed(0)} % Ausprägung)`);

  return { leaning, direction, contributingFactors };
}

// ---------------------------------------------------------------------------
// Schritt 3: Konflikt-Erkennung
// ---------------------------------------------------------------------------

const MAX_CONFIDENCE_REDUCTION_PCT = 25;

/**
 * Vergleicht die Richtung mehrerer unabhängiger, bereits bestehender
 * Signalquellen (Poisson, Monte Carlo, Markt-Modul, Pitcher-Modul,
 * Offense-Modul, verstärktes Gesamtmodell) paarweise und erkennt echte
 * Richtungs-Widersprüche automatisch — genau die in der Aufgabenstellung
 * genannten Beispiele (Pitcher vs. Offense, Markt vs. Modell, Monte
 * Carlo vs. Poisson).
 */
export function detectConflicts(params: {
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  modules: ModuleResult[];
  breadthCorrectedScore: number;
}): ConflictAnalysis {
  type Opinion = { source: string; direction: "over" | "under" | "neutral" };

  const directionFromProbability = (p: number): Opinion["direction"] => (p > 0.52 ? "over" : p < 0.48 ? "under" : "neutral");
  const directionFromScore = (score: number): Opinion["direction"] => (score > 52 ? "over" : score < 48 ? "under" : "neutral");

  const opinions: Opinion[] = [
    { source: "Poisson", direction: directionFromProbability(params.poisson.overProbability) },
    { source: "Monte Carlo", direction: directionFromProbability(params.montecarlo.overProbability) },
    { source: "Gesamtmodell (verstärkt)", direction: directionFromScore(params.breadthCorrectedScore) },
  ];

  for (const key of ["market", "pitcher", "offense"] as const) {
    const module = params.modules.find((m) => m.key === key);
    if (module?.hasData) {
      const label = key === "market" ? "Markt" : key === "pitcher" ? "Pitcher" : "Offense";
      opinions.push({ source: label, direction: directionFromScore(module.score) });
    }
  }

  const directional = opinions.filter((o) => o.direction !== "neutral");
  const conflicts: DetectedConflict[] = [];

  for (let i = 0; i < directional.length; i++) {
    for (let j = i + 1; j < directional.length; j++) {
      if (directional[i].direction !== directional[j].direction) {
        conflicts.push({
          sourceA: directional[i].source,
          sourceB: directional[j].source,
          description: `${directional[i].source} zeigt ${directional[i].direction === "over" ? "Over" : "Under"}, ${directional[j].source} zeigt ${directional[j].direction === "over" ? "Over" : "Under"}.`,
        });
      }
    }
  }

  const possiblePairs = directional.length >= 2 ? (directional.length * (directional.length - 1)) / 2 : 0;
  const conflictSeverity = possiblePairs > 0 ? (conflicts.length / possiblePairs) * 100 : 0;
  const confidenceReductionPct = clamp(conflictSeverity * 0.3, 0, MAX_CONFIDENCE_REDUCTION_PCT);

  return { conflicts, conflictSeverity, confidenceReductionPct };
}

// ---------------------------------------------------------------------------
// Schritt 4: Signal-Stärke
// ---------------------------------------------------------------------------

/**
 * Klassifiziert die Gesamt-Signal-Stärke dieser Prognose in vier Stufen
 * (schwach/mittel/stark/extrem stark) — kombiniert die Abweichung des
 * (bereits konsens-breiten-korrigierten) Scores von neutral, das
 * Umfeld-Signal sowie eine Abschwächung durch erkannte Konflikte.
 */
export function computeSignalStrength(params: {
  breadthCorrectedScore: number;
  environmentalLeaning: number;
  conflictSeverity: number;
}): SignalStrengthAssessment {
  const scoreDeviation = clamp(Math.abs(params.breadthCorrectedScore - 50) / 50, 0, 1);
  const environmentalMagnitude = clamp(Math.abs(params.environmentalLeaning), 0, 1);
  const conflictPenalty = clamp(params.conflictSeverity / 100, 0, 1);

  const rawStrength = clamp((scoreDeviation * 0.6 + environmentalMagnitude * 0.4) * (1 - conflictPenalty * 0.5), 0, 1);
  const score = Math.round(rawStrength * 100);

  const label: SignalStrengthAssessment["label"] = score >= 70 ? "extrem stark" : score >= 45 ? "stark" : score >= 20 ? "mittel" : "schwach";

  const contributingFactors = [
    `Score-Abweichung von neutral: ${(scoreDeviation * 100).toFixed(0)} %`,
    `Umfeld-Signal-Ausprägung: ${(environmentalMagnitude * 100).toFixed(0)} %`,
    conflictPenalty > 0 ? `Konflikte reduzieren die Stärke um ${(conflictPenalty * 50).toFixed(0)} %` : "keine Konflikte erkannt",
  ];

  return { score, label, contributingFactors };
}

// ---------------------------------------------------------------------------
// Schritt 6: Extremfall-Erkennung
// ---------------------------------------------------------------------------

/**
 * Erkennt automatisch Sondersituationen (extrem gutes Over-/Under-Spiel,
 * hohes Risiko, schlechte Datenlage, ungewöhnliche Spielsituation) —
 * ausschließlich aus bereits berechneten Werten, keine neue Datenquelle.
 * Rein interne Information, keine UI-Änderung.
 */
export function detectExtremeCases(params: {
  breadthCorrectedScore: number;
  linearScore: number;
  signalStrength: SignalStrengthAssessment;
  conflictAnalysis: ConflictAnalysis;
  dataQualityPct: number;
}): ExtremeCaseFlag[] {
  const flags: ExtremeCaseFlag[] = [];

  if (params.signalStrength.label === "extrem stark" && params.breadthCorrectedScore > 65) {
    flags.push({
      category: "extremes Over-Spiel",
      description: `Sehr starkes, konsistentes Over-Signal (verstärkter Score ${params.breadthCorrectedScore.toFixed(1)}/100).`,
    });
  }

  if (params.signalStrength.label === "extrem stark" && params.breadthCorrectedScore < 35) {
    flags.push({
      category: "extremes Under-Spiel",
      description: `Sehr starkes, konsistentes Under-Signal (verstärkter Score ${params.breadthCorrectedScore.toFixed(1)}/100).`,
    });
  }

  if (params.conflictAnalysis.conflictSeverity >= 50) {
    flags.push({
      category: "hohes Risiko",
      description: `Hohe Widerspruchsrate zwischen den Signalquellen (${params.conflictAnalysis.conflictSeverity.toFixed(0)} %).`,
    });
  }

  if (params.dataQualityPct < 50) {
    flags.push({
      category: "schlechte Datenlage",
      description: `Datenqualität unterdurchschnittlich (${params.dataQualityPct.toFixed(0)}/100) — Prognose entsprechend vorsichtig behandeln.`,
    });
  }

  if (Math.abs(params.breadthCorrectedScore - params.linearScore) >= 15) {
    flags.push({
      category: "ungewöhnliche Spielsituation",
      description: "Deutliche Abweichung zwischen linearer und verstärkter Einschätzung — die Modul-Kombination weicht stark vom Normalfall ab.",
    });
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Version 6.0 (Paket 5), Punkt 4: Data-Quality-/Lineup-Quality-bewusste Confidence
// ---------------------------------------------------------------------------

/** Unterer/oberer Rand des Dämpfungsfaktors — bewusst NIE über 1.0 (keine künstliche Verstärkung), nur Reduktion bei niedriger Datenqualität. */
const MIN_QUALITY_CONFIDENCE_FACTOR = 0.85;
const MAX_QUALITY_CONFIDENCE_FACTOR = 1.0;

/**
 * Dämpft die bestehende, nicht-lineare Confidence (Prediction Engine
 * 2.0, unverändert als Basis übernommen) anhand der Datenqualität
 * (`PredictionSummary.dataQualityPct`, bereits bestehend) sowie —
 * sofern verfügbar — dem neuen Lineup Quality Score. Rein additiv,
 * keine starre Addition: ein gewichteter Kombinations-Score steuert
 * einen Faktor zwischen 0,85 (niedrige Qualität) und 1,0 (hohe
 * Qualität, keine Verstärkung) — "Markt/Daten dürfen niemals allein
 * entscheiden, aber schlechte Datenlage reduziert automatisch die
 * Zuverlässigkeit".
 */
function computeQualityAdjustedConfidence(baseConfidence: number, dataQualityPct: number, lineupQualityScore: number | null): number {
  const combinedQuality = lineupQualityScore !== null ? dataQualityPct * 0.6 + lineupQualityScore * 0.4 : dataQualityPct;

  const factor =
    MIN_QUALITY_CONFIDENCE_FACTOR + (MAX_QUALITY_CONFIDENCE_FACTOR - MIN_QUALITY_CONFIDENCE_FACTOR) * clamp(combinedQuality / 100, 0, 1);

  return clamp(baseConfidence * factor, 0, 1);
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export function computePredictionIntelligencePro(params: {
  modules: ModuleResult[];
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weather: WeatherInput;
  ballpark: BallparkInput;
  /** Bereits vorhandener, nicht-linear verstärkter Score aus Prediction Engine 2.0 (`PredictionEngine2Result.enhancedScore`). */
  enhancedScore: number;
  /** Bereits vorhandener linearer Score aus dem bestehenden Konsens (`ConsensusResult.finalScore`). */
  linearScore: number;
  /** Bereits vorhandene Datenqualität (`PredictionSummary.dataQualityPct`). */
  dataQualityPct: number;
  /** Bereits vorhandene, nicht-lineare Confidence aus Prediction Engine 2.0 (`PredictionEngine2Result.nonLinearConfidence`). */
  nonLinearConfidence: number;
  /** Version 6.0 (Paket 5): destillierter Lineup Quality Score, `null` falls Lineups noch nicht verfügbar. */
  lineupQualityScore: number | null;
}): PredictionIntelligenceProResult {
  const consensusBreadthFactor = computeConsensusBreadthFactor(params.modules);
  const breadthCorrectedScore = clamp(50 + (params.enhancedScore - 50) * consensusBreadthFactor, 0, 100);

  const environmentalSignal = computeEnvironmentalSignal(params);

  const conflictAnalysis = detectConflicts({
    poisson: params.poisson,
    montecarlo: params.montecarlo,
    modules: params.modules,
    breadthCorrectedScore,
  });

  const signalStrength = computeSignalStrength({
    breadthCorrectedScore,
    environmentalLeaning: environmentalSignal.leaning,
    conflictSeverity: conflictAnalysis.conflictSeverity,
  });

  const extremeCases = detectExtremeCases({
    breadthCorrectedScore,
    linearScore: params.linearScore,
    signalStrength,
    conflictAnalysis,
    dataQualityPct: params.dataQualityPct,
  });

  const qualityAdjustedConfidence = computeQualityAdjustedConfidence(params.nonLinearConfidence, params.dataQualityPct, params.lineupQualityScore);

  const notes: string[] = [
    `Konsens-Breiten-Faktor: ${consensusBreadthFactor.toFixed(2)}× (Score ${params.enhancedScore.toFixed(1)} → ${breadthCorrectedScore.toFixed(1)}).`,
    `Umfeld-Signal: ${environmentalSignal.direction === "neutral" ? "neutral" : environmentalSignal.direction === "over" ? "Richtung Over" : "Richtung Under"} (${(Math.abs(environmentalSignal.leaning) * 100).toFixed(0)} % Ausprägung).`,
    conflictAnalysis.conflicts.length > 0
      ? `${conflictAnalysis.conflicts.length} Konflikt(e) zwischen Signalquellen erkannt — Confidence-Reduktion ${conflictAnalysis.confidenceReductionPct.toFixed(1)} %.`
      : "Keine Konflikte zwischen den Signalquellen erkannt.",
    `Signal-Stärke: ${signalStrength.label} (${signalStrength.score}/100).`,
    extremeCases.length > 0 ? `${extremeCases.length} Sondersituation(en) erkannt.` : "Keine Sondersituation erkannt.",
    `Qualitätsbereinigte Confidence: ${(params.nonLinearConfidence * 100).toFixed(1)} % → ${(qualityAdjustedConfidence * 100).toFixed(1)} % (Datenqualität ${params.dataQualityPct.toFixed(0)}/100${params.lineupQualityScore !== null ? `, Lineup-Qualität ${params.lineupQualityScore}/100` : ", Lineup-Qualität nicht verfügbar"}).`,
  ];

  return {
    breadthCorrectedScore,
    consensusBreadthFactor,
    environmentalSignal,
    conflictAnalysis,
    signalStrength,
    extremeCases,
    qualityAdjustedConfidence,
    notes,
  };
}
