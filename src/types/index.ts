export type TeamSide = "home" | "away";

/** Über/Unter-Tendenz */
export type OUPick = "over" | "under" | null;

/** Wurf-/Schlaghänder-Split */
export type Handedness = "L" | "R";

// ---------------------------------------------------------------------------
// Modul 1: Team-Form
// ---------------------------------------------------------------------------
export interface TeamFormInput {
  /** Erzielte Runs der letzten 10 Spiele */
  last10: string[];
  /** Erzielte Runs der letzten 20 Spiele */
  last20: string[];
  /** Zugelassene Runs der letzten 10 Spiele */
  runsAllowedLast10: string[];
  /** Aktuelle Siegesserie (positiv) oder Niederlagenserie (negativ), 0 = keine */
  streak: number;
  /** Runs pro Spiel zuhause */
  homeRunsPerGame: string;
  /** Runs pro Spiel auswärts */
  awayRunsPerGame: string;
}

// ---------------------------------------------------------------------------
// Modul 2: Starting Pitcher
// ---------------------------------------------------------------------------
export interface PitcherInput {
  era: string;
  xera: string;
  fip: string;
  siera: string;
  whip: string;
  babip: string;
  kPct: string;
  bbPct: string;
  hr9: string;
  gbPct: string;
  fbPct: string;
  lobPct: string;
  hardHitPct: string;
  barrelPct: string;
  /** Pitch Count des letzten Starts (Einzelwert, historisch beibehalten). */
  pitchCount: string;
  restDays: string;
  /** Zugelassene Runs der letzten 5 Starts. */
  last5Starts: string[];
  /** Zugelassene Runs der letzten 10 Starts (Starting Pitcher PRO). */
  last10Starts: string[];
  /** Pitch Count der letzten 5 Starts (Starting Pitcher PRO). */
  pitchCountLast5: string[];
  velocity: string;
  spinRate: string;
  throwsHand: Handedness;
  dayEraSplit: string;
  nightEraSplit: string;
  homeEraSplit: string;
  awayEraSplit: string;
}

// ---------------------------------------------------------------------------
// Starting Pitcher PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/** Notenskala des individuellen Pitcher Scores (0–100). */
export type PitcherGrade = "Elite" | "Sehr gut" | "Gut" | "Durchschnitt" | "Schwach" | "Sehr schwach";

/** Einzelne, aus echten Kennzahlen abgeleitete Beobachtung (Stärke/Schwäche). */
export interface PitcherMetricNote {
  /** Anzeigename der Kennzahl, z. B. "ERA". */
  metric: string;
  /** Formatierter Wert, z. B. "3.15" oder "24.8 %". */
  value: string;
  /** Kurze Erklärung im Vergleich zum Liga-Durchschnitt. */
  note: string;
}

/**
 * Vollständige Pitcher-PRO-Bewertung eines einzelnen Starting Pitchers,
 * unabhängig vom direkten Matchup-Score des Prediction-Moduls.
 */
export interface PitcherQualityAssessment {
  /** Individueller Pitcher Score, 0 (sehr schwach) – 100 (Elite). */
  score: number;
  grade: PitcherGrade;
  /** Vertrauens-Score in die Prognosekraft dieses Pitchers, 0–100. */
  confidence: number;
  /** Ob genügend Kennzahlen für eine belastbare Bewertung vorhanden waren. */
  hasData: boolean;
  strengths: PitcherMetricNote[];
  weaknesses: PitcherMetricNote[];
  /** Bis zu 3 herausragende Kennzahlen, absteigend sortiert. */
  topMetrics: string[];
  warnings: string[];
  positiveFactors: string[];
  negativeFactors: string[];
}

