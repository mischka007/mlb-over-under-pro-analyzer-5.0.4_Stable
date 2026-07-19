import type {
  BallparkInput,
  BullpenQualityAssessment,
  ConfidenceBreakdown,
  ConsensusResult,
  ModuleResult,
  ModuleSynergy,
  OffenseQualityAssessment,
  PitcherQualityAssessment,
  PoissonResult,
  PredictionEngine2Result,
  WeatherInput,
} from "@/types";
import { clamp, toNumber } from "@/utils/math";

/**
 * Version 6.0 — Paket 1: Prediction Engine 2.0 + Confidence Engine 2.0.
 *
 * WICHTIG: Dies ist eine vollständig ADDITIVE Zweitberechnung. Sie
 * ersetzt NICHTS Bestehendes:
 *
 *  - `computeConsensus()` (`@/utils/consensus`) bleibt unverändert die
 *    Quelle von `ConsensusResult.finalScore`/`.pick`/`.confidence`, die
 *    weiterhin vom Premium Filter, dem Dashboard und allen bisherigen
 *    Verbrauchern genutzt wird.
 *  - `computeConfidenceBreakdown()` (`@/engine/confidenceEngine`) bleibt
 *    unverändert die Quelle der linearen Basis-Confidence.
 *  - Monte Carlo, Poisson, Dynamic Weighting, Historical Calibration,
 *    Backtesting, Model Optimization, Decision Support — alle
 *    unverändert, nur als Eingaben bzw. zum Abgleich genutzt.
 *
 * Diese Datei kombiniert deren bereits vorhandene Ergebnisse lediglich
 * NICHT-LINEAR neu, erkennt Modul-Synergien und liefert eine zweite,
 * nicht-linear geformte Confidence — alles zusätzlich zu den
 * bestehenden Werten, nicht anstelle davon.
 */

// ---------------------------------------------------------------------------
// Schritt 2: nicht-lineare Modul-Kombination
// ---------------------------------------------------------------------------

/**
 * Verstärkungsfaktor (> 1) für die Amplifikation der Modul-Abweichung
 * von neutral (50). Bei GAMMA > 1 werden starke Abweichungen (nahe an
 * 0 oder 100) nahezu unverändert beibehalten, während schwache
 * Abweichungen (nahe 50) überproportional gedämpft werden — das
 * erzeugt genau die geforderte "stärkere Trennung zwischen starken und
 * schwachen Signalen" ohne lineare Durchschnittsbildung.
 */
const AMPLIFICATION_GAMMA = 1.35;

/**
 * Kombiniert die Modul-Scores nicht-linear: statt eines einfachen
 * gewichteten Mittels (wie in `computeConsensus()`) wird die Abweichung
 * jedes Moduls von neutral (50) zunächst durch eine Potenzfunktion
 * geformt (siehe `AMPLIFICATION_GAMMA`), bevor sie gewichtet summiert
 * wird. Ein Modul mit Score 52 (schwaches Signal) trägt dadurch
 * deutlich weniger zum Endergebnis bei als linear, während ein Modul
 * mit Score 90 (starkes Signal) nahezu seine volle Abweichung behält.
 */
function computeNonLinearCombination(modules: ModuleResult[]): { enhancedScore: number; amplificationDelta: number; linearScore: number } {
  const active = modules.filter((m) => m.hasData && m.weight > 0);
  const weightSum = active.reduce((sum, m) => sum + m.weight, 0);

  if (active.length === 0 || weightSum === 0) {
    return { enhancedScore: 50, amplificationDelta: 0, linearScore: 50 };
  }

  const linearScore = clamp(
    active.reduce((sum, m) => sum + m.score * (m.weight / weightSum), 0),
    0,
    100
  );

  const amplifiedSum = active.reduce((sum, m) => {
    const deviation = m.score - 50;
    const shaped = Math.sign(deviation) * 50 * (Math.abs(deviation) / 50) ** AMPLIFICATION_GAMMA;
    return sum + shaped * (m.weight / weightSum);
  }, 0);

  const enhancedScoreBeforeSynergies = clamp(50 + amplifiedSum, 0, 100);

  return {
    enhancedScore: enhancedScoreBeforeSynergies,
    amplificationDelta: enhancedScoreBeforeSynergies - linearScore,
    linearScore,
  };
}

