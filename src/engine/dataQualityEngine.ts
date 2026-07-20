import type { AnalyzerState, ConfidenceFactor, DataQualityAreaAssessment, DataQualityLabel, DataQualityReport } from "@/types";
import type { FullAnalysis } from "@/models/GameModel";
import { toNumber } from "@/utils/math";

/**
 * Tag 9 — Data Quality Engine.
 *
 * Zentrale Bewertung der Datenqualität je Bereich. Nutzt für Pitcher/
 * Bullpen/Offense/Weather/Market ausschließlich die bereits bestehenden
 * Confidence-Engine-Faktoren (`ConfidenceBreakdown.factors`, Paket 4,
 * unverändert wiederverwendet) — für Head-to-Head und Ballpark (dort
 * bisher kein eigener Confidence-Faktor) wird die Feld-Vollständigkeit
 * der tatsächlichen Eingabedaten berechnet. Lineups fließt nur ein,
 * wenn der Aufrufer den echten Lade-Status übergibt (aus
 * `useGameAutoLoad`s `AvailabilityFlags`) — ohne Angabe wird der
 * Bereich ausgelassen statt einen Wert zu erfinden.
 */

function labelForScore(score: number): DataQualityLabel {
  if (score >= 85) return "Exzellent";
  if (score >= 70) return "Gut";
  if (score >= 50) return "Ausreichend";
  if (score >= 30) return "Schwach";
  return "Unzureichend";
}

/** Rundet den Confidence-Faktor-Score/Gewicht auf einen geschätzten Confidence-Beitrag in Prozentpunkten um. */
function confidenceImpactFromFactor(factor: ConfidenceFactor | undefined): number {
  if (!factor) return 0;
  return Math.round((factor.score / 100 - 0.5) * factor.weight * 100 * 10) / 10;
}

function areaFromConfidenceFactor(area: string, factor: ConfidenceFactor | undefined, fallbackNote: string): DataQualityAreaAssessment {
  const score = factor?.score ?? 0;
  return {
    area,
    qualityScore: Math.round(score),
    qualityLabel: labelForScore(score),
    confidenceImpact: confidenceImpactFromFactor(factor),
    note: factor?.note ?? fallbackNote,
  };
}

/** Anteil (0–100) der übergebenen String-Werte, die sich zu einer gültigen Zahl parsen lassen. */
function fieldsPresentPct(values: string[]): number {
  if (values.length === 0) return 0;
  const present = values.filter((v) => toNumber(v) !== null).length;
  return (present / values.length) * 100;
}

function assessH2HQuality(state: AnalyzerState): DataQualityAreaAssessment {
  const numericFieldsPct = fieldsPresentPct([state.h2h.firstFiveInningsAvg, state.h2h.extraInningsGames]);
  const last10Filled = state.h2h.last10TotalRuns.filter((v) => toNumber(v) !== null).length;
  const last10Pct = state.h2h.last10TotalRuns.length > 0 ? (last10Filled / state.h2h.last10TotalRuns.length) * 100 : 0;
  const score = Math.round(numericFieldsPct * 0.4 + last10Pct * 0.6);

  return {
    area: "Head-to-Head",
    qualityScore: score,
    qualityLabel: labelForScore(score),
    confidenceImpact: 0,
    note: `${last10Filled}/${state.h2h.last10TotalRuns.length} Duelle (letzte 10) mit echten Runs-Werten hinterlegt.`,
  };
}

function assessBallparkQuality(state: AnalyzerState): DataQualityAreaAssessment {
  const fields = [
    state.ballpark.runFactor,
    state.ballpark.hrFactor,
    state.ballpark.singlesFactor,
    state.ballpark.doublesFactor,
    state.ballpark.triplesFactor,
    state.ballpark.altitudeMeters,
    state.ballpark.leftFieldDistance,
    state.ballpark.rightFieldDistance,
  ];
  const score = Math.round(fieldsPresentPct(fields));
  const filled = fields.filter((v) => toNumber(v) !== null).length;

  return {
    area: "Ballpark",
    qualityScore: score,
    qualityLabel: labelForScore(score),
    confidenceImpact: 0,
    note: `${filled}/${fields.length} Ballpark-Kennzahlen hinterlegt.`,
  };
}

