import type { MonteCarloResult, RunEnvironmentVarianceComponents } from "@/types";
import { clamp, createSeededRandom, mean, stdDev as computeStdDev } from "@/utils/math";

/**
 * Berechnet den Median eines BEREITS sortierten Arrays direkt, ohne die
 * (für diesen Zweck redundante) Kopie + erneute Sortierung der
 * geteilten `median()`-Hilfsfunktion aus `@/utils/math` — bei 10.000+
 * Simulationsdurchläufen pro Analyse spart das eine vollständige
 * O(n log n)-Sortierung eines bereits sortierten Arrays. Liefert bei
 * identischer Eingabe exakt denselben Wert wie `median(sortedValues)`.
 *
 * Performance PRO.
 */
function medianOfSorted(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const mid = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid];
}

/**
 * Zählt in EINEM Durchlauf, wie viele Werte über bzw. unter der Linie
 * liegen — vermeidet zwei separate `Array.filter(...).length`-Aufrufe,
 * die sonst je ein vollständiges, temporäres 10.000+-Element-Array
 * alloziert hätten, nur um es sofort wieder zu verwerfen.
 *
 * Performance PRO.
 */
function countAboveBelow(values: number[], line: number): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > line) above++;
    else if (values[i] < line) below++;
  }
  return { above, below };
}

/**
 * Zieht eine einzelne Poisson-verteilte Zufallszahl mittels der
 * Knuth-Methode (Produkt gleichverteilter Zufallszahlen gegen e^-λ).
 * Für die hier relevanten λ-Bereiche (typischerweise 3–15 Runs) ist das
 * performant genug für 10.000+ Simulationen.
 */
function samplePoisson(lambda: number, rng: () => number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > l);
  return k - 1;
}

/**
 * Zieht eine standardnormalverteilte Zufallszahl (Box-Muller-Transformation).
 */