// ---------------------------------------------------------------------------
// Schritt 3: Modul-Synergien
// ---------------------------------------------------------------------------

/** Schwellenwerte für die Synergie-Erkennung — bewusst konsistent mit den bereits bestehenden Dynamic-Weighting-Schwellen (`@/engine/predictionEngine`) gewählt. */
const STRONG_OFFENSE_THRESHOLD = 65;
const WEAK_PITCHER_THRESHOLD = 40;
const WEAK_BULLPEN_THRESHOLD = 40;
const HITTER_FRIENDLY_PARK_THRESHOLD = 108;
const SUPPORTIVE_WIND_MPH_THRESHOLD = 8;

const ACE_PITCHER_THRESHOLD = 78;
const ELITE_BULLPEN_THRESHOLD = 80;
const PITCHER_FRIENDLY_PARK_THRESHOLD = 92;

/** Maximaler Betrag, um den eine einzelne Synergie den Score verschieben darf — verhindert künstliche Übertreibung (Schritt 6). */
const MAX_SYNERGY_BONUS = 10;

/**
 * Erkennt die beiden explizit geforderten Referenz-Synergien
 * (starke Offense + schwacher Pitcher + schwacher Bullpen +
 * Hitter-Park + Rückenwind → deutlich Richtung Over; Ass-Pitcher +
 * Elite-Bullpen + Pitcher-Park + Gegenwind → deutlich Richtung Under).
 * Bewertet ausschließlich bereits vorhandene, real berechnete
 * Qualitäts-/Modul-Werte — keine neue Datenquelle, keine Schätzung.
 * Ein Bonus wird nur angewendet, wenn ALLE Bedingungen einer Synergie
 * gleichzeitig erfüllt sind (keine Teil-Treffer), um unbegründete
 * Boosts zu vermeiden.
 */
function detectModuleSynergies(params: {
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weather: WeatherInput;
  ballpark: BallparkInput;
}): ModuleSynergy[] {
  const synergies: ModuleSynergy[] = [];

  const strongestOffense = Math.max(
    params.homeOffenseQuality.hasData ? params.homeOffenseQuality.score : 0,
    params.awayOffenseQuality.hasData ? params.awayOffenseQuality.score : 0
  );
  const weakestPitcher = Math.min(
    params.homePitcherQuality.hasData ? params.homePitcherQuality.score : 100,
    params.awayPitcherQuality.hasData ? params.awayPitcherQuality.score : 100
  );
  const weakestBullpen = Math.min(
    params.homeBullpenQuality.hasData ? params.homeBullpenQuality.score : 100,
    params.awayBullpenQuality.hasData ? params.awayBullpenQuality.score : 100
  );
  const strongestPitcher = Math.max(
    params.homePitcherQuality.hasData ? params.homePitcherQuality.score : 0,
    params.awayPitcherQuality.hasData ? params.awayPitcherQuality.score : 0
  );
  const strongestBullpen = Math.max(
    params.homeBullpenQuality.hasData ? params.homeBullpenQuality.score : 0,
    params.awayBullpenQuality.hasData ? params.awayBullpenQuality.score : 0
  );

  const runFactor = toNumber(params.ballpark.runFactor);
  const windSpeed = toNumber(params.weather.windSpeedMph);

  const hasOverSynergy =
    strongestOffense >= STRONG_OFFENSE_THRESHOLD &&
    weakestPitcher <= WEAK_PITCHER_THRESHOLD &&
    weakestBullpen <= WEAK_BULLPEN_THRESHOLD &&
    runFactor !== null &&
    runFactor >= HITTER_FRIENDLY_PARK_THRESHOLD &&
    params.weather.windDirection === "out" &&
    windSpeed !== null &&
    windSpeed >= SUPPORTIVE_WIND_MPH_THRESHOLD;

  if (hasOverSynergy) {
    synergies.push({
      name: "Offense-Explosion",
      direction: "over",
      description:
        "Starke Offense trifft auf schwachen Starter, schwachen Bullpen, einen Hitter-Park und Rückenwind — die Kombination spricht deutlich stärker für viele Runs, als es die Einzelmodule allein ausdrücken.",
      bonus: MAX_SYNERGY_BONUS,
    });
  }

  const hasUnderSynergy =
    strongestPitcher >= ACE_PITCHER_THRESHOLD &&
    strongestBullpen >= ELITE_BULLPEN_THRESHOLD &&
    runFactor !== null &&
    runFactor <= PITCHER_FRIENDLY_PARK_THRESHOLD &&
    params.weather.windDirection === "in" &&
    windSpeed !== null &&
    windSpeed >= SUPPORTIVE_WIND_MPH_THRESHOLD;

  if (hasUnderSynergy) {
    synergies.push({
      name: "Pitcher-Dominanz",
      direction: "under",
      description:
        "Ass-Pitcher trifft auf Elite-Bullpen, einen Pitcher-Park und Gegenwind — die Kombination spricht deutlich stärker für wenige Runs, als es die Einzelmodule allein ausdrücken.",
      bonus: -MAX_SYNERGY_BONUS,
    });
  }

  return synergies;
}

