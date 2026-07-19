import type { AnalyzerState, DataQualityReport, SmartWarning } from "@/types";
import type { FullAnalysis } from "@/models/GameModel";
import { toNumber } from "@/utils/math";

/**
 * Tag 9 — Smart Warnings.
 *
 * Erweitert das bestehende, bisher über mehrere Module verstreute
 * Warnsystem (`BullpenQualityAssessment.warnings`,
 * `OffenseQualityAssessment.warnings`, `ConfidenceBreakdown.penalties`,
 * `PremiumBetAssessment.warnings` — alle unverändert, nur hier
 * zusammengeführt) um eine einzige, priorisierte und kategorisierte
 * Liste sowie um zusätzliche, aus echten Werten abgeleitete Prüfungen:
 * große Line Movement, schwache Datenqualität, zu viele fehlende
 * Module, instabile Monte-Carlo-Simulation, geringe
 * Modulübereinstimmung.
 *
 * Bewusst NICHT umgesetzt: "sehr alte Daten" und "Pitcher kurzfristig
 * geändert" — dafür existiert im Projekt aktuell keine echte
 * Zeitstempel- bzw. Pitcher-Wechsel-Historie. Eine Warnung ohne echte
 * Datenbasis würde gegen das Transparenz-Gebot verstoßen, daher bewusst
 * ausgelassen statt erfunden.
 */

const BIG_LINE_MOVEMENT_THRESHOLD = 0.5;
const WEAK_DATA_QUALITY_THRESHOLD = 50;
const TOO_MANY_MISSING_MODULES_THRESHOLD = 3;
const UNSTABLE_SIMULATION_THRESHOLD = 60;
const LOW_MODULE_AGREEMENT_THRESHOLD = 50;

function existingModuleWarnings(sideLabel: string, warnings: string[]): SmartWarning[] {
  return warnings.map((description) => ({
    priority: "mittel" as const,
    category: "Datenqualität" as const,
    description: `${sideLabel}: ${description}`,
    recommendation: "Eingabedaten prüfen bzw. vervollständigen, bevor die Prognose als final betrachtet wird.",
  }));
}

/**
 * Baut die vollständige Smart-Warnings-Liste auf, priorisiert
 * (kritisch → niedrig).
 */
export function buildSmartWarnings(state: AnalyzerState, analysis: FullAnalysis, dataQuality: DataQualityReport): SmartWarning[] {
  const warnings: SmartWarning[] = [];

  // --- Bestehende Warnungen zusammenführen (keine Duplizierung der Logik) ---
  warnings.push(...existingModuleWarnings("Bullpen Heim", analysis.bullpenQuality.home.warnings));
  warnings.push(...existingModuleWarnings("Bullpen Auswärts", analysis.bullpenQuality.away.warnings));
  warnings.push(...existingModuleWarnings("Offense Heim", analysis.offenseQuality.home.warnings));
  warnings.push(...existingModuleWarnings("Offense Auswärts", analysis.offenseQuality.away.warnings));

  for (const penalty of analysis.advancedPrediction.confidenceBreakdown.penalties) {
    warnings.push({ priority: "hoch", category: "Bestätigung", description: penalty, recommendation: "Vor dem Wetteinsatz bestätigen bzw. klären." });
  }

  for (const warning of analysis.premiumBetAssessment.warnings) {
    warnings.push({ priority: "mittel", category: "Modell", description: warning, recommendation: "Bei der finalen Einschätzung berücksichtigen." });
  }

  // --- Neue Prüfungen ---
  const openingLine = toNumber(state.market.openingLine);
  const currentLine = toNumber(state.market.currentLine);
  if (openingLine !== null && currentLine !== null && Math.abs(currentLine - openingLine) >= BIG_LINE_MOVEMENT_THRESHOLD) {
    warnings.push({
      priority: "hoch",
      category: "Markt",
      description: `Große Line Movement erkannt (${openingLine.toFixed(1)} → ${currentLine.toFixed(1)}).`,
      recommendation: "Ursache der Marktbewegung prüfen (z. B. Lineup-/Pitcher-Nachricht) bevor der Einsatz platziert wird.",
    });
  }

  const weakAreas = dataQuality.areas.filter((a) => a.qualityScore < WEAK_DATA_QUALITY_THRESHOLD);
  for (const area of weakAreas) {
    warnings.push({
      priority: "mittel",
      category: "Datenqualität",
      description: `Schwache Datenqualität im Bereich ${area.area} (${area.qualityScore}/100).`,
      recommendation: `${area.area}-Daten vervollständigen, um die Prognosequalität zu erhöhen.`,
    });
  }

  const missingModuleCount = analysis.modules.filter((m) => !m.hasData).length;
  if (missingModuleCount >= TOO_MANY_MISSING_MODULES_THRESHOLD) {
    warnings.push({
      priority: "kritisch",
      category: "Datenqualität",
      description: `Zu viele fehlende Module (${missingModuleCount} von ${analysis.modules.length} ohne ausreichende Datenbasis).`,
      recommendation: "Prognose mit Vorsicht behandeln — mehr Eingabedaten ergänzen, bevor auf Basis dieser Analyse gewettet wird.",
    });
  }

  if (analysis.montecarlo.simulationConfidence < UNSTABLE_SIMULATION_THRESHOLD) {
    warnings.push({
      priority: "hoch",
      category: "Simulation",
      description: `Monte-Carlo-Simulation instabil (Simulation Confidence ${analysis.montecarlo.simulationConfidence.toFixed(0)}/100).`,
      recommendation: "Ergebnis der Simulation mit Vorsicht interpretieren, ggf. Eingabedaten prüfen.",
    });
  }

  const moduleAgreementFactor = analysis.advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "moduleAgreement");
  if (moduleAgreementFactor && moduleAgreementFactor.score < LOW_MODULE_AGREEMENT_THRESHOLD) {
    warnings.push({
      priority: "hoch",
      category: "Modell",
      description: `Geringe Modulübereinstimmung (${moduleAgreementFactor.score.toFixed(0)}/100) — die Module widersprechen sich teilweise.`,
      recommendation: "Einzelne Modul-Scores im Dashboard prüfen, bevor der Pick übernommen wird.",
    });
  }

  const priorityRank: Record<SmartWarning["priority"], number> = { kritisch: 0, hoch: 1, mittel: 2, niedrig: 3 };
  return warnings.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
}
