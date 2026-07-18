import type {
  AdvancedPrediction,
  AnalyzerState,
  BankrollResult,
  BullpenQualityAssessment,
  ConsensusResult,
  ModuleResult,
  ModuleWeightMultipliers,
  MonteCarloResult,
  OffenseQualityAssessment,
  PoissonResult,
  PremiumBetAssessment,
  PremiumFilterResult,
} from "@/types";
import {
  applyBullpenQualityWeighting,
  applyOffenseQualityWeighting,
  assessBullpenQuality,
  assessOffenseQuality,
  assessPitcherQuality,
  bullpenExpectedRuns,
  offenseExpectedRuns,
  pitcherExpectedRunsAllowed,
  scoreBallpark,
  scoreBullpen,
  scoreH2H,
  scoreMarket,
  scoreOffense,
  scorePitcher,
  scoreTeamForm,
  scoreWeather,
} from "@/utils/scoring";
import { computeConsensus, evaluatePremiumFilter } from "@/utils/consensus";
import { computePoissonModel } from "@/utils/poisson";
import { runMonteCarloSimulation } from "@/utils/montecarlo";
import { computeBankrollResult } from "@/utils/kelly";
import {
  applyCalibrationMultipliers,
  applyDynamicWeighting,
  computeAdvancedPrediction,
  type DynamicWeightingContext,
} from "@/engine/predictionEngine";
import { assessPremiumBet } from "@/engine/premiumBetEngine";
import { toNumber, weightedAverage } from "@/utils/math";

export interface FullAnalysis {
  modules: ModuleResult[];
  consensus: ConsensusResult;
  poisson: PoissonResult;
  montecarlo: MonteCarloResult;
  bankroll: BankrollResult;
  premiumFilter: PremiumFilterResult;
  baselineRuns: number;
  finalExpectedRuns: number;
  /**
   * Bullpen PRO: individuelle Qualitäts- & Confidence-Bewertung beider
   * Team-Bullpens (unabhängig vom Matchup-Score). Fließt bereits über
   * `applyBullpenQualityWeighting()` in die Gewichtung des Bullpen-Moduls
   * ein (siehe Schritt 1) und wird hier zusätzlich für die UI/Backtesting-
   * Auswertung bereitgestellt.
   */
  bullpenQuality: {
    home: BullpenQualityAssessment;
    away: BullpenQualityAssessment;
  };
  /**
   * Offense PRO: individuelle Qualitäts- & Confidence-Bewertung beider
   * Team-Offenses (unabhängig vom Matchup-Score). Fließt bereits über
   * `applyOffenseQualityWeighting()` in die Gewichtung des Offense-Moduls
   * ein (siehe Schritt 1) und wird hier zusätzlich für die UI/Backtesting-
   * Auswertung bereitgestellt.
   */
  offenseQuality: {
    home: OffenseQualityAssessment;
    away: OffenseQualityAssessment;
  };
  /**
   * Prediction Engine PRO: dynamisch gewichtete erweiterte Prognose
   * (Expected Runs Home/Away, Probability Over/Under, Premium-/Risk-Score,
   * Edges, Fair/Model Total, dynamische Gewichtungs- und
   * Confidence-Anpassungen). Siehe `@/engine/predictionEngine`.
   */
  advancedPrediction: AdvancedPrediction;
  /**
   * Premium Bet Engine PRO: sechsstufige Bewertung (No Bet → Elite Bet)
   * auf Basis von Edge, Confidence, Consensus, Simulation, Historical
   * Accuracy, Market, Closing Line, Expected Value und Bookmaker Edge.
   * Siehe `@/engine/premiumBetEngine`.
   */
  premiumBetAssessment: PremiumBetAssessment;
}