// ---------------------------------------------------------------------------
// Schritt 4: Confidence Engine 2.0 — nicht-lineare Confidence-Formung
// ---------------------------------------------------------------------------

/** Untere/obere Grenze des nicht-linearen Confidence-Anpassungsfaktors — verhindert Extremwerte (Schritt 6: "nicht aggressiver"). */
const MIN_CONFIDENCE_ADJUSTMENT_FACTOR = 0.75;
const MAX_CONFIDENCE_ADJUSTMENT_FACTOR = 1.15;

/** Verstärkungsfaktor der Übereinstimmungs-Formung — >1 macht die Kurve konvex (überproportionale Wirkung bei hoher Übereinstimmung). */
const AGREEMENT_SHAPING_GAMMA = 1.8;

/**
 * Berechnet den gewichteten Richtungs-Übereinstimmungsgrad aller
 * aktiven Module: -1 (alle Module widersprechen sich exakt
 * ausgleichend) … 0 (keine klare Tendenz) … 1 (alle Module zeigen in
 * dieselbe Richtung). Module mit Score sehr nahe 50 (± 2) gelten als
 * neutral und fließen nicht in die Richtungsbewertung ein.
 */
function computeModuleAgreementRatio(modules: ModuleResult[]): number {
  const active = modules.filter((m) => m.hasData && m.weight > 0);
  const weightSum = active.reduce((sum, m) => sum + m.weight, 0);
  if (active.length < 2 || weightSum === 0) return 0;

  const netDirection = active.reduce((sum, m) => {
    const direction = m.score > 52 ? 1 : m.score < 48 ? -1 : 0;
    return sum + direction * (m.weight / weightSum);
  }, 0);

  return clamp(netDirection, -1, 1);
}

/**
 * Formt die bestehende, lineare Confidence (`ConfidenceBreakdown.confidence`,
 * unverändert als Basis übernommen — Data Quality/Simulation/Backtesting
 * fließen dadurch weiterhin vollständig ein) nicht-linear: bei hoher
 * Modul-Übereinstimmung wird die Confidence überproportional erhöht, bei
 * starkem Widerspruch überproportional reduziert. Der Anpassungsfaktor
 * ist auf [0.75, 1.15] geklemmt, damit die Wirkung spürbar, aber nicht
 * aggressiv/künstlich ist (Schritt 6).
 */
function applyNonLinearConfidenceShaping(baseConfidence: number, agreementRatio: number): number {
  const magnitude = Math.abs(agreementRatio);
  const shapedMagnitude = magnitude ** AGREEMENT_SHAPING_GAMMA;
  const factor =
    agreementRatio >= 0
      ? 1 + (MAX_CONFIDENCE_ADJUSTMENT_FACTOR - 1) * shapedMagnitude
      : 1 - (1 - MIN_CONFIDENCE_ADJUSTMENT_FACTOR) * shapedMagnitude;

  return clamp(baseConfidence * factor, 0, 1);
}

// ---------------------------------------------------------------------------
// Schritt 6: Fair Probability — Plausibilitäts-Abgleich mit dem Poisson-Modell
// ---------------------------------------------------------------------------

