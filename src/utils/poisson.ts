import type { PoissonResult } from "@/types";
import { clamp } from "@/utils/math";

/**
 * Berechnet die Poisson-Wahrscheinlichkeitsmassefunktion (PMF) für λ = expectedRuns
 * über k = 0..cap, iterativ berechnet um Fakultäts-Overflow bei großen k zu vermeiden:
 * P(0) = e^-λ,  P(k) = P(k-1) * λ / k
 *
 * Version 7.0: exportiert, damit der neue Run-Line-Analyzer
 * (`@/engine/runLineEngine`) dieselbe, bereits validierte PMF-Berechnung
 * wiederverwenden kann, statt sie zu duplizieren. Die Funktion selbst
 * bleibt unverändert.
 */
export function poissonPmf(lambda: number, cap: number): number[] {
  const pmf = new Array(cap + 1).fill(0);
  pmf[0] = Math.exp(-lambda);
  for (let k = 1; k <= cap; k++) {
    pmf[k] = (pmf[k - 1] * lambda) / k;
  }
  return pmf;
}

/**
 * Berechnet das vollständige Poisson-Modell für eine gegebene erwartete
 * Gesamt-Run-Zahl (λ) und eine Wettlinie.
 *
 * Rückgabe enthält die vollständige Run-Verteilung (für Diagramme) sowie
 * Über-/Unter-/Push-Wahrscheinlichkeiten.
 */
export function computePoissonModel(expectedRuns: number, line: number): PoissonResult {
  const safeLambda = clamp(expectedRuns, 0.01, 30);
  const cap = Math.max(24, Math.ceil(safeLambda * 3));
  const pmf = poissonPmf(safeLambda, cap);

  let overProbability = 0;
  let underProbability = 0;
  let pushProbability = 0;

  const distribution = pmf.map((probability, runs) => {
    if (runs > line) overProbability += probability;
    else if (runs < line) underProbability += probability;
    else pushProbability += probability;
    return { runs, probability };
  });

  return {
    expectedRuns: safeLambda,
    distribution,
    overProbability,
    underProbability,
    pushProbability,
  };
}
