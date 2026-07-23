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
  /**
   * Version 6.0 (Paket 4): destillierter 0–100-Score aus der Market
   * Intelligence Engine (siehe `@/engine/marketIntelligenceEngine`).
   * Das vollständige, reichhaltige Ergebnis (Line Movement, Sharp/RLM/
   * Steam-Erkennung, CLV etc.) fließt NICHT direkt in `AnalyzerState`,
   * sondern bleibt — analog zu `ExtendedMetrics` — als eigenständiges
   * Objekt neben dem State bestehen und wird separat an das Dashboard
   * durchgereicht. Nur dieser distillierte Score beeinflusst über die
   * dynamische Gewichtung tatsächlich die Prognose.
   */
  marketScore: string;
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
   * Version 6.0 (Paket 5): destillierter 0–100-Score aus der Lineup
   * Quality Engine (siehe `@/engine/lineupQualityEngine`). Analog zu
   * `MarketInput.marketScore` — das vollständige, reichhaltige Ergebnis
   * bleibt als eigenständiges Objekt neben dem State bestehen, nur
   * dieser distillierte Wert beeinflusst über die dynamische Gewichtung
   * tatsächlich die Prognose.
   */
  lineupQualityScore: string;
  /**
   * Version 7.0: echte, dedizierte Marktquoten für den Run-Line-Modus —
   * bewusst getrennt von `oddsOver`/`oddsUnder` (die gehören zum
   * Over/Under-Markt und dürfen nicht zweckentfremdet werden). Leer,
   * falls der Nutzer keine Run-Line-Quote hinterlegt hat.
   */
  runLineFavoriteOdds: string;
  runLineUnderdogOdds: string;
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
  /**
   * Version 6.0 (Paket 5): zusätzliche, bereits von der MLB Stats API
   * gelieferte Felder für die automatische Spielinformationen-Anzeige
   * (siehe `@/engine/gameInfoEngine`).
   */
  officialDate: string;
  venueId: number | null;
  abstractGameState: string | null;
  isDoubleheader: boolean;
  doubleheaderGameNumber: number | null;
  gameType: string | null;
  seriesGameNumber: number | null;
  gamesInSeries: number | null;
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

  /**
   * Version 6.0 (Paket 4): Market-Intelligence-Felder. Bulk-Backtests
   * laden aktuell keine echten Multi-Buchmacher-/Linien-Historien-Daten
   * je historischem Spiel (dieselbe bereits dokumentierte Einschränkung
   * wie beim Closing-Line-Value in Backtesting PRO, Paket 7 — historische
   * Odds erfordern einen kostenpflichtigen Datenfeed pro Abruf). Diese
   * Felder sind daher bei Bulk-Backtests konsequent `null`/`false` statt
   * erfunden — die Berechnungslogik ist vollständig vorhanden und
   * korrekt, sobald echte historische Marktdaten verfügbar sind (z. B.
   * über einen zukünftigen, gezielten historischen Odds-Import).
   */
  marketOpeningLine: number | null;
  marketClosingLine: number | null;
  marketScore: number | null;
  sharpMovementDetected: boolean;
  reverseLineMovementDetected: boolean;
  steamMoveDetected: boolean;
  clv: number | null;

  /**
   * Version 7.0: getrennte Run-Line-Statistik für dasselbe historische
   * Spiel — nutzt den bereits vorhandenen `computeRunLineAnalysis()`
   * (unverändert) sowie die real gespeicherten Endstände
   * (`homeRuns`/`awayRuns`) für die Standard-Run-Line ±1.5.
   * `runLineProfitLoss` bleibt bewusst `null`: es gibt im Projekt keine
   * echten historischen Run-Line-Quoten (nur Total-Quoten werden
   * historisch erfasst) — ein Gewinn/Verlust ohne echte Quote würde
   * eine Quote erfinden. `runLineHit` ist dagegen aus den echten
   * Endständen berechenbar und daher gesetzt.
   */
  runLineFavorite: "home" | "away" | null;
  runLineRecommendedSide: "favorite" | "underdog" | null;
  runLineRecommendedLine: number | null;
  runLineProbability: number | null;
  runLineHit: boolean | null;
  runLineProfitLoss: null;
}

