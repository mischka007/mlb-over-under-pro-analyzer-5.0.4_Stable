/**
 * Grundlegende, wiederverwendbare Mathe-Hilfsfunktionen.
 * Werden von Scoring-, Poisson- und Monte-Carlo-Modulen genutzt.
 */

/** Begrenzt einen Wert auf ein Intervall [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Wandelt einen String-Input sicher in eine Zahl um, oder null falls ungültig. */
export function toNumber(value: string): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Wandelt ein Array von String-Eingaben in ein Array gültiger Zahlen um und
 * lässt leere/ungültige Einträge korrekt weg.
 *
 * WICHTIG: Bewusst NICHT als `values.map(Number).filter(Number.isFinite)`
 * implementiert — `Number('')` ergibt in JavaScript `0`, nicht `NaN`, und
 * würde von `Number.isFinite` fälschlich als gültiger Wert durchgelassen.
 * Das führte in einer früheren Version dazu, dass komplett leere
 * Eingabefelder als "10 Spiele mit je 0 Runs" statt als "keine Daten"
 * interpretiert wurden. `toNumber()` behandelt einen leeren String korrekt
 * als `null`.
 */
export function toNumberArray(values: string[]): number[] {
  return values.map(toNumber).filter((n): n is number => n !== null);
}

/** Arithmetisches Mittel eines Zahlen-Arrays. Ignoriert NaN-Werte. */
export function mean(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/** Standardabweichung (Stichprobe) eines Zahlen-Arrays. */
export function stdDev(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length < 2) return 0;
  const m = mean(valid);
  const variance = valid.reduce((acc, v) => acc + (v - m) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

/** Median eines Zahlen-Arrays. */
export function median(values: number[]): number {
  const valid = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (valid.length === 0) return 0;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];
}

/** Prüft, ob mindestens ein Eintrag eines String-Arrays gefüllt ist. */
export function hasAnyValue(values: string[]): boolean {
  return values.some((v) => v !== "" && v !== null && v !== undefined);
}

/**
 * Gewichteter Mittelwert einer Liste von { value, weight }-Paaren.
 * Einträge mit value === null werden ignoriert; die Gewichte der übrigen
 * Einträge werden proportional neu normalisiert.
 */
export function weightedAverage(parts: { value: number | null; weight: number }[]): number | null {
  const valid = parts.filter((p): p is { value: number; weight: number } => p.value !== null);
  if (valid.length === 0) return null;
  const weightSum = valid.reduce((a, p) => a + p.weight, 0);
  if (weightSum === 0) return null;
  return valid.reduce((a, p) => a + p.value * p.weight, 0) / weightSum;
}

/** Lineare Interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Einfacher, deterministisch-seedbarer Pseudo-Zufallsgenerator (Mulberry32).
 * Wird für die Monte-Carlo-Simulation genutzt, damit Ergebnisse bei Bedarf
 * reproduzierbar bleiben.
 */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