/**
 * Führt die vollständige Analyse-Pipeline aus:
 *
 *  1. Berechnet die additiven "Kern"-Module (Form, Pitcher, Bullpen, Offense, H2H)
 *  2. Bildet daraus eine gewichtete Baseline-Run-Erwartung
 *  3. Wendet Wetter- und Ballpark-Multiplikatoren auf die Baseline an
 *  4. Berechnet Poisson- und Monte-Carlo-Modell auf Basis der finalen Erwartung
 *  5. Wendet die dynamische Gewichtung (Prediction Engine PRO) an und berechnet
 *     darauf den gewichteten Konsens-Score über alle Module
 *  6. Berechnet Bankroll/Kelly auf Basis der Poisson-Wahrscheinlichkeit der
 *     vom Konsens gewählten Seite
 *  7. Prüft den Premium-Filter
 *  8. Berechnet die erweiterte Prognose (Expected Runs Home/Away, Probability
 *     Over/Under, Premium-/Risk-Score, Edges, Fair/Model Total) inkl. der
 *     vollständigen Confidence-Engine-PRO-Bewertung (Datenqualität,
 *     Simulationsqualität, Modul-Konsens, Penalties)
 *  9. Berechnet die Premium-Bet-Engine-PRO-Bewertung (sechsstufiges
 *     Bet-Tier: No Bet → Lean → Good Bet → Strong Bet → Premium Bet → Elite Bet)
 *
 * @param calibrationMultipliers  Optionale, aus `runHistoricalCalibration()`
 *   (Historical Calibration PRO, siehe `@/backtesting/historicalCalibration`)
 *   gewonnene Gewichtungs-Multiplikatoren je Modul. Werden — sofern
 *   übergeben — zusätzlich zur dynamischen Gewichtung (Schritt 5)
 *   angewendet. Ohne Angabe (Standard) verhält sich die Funktion exakt
 *   wie zuvor — vollständig abwärtskompatibel.
 */