// ---------------------------------------------------------------------------
// Modul 3: Bullpen
// ---------------------------------------------------------------------------
export interface BullpenInput {
  era: string;
  whip: string;
  fip: string;
  war: string;
  closerAvailable: boolean;
  middleReliefAvailable: boolean;
  inningsLast3Days: string;
  inningsLast7Days: string;
  /** Bullpen PRO: xFIP (erwartete FIP auf Basis der Fly-Ball-Rate statt tatsächlicher HR). */
  xfip: string;
  /** Bullpen PRO: Strikeout-Rate des gesamten Bullpens. */
  kPct: string;
  /** Bullpen PRO: Walk-Rate des gesamten Bullpens. */
  bbPct: string;
  /** Bullpen PRO: Home Runs pro 9 Innings, Bullpen-aggregiert. */
  hr9: string;
  /** Bullpen PRO: Left-On-Base % (Strandingsrate) des Bullpens. */
  lobPct: string;
  /** Bullpen PRO: Hard-Hit % gegen den Bullpen (Statcast). */
  hardHitPct: string;
  /** Bullpen PRO: Ob ein ausgeruhter High-Leverage-Reliever (Setup-Man-Niveau) verfügbar ist. */
  highLeverageAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Bullpen PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/** Notenskala des individuellen Bullpen Scores (0–100). */
export type BullpenGrade = "Elite" | "Sehr gut" | "Gut" | "Durchschnitt" | "Schwach" | "Sehr schwach";

/** Einzelne, aus echten Kennzahlen abgeleitete Beobachtung (Stärke/Schwäche) eines Bullpens. */
export interface BullpenMetricNote {
  /** Anzeigename der Kennzahl, z. B. "ERA". */
  metric: string;
  /** Formatierter Wert, z. B. "3.65" oder "24.1 %". */
  value: string;
  /** Kurze Erklärung im Vergleich zum Liga-Durchschnitt. */
  note: string;
}

/**
 * Vollständige Bullpen-PRO-Bewertung eines einzelnen Team-Bullpens,
 * unabhängig vom direkten Matchup-Score des Prediction-Moduls.
 */
export interface BullpenQualityAssessment {
  /** Individueller Bullpen Score, 0 (sehr schwach) – 100 (Elite). */
  score: number;
  grade: BullpenGrade;
  /** Vertrauens-Score in die Prognosekraft dieses Bullpens, 0–100. */
  confidence: number;
  /** Ob genügend Kennzahlen für eine belastbare Bewertung vorhanden waren. */
  hasData: boolean;
  strengths: BullpenMetricNote[];
  weaknesses: BullpenMetricNote[];
  /** Bis zu 3 herausragende Kennzahlen, absteigend sortiert. */
  topMetrics: string[];
  warnings: string[];
  positiveFactors: string[];
  negativeFactors: string[];
}

// ---------------------------------------------------------------------------
// Modul 4: Offense
// ---------------------------------------------------------------------------
export interface OffenseInput {
  runsPerGame: string;
  ops: string;
  wrcPlus: string;
  woba: string;
  iso: string;
  avg: string;
  obp: string;
  slg: string;
  kPct: string;
  bbPct: string;
  babip: string;
  hardHitPct: string;
  barrelPct: string;
  rispAvg: string;
  homeSplitRuns: string;
  awaySplitRuns: string;
  last10Games: string[];
  /** Offense PRO: Expected wOBA auf Basis der Batted-Ball-Qualität (Statcast). */
  xwoba: string;
  /** Offense PRO: durchschnittliche Exit Velocity in mph (Statcast). */
  exitVelocity: string;
  /** Offense PRO: durchschnittlicher Launch Angle in Grad (Statcast). */
  launchAngle: string;
  /** Offense PRO: Contact % (Anteil getroffener Swings). */
  contactPct: string;
  /** Offense PRO: Chase % (Swings außerhalb der Zone). */
  chasePct: string;
  /** Offense PRO: Zone-Contact % (Kontaktrate bei Pitches in der Zone). */
  zoneContactPct: string;
  /** Offense PRO: Swing % (Gesamt-Swing-Rate). */
  swingPct: string;
  /** Offense PRO: OPS gegen Linkshänder. */
  vsLhpOps: string;
  /** Offense PRO: OPS gegen Rechtshänder. */
  vsRhpOps: string;
  /** Offense PRO: durchschnittliche Runs/Spiel der letzten 7 Spiele. */
  last7AvgRuns: string;
  /** Offense PRO: durchschnittliche Runs/Spiel der letzten 15 Spiele. */
  last15AvgRuns: string;
  /** Offense PRO: durchschnittliche Runs/Spiel der letzten 30 Spiele. */
  last30AvgRuns: string;
}

// ---------------------------------------------------------------------------
// Offense PRO: individuelle Qualitäts- & Confidence-Bewertung
// ---------------------------------------------------------------------------

/** Notenskala des individuellen Offense Scores (0–100). */
export type OffenseGrade = "Elite" | "Sehr gut" | "Gut" | "Durchschnitt" | "Schwach" | "Sehr schwach";

/** Einzelne, aus echten Kennzahlen abgeleitete Beobachtung (Stärke/Schwäche) einer Offense. */
export interface OffenseMetricNote {
  /** Anzeigename der Kennzahl, z. B. "wOBA". */
  metric: string;
  /** Formatierter Wert, z. B. "0.335" oder "38.2 %". */
  value: string;
  /** Kurze Erklärung im Vergleich zum Liga-Durchschnitt. */
  note: string;
}

/**
 * Vollständige Offense-PRO-Bewertung eines einzelnen Team-Lineups,
 * unabhängig vom direkten Matchup-Score des Prediction-Moduls.
 */
export interface OffenseQualityAssessment {
  /** Individueller Offense Score, 0 (sehr schwach) – 100 (Elite). */
  score: number;
  grade: OffenseGrade;
  /** Vertrauens-Score in die Prognosekraft dieser Offense, 0–100. */
  confidence: number;
  /** Ob genügend Kennzahlen für eine belastbare Bewertung vorhanden waren. */
  hasData: boolean;
  strengths: OffenseMetricNote[];
  weaknesses: OffenseMetricNote[];
  /** Bis zu 3 herausragende Kennzahlen, absteigend sortiert. */
  topMetrics: string[];
  warnings: string[];
  positiveFactors: string[];
  negativeFactors: string[];
}

// ---------------------------------------------------------------------------
// Modul 5: Wetter
// ---------------------------------------------------------------------------
export type WindDirection = "out" | "in" | "cross" | "none";

export interface WeatherInput {
  temperatureC: string;
  windSpeedMph: string;
  windDirection: WindDirection;
  humidityPct: string;
  pressureHpa: string;
  rainChancePct: string;
  roofState: "open" | "closed" | "none";
}

// ---------------------------------------------------------------------------
// Modul 6: Ballpark
// ---------------------------------------------------------------------------
export interface BallparkInput {
  runFactor: string;
  hrFactor: string;
  singlesFactor: string;
  doublesFactor: string;
  triplesFactor: string;
  altitudeMeters: string;
  leftFieldDistance: string;
  rightFieldDistance: string;
  dayNight: "day" | "night";
}

// ---------------------------------------------------------------------------
// Modul 7: Head-to-Head
// ---------------------------------------------------------------------------
export interface H2HInput {
  /** Gesamtpunkte (beide Teams) je Duell, letzte 10 */
  last10TotalRuns: string[];
  /** Gesamtpunkte (beide Teams) je Duell, letzte 20 */
  last20TotalRuns: string[];
  firstFiveInningsAvg: string;
  extraInningsGames: string;
}

// ---------------------------------------------------------------------------
// Modul 8: Marktanalyse
// ---------------------------------------------------------------------------
export interface MarketInput {
  openingLine: string;
  currentLine: string;
  closingLine: string;
  publicOverPct: string;
  sharpOverPct: string;
}

// ---------------------------------------------------------------------------
// Spiel-Setup (Dashboard-Kopf)
// ---------------------------------------------------------------------------
export interface GameSetup {
  homeTeamName: string;
  awayTeamName: string;
  line: string;
  bookmaker: string;
  oddsOver: string;
  oddsUnder: string;
  bankroll: string;
  isDoubleheader: boolean;
  lineupsConfirmed: boolean;
  pitcherConfirmed: boolean;
  weatherConfirmed: boolean;
  /**
   * Prediction Engine PRO: Ob keine Verletzungssorgen bei Schlüsselspielern
   * (Starting Pitcher, Kern-Lineup) bekannt sind. `true` = keine bekannten
   * Probleme (Standardwert, keine Auswirkung). `false` = eine bekannte
   * Verletzungssorge reduziert die Prediction-Confidence
   * (`applyDynamicWeighting` in `@/engine/predictionEngine`).
   */
  noInjuryConcerns: boolean;
}

// ---------------------------------------------------------------------------
// Team-übergreifender State (je Team ein Satz aller Modul-Inputs)
// ---------------------------------------------------------------------------
export interface TeamAnalyzerState {
  form: TeamFormInput;
  pitcher: PitcherInput;
  bullpen: BullpenInput;
  offense: OffenseInput;
}

export interface AnalyzerState {
  setup: GameSetup;
  home: TeamAnalyzerState;
  away: TeamAnalyzerState;
  weather: WeatherInput;
  ballpark: BallparkInput;
  h2h: H2HInput;
  market: MarketInput;
}

// ---------------------------------------------------------------------------
// Modul-Ergebnisse (0–100 Score + abgeleiteter Erwartungswert für Runs)
// ---------------------------------------------------------------------------
export interface ModuleResult {
  /** Eindeutiger Schlüssel des Moduls */
  key: ModuleKey;
  /** Anzeigename */
  label: string;
  /** Score von 0 (starkes Unter-Signal) bis 100 (starkes Über-Signal) */
  score: number;
  /** Gewichtung im Gesamtmodell (0–1) */
  weight: number;
  /** Ob genügend Daten für eine Berechnung vorhanden waren */
  hasData: boolean;
  /** Erwarteter Runs-Beitrag dieses Moduls (falls zutreffend), für Poisson-Modell */
  expectedRuns: number | null;
}

export type ModuleKey =
  | "form"
  | "pitcher"
  | "bullpen"
  | "offense"
  | "weather"
  | "ballpark"
  | "h2h"
  | "market";

// ---------------------------------------------------------------------------
// Poisson-Modell-Ausgabe
// ---------------------------------------------------------------------------
export interface PoissonResult {
  expectedRuns: number;
  distribution: { runs: number; probability: number }[];
  overProbability: number;
  underProbability: number;
  pushProbability: number;
}

// ---------------------------------------------------------------------------
// Monte-Carlo-Simulationsausgabe
// ---------------------------------------------------------------------------

/**
 * Monte Carlo PRO: Aufschlüsselung zusätzlicher Simulations-Streuung nach
 * Ursprungs-Modul ("Run Environment"). Jeder Wert ist ein zusätzlicher
 * Streuungsbeitrag in Runs (0 = kein zusätzlicher Beitrag durch dieses
 * Modul).
 */
export interface RunEnvironmentVarianceComponents {
  pitcher: number;
  bullpen: number;
  weather: number;
  ballpark: number;
  offense: number;
}

export interface MonteCarloResult {
  simulations: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  ciLow: number;
  ciHigh: number;
  overProbability: number;
  underProbability: number;
  histogram: { bucket: number; count: number }[];
  /** Monte Carlo PRO: Varianz der simulierten Gesamt-Runs. */
  variance: number;
  /** Monte Carlo PRO: Standardabweichung der simulierten Gesamt-Runs. */
  stdDev: number;
  /** Monte Carlo PRO: unteres Ende des 80 %-Konfidenzintervalls. */
  ci80Low: number;
  /** Monte Carlo PRO: oberes Ende des 80 %-Konfidenzintervalls. */
  ci80High: number;
  /** Monte Carlo PRO: normalisierte Wahrscheinlichkeits-Verteilungskurve (Histogramm als Anteile statt Zählwerte). */
  distributionCurve: { bucket: number; probability: number }[];
  /** Monte Carlo PRO: Über-Wahrscheinlichkeit laut Normal-Approximations-Modell (Vergleichsmodell). */
  normalApproxOverProbability: number;
  /** Monte Carlo PRO: Unter-Wahrscheinlichkeit laut Normal-Approximations-Modell. */
  normalApproxUnderProbability: number;
  /** Monte Carlo PRO: Stabilität der Simulation (0–100) via Split-Half-Vergleich. */
  simulationConfidence: number;
  /** Monte Carlo PRO: Übereinstimmung (0–100) zwischen Monte-Carlo- und geschlossener Poisson-Lösung. */
  simulationAgreement: number;
  /** Monte Carlo PRO: angewendete Streuungs-Aufschlüsselung nach Modul ("Run Environment"). */
  varianceComponents: RunEnvironmentVarianceComponents;
  /** Monte Carlo PRO: menschlich lesbare Zusammenfassung der dominierenden Unsicherheitsquellen. */
  runEnvironmentNote: string | null;
}

// ---------------------------------------------------------------------------
// Konsens-/Gesamt-Ergebnis
// ---------------------------------------------------------------------------
export interface ConsensusResult {
  modules: ModuleResult[];
  finalScore: number; // 0–100
  pick: OUPick;
  confidence: number; // 0–1, Wahrscheinlichkeit der gewählten Seite
  stars: number; // 1–5
}

// ---------------------------------------------------------------------------
// Bankroll / Kelly
// ---------------------------------------------------------------------------
export interface BankrollResult {
  expectedValue: number; // in Einheiten des Einsatzes (z. B. 0.08 = +8 %)
  valuePct: number; // Differenz Modellwahrscheinlichkeit vs. implizite Quote in %
  kellyFraction: number; // 0–1
  halfKellyFraction: number;
  quarterKellyFraction: number;
  flatStake: number;
  kellyStake: number;
  halfKellyStake: number;
  quarterKellyStake: number;
}
export interface PremiumFilterChecks {
  pitcherConfirmed: boolean;
  lineupsConfirmed: boolean;
  weatherConfirmed: boolean;
  confidenceAtLeast85: boolean;
  positiveExpectedValue: boolean;
  positiveKelly: boolean;
  noDoubleheader: boolean;
  rainBelow60: boolean;
}

export interface PremiumFilterResult {
  checks: PremiumFilterChecks;
  allPassed: boolean;
}

// ---------------------------------------------------------------------------
// v5.0: Automatisches Laden, Qualitätsbewertung, Historie
// ---------------------------------------------------------------------------

/** Kennzeichnet für ein Datenfeld, ob es automatisch geladen werden konnte. */
export type FieldSource = "api" | "manual" | "unavailable";

export interface GameCardSummary {
  gamePk: number;
  gameDate: string;
  status: string;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  homeProbablePitcherId: number | null;
  homeProbablePitcherName: string | null;
  awayProbablePitcherId: number | null;
  awayProbablePitcherName: string | null;
  venueName: string;
  line: number | null;
  oddsOver: number | null;
  oddsUnder: number | null;
}

export type QualityGrade = "A+" | "A" | "A-" | "B+" | "B" | "C" | "D";
/**
 * Premium Bet Engine PRO: sechsstufige Bewertungsskala.
 * `"Pass"` bleibt als Legacy-Wert erhalten (wird von bereits gespeicherten
 * `HistoryEntry`-Datensätzen aus früheren Versionen verwendet), fließt aber
 * in keine neue Berechnung mehr ein — `assessPremiumBet()` (Paket 5)
 * verwendet ausschließlich die sechs neuen Stufen.
 */
export type BetTier = "Elite Bet" | "Premium Bet" | "Strong Bet" | "Good Bet" | "Lean" | "Pass" | "No Bet";

export interface QualityAssessment {
  grade: QualityGrade;
  tier: BetTier;
}

export interface LoadingStep {
  label: string;
  done: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: string;
  homeTeamName: string;
  awayTeamName: string;
  line: number;
  pick: OUPick;
  confidence: number;
  grade: QualityGrade;
  tier: BetTier;
  state: AnalyzerState;
}

/** Zusätzliche, in v5.0 neu berechnete Kennzahlen jenseits der 8 Kern-Module. */
export interface ExtendedMetrics {
  expectedHomeRuns: number | null;
  pitcherMatchupScore: number; // 0-100, entspricht dem Pitcher-Modul-Score
  bullpenMatchupScore: number;
  offenseMatchupScore: number;
  lineupStrengthScore: number | null; // null, falls Lineup noch nicht veröffentlicht
  momentumScore: number; // aus Serie + letzten 10 Spielen
  recentFormScore: number; // aus Form-Modul-Score
  travelFatigueNote: string | null;
  restAdvantageNote: string | null;
  umpireName: string | null;
}

// ---------------------------------------------------------------------------
// Prediction Engine PRO: dynamische Gewichtung & erweiterte Prognose
// ---------------------------------------------------------------------------

/**
 * Protokolliert eine einzelne dynamische Gewichtungsanpassung, die auf ein
 * Modul angewendet wurde (z. B. "Ace-vs-Ace" erhöht das Pitcher-Gewicht).
 * Dient der Nachvollziehbarkeit der dynamischen Gewichtung.
 */
export interface DynamicWeightingAdjustment {
  moduleKey: ModuleKey;
  /** Menschlich lesbare Begründung der Anpassung. */
  reason: string;
  /** Multiplikator, der auf das Basis-Gewicht des Moduls angewendet wurde. */
  factor: number;
}

/**
 * Erweiterte, professionelle Prognose-Ausgabe der Prediction Engine PRO.
 * Baut auf Konsens/Poisson/Monte-Carlo/Bankroll auf, ohne deren
 * Basisberechnung zu verändern — reine additive Veredelung.
 */
export interface AdvancedPrediction {
  /** Modellseitig erwartete Runs des Heimteams (anteilige Aufteilung von `expectedTotal`). */
  expectedRunsHome: number | null;
  /** Modellseitig erwartete Runs des Auswärtsteams. */
  expectedRunsAway: number | null;
  /** Modellseitig erwartete Gesamt-Runs (identisch zu `finalExpectedRuns`). */
  expectedTotal: number;
  /** Über-Wahrscheinlichkeit, Konsens aus Poisson- und Monte-Carlo-Modell. */
  probabilityOver: number;
  /** Unter-Wahrscheinlichkeit, Konsens aus Poisson- und Monte-Carlo-Modell. */
  probabilityUnder: number;
  /** Confidence (0–1) nach Anwendung dynamischer Confidence-Penalties. */
  confidence: number;
  /** Buchstaben-Note der Prognosequalität (wiederverwendet `QualityGrade`). */
  predictionGrade: QualityGrade;
  /** Zusammengesetzter Premium-Score (0–100): je höher, desto handelbarer die Wette. */
  premiumScore: number;
  /** Risiko-Score (0–100): je höher, desto unsicherer/volatiler die Prognose. */
  riskScore: number;
  /** Differenz Modellwahrscheinlichkeit vs. implizite Buchmacher-Wahrscheinlichkeit, in Prozentpunkten. */
  expectedEdge: number | null;
  /** Erwarteter Wert (Expected Value) der gewählten Seite, in Prozent des Einsatzes. */
  valueEdge: number | null;
  /** Buchmacher-Marge (Vig) zwischen Über- und Unter-Quote, in Prozent. */
  bookmakerEdge: number | null;
  /** Modellseitig projizierte Closing Line auf Basis von Linienbewegung und Sharp-Money-Anteil. */
  expectedClosingLine: number | null;
  /** Line, bei der Über- und Unter-Wahrscheinlichkeit laut Modell exakt ausgeglichen wären. */
  fairTotalLine: number;
  /** Modell-Gesamtlinie, auf den nächsten Halbschritt gerundet (Sportsbook-Konvention). */
  modelTotal: number;
  /** Modellseitige Run-Differenz (Heim minus Auswärts). */
  modelSpread: number | null;
  /** Expected Run Differential — identisch zu `modelSpread`, unter dem in Phase 2 angeforderten Namen zusätzlich verfügbar. */
  expectedRunDifferential: number | null;
  /** Faire Dezimalquote der Over-Seite (1 / probabilityOver, ohne Buchmacher-Marge). `null`, wenn probabilityOver 0 ist. */
  fairOddsOver: number | null;
  /** Faire Dezimalquote der Under-Seite (1 / probabilityUnder, ohne Buchmacher-Marge). `null`, wenn probabilityUnder 0 ist. */
  fairOddsUnder: number | null;
  /** Protokoll aller angewendeten dynamischen Gewichtungsanpassungen. */
  weightingAdjustments: DynamicWeightingAdjustment[];
  /** Menschlich lesbare Liste aller angewendeten Confidence-Abzüge. */
  confidencePenalties: string[];
  /**
   * Confidence Engine PRO: vollständige, nachvollziehbare Aufschlüsselung
   * der Confidence-Berechnung (siehe `@/engine/confidenceEngine`). `confidence`
   * oben ist identisch zu `confidenceBreakdown.confidence` — bleibt als
   * eigenes Feld erhalten für Abwärtskompatibilität mit bestehenden Lesern.
   */
  confidenceBreakdown: ConfidenceBreakdown;
  /**
   * Prediction Engine PRO (Phase 2): erklärbare Zusammenfassung der
   * Prognose — warum sie zustande kam und welche Module den größten
   * Einfluss hatten. Siehe `PredictionSummary`.
   */
  predictionSummary: PredictionSummary;
}

/**
 * Prediction Engine PRO (Phase 2): Einfluss eines einzelnen Moduls auf
 * die Gesamtprognose. `influence` ist `weight * (score - 50)` — positiv
 * bedeutet, das Modul zieht Richtung Over, negativ Richtung Under; der
 * Betrag zeigt die Stärke des Einflusses.
 */
export interface ModuleInfluence {
  moduleKey: ModuleKey;
  label: string;
  score: number;
  weight: number;
  influence: number;
  direction: "over" | "under" | "neutral";
}

/**
 * Prediction Engine PRO (Phase 2): erklärbare Zusammenfassung der
 * Prognose. Fasst ausschließlich bereits vorhandene Modul-/Confidence-
 * Ausgaben zusammen (keine neue Berechnung eines eigenen Scores) —
 * beantwortet "warum kam diese Prognose zustande?" und "welche Module
 * hatten den größten Einfluss?" in menschlich lesbarer Form.
 */
export interface PredictionSummary {
  /** Bis zu 3 stärkste Module/Signale, die für Over sprechen. Leer, wenn keine vorliegen. */
  topReasonsForOver: string[];
  /** Bis zu 3 stärkste Module/Signale, die für Under sprechen. Leer, wenn keine vorliegen. */
  topReasonsForUnder: string[];
  /** Größte erkannte Risiken der Prognose (aus Confidence-Faktoren mit niedrigem Score sowie aktiven Penalties). */
  biggestRisks: string[];
  /** Anteil der Module mit ausreichender Datenbasis, 0–100. */
  dataQualityPct: number;
  /** Menschlich lesbares Label zu `dataQualityPct` ("Hoch" / "Mittel" / "Niedrig"). */
  dataQualityLabel: "Hoch" | "Mittel" | "Niedrig";
  /** Bis zu 5 Module mit dem größten absoluten Einfluss auf die Gesamtprognose, absteigend sortiert. */
  topInfluencingModules: ModuleInfluence[];
}

/**
 * Confidence Engine PRO: eine einzelne, in die Gesamt-Confidence
 * eingehende Kennzahl mit ihrem Beitrag (Score 0–100) und Gewicht.
 */
export interface ConfidenceFactor {
  key: string;
  label: string;
  /** Beitrag dieser Kennzahl, 0 (schlecht) – 100 (exzellent). */
  score: number;
  /** Gewicht dieser Kennzahl in der gewichteten Basis-Confidence. */
  weight: number;
  note: string;
}

/**
 * Confidence Engine PRO: vollständige, professionelle Confidence-
 * Berechnung. Kombiniert Datenqualität (Pitcher/Bullpen/Offense/Weather/
 * Market), API-/Modul-Vollständigkeit, Simulationsqualität (Monte Carlo
 * PRO), Modul-Konsens, optional Historical Accuracy sowie harte,
 * ausschließlich verringernde Penalties (fehlende Lineup-Bestätigung,
 * Verletzungssorgen, fehlende Kernmodul-Daten, gegenläufige
 * Linienbewegung) — damit die Confidence niemals künstlich hoch ist.
 */
export interface ConfidenceBreakdown {
  /** Finaler Confidence-Score, 0–100. */
  score: number;
  /** Identisch zu `score / 100`, für Kompatibilität mit bestehenden 0–1-Confidence-Werten. */
  confidence: number;
  grade: QualityGrade;
  factors: ConfidenceFactor[];
  penalties: string[];
}

// ---------------------------------------------------------------------------
// Premium Bet Engine PRO
// ---------------------------------------------------------------------------

/** Einzelne, in die Premium-Bet-Bewertung eingehende Kennzahl. */
export interface PremiumBetFactor {
  key: string;
  label: string;
  /** Beitrag dieser Kennzahl, 0 (schlecht) – 100 (exzellent). `null`, wenn die Kennzahl nicht verfügbar war (fließt dann nicht ein). */
  score: number | null;
  weight: number;
  note: string;
}

/**
 * Vollständige Premium-Bet-Bewertung: kombiniert Edge, Confidence,
 * Consensus, Simulationsqualität, Historical Accuracy (falls verfügbar),
 * Market-Datenqualität, Closing-Line-Ausrichtung, Expected Value und
 * Bookmaker Edge zu einem zusammengesetzten 0–100-"Bettability"-Score,
 * der zusammen mit den harten Premium-Filter-Prüfungen die sechsstufige
 * `BetTier`-Einordnung ergibt.
 */
export interface PremiumBetAssessment {
  tier: BetTier;
  grade: QualityGrade;
  /** Zusammengesetzter "Bettability"-Score, 0–100. */
  score: number;
  factors: PremiumBetFactor[];
  /** Menschlich lesbare Begründung, warum diese Stufe vergeben wurde. */
  reasons: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Historical Calibration PRO
// ---------------------------------------------------------------------------

/**
 * Multiplikative Gewichtungs-Anpassung je Modul, aus historischen
 * Backtest-Ergebnissen abgeleitet (siehe
 * `@/backtesting/historicalCalibration`). Wird optional zusätzlich zur
 * dynamischen Gewichtung (Paket 2) in `computeFullAnalysis()` angewendet.
 * Ein Wert von `1` bedeutet keine Anpassung.
 */
export interface ModuleWeightMultipliers {
  form: number;
  pitcher: number;
  bullpen: number;
  offense: number;
  weather: number;
  ballpark: number;
  h2h: number;
  market: number;
}

// ---------------------------------------------------------------------------
// Backtesting PRO Phase 3 — Datensatz, Auswertungen, Kalibrierungs-Hinweise
// ---------------------------------------------------------------------------

/**
 * Vollständiger, strukturierter Datensatz eines einzelnen historischen
 * Spiels für Backtesting PRO Phase 3. Fasst ausschließlich bereits von
 * `computeFullAnalysis()` berechnete Werte zusammen (Prediction Engine
 * PRO, Confidence Engine, Premium Bet Engine, Kelly/Bankroll) — es wird
 * keine neue, eigenständige Berechnung eingeführt.
 */
export interface BacktestDatasetRecord {
  gameId: number;
  /** Offizieller Spieltag, YYYY-MM-DD. */
  date: string;
  /** MLB-Saison (Kalenderjahr des Spieltags). */
  season: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  line: number;