/** Auswertung einer Gruppe von Spielen mit ähnlichem Market Score (Version 6.0, Paket 4, Schritt 9). */
export interface MarketQualityBucketPerformance {
  label: string;
  minScore: number;
  maxScore: number;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  decidedBets: number;
  hitRate: number;
  roi: number;
  yield: number;
  profit: number;
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
// ---------------------------------------------------------------------------
// Version 6.0 Paket 2 — Adaptive Intelligence Engine
// ---------------------------------------------------------------------------

/** Eine einzelne Wahrscheinlichkeits-Quelle, die in die Bayesianische Kombination eingeht. */
export interface BayesianProbabilitySource {
  source: string;
  probability: number;
  weight: number;
  logOdds: number;
}

/**
 * Schritt 4+7: Bayesianisch (log-odds-basiert) kombinierte Über-
 * Wahrscheinlichkeit aus Poisson, Monte Carlo und Prediction Engine 2.0.
 * Ersetzt NICHT `AdvancedPrediction.probabilityOver` (bleibt unverändert
 * bestehen) — reine additive Zweitberechnung mit stärkerer Trennung bei
 * übereinstimmenden starken Signalen und Dämpfung bei Widersprüchen.
 */
export interface BayesianProbabilityUpdate {
  bayesianOverProbability: number;
  bayesianUnderProbability: number;
  sources: BayesianProbabilitySource[];
  /** Grad der Übereinstimmung der Quellen, 0 (Widerspruch) – 1 (volle Übereinstimmung). */
  sourceAgreement: number;
  /** Differenz zwischen der bayesianischen und der linear gemittelten Quellen-Wahrscheinlichkeit. */
  separationDelta: number;
}

/** Schritt 2: adaptiv angepasstes Gewicht eines Moduls, aus nachgewiesener historischer Qualität abgeleitet. */
export interface AdaptiveModuleWeight {
  moduleKey: ModuleKey;
  label: string;
  baseWeight: number;
  adaptiveMultiplier: number;
  adjustedWeight: number;
  reason: string;
}

/** Schritt 3+6: eine aus historischen Backtest-Daten gelernte (nicht fest programmierte) Modul-Synergie. */
export interface LearnedSynergy {
  moduleKeys: [ModuleKey, ModuleKey];
  direction: "over" | "under";
  historicalHitRate: number;
  sampleSize: number;
  bonus: number;
  description: string;
}

/**
 * Vollständiges Ergebnis der Adaptive Intelligence Engine (Version 6.0,
 * Paket 2). Historien-abhängige Teile (`adaptiveWeights` mit echtem
 * Multiplikator, `learnedSynergies`, `calibrationApplied`) bleiben
 * inaktiv (neutrale Werte, `applied: false`), wenn keine historischen
 * Backtest-Daten übergeben wurden — kein erfundener Wert. Die
 * Bayesianische Wahrscheinlichkeits-Kombination ist immer aktiv, da sie
 * ausschließlich bereits live vorhandene Werte (Poisson/Monte
 * Carlo/Prediction Engine 2.0) nutzt.
 */
export interface AdaptiveIntelligenceResult {
  bayesianUpdate: BayesianProbabilityUpdate;
  adaptiveWeights: AdaptiveModuleWeight[];
  learnedSynergies: LearnedSynergy[];
  calibratedConfidence: number;
  calibrationApplied: boolean;
  adaptiveWeightingApplied: boolean;
  notes: string[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 3 — Prediction Intelligence PRO
// ---------------------------------------------------------------------------

export type SignalStrengthLabel = "schwach" | "mittel" | "stark" | "extrem stark";

/** Schritt 4: Gesamtbewertung der Signal-Stärke dieser Prognose. */
export interface SignalStrengthAssessment {
  score: number;
  label: SignalStrengthLabel;
  contributingFactors: string[];
}

/** Schritt 3: eine erkannte Richtungs-Divergenz zwischen zwei Wahrscheinlichkeits-/Signalquellen. */
export interface DetectedConflict {
  sourceA: string;
  sourceB: string;
  description: string;
}

/** Schritt 3: Zusammenfassung aller erkannten Konflikte zwischen Modulen/Quellen. */
export interface ConflictAnalysis {
  conflicts: DetectedConflict[];
  conflictSeverity: number;
  confidenceReductionPct: number;
}

/**
 * Schritt 2: kontinuierliches (nicht hartcodiertes) Umfeld-Signal aus
 * Offense/Pitcher/Bullpen/Ballpark/Wind/Temperatur — verallgemeinert die
 * in Prediction Engine 2.0 fest programmierten Referenz-Synergien zu
 * einer graduellen, datengetriebenen Bewertung.
 */
export interface EnvironmentalSignal {
  leaning: number;
  direction: "over" | "under" | "neutral";
  contributingFactors: string[];
}

export type ExtremeCaseCategory = "extremes Over-Spiel" | "extremes Under-Spiel" | "hohes Risiko" | "schlechte Datenlage" | "ungewöhnliche Spielsituation";

export interface ExtremeCaseFlag {
  category: ExtremeCaseCategory;
  description: string;
}

/**
 * Vollständiges Ergebnis der Prediction Intelligence PRO (Version 6.0,
 * Paket 3). Rein additiv — ersetzt keine bestehende Berechnung.
 */
export interface PredictionIntelligenceProResult {
  /** Schritt 5: Korrektur der Prediction-Engine-2.0-Verstärkung um einen Konsens-Breiten-Faktor (behebt die identifizierte Unter-Trennung bei vielen moderat übereinstimmenden Modulen). */
  breadthCorrectedScore: number;
  consensusBreadthFactor: number;
  environmentalSignal: EnvironmentalSignal;
  conflictAnalysis: ConflictAnalysis;
  signalStrength: SignalStrengthAssessment;
  extremeCases: ExtremeCaseFlag[];
  /**
   * Version 6.0 (Paket 5), Punkt 4: die nicht-lineare Confidence aus
   * Prediction Engine 2.0 (`PredictionEngine2Result.nonLinearConfidence`,
   * unverändert als Basis übernommen), zusätzlich um Data-Quality-/
   * Lineup-Quality-Score gedämpft — NIEMALS künstlich verstärkt, nur bei
   * niedriger Datenqualität reduziert (Faktor 0.85–1.0).
   */
  qualityAdjustedConfidence: number;
  notes: string[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 4 — Market Intelligence Engine
// ---------------------------------------------------------------------------

export type LineMovementDirection = "over" | "under" | "stable";
export type MarketMovementSpeed = "keine Bewegung" | "langsam" | "moderat" | "schnell";

/** Ein einzelner, real beobachteter Linien-Snapshot (dauerhaft gespeichert, siehe `odds.ts`). */
export interface LineHistorySnapshot {
  timestamp: number;
  line: number;
  oddsOver: number;
  oddsUnder: number;
  bookmakerCount: number;
}

export type ClvOutcome = "positive" | "negative" | "push" | "unbekannt";

/** Closing Line Value (Schritt 5): Vergleich der eigenen/beobachteten Linie mit der später beobachteten Closing Line. */
export interface ClosingLineValueResult {
  openingLine: number | null;
  currentLine: number | null;
  closingLine: number | null;
  /** In Linienpunkten, in Richtung des Picks (positiv = Line-Value gewonnen). `null` ohne Pick oder ohne Closing Line. */
  clv: number | null;
  clvPct: number | null;
  outcome: ClvOutcome;
}

/**
 * Vollständiges Ergebnis der Market Intelligence Engine (Version 6.0,
 * Paket 4). Alle Werte werden ausschließlich aus real beobachteten Daten
 * berechnet: der eigenen, dauerhaft gespeicherten Opening-Line/Linien-
 * Historie (`odds.ts`) sowie den aktuell von mehreren Buchmachern
 * gleichzeitig gelieferten Quoten (`OddsSnapshot[]`). Sharp Money/
 * Reverse Line Movement/Steam Move sind — mangels verfügbarer Public-
 * Betting-Prozentsätze (kostenpflichtiger Datenfeed) — begründete
 * Heuristiken auf Basis von Linienbewegung, -geschwindigkeit und
 * Buchmacher-Konsens, nicht auf Basis echter Einsatzverteilungen.
 */
export interface MarketIntelligenceResult {
  openingLine: number | null;
  currentLine: number | null;
  closingLine: number | null;
  lineMovement: number | null;
  lineMovementPct: number | null;
  movementDirection: LineMovementDirection;
  /** 0–100. */
  movementStrength: number;
  movementSpeed: MarketMovementSpeed;
  movementSpeedPerHour: number | null;
  sharpMovementDetected: boolean;
  publicMovementDetected: boolean;
  reverseLineMovementDetected: boolean;
  steamMoveDetected: boolean;
  lateSharpAction: boolean;
  /** 0–100: wie einig sich die aktuell abgefragten Buchmacher bei der Linie sind. */
  marketConsensusPct: number;
  /** 0–100: Streuung der Linie über die Zeit sowie über Buchmacher hinweg. */
  marketVolatility: number;
  bookmakerCount: number;
  historyLength: number;
  /** 0–100, siehe Schritt 3 — fließt optional in die dynamische Gewichtung ein. */
  marketScore: number;
  clv: ClosingLineValueResult;
  notes: string[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 5 — Spielinformationen
// ---------------------------------------------------------------------------

export type NormalizedGameStatus =
  | "Vor Spielbeginn"
  | "Live"
  | "Beendet"
  | "Verschoben"
  | "Doubleheader Spiel 1"
  | "Doubleheader Spiel 2"
  | "Unbekannt";

/**
 * Automatisch aus der MLB Stats API abgeleitete Spielinformationen
 * (Version 6.0, Paket 5). Ausschließlich aus bereits geladenen, echten
 * Feldern berechnet (Datum/Uhrzeit-Formatierung, Zeitzonen-Umrechnung,
 * Status-Normalisierung) — keine zusätzliche API, keine erfundenen
 * Werte.
 */
export interface GameInfo {
  gameId: number;
  homeTeamName: string;
  awayTeamName: string;
  dateLabel: string;
  weekdayLabel: string;
  localTimeLabel: string;
  germanTimeLabel: string;
  status: NormalizedGameStatus;
  venueName: string;
  venueId: number | null;
  doubleheaderGameNumber: number | null;
  seriesGameNumber: number | null;
  gamesInSeries: number | null;
  seasonPhaseLabel: string;
  /** Version 6.0 (Paket 6), Schritt 8: echter Zeitpunkt (`Date.now()`), zu dem diese Spielinformationen geladen wurden — Basis für "Zeit seit letzter Aktualisierung". */
  loadedAt: number;
  /** Version 6.0 (Paket 6), Schritt 8: exakter Spielbeginn als Unix-Timestamp (ms) — Basis für den Countdown. `null`, falls `gameDate` nicht parsbar war. */
  gameStartTimestamp: number | null;
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 5 — Lineup Quality Score
// ---------------------------------------------------------------------------

/**
 * Echter Lineup Quality Score (Version 6.0, Paket 5) — ersetzt das
 * bisher immer `null`e `ExtendedMetrics.lineupStrengthScore`
 * vollständig. Ausschließlich aus real geladenen Daten berechnet
 * (Batting-Order-Vollständigkeit, Positionsabdeckung, Starter-
 * Bestätigung, Aktualität des Abrufs). "Verletzte Spieler"/"fehlende
 * Stammspieler" fließen bewusst NICHT ein — dafür gibt es im Projekt
 * keine Verletzungs-/Roster-Historien-Datenquelle; das als Score-Dimension
 * zu erfinden würde gegen das Transparenz-Gebot verstoßen.
 */
export interface LineupQualityScore {
  score: number;
  label: DataQualityLabel;
  battingOrderCompleteness: number;
  positionCoverage: number;
  pitcherConfirmed: boolean;
  bothLineupsAvailable: boolean;
  ageMinutes: number | null;
  notes: string[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 6 — Prediction Quality Engine
// ---------------------------------------------------------------------------

/** Ein Rolling-Metrik-Punkt (gleitendes Fenster über die chronologisch sortierten Backtest-Ergebnisse). */
export interface RollingMetricPoint {
  index: number;
  date: string;
  rollingAccuracy: number;
  rollingRoi: number;
  rollingYield: number;
  /** Mittlerer absoluter Abstand zwischen gemeldeter Confidence und tatsächlichem Treffer (0=perfekt kalibriert) im Fenster. */
  rollingConfidenceGap: number;
  /** Proxy für Datenvollständigkeit: Anteil der 8 Module mit echten Daten, gemittelt über das Fenster. */
  rollingDataCompleteness: number;
}

export type PredictionDriftDirection = "verbessert" | "verschlechtert" | "stabil";

/**
 * Vollständiger Prediction-Quality-Report (Version 6.0, Paket 6).
 * Baut bewusst auf den bereits bestehenden Tag-7-Berechnungen auf
 * (`ModelQualitySummary`, `ConfidenceCalibrationPoint[]`,
 * `ModuleBacktestPerformance[]`) statt sie neu zu implementieren — nur
 * Drift, Stabilität, Konsistenz, aggregierter Kalibrierungsfehler,
 * Trust Score und Rolling-Metriken sind echte Neuentwicklungen.
 */
export interface PredictionQualityReport {
  modelQuality: ModelQualitySummary;
  predictionAccuracy: number;
  predictionError: number;
  /** Mittlerer absoluter Confidence-Kalibrierungs-Fehler in Prozentpunkten, aus `ConfidenceCalibrationPoint[]` aggregiert. */
  confidenceError: number;
  /** Stichproben-gewichteter Expected Calibration Error (ECE) in Prozentpunkten. */
  calibrationError: number;
  predictionDrift: number;
  driftDirection: PredictionDriftDirection;
  predictionStability: number;
  predictionConsistency: number;
  predictionReliability: number;
  confidenceAccuracy: number;
  trustScore: number;
  trustGrade: QualityGrade;
  rollingMetrics: RollingMetricPoint[];
  sampleSize: number;
  notes: string[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 7A — Live Monitoring Core (Infrastruktur, noch ohne Alerts/Historie)
// ---------------------------------------------------------------------------

/**
 * Ein Schnappschuss der überwachten Werte zu einem Zeitpunkt.
 * Ausschließlich aus bereits vorhandenen Datenquellen befüllt.
 */
export interface LiveMonitoringSnapshot {
  timestamp: number;
  homeProbablePitcherId: number | null;
  awayProbablePitcherId: number | null;
  lineupsConfirmed: boolean;
  weatherTemperatureC: number | null;
  weatherWindSpeedMph: number | null;
  weatherWindDegrees: number | null;
  currentLine: number | null;
  marketScore: number | null;
  gameStatus: NormalizedGameStatus;
  dataQualityScore: number;
  /** Version 6.0 (Paket 7B): aus `MarketIntelligenceResult` (Paket 4, unverändert wiederverwendet). */
  steamMoveDetected: boolean;
  reverseLineMovementDetected: boolean;
  /** Version 6.0 (Paket 7B): aktueller Pick/Confidence zum Zeitpunkt des Checks, vom Aufrufer übergeben (bereits von `computeFullAnalysis()` berechnet). */
  predictionPick: "over" | "under" | null;
  confidencePct: number | null;
}

export type LiveMonitoringCategory =
  | "pitcher"
  | "lineups"
  | "weather"
  | "odds"
  | "status"
  | "dataQuality"
  | "steamMove"
  | "reverseLineMovement"
  | "prediction"
  | "confidence"
  | "marketScoreValue";

/** Ergebnis des Vergleichs zweier Snapshots — reine Erkennung, noch keine Alert-/Historien-Objekte (kommt in Paket 7B). */
export interface LiveMonitoringChangeFlags {
  pitcherChanged: boolean;
  lineupsChanged: boolean;
  weatherChanged: boolean;
  oddsChanged: boolean;
  statusChanged: boolean;
  dataQualityChanged: boolean;
  /** Version 6.0 (Paket 7B) */
  steamMoveChanged: boolean;
  reverseLineMovementChanged: boolean;
  predictionChanged: boolean;
  confidenceChanged: boolean;
  marketScoreChanged: boolean;
  changedCategories: LiveMonitoringCategory[];
  hasAnyChange: boolean;
}

/** Status einer einzelnen überwachten API-Quelle — nutzt denselben Status-Wertebereich wie `ApiSourceHealth` (Tag 9/Paket 5), keine Dopplung. */
export interface LiveMonitoringApiStatus {
  source: string;
  status: ApiSourceStatus;
  lastCheckedAt: number | null;
}

/** Öffentlicher Zustand der Live Monitoring Engine, wie er im Dashboard angezeigt wird (Schritt 5). */
export interface LiveMonitoringState {
  isActive: boolean;
  lastCheckedAt: number | null;
  nextCheckAt: number | null;
  checkIntervalMs: number;
  apiStatus: LiveMonitoringApiStatus[];
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 7B — Smart Alerts & Change History
// ---------------------------------------------------------------------------

export type AlertCategory =
  | "pitcher"
  | "lineup"
  | "weather"
  | "odds"
  | "steamMove"
  | "reverseLineMovement"
  | "prediction"
  | "confidence"
  | "marketScore"
  | "dataQuality";

export type AlertSeverity = "niedrig" | "mittel" | "hoch" | "kritisch";

/**
 * Eine einzelne, real erkannte Änderung (Version 6.0, Paket 7B). Baut
 * auf `LiveMonitoringSnapshot`/`detectChangeFlags` aus Paket 7A auf —
 * keine neue Erkennungslogik, nur die Umsetzung einer erkannten
 * Änderung in ein dokumentiertes, chronologisch gespeichertes Ereignis.
 */
export interface SmartAlert {
  id: string;
  timestamp: number;
  category: AlertCategory;
  description: string;
  oldValue: string;
  newValue: string;
  impact: string;
  severity: AlertSeverity;
  /**
   * Version 6.0 (Paket 7C): "Alert Confidence" — wie deutlich die
   * erkannte Änderung über der Erkennungsschwelle liegt (0–100). Bei
   * binären Änderungen (Pitcher/Prediction gewechselt, Steam Move
   * erkannt etc.) immer 100 — eindeutig, kein Schwellenwert-Ermessen.
   */
  confidencePct: number;
}
// ---------------------------------------------------------------------------
// Version 6.0 Paket 7C — Live Re-Analysis Qualitätskennzahlen
// ---------------------------------------------------------------------------

/**
 * Live-Kontext-Qualitätskennzahlen (Version 6.0, Paket 7C). Bewusst
 * NICHT identisch mit `PredictionQualityReport` (Paket 6, aus
 * historischen Backtests): dort wird die Modellqualität über viele
 * vergangene Spiele bewertet, hier die Verlässlichkeit der AKTUELLEN
 * Live-Überwachung eines einzelnen, laufenden Spiels.
 */
export interface LiveQualityMetrics {
  /** 0–100: je weniger Änderungen relativ zu den durchgeführten Checks, desto stabiler. */
  liveStability: number;
  /** 0–100: Vertrauen in den aktuellen Live-Stand, aus API-Gesundheit und Aktualität der letzten Prüfung. */
  updateConfidence: number;
  /** 0–100: Komposit aus Live Stability, Update Confidence und Häufigkeit kritischer Alerts. */
  livePredictionReliability: number;
  /** 0–100: Mittelwert der `SmartAlert.confidencePct` aller bisher erkannten Änderungen. */
  averageAlertConfidence: number;
  checksPerformed: number;
  changesDetectedCount: number;
}
// ---------------------------------------------------------------------------
// Version 7.0 — Run Line (Asian Handicap) Analyzer
// ---------------------------------------------------------------------------

export type AnalysisMode = "overUnder" | "runLine";

/** Eine einzelne Run-Line-Variante (z. B. -1.5/+1.5, -2.5/+2.5) mit beiden Seiten. */
export interface RunLineOutcome {
  line: number;
  favoriteTeam: "home" | "away";
  /** Wahrscheinlichkeit, dass der Favorit die Linie (−line) deckt. */
  favoriteCoverProbability: number;
  /** Wahrscheinlichkeit, dass der Underdog die Linie (+line) deckt — exakt `1 - favoriteCoverProbability` (halbe Linien, kein Push möglich). */
  underdogCoverProbability: number;
  favoriteFairOdds: number;
  underdogFairOdds: number;
}

/** Begründete Empfehlung für eine konkrete Run-Line-Seite (Schritt "Zielquote"). */
export interface RunLineRecommendation {
  line: number;
  side: "favorite" | "underdog";
  team: "home" | "away";
  probability: number;
  fairOdds: number;
  marketOdds: number | null;
  valuePct: number | null;
  confidence: number;
  /** Abstand der (Fair- oder Markt-)Quote zur Zielquote ≈2.00. */
  distanceToTargetOdds: number;
  reasoning: string[];
}

/**
 * Vollständiges Run-Line-Analyseergebnis (Version 7.0). Nutzt
 * ausschließlich bereits bestehende, unveränderte Bausteine
 * (`pitcherExpectedRunsAllowed`, `offenseExpectedRuns`,
 * `bullpenExpectedRuns` aus `@/utils/scoring`; `poissonPmf` aus
 * `@/utils/poisson`) — keine neue Datenquelle, keine neue Kern-Statistik.
 */
export interface RunLineAnalysis {
  homeExpectedRuns: number;
  awayExpectedRuns: number;
  expectedRunDifferential: number;
  favoriteTeam: "home" | "away";
  outcomes: RunLineOutcome[];
  recommendation: RunLineRecommendation;
  /** `true`, falls Heim-/Auswärts-Aufteilung mangels Daten nur symmetrisch angenommen wurde (transparent, kein erfundener Vorteil). */
  splitEstimated: boolean;
  /**
   * Explainable AI (Version 7.0): mit "+"/"−" markierte Gründe für den
   * Favoriten, analog zur bestehenden Decision-Support-Darstellung
   * (Tag 8) — hier speziell für den Team-vs-Team-Vergleich der Run
   * Line statt der Modul-Einflüsse auf das Gesamt-Total.
   */
  explainableReasons: string[];
  notes: string[];
}