function buildFairProbabilityNote(enhancedScore: number, poisson: PoissonResult): string {
  const enhancedDirection = enhancedScore > 51 ? "over" : enhancedScore < 49 ? "under" : null;
  const poissonDirection = poisson.overProbability > 0.52 ? "over" : poisson.overProbability < 0.48 ? "under" : null;

  if (enhancedDirection === null || poissonDirection === null) {
    return "Kein klares Signal auf einer oder beiden Seiten — Prognose bleibt nahe 50 %, wie bei ausgeglichenen Spielen erwartet.";
  }

  if (enhancedDirection === poissonDirection) {
    return "Nicht-lineares Modell und Poisson-Modell stimmen in der Richtung überein — die Verstärkung ist plausibel kalibriert.";
  }

  return "Nicht-lineares Modell und Poisson-Modell weichen in der Richtung voneinander ab — erhöhte Vorsicht bei dieser Prognose empfohlen.";
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Berechnet das vollständige Prediction-Engine-2.0-/Confidence-Engine-
 * 2.0-Ergebnis. `historicalValidationAccuracyPct` ist optional (Schritt 5:
 * nutzt die bestehende Historical-Calibration-PRO-Engine, sofern
 * verfügbar — bei einer Live-Einzelspiel-Analyse ohne vorherigen
 * Backtest-Lauf bewusst `null` statt eines erfundenen Werts, identisch
 * zum bereits etablierten Muster in `confidenceEngine.ts`).
 */
export function computePredictionEngine2(params: {
  modules: ModuleResult[];
  consensus: ConsensusResult;
  confidenceBreakdown: ConfidenceBreakdown;
  poisson: PoissonResult;
  homePitcherQuality: PitcherQualityAssessment;
  awayPitcherQuality: PitcherQualityAssessment;
  homeBullpenQuality: BullpenQualityAssessment;
  awayBullpenQuality: BullpenQualityAssessment;
  homeOffenseQuality: OffenseQualityAssessment;
  awayOffenseQuality: OffenseQualityAssessment;
  weather: WeatherInput;
  ballpark: BallparkInput;
  historicalValidationAccuracyPct: number | null;
}): PredictionEngine2Result {
  const { enhancedScore: baseEnhancedScore, amplificationDelta, linearScore } = computeNonLinearCombination(params.modules);

  const synergies = detectModuleSynergies(params);
  const synergyBonus = synergies.reduce((sum, s) => sum + s.bonus, 0);
  const enhancedScore = clamp(baseEnhancedScore + synergyBonus, 0, 100);

  const moduleAgreementRatio = computeModuleAgreementRatio(params.modules);
  const nonLinearConfidence = applyNonLinearConfidenceShaping(params.confidenceBreakdown.confidence, moduleAgreementRatio);

  const notes: string[] = [
    `Lineare Kombination (bestehend, unverändert): ${linearScore.toFixed(1)}/100.`,
    `Nicht-lineare Amplifikation (Schritt 2): ${amplificationDelta >= 0 ? "+" : ""}${amplificationDelta.toFixed(1)} Punkte.`,
  ];

  if (synergies.length > 0) {
    for (const synergy of synergies) {
      notes.push(`Synergie erkannt: ${synergy.name} (${synergy.bonus >= 0 ? "+" : ""}${synergy.bonus} Punkte).`);
    }
  } else {
    notes.push("Keine der beiden Referenz-Synergien vollständig erfüllt — keine Synergie-Anpassung angewendet.");
  }

  if (params.historicalValidationAccuracyPct !== null) {
    notes.push(`Historische Validierungs-Trefferquote verfügbar: ${params.historicalValidationAccuracyPct.toFixed(1)} %.`);
  } else {
    notes.push("Keine historische Kalibrierung für diese Live-Analyse verfügbar (kein vorheriger Backtest-Lauf).");
  }

  return {
    enhancedScore,
    linearScore,
    amplificationDelta,
    synergies,
    synergyBonus,
    nonLinearConfidence,
    linearConfidence: params.confidenceBreakdown.confidence,
    moduleAgreementRatio,
    calibrationApplied: params.historicalValidationAccuracyPct !== null,
    fairProbabilityNote: buildFairProbabilityNote(enhancedScore, params.poisson),
    notes,
  };
}
