/** Formatiert eine Wahrscheinlichkeit (0–1) als Prozentzahl mit einer Nachkommastelle. */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Formatiert eine Zahl als Währungsbetrag (€). */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

/** Formatiert eine Dezimalquote mit zwei Nachkommastellen. */
export function formatOdds(value: number): string {
  return value.toFixed(2);
}

/** Formatiert eine allgemeine Zahl mit fester Nachkommastellenzahl. */
export function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/**
 * Formatiert eine Zahl mit explizitem Vorzeichen (+/-), z. B. für Edge-/
 * ROI-/Änderungs-Werte. Behebt dabei ein reales Floating-Point-Problem:
 * ein knapp negativer Wert wie `-0.04` würde mit `.toFixed(1)` zu
 * `"-0.0"` runden — sichtbar falsch, da der gerundete Wert eigentlich
 * neutral ist. Wird stattdessen als `"0.0"` (ohne Vorzeichen) dargestellt.
 */
export function formatSigned(value: number, digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  const normalized = rounded === 0 ? 0 : rounded;
  return `${normalized > 0 ? "+" : ""}${normalized.toFixed(digits)}`;
}

/**
 * Erzeugt einen dateisystemsicheren Datum+Zeit-Stempel (YYYY-MM-DD_HH-mm-ss)
 * für Dateinamen. Enthält bewusst die Uhrzeit (nicht nur das Datum), damit
 * mehrere Exporte am selben Tag eindeutige, chronologisch sortierbare
 * Dateinamen erhalten. Keine Doppelpunkte (unter Windows in Dateinamen
 * nicht zulässig).
 */
export function isoDateStamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const datePart = date.toISOString().slice(0, 10);
  const timePart = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `${datePart}_${timePart}`;
}
