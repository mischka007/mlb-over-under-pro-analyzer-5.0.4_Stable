import type { AnalyzerState, ConsensusResult, PoissonResult } from "@/types";
import { isoDateStamp } from "@/utils/format";

/** Escaped einen CSV-Feldwert (Kommas, Anführungszeichen, Zeilenumbrüche). */
function csvEscape(value: string | number): string {
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exportiert die wichtigsten Analyse-Ergebnisse als CSV-Datei und löst den
 * Download im Browser aus.
 */
export function exportAnalysisAsCsv(
  state: AnalyzerState,
  consensus: ConsensusResult,
  poisson: PoissonResult
): void {
  const rows: (string | number)[][] = [
    ["Feld", "Wert"],
    ["Heimteam", state.setup.homeTeamName || "–"],
    ["Auswärtsteam", state.setup.awayTeamName || "–"],
    ["Wettlinie", state.setup.line || "–"],
    ["Bookmaker", state.setup.bookmaker || "–"],
    ["Quote Über", state.setup.oddsOver || "–"],
    ["Quote Unter", state.setup.oddsUnder || "–"],
    ["Erwartete Gesamt-Runs (Poisson)", poisson.expectedRuns.toFixed(2)],
    ["Über-Wahrscheinlichkeit", (poisson.overProbability * 100).toFixed(1) + "%"],
    ["Unter-Wahrscheinlichkeit", (poisson.underProbability * 100).toFixed(1) + "%"],
    ["Gesamtscore (Konsens)", consensus.finalScore.toFixed(1)],
    ["Pick", consensus.pick ?? "–"],
    ["Konfidenz", (consensus.confidence * 100).toFixed(1) + "%"],
    ["Sterne", consensus.stars],
    [""],
    ["Modul", "Score (0-100)", "Gewichtung %", "Erwartete Runs", "Daten vorhanden"],
    ...consensus.modules.map((m) => [
      m.label,
      m.score.toFixed(1),
      (m.weight * 100).toFixed(0),
      m.expectedRuns !== null ? m.expectedRuns.toFixed(2) : "–",
      m.hasData ? "Ja" : "Nein",
    ]),
  ];

  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mlb-analyzer-${isoDateStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