/**
 * Baut den vollständigen Data-Quality-Report auf. `lineupsAvailable` ist
 * optional (aus `AvailabilityFlags.lineups`, siehe `useGameAutoLoad`) —
 * wird es nicht übergeben, bleibt der Lineups-Bereich ausgelassen statt
 * einen Wert zu erfinden.
 */
/**
 * Version 6.0 (Paket 5), Punkt 3: `lineupQualityScore` (der echte,
 * nuancierte Score aus `@/engine/lineupQualityEngine`, sofern
 * verfügbar) ersetzt die bisher rein binäre `lineupsAvailable`-Prüfung
 * mit einer präziseren Bewertung. `marketIntelligenceScore` und
 * `gameInfoComplete` sind neue, eigenständige Bereiche.
 */
export function buildDataQualityReport(
  state: AnalyzerState,
  analysis: FullAnalysis,
  lineupsAvailable?: boolean,
  lineupQualityScore?: number | null,
  marketIntelligenceScore?: number | null,
  gameInfoComplete?: boolean
): DataQualityReport {
  const factors = analysis.advancedPrediction.confidenceBreakdown.factors;
  const findFactor = (key: string) => factors.find((f) => f.key === key);

  const areas: DataQualityAreaAssessment[] = [
    areaFromConfidenceFactor("Pitcher", findFactor("pitcherDataQuality"), "Keine Pitcher-PRO-Daten vorhanden."),
    areaFromConfidenceFactor("Bullpen", findFactor("bullpenDataQuality"), "Keine Bullpen-PRO-Daten vorhanden."),
    areaFromConfidenceFactor("Offense", findFactor("offenseDataQuality"), "Keine Offense-PRO-Daten vorhanden."),
    areaFromConfidenceFactor("Weather", findFactor("weatherDataQuality"), "Keine Wetterdaten vorhanden."),
    areaFromConfidenceFactor("Market", findFactor("marketDataQuality"), "Keine Marktdaten vorhanden."),
    assessH2HQuality(state),
    assessBallparkQuality(state),
  ];

  if (lineupQualityScore !== undefined && lineupQualityScore !== null) {
    areas.push({
      area: "Lineups",
      qualityScore: lineupQualityScore,
      qualityLabel: labelForScore(lineupQualityScore),
      confidenceImpact: 0,
      note: `Echter Lineup Quality Score (Batting-Order-Vollständigkeit, Positionsabdeckung, Starter-Bestätigung, Aktualität): ${lineupQualityScore}/100.`,
    });
  } else if (lineupsAvailable !== undefined) {
    const score = lineupsAvailable ? 100 : 0;
    areas.push({
      area: "Lineups",
      qualityScore: score,
      qualityLabel: labelForScore(score),
      confidenceImpact: 0,
      note: lineupsAvailable ? "Lineups erfolgreich geladen." : "Lineups konnten nicht geladen werden (noch nicht veröffentlicht oder API-Fehler).",
    });
  }

  if (marketIntelligenceScore !== undefined) {
    const score = marketIntelligenceScore ?? 0;
    areas.push({
      area: "Market Intelligence",
      qualityScore: score,
      qualityLabel: labelForScore(score),
      confidenceImpact: 0,
      note:
        marketIntelligenceScore !== null
          ? `Market Intelligence Engine erfolgreich berechnet (Market Score ${score}/100).`
          : "Keine Market Intelligence verfügbar (kein Odds-API-Key oder kein passendes Spiel gefunden).",
    });
  }

  if (gameInfoComplete !== undefined) {
    const score = gameInfoComplete ? 100 : 40;
    areas.push({
      area: "Spielinformationen",
      qualityScore: score,
      qualityLabel: labelForScore(score),
      confidenceImpact: 0,
      note: gameInfoComplete
        ? "Spielinformationen (Datum, Uhrzeit, Status, Stadion, Saisonphase) vollständig aus der MLB Stats API geladen."
        : "Spielinformationen unvollständig (z. B. Stadion oder Saisonphase nicht von der API geliefert).",
    });
  }

  const overallScore = Math.round(areas.reduce((sum, a) => sum + a.qualityScore, 0) / Math.max(1, areas.length));

  return { areas, overallScore, overallLabel: labelForScore(overallScore) };
}