function sampleStandardNormal(rng: () => number): number {
  // Vermeidet log(0), indem u1 niemals exakt 0 wird.
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Zieht eine normalverteilte Zufallszahl mit Poisson-äquivalenten
 * Momenten (Mittelwert λ, Varianz λ) — die klassische Normal-Approximation
 * der Poisson-Verteilung, hier als zweites, unabhängiges Simulationsmodell
 * genutzt (Monte Carlo PRO: "Normal Distribution").
 */
function sampleNormalApprox(lambda: number, rng: () => number): number {
  const value = lambda + sampleStandardNormal(rng) * Math.sqrt(Math.max(lambda, 0.0001));
  return Math.max(0, Math.round(value));
}

/**
 * Berechnet Perzentil-Grenzen aus einem bereits sortierten Array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.round((sorted.length - 1) * p), 0, sorted.length - 1);
  return sorted[index];
}

/**
 * Baut aus einer Ergebnis-Stichprobe ein Histogramm + eine normalisierte
 * Wahrscheinlichkeits-Verteilungskurve ("Distribution Curve").
 */
function buildDistribution(
  results: number[]
): { histogram: { bucket: number; count: number }[]; distributionCurve: { bucket: number; probability: number }[] } {
  const maxRuns = results[results.length - 1] ?? 0;
  const bucketCount = Math.min(maxRuns + 1, 30);
  const histogramMap = new Map<number, number>();
  results.forEach((r) => histogramMap.set(r, (histogramMap.get(r) ?? 0) + 1));

  const histogram = Array.from({ length: bucketCount }, (_, bucket) => ({
    bucket,
    count: histogramMap.get(bucket) ?? 0,
  }));

  const distributionCurve = histogram.map((entry) => ({
    bucket: entry.bucket,
    probability: results.length > 0 ? entry.count / results.length : 0,
  }));

  return { histogram, distributionCurve };
}

/**
 * Bewertet die Stabilität der Simulation über eine Split-Half-Prüfung:
 * die Stichprobe wird in zwei unabhängige Hälften (gerade/ungerade Indizes
 * der Ziehungsreihenfolge) geteilt, deren Über-Wahrscheinlichkeiten
 * verglichen werden. Eine kleine Differenz bedeutet, dass die Simulation
 * bereits mit der gewählten Anzahl an Durchläufen konvergiert ist.
 */
function computeSplitHalfConfidence(rawSequence: number[], line: number): number {
  if (rawSequence.length < 100) return 50;

  const firstHalf = rawSequence.filter((_, i) => i % 2 === 0);
  const secondHalf = rawSequence.filter((_, i) => i % 2 === 1);

  const overShareFirst = firstHalf.filter((r) => r > line).length / firstHalf.length;
  const overShareSecond = secondHalf.filter((r) => r > line).length / secondHalf.length;

  const divergence = Math.abs(overShareFirst - overShareSecond);
  // Divergenz von 0 → 100 Confidence, Divergenz ab 10 Prozentpunkten → 0 Confidence.
  return clamp(100 - divergence * 1000, 0, 100);
}

/**
 * Vergleicht die Monte-Carlo-Über-Wahrscheinlichkeit mit der geschlossenen
 * Poisson-Lösung ("Simulation Agreement"). Hohe Übereinstimmung bestätigt,
 * dass das Simulationsmodell die analytische Lösung korrekt reproduziert;
 * größere Abweichungen deuten auf zusätzliche Varianzquellen
 * (Wetter-/Datenunsicherheit) oder zu wenige Durchläufe hin.
 */
function computeSimulationAgreement(monteCarloOverProbability: number, referenceOverProbability: number | null): number {
  if (referenceOverProbability === null) return 100;
  const divergence = Math.abs(monteCarloOverProbability - referenceOverProbability);
  // Divergenz von 0 → 100 % Agreement, ab 15 Prozentpunkten Abweichung → 0 %.
  return clamp(100 - divergence * (100 / 0.15), 0, 100);
}

/**
 * Erstellt eine kurze, menschlich lesbare Zusammenfassung der
 * dominierenden Unsicherheitsquellen ("Run Environment").
 */
function describeRunEnvironment(components: RunEnvironmentVarianceComponents, varianceBoost: number): string | null {
  const notes: string[] = [];
  if (components.pitcher > 0) notes.push("Pitcher-Datenbasis");
  if (components.bullpen > 0) notes.push("Bullpen-Zustand");
  if (components.weather > 0 || varianceBoost > 0) notes.push("Wetterunsicherheit");
  if (components.ballpark > 0) notes.push("Ballpark-Extremwert");
  if (components.offense > 0) notes.push("Offense-Datenbasis");

  if (notes.length === 0) return null;
  return `Erhöhte Streuung durch: ${notes.join(", ")}.`;
}

/**
 * Führt eine Monte-Carlo-Simulation der Gesamt-Runs durch (Monte Carlo PRO).
 *
 * Simuliert zwei unabhängige Modelle parallel:
 *  1. Poisson-Ziehung (Haupt-Simulationsmodell, wie bisher)
 *  2. Normal-Approximation (Mittelwert/Varianz = λ) als Vergleichsmodell
 *
 * Zusätzlich zur bisherigen Ausgabe (Mittelwert/Median/Min/Max/95 %-CI/
 * Histogramm/Über-Unter-Wahrscheinlichkeit) liefert Monte Carlo PRO:
 * Varianz/Standardabweichung, 80 %-Konfidenzintervall, eine normalisierte
 * Wahrscheinlichkeits-Verteilungskurve, die Normal-Approximations-
 * Wahrscheinlichkeiten, eine Simulation-Confidence (Split-Half-Stabilität),
 * eine Simulation-Agreement (Abgleich mit der geschlossenen
 * Poisson-Lösung) sowie eine Aufschlüsselung der Varianzquellen
 * ("Run Environment": Pitcher-/Bullpen-/Weather-/Ballpark-/Offense-Impact).
 *
 * @param expectedRuns          Erwartete Gesamt-Runs (λ) laut Modell
 * @param line                  Wettlinie zur Berechnung von Über/Unter
 * @param runs                  Anzahl der Simulationsdurchläufe (Standard 10.000)
 * @param varianceBoost         Zusätzliche pauschale Streuung (z. B. Regen-Unsicherheit), 0 = keine
 * @param seed                  Optionaler Seed für Reproduzierbarkeit
 * @param varianceComponents    Optionale Aufschlüsselung zusätzlicher Streuung nach Ursprungs-Modul
 * @param referenceOverProbability  Optionale Referenz-Über-Wahrscheinlichkeit (z. B. aus dem Poisson-Modell) für die Simulation-Agreement-Berechnung
 */
export function runMonteCarloSimulation(
  expectedRuns: number,
  line: number,
  runs = 10000,
  varianceBoost = 0,
  seed = 42,
  varianceComponents?: RunEnvironmentVarianceComponents,
  referenceOverProbability?: number
): MonteCarloResult {
  const rng = createSeededRandom(seed);
  const lambda = clamp(expectedRuns, 0.01, 30);

  const components: RunEnvironmentVarianceComponents = varianceComponents ?? {
    pitcher: 0,
    bullpen: 0,
    weather: 0,
    ballpark: 0,
    offense: 0,
  };

  const totalComponentVariance = components.pitcher + components.bullpen + components.weather + components.ballpark + components.offense;
  const totalVarianceBoost = varianceBoost + totalComponentVariance;

  const results: number[] = new Array(runs);
  const normalResults: number[] = new Array(runs);

  for (let i = 0; i < runs; i++) {
    // Hauptmodell: Poisson-Ziehung
    let value = samplePoisson(lambda, rng);
    // Vergleichsmodell: Normal-Approximation, unabhängig gezogen
    normalResults[i] = sampleNormalApprox(lambda, rng);

    // Optionale zusätzliche Streuung (Run Environment: Wetter, dünne
    // Pitcher-/Bullpen-/Offense-Datenbasis, Ballpark-Extremwerte) als
    // symmetrisches Rauschen von bis zu ± totalVarianceBoost Runs.
    if (totalVarianceBoost > 0) {
      value += Math.round((rng() - 0.5) * 2 * totalVarianceBoost);
    }

    results[i] = Math.max(0, value);
  }

  // Performance PRO: `results` wird nach der Schleife nicht mehr
  // mutiert (`sorted` entsteht aus einer eigenen Kopie) — `rawSequence`
  // kann daher direkt dieselbe Referenz verwenden, statt sie unnötig zu
  // kopieren.
  const rawSequence = results;

  const sorted = results.slice().sort((a, b) => a - b);
  const ciLowIndex = Math.floor(runs * 0.025);
  const ciHighIndex = Math.ceil(runs * 0.975) - 1;

  const { above: overCount, below: underCount } = countAboveBelow(sorted, line);
  const { above: normalOverCount, below: normalUnderCount } = countAboveBelow(normalResults, line);

  const { histogram, distributionCurve } = buildDistribution(sorted);

  // Performance PRO: `computeStdDev(sorted)` einmal berechnen und für
  // sowohl `variance` als auch `stdDev` wiederverwenden, statt denselben
  // O(n)-Durchlauf über ein 10.000+-Element-Array zweimal auszuführen.
  const stdDevValue = computeStdDev(sorted);
  const variance = stdDevValue ** 2;

  const simulationConfidence = computeSplitHalfConfidence(rawSequence, line);
  const simulationAgreement = computeSimulationAgreement(overCount / runs, referenceOverProbability ?? null);

  return {
    simulations: runs,
    mean: mean(sorted),
    median: medianOfSorted(sorted),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    ciLow: sorted[Math.max(0, ciLowIndex)] ?? 0,
    ciHigh: sorted[Math.min(sorted.length - 1, ciHighIndex)] ?? 0,
    overProbability: overCount / runs,
    underProbability: underCount / runs,
    histogram,
    variance,
    stdDev: stdDevValue,
    ci80Low: percentile(sorted, 0.1),
    ci80High: percentile(sorted, 0.9),
    distributionCurve,
    normalApproxOverProbability: normalOverCount / runs,
    normalApproxUnderProbability: normalUnderCount / runs,
    simulationConfidence,
    simulationAgreement,
    varianceComponents: components,
    runEnvironmentNote: describeRunEnvironment(components, varianceBoost),
  };
}
