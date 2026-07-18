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

/** Erzeugt ein ISO-Datum (YYYY-MM-DD) für Dateinamen o. Ä. */
export function isoDateStamp(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