  prediction: "over" | "under" | null;
  overProbability: number;
  underProbability: number;
  /** Modellseitig erwartete Runs des Heimteams (aus der Prediction Engine PRO). */
  expectedRunsHome: number | null;
  /** Modellseitig erwartete Runs des Auswärtsteams. */
  expectedRunsAway: number | null;
  expectedRuns: number;
  expectedRunDifferential: number | null;
  /** Faire Dezimalquote der vorhergesagten Seite (`null` ohne Pick). */
  fairOdds: number | null;
  /**
   * Modellseitige "Fair Total Line" (aus der Poisson-Verteilung), für den
   * Vergleich "Prediction vs. Closing Betting Line" — `line` oben ist die
   * tatsächlich verwendete Wettlinie zur Wettzeit.
   */
  modelFairLine: number;
  /** Expected Edge in Prozentpunkten (`null` ohne Pick). */
  edge: number | null;
  /** Expected Value in Prozent des Einsatzes (`null` ohne Pick). */
  valuePct: number | null;
  /** Kelly-Anteil in Prozent des Bankrolls. */
  kellyPct: number;

  confidence: number;
  premiumRating: BetTier;
  /** Ob der Premium-Filter (Lineup/Pitcher/Wetter bestätigt, positive EV etc.) für dieses Spiel bestanden wurde. */
  premiumFilterPassed: boolean;