export function computeFullAnalysis(state: AnalyzerState, calibrationMultipliers?: ModuleWeightMultipliers): FullAnalysis {
  const line = toNumber(state.setup.line) ?? 8.5;

  // Schritt 1: additive Kern-Module
  const formResult = scoreTeamForm(state.home.form, state.away.form);
  const pitcherResult = scorePitcher(state.home.pitcher, state.away.pitcher);

  // Bullpen PRO: individuelle Qualitäts-/Confidence-Bewertung je Team-Bullpen,
  // anschließend genutzt, um die Gewichtung des Bullpen-Moduls im
  // Gesamtmodell dynamisch an die Verlässlichkeit der Bullpen-Datenbasis
  // anzupassen (siehe `applyBullpenQualityWeighting` in `@/utils/scoring`).
  const homeBullpenQuality = assessBullpenQuality(state.home.bullpen);
  const awayBullpenQuality = assessBullpenQuality(state.away.bullpen);
  const bullpenResult = applyBullpenQualityWeighting(
    scoreBullpen(state.home.bullpen, state.away.bullpen),
    homeBullpenQuality,
    awayBullpenQuality
  );

  // Offense PRO: individuelle Qualitäts-/Confidence-Bewertung je Team-Offense,
  // anschließend genutzt, um die Gewichtung des Offense-Moduls im
  // Gesamtmodell dynamisch an die Verlässlichkeit der Offense-Datenbasis
  // anzupassen (siehe `applyOffenseQualityWeighting` in `@/utils/scoring`).
  const homeOffenseQuality = assessOffenseQuality(state.home.offense);
  const awayOffenseQuality = assessOffenseQuality(state.away.offense);
  const offenseResult = applyOffenseQualityWeighting(
    scoreOffense(state.home.offense, state.away.offense),
    homeOffenseQuality,
    awayOffenseQuality
  );

  // Starting Pitcher PRO: individuelle Qualitäts-/Confidence-Bewertung je
  // Team-Pitcher. Wird sowohl für die "Run Environment"-Varianzquellen der
  // Monte-Carlo-PRO-Simulation (Schritt 4) als auch für die dynamische
  // Gewichtung (Schritt 5, z. B. "Ass-vs-Ass") genutzt.
  const homePitcherQuality = assessPitcherQuality(state.home.pitcher, state.away.offense);
  const awayPitcherQuality = assessPitcherQuality(state.away.pitcher, state.home.offense);

  const h2hResult = scoreH2H(state.h2h);

  // Schritt 2: gewichtete Baseline aus den additiven Modulen (nur mit Daten)
  const baselineRuns =
    weightedAverage([
      { value: formResult.hasData ? formResult.expectedRuns : null, weight: formResult.weight },
      { value: pitcherResult.hasData ? pitcherResult.expectedRuns : null, weight: pitcherResult.weight },
      { value: bullpenResult.hasData ? bullpenResult.expectedRuns : null, weight: bullpenResult.weight },
      { value: offenseResult.hasData ? offenseResult.expectedRuns : null, weight: offenseResult.weight },
      { value: h2hResult.hasData ? h2hResult.expectedRuns : null, weight: h2hResult.weight },
    ]) ?? 8.5; // Liga-typischer Default, falls noch gar keine Daten vorhanden sind

  // Schritt 3: Wetter- und Ballpark-Module wirken als Multiplikator auf die Baseline
  const weatherResult = scoreWeather(state.weather, baselineRuns);
  const ballparkResult = scoreBallpark(state.ballpark, baselineRuns);
  const marketResult = scoreMarket(state.market);

  const weatherMultiplier = weatherResult.hasData && weatherResult.expectedRuns !== null ? weatherResult.expectedRuns / baselineRuns : 1;
  const ballparkMultiplier = ballparkResult.hasData && ballparkResult.expectedRuns !== null ? ballparkResult.expectedRuns / baselineRuns : 1;
  const finalExpectedRuns = baselineRuns * weatherMultiplier * ballparkMultiplier;

  const modules: ModuleResult[] = [
    formResult,
    pitcherResult,
    bullpenResult,
    offenseResult,
    weatherResult,
    ballparkResult,
    h2hResult,
    marketResult,
  ];

  // Schritt 4: Poisson- und Monte-Carlo-Modell
  const poisson = computePoissonModel(finalExpectedRuns, line);
  const rainChance = toNumber(state.weather.rainChancePct);
  const varianceBoost = rainChance !== null && rainChance > 40 ? 1 : 0;

  // Monte Carlo PRO: "Run Environment" — zusätzliche Streuung je Ursprungs-
  // Modul, abgeleitet aus Datenvollständigkeit/Confidence der jeweiligen
  // PRO-Bewertungen sowie Extremwerten bei Wetter/Ballpark. Fehlt einem
  // Modul die Datenbasis komplett oder ist die Confidence niedrig, ist die
  // Prognose unsicherer — die Simulation bildet das über eine breitere
  // Streuung ab, statt eine falsche Präzision vorzutäuschen.
  const runFactorValue = toNumber(state.ballpark.runFactor);
  const varianceComponents = {
    pitcher: !pitcherResult.hasData
      ? 0.8
      : (homePitcherQuality.hasData && homePitcherQuality.confidence < 50) || (awayPitcherQuality.hasData && awayPitcherQuality.confidence < 50)
        ? 0.4
        : 0,
    bullpen: !bullpenResult.hasData
      ? 0.6
      : (homeBullpenQuality.hasData && homeBullpenQuality.confidence < 50) || (awayBullpenQuality.hasData && awayBullpenQuality.confidence < 50)
        ? 0.3
        : 0,
    weather: !weatherResult.hasData ? 0.4 : state.weather.windDirection === "cross" ? 0.2 : 0,
    ballpark: runFactorValue !== null && Math.abs(runFactorValue - 100) > 15 ? 0.2 : 0,
    offense: !offenseResult.hasData
      ? 0.6
      : (homeOffenseQuality.hasData && homeOffenseQuality.confidence < 50) || (awayOffenseQuality.hasData && awayOffenseQuality.confidence < 50)
        ? 0.3
        : 0,
  };

  const montecarlo = runMonteCarloSimulation(finalExpectedRuns, line, 20000, varianceBoost, 42, varianceComponents, poisson.overProbability);

  // Schritt 5: dynamische Gewichtung (Prediction Engine PRO) + Konsens
  //
  // Die dynamische Gewichtung wirkt ausschließlich auf die Modul-Gewichte,
  // die in den Konsens (Score/Pick/Confidence/Sterne) einfließen — NICHT
  // auf `baselineRuns` (Schritt 2), damit die bereits validierte
  // Runs-Erwartung unverändert und regressionsfrei bleibt. Sie baut auf
  // den Basis-Gewichten inkl. der Bullpen-/Offense-PRO-Reliability-
  // Anpassung aus Schritt 1 auf.
  const weightingContext: DynamicWeightingContext = {
    homePitcherQuality,
    awayPitcherQuality,
    homeBullpenScore: homeBullpenQuality.hasData ? homeBullpenQuality.score : null,
    awayBullpenScore: awayBullpenQuality.hasData ? awayBullpenQuality.score : null,
    homeBullpenIp3: toNumber(state.home.bullpen.inningsLast3Days),
    homeBullpenIp7: toNumber(state.home.bullpen.inningsLast7Days),
    awayBullpenIp3: toNumber(state.away.bullpen.inningsLast3Days),
    awayBullpenIp7: toNumber(state.away.bullpen.inningsLast7Days),
    windDirection: state.weather.windDirection,
    windSpeedMph: toNumber(state.weather.windSpeedMph),
    ballparkRunFactor: toNumber(state.ballpark.runFactor),
    marketOpeningLine: toNumber(state.market.openingLine),
    marketCurrentLine: toNumber(state.market.currentLine),
  };

  const { modules: dynamicModules, adjustments: weightingAdjustments } = applyDynamicWeighting(modules, weightingContext);

  // Historical Calibration PRO: optionale, aus historischen Backtest-
  // Ergebnissen gewonnene Gewichtungs-Multiplikatoren. Rein additiv —
  // ohne übergebene Multiplikatoren identisch zum bisherigen Verhalten.
  const calibratedModules = calibrationMultipliers ? applyCalibrationMultipliers(dynamicModules, calibrationMultipliers) : dynamicModules;

  const consensus = computeConsensus(calibratedModules);

  // Schritt 6: Bankroll/Kelly auf Basis der Poisson-Wahrscheinlichkeit der gewählten Seite
  const pickProbability = consensus.pick === "over" ? poisson.overProbability : consensus.pick === "under" ? poisson.underProbability : 0.5;
  const pickOdds =
    consensus.pick === "over" ? toNumber(state.setup.oddsOver) : consensus.pick === "under" ? toNumber(state.setup.oddsUnder) : null;
  const bankrollAmount = toNumber(state.setup.bankroll) ?? 0;
  const bankroll = computeBankrollResult(pickProbability, pickOdds ?? 1.91, bankrollAmount);

  // Schritt 7: Premium-Filter
  const premiumFilter = evaluatePremiumFilter(state.setup, consensus, bankroll, rainChance);

  // Schritt 8: erweiterte Prognose (Prediction Engine PRO)
  //
  // Home/Away-Run-Split aus einem separaten, leichtgewichtigen Rohsignal
  // (Pitcher-Runs-Allowed + Bullpen-Runs-Allowed je Gegner-Seite +
  // Offense-Eigenleistung), das NUR zur Aufteilung von `finalExpectedRuns`
  // dient — die Gesamt-Run-Erwartung selbst bleibt exakt die bereits
  // validierte `finalExpectedRuns` aus Schritt 3.
  const awayRunsRaw = weightedAverage([
    { value: pitcherExpectedRunsAllowed(state.home.pitcher), weight: 0.45 },
    { value: bullpenExpectedRuns(state.home.bullpen), weight: 0.15 },
    { value: offenseExpectedRuns(state.away.offense), weight: 0.4 },
  ]);
  const homeRunsRaw = weightedAverage([
    { value: pitcherExpectedRunsAllowed(state.away.pitcher), weight: 0.45 },
    { value: bullpenExpectedRuns(state.away.bullpen), weight: 0.15 },
    { value: offenseExpectedRuns(state.home.offense), weight: 0.4 },
  ]);
  const homeRunRatio =
    homeRunsRaw !== null && awayRunsRaw !== null && homeRunsRaw + awayRunsRaw > 0
      ? homeRunsRaw / (homeRunsRaw + awayRunsRaw)
      : null;

  const activeModuleCount = calibratedModules.filter((m) => m.hasData).length;

  const advancedPrediction = computeAdvancedPrediction({
    modules: calibratedModules,
    consensus,
    poisson,
    montecarlo,
    bankroll,
    finalExpectedRuns,
    homeRunRatio,
    setup: state.setup,
    weather: state.weather,
    market: state.market,
    homePitcherQuality,
    awayPitcherQuality,
    homeBullpenQuality,
    awayBullpenQuality,
    homeOffenseQuality,
    awayOffenseQuality,
    weightingAdjustments,
    activeModuleCount,
    totalModuleCount: calibratedModules.length,
    // Historical Accuracy (Confidence Engine PRO) wird erst mit dem
    // Backtesting-PRO-Paket aus echten, gespeicherten Backtest-Ergebnissen
    // gespeist. Bis dahin bewusst `null` statt eines erfundenen Werts —
    // der Faktor wird von der Confidence Engine dann einfach ausgeschlossen
    // (siehe `computeConfidenceBreakdown` in `@/engine/confidenceEngine`).
    historicalAccuracyPct: null,
  });

  // Schritt 9: Premium Bet Engine PRO — sechsstufige Bewertung auf Basis
  // der bereits berechneten erweiterten Prognose (Edge/Confidence/
  // Consensus/Simulation/Market/Closing Line/Expected Value/Bookmaker
  // Edge) und der harten Premium-Filter-Prüfungen.
  const premiumBetAssessment = assessPremiumBet({
    consensus,
    advancedPrediction,
    premiumFilter,
    currentLine: toNumber(state.market.currentLine),
  });

  return {
    modules: calibratedModules,
    consensus,
    poisson,
    montecarlo,
    bankroll,
    premiumFilter,
    baselineRuns,
    finalExpectedRuns,
    bullpenQuality: { home: homeBullpenQuality, away: awayBullpenQuality },
    offenseQuality: { home: homeOffenseQuality, away: awayOffenseQuality },
    advancedPrediction,
    premiumBetAssessment,
  };
}
