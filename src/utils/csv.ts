import type { AnalyzerState, ConsensusResult, GameInfo, LineupQualityScore, MarketIntelligenceResult, PoissonResult, SmartAlert } from "@/types";
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
 *
 * Version 6.0 (Paket 5), Priorität 6: `gameInfo`/`marketIntelligence`/
 * `lineupQuality` sind optional — werden sie übergeben, erscheinen die
 * Spielinformationen, Market-Intelligence- und Lineup-Quality-Daten als
 * zusätzliche Abschnitte in der CSV.
 */
export function exportAnalysisAsCsv(
  state: AnalyzerState,
  consensus: ConsensusResult,
  poisson: PoissonResult,
  gameInfo?: GameInfo | null,
  marketIntelligence?: MarketIntelligenceResult | null,
  lineupQuality?: LineupQualityScore | null
): void {
  const rows: (string | number)[][] = [["Feld", "Wert"]];

  if (gameInfo) {
    rows.push(
      ["Heimteam", gameInfo.homeTeamName],
      ["Auswärtsteam", gameInfo.awayTeamName],
      ["Datum", gameInfo.dateLabel],
      ["Wochentag", gameInfo.weekdayLabel || "–"],
      ["US-Zeit", gameInfo.localTimeLabel || "–"],
      ["Lokale Zeit", gameInfo.germanTimeLabel || "–"],
      ["Status", gameInfo.status],
      ["Stadion", gameInfo.venueName || "–"],
      ["Saisonphase", gameInfo.seasonPhaseLabel],
      ["Game-ID", gameInfo.gameId],
      ["Venue-ID", gameInfo.venueId ?? "–"],
      ["Doubleheader-Spiel", gameInfo.doubleheaderGameNumber ?? "–"],
      ["Serie", gameInfo.seriesGameNumber !== null && gameInfo.gamesInSeries !== null ? `${gameInfo.seriesGameNumber}/${gameInfo.gamesInSeries}` : "–"],
      [""]
    );
  } else {
    rows.push(
      ["Heimteam", state.setup.homeTeamName || "–"],
      ["Auswärtsteam", state.setup.awayTeamName || "–"]
    );
  }

  rows.push(
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
    ])
  );

  if (marketIntelligence) {
    rows.push(
      [""],
      ["Market Intelligence", ""],
      ["Opening Line", marketIntelligence.openingLine?.toFixed(1) ?? "–"],
      ["Current Line", marketIntelligence.currentLine?.toFixed(1) ?? "–"],
      ["Closing Line", marketIntelligence.closingLine?.toFixed(1) ?? "–"],
      ["Line Movement", marketIntelligence.lineMovement?.toFixed(2) ?? "–"],
      ["Market Score", marketIntelligence.marketScore],
      ["Sharp Movement", marketIntelligence.sharpMovementDetected ? "Ja" : "Nein"],
      ["Reverse Line Movement", marketIntelligence.reverseLineMovementDetected ? "Ja" : "Nein"],
      ["Steam Move", marketIntelligence.steamMoveDetected ? "Ja" : "Nein"],
      ["CLV", marketIntelligence.clv.clv?.toFixed(2) ?? "–"]
    );
  }

  if (lineupQuality) {
    rows.push(
      [""],
      ["Lineup Quality", ""],
      ["Lineup Quality Score", lineupQuality.score],
      ["Batting-Order-Vollständigkeit", lineupQuality.battingOrderCompleteness.toFixed(0)],
      ["Positionsabdeckung", lineupQuality.positionCoverage.toFixed(0)],
      ["Starter bestätigt", lineupQuality.pitcherConfirmed ? "Ja" : "Nein"],
      ["Beide Lineups verfügbar", lineupQuality.bothLineupsAvailable ? "Ja" : "Nein"]
    );
  }

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

/**
 * Version 6.0 (Paket 7B): exportiert die Live-Monitoring-Change-History
 * (Smart Alerts) als CSV-Datei — chronologisch, mit Zeit, altem/neuem
 * Wert, Auswirkung und Schweregrad. Nur echte, während der laufenden
 * Session erkannte Änderungen — keine Platzhalter.
 */
export function exportChangeHistoryAsCsv(changeHistory: SmartAlert[]): void {
  const rows: (string | number)[][] = [
    ["Zeit", "Kategorie", "Beschreibung", "Alter Wert", "Neuer Wert", "Auswirkung", "Schweregrad", "Alert Confidence"],
    ...changeHistory.map((alert) => [
      new Date(alert.timestamp).toLocaleString("de-DE"),
      alert.category,
      alert.description,
      alert.oldValue,
      alert.newValue,
      alert.impact,
      alert.severity,
      alert.confidencePct,
    ]),
  ];

  const csvContent = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `mlb-change-history-${isoDateStamp()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