  actualResult: "over" | "under" | "push";
  actualRuns: number;

  /** `null`, wenn kein Pick platziert wurde (kein Ergebnis auswertbar) oder das Spiel ein Push war. */
  hit: boolean | null;
  /** Gewinn/Verlust in Einheiten des Einsatzes (Flat-Stake-Konvention, konsistent mit `evaluateBacktestGame`). */
  profitLoss: number;

  /** Einfluss ALLER 8 Module auf diese Prognose (nicht nur die Top 5 wie in `PredictionSummary`). */
  moduleInfluences: ModuleInfluence[];
}

/** Auswertung einer Gruppe von Spielen mit derselben (gerundeten) Wettlinie. */
export interface LineBucketPerformance {
  line: number;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  decidedBets: number;
  hitRate: number;
  roi: number;
  profit: number;
}

/** Auswertung eines einzelnen Moduls über alle Backtest-Spiele hinweg. */
export interface ModuleBacktestPerformance {
  moduleKey: ModuleKey;
  label: string;
  /** Durchschnitt von `weight * (score - 50)` über alle Spiele mit Daten für dieses Modul. */
  averageInfluence: number;
  /** Durchschnittlicher positiver Einfluss (nur Spiele mit Über-Richtung dieses Moduls). 0, wenn keine vorliegen. */
  averagePositiveInfluence: number;
  /** Durchschnittlicher negativer Einfluss (nur Spiele mit Unter-Richtung dieses Moduls). 0, wenn keine vorliegen. */
  averageNegativeInfluence: number;
  /**
   * Durchschnittlicher Fehler (Brier-Score-Prinzip): Abweichung zwischen
   * der aus dem Modul-Score abgeleiteten Über-Wahrscheinlichkeit und dem
   * tatsächlichen Ergebnis, quadriert und gemittelt. 0 = perfekt, 1 =
   * maximal falsch.
   */
  averageError: number;
  /** Stabilität des Moduls (0–100): je geringer die Streuung des Einflusses über die Spiele, desto höher. */
  stability: number;
  /** Durchschnittliches tatsächliches Gewicht (0–1) dieses Moduls im Konsens über alle Spiele mit Daten. */
  averageWeight: number;
  /** Anzahl Spiele, in denen dieses Modul Richtung Over ausschlug. */
  positiveInfluenceCount: number;
  /** `positiveInfluenceCount` als Anteil (0–100) aller Spiele mit Daten. */
  positiveInfluencePct: number;
  /** Anzahl Spiele, in denen dieses Modul Richtung Under ausschlug. */
  negativeInfluenceCount: number;
  /** `negativeInfluenceCount` als Anteil (0–100) aller Spiele mit Daten. */
  negativeInfluencePct: number;
  /** Trefferquote der Spiele, in denen die Richtung dieses Moduls mit dem tatsächlichen Ergebnis übereinstimmte. */
  hitRate: number;
  /** ROI der Wetten, bei denen die Richtung dieses Moduls mit dem platzierten Pick übereinstimmte. */
  roi: number;
  /** Wie oft dieses Modul (nach absolutem Einfluss) das stärkste aller Module war. */
  strongestCount: number;
  /** `strongestCount` als Anteil (0–100) aller ausgewerteten Spiele. */
  strongestPct: number;
  gamesWithData: number;
  /** Automatisch aus Trefferquote/ROI abgeleitete, rein informative Empfehlung — passt keine Gewichte an. */
  weightingRecommendation: string;
}

/**
 * Automatisch aus echten Backtest-Ergebnissen abgeleitete
 * Kalibrierungs-Empfehlung. Rein informativ — verändert keine
 * Modul-Gewichte (siehe `@/backtesting/historicalCalibration` für die
 * tatsächliche, optionale Gewichts-Kalibrierung).
 */
export interface CalibrationRecommendation {
  category: "module" | "confidence" | "line" | "staking" | "general";
  text: string;
  /** Kennzahl, auf der die Empfehlung beruht (z. B. ROI-Wert), für Transparenz. */
  basedOnValue: number;
}

/**
 * Wirksamkeits-Auswertung des Premium-Filters (Lineup/Pitcher/Wetter
 * bestätigt, positive EV/Kelly etc.). Der Premium-Filter ist bewusst
 * KEIN gewichtetes Konsens-Modul (kein `ModuleKey`), sondern ein hartes
 * Gate — daher separat von `ModuleBacktestPerformance` ausgewertet:
 * vergleicht die Trefferquote/ROI von Spielen, die den Filter bestanden
 * haben, mit denen, die ihn nicht bestanden haben.
 */
export interface PremiumFilterEfficacyStat {
  gamesPassed: number;
  gamesFailed: number;
  hitRatePassed: number;
  hitRateFailed: number;
  roiPassed: number;
  roiFailed: number;
}

/** Ein Datenpunkt einer Zeitreihe für die Backtesting-PRO-Visualisierung. */
export interface BacktestTimeSeriesPoint {
  index: number;
  date: string;
  value: number;
}
// ---------------------------------------------------------------------------
// Tag 7 — Model Optimization & Self-Learning Analytics
// ---------------------------------------------------------------------------

/**
 * Gewichtungs-Analyse eines einzelnen Moduls: aktuelles vs. optimales
 * Gewicht (aus der bestehenden Historical-Calibration-PRO-Engine, siehe
 * `@/backtesting/historicalCalibration`), empfohlene Änderung sowie die
 * dadurch erwartete Verbesserung der Validierungs-Trefferquote. Rein
 * informativ — passt selbst keine Gewichte an.
 */
export interface ModuleWeightingAnalysis {
  moduleKey: ModuleKey;
  label: string;
  currentWeight: number;
  optimalWeight: number;
  /** Empfohlene Änderung in Prozent des aktuellen Gewichts (z. B. +15 = 15 % Erhöhung). */
  recommendedChangePct: number;
  /** Erwartete Verbesserung der Validierungs-Trefferquote in Prozentpunkten bei Übernahme der Kalibrierung. */
  expectedImprovementPct: number;
}

/** Automatisch erkannte, häufige Fehlerursache verlorener Predictions. */
export interface ErrorCauseCategory {
  moduleKey: ModuleKey;
  label: string;
  description: string;
  count: number;
  /** Anteil (0–100) an allen verlorenen, ausgewerteten Predictions. */
  pct: number;
}

/** Vergleich vorhergesagter Confidence mit tatsächlicher Trefferquote in einem Bereich. */
export interface ConfidenceCalibrationPoint {
  bucket: string;
  predictedPct: number;
  actualPct: number;
  /** `actualPct - predictedPct`, in Prozentpunkten. Negativ = Modell überschätzt seine eigene Confidence. */
  gap: number;
  decidedBets: number;
}

/** Zusammengesetzte Modellqualitäts-Bewertung aus Genauigkeit, Confidence-Kalibrierung und Modul-Stabilität. */
export interface ModelQualitySummary {
  overallScore: number;
  grade: QualityGrade;
  accuracyScore: number;
  calibrationScore: number;
  stabilityScore: number;
}
// ---------------------------------------------------------------------------
// Tag 8 — Explainable AI & Smart Decision Support
// ---------------------------------------------------------------------------

/** Ein Modul, das für Unsicherheit in der aktuellen Prognose sorgt. */
export interface DecisionSupportModuleNote {
  moduleKey: ModuleKey;
  label: string;
  reason: string;
}

/** Zwei Module, die sich in ihrer Richtung widersprechen. */
export interface ModuleContradiction {
  overModule: string;
  underModule: string;
  description: string;
}

/** Sechsstufiges Decision Label (Schritt 5). */
export type DecisionLabel = "Sehr schwach" | "Schwach" | "Neutral" | "Gut" | "Sehr gut" | "Elite";

/**
 * Explainable-AI-Zusammenfassung einer einzelnen Live-Prognose (Tag 8).
 * Fasst ausschließlich bereits vorhandene Berechnungen (Modul-Scores/
 * -Gewichte, `PredictionSummary`, `ConfidenceBreakdown`, Monte-Carlo-PRO-
 * Simulationsstabilität) zusammen — erzeugt keinen neuen, eigenständigen
 * Score jenseits des dokumentierten `decisionScore`.
 */
export interface DecisionSupportSummary {
  /** Dynamisch erzeugte, ausschließlich datengetriebene Entscheidungssätze. */
  narrativeSentences: string[];
  /** Der Einzelgrund mit dem größten absoluten Einfluss auf die Prognose. */
  strongestSingleReason: string | null;
  /** Module mit dem geringsten absoluten Einfluss (Gegenstück zu `PredictionSummary.topInfluencingModules`). */
  leastInfluentialModules: ModuleInfluence[];
  /** Module mit unterdurchschnittlicher Datenqualität bzw. ohne ausreichende Datenbasis. */
  mostUncertainModules: DecisionSupportModuleNote[];
  /** Erkannte Widersprüche zwischen Modulen (starke, aber gegensätzliche Richtungen). */
  moduleContradictions: ModuleContradiction[];
  /** Menschlich lesbare Begründung der aktuellen Confidence, aus den Confidence-Engine-Faktoren abgeleitet. */
  confidenceRationale: string[];
  /** Zusammengesetzter Decision Score, 0–100. */
  decisionScore: number;
  decisionLabel: DecisionLabel;
}
// ---------------------------------------------------------------------------
// Tag 9 — Performance & Data Quality PRO
// ---------------------------------------------------------------------------

export type DataQualityLabel = "Exzellent" | "Gut" | "Ausreichend" | "Schwach" | "Unzureichend";

/** Data Quality Engine (Schritt 3): Bewertung eines einzelnen Datenbereichs. */
export interface DataQualityAreaAssessment {
  area: string;
  qualityScore: number;
  qualityLabel: DataQualityLabel;
  /**
   * Geschätzter Einfluss dieses Bereichs auf die Gesamt-Confidence, in
   * Prozentpunkten (positiv = erhöhend, negativ = reduzierend) — aus dem
   * tatsächlichen Gewicht/Score des zugehörigen Confidence-Faktors
   * abgeleitet, sofern vorhanden.
   */
  confidenceImpact: number;
  note: string;
}

export interface DataQualityReport {
  areas: DataQualityAreaAssessment[];
  overallScore: number;
  overallLabel: DataQualityLabel;
}

export type WarningPriority = "kritisch" | "hoch" | "mittel" | "niedrig";
export type WarningCategory = "Datenqualität" | "Modell" | "Markt" | "Simulation" | "Bestätigung";

/** Smart Warnings (Schritt 4): eine einzelne, priorisierte, kategorisierte Warnung. */
export interface SmartWarning {
  priority: WarningPriority;
  category: WarningCategory;
  description: string;
  recommendation: string;
}

export type ApiSourceStatus = "verfügbar" | "eingeschränkt" | "nicht verfügbar";

/**
 * API Health (Schritt 5): Bewertung einer einzelnen Datenquelle.
 * `responseTimeMs`/`errorRatePct`/`lastUpdated` sind `null`, wenn dafür
 * keine echte Instrumentierung vorliegt — bewusst nicht erfunden.
 */
export interface ApiSourceHealth {
  source: string;
  status: ApiSourceStatus;
  fieldsLoaded: number;
  fieldsExpected: number;
  completenessPct: number;
  responseTimeMs: number | null;
  errorRatePct: number | null;
  lastUpdated: string | null;
}

export interface ApiHealthReport {
  sources: ApiSourceHealth[];
  overallCompletenessPct: number;
}

/** Release Dashboard (Schritt 6): Zusammenfassung des Cache-Zustands. */
export interface CacheStatusSummary {
  totalEntries: number;
  freshEntries: number;
  staleEntries: number;
}

/**
 * Release Dashboard (Schritt 6): technische Systemstatus-Zusammenfassung
 * für die aktuelle Analyse.
 */
export interface SystemStatusSummary {
  version: string;
  computationDurationMs: number | null;
  cacheStatus: CacheStatusSummary;
  dataQuality: DataQualityReport;
  warnings: SmartWarning[];
  apiHealth: ApiHealthReport;
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 1 — Prediction Engine 2.0 & Confidence Engine 2.0
// ---------------------------------------------------------------------------

/**
 * Eine erkannte Modul-Synergie (Schritt 3): eine Kombination mehrerer
 * Module, die gemeinsam deutlich stärker in dieselbe Richtung sprechen,
 * als es die einfache gewichtete Summe der Einzelmodule ausdrücken würde.
 * Wird ausschließlich aus bereits vorhandenen Modul-/Qualitäts-Scores
 * abgeleitet — keine neue Datenquelle.
 */
export interface ModuleSynergy {
  name: string;
  direction: "over" | "under";
  description: string;
  /** Bonus in Score-Punkten (0–100-Skala), der Richtung `direction` angewendet wurde. */
  bonus: number;
}

/**
 * Ergebnis der nicht-linearen Modul-Kombination (Schritt 2). Ersetzt
 * NICHT `ConsensusResult.finalScore` (bleibt unverändert bestehen,
 * weiterhin von Premium Filter/Dashboard genutzt) — reine additive
 * Zweitberechnung mit stärkerer Trennung zwischen starken und schwachen
 * Signalen sowie erkannten Synergien.
 */
export interface PredictionEngine2Result {
  /** Nicht-linear kombinierter Score, 0–100 (inkl. Synergie-Bonus). */
  enhancedScore: number;
  /** `ConsensusResult.finalScore` zum Vergleich — unverändert übernommen. */
  linearScore: number;
  /** Differenz zwischen nicht-linearer Amplifikation und linearem Score, vor Synergien. */
  amplificationDelta: number;
  synergies: ModuleSynergy[];
  /** Summe aller Synergie-Boni (positiv = Richtung Over, negativ = Richtung Under). */
  synergyBonus: number;
  /** Confidence Engine 2.0: nicht-linear angepasste Confidence, 0–1. */
  nonLinearConfidence: number;
  /** Ursprüngliche (lineare) Confidence aus der bestehenden Confidence Engine, zum Vergleich. */
  linearConfidence: number;
  /** Gewichteter Grad der Richtungs-Übereinstimmung aller aktiven Module, -1 (Widerspruch) … 1 (volle Übereinstimmung). */
  moduleAgreementRatio: number;
  /** Ob eine historische Kalibrierung (Schritt 5) für diese Berechnung verfügbar war. */
  calibrationApplied: boolean;
  /** Schritt 6: Plausibilitäts-Hinweis, ob die verstärkte Einschätzung mit dem Poisson-Modell übereinstimmt. */
  fairProbabilityNote: string;
  notes: string[];
}
