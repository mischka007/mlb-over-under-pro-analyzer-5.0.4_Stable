import type { BetTier, ConsensusResult, PremiumFilterResult, QualityAssessment, QualityGrade } from "@/types";

/**
 * Leitet aus Confidence + Anzahl vorhandener Datenmodule eine Schulnote
 * (A+ bis D) sowie ein Bet-Tier ab. Die Notenskala kombiniert bewusst zwei
 * Dinge: wie stark das Signal ist (Confidence) UND wie vollständig die
 * Datenbasis dafür ist (je mehr Module hasData=true, desto verlässlicher
 * die Aussage) — eine hohe Confidence auf Basis von nur 2 von 8 Modulen
 * verdient keine A-Note.
 */
export function assessQuality(consensus: ConsensusResult, filter: PremiumFilterResult): QualityAssessment {
  const dataCompleteness = consensus.modules.filter((m) => m.hasData && m.weight > 0).length / consensus.modules.filter((m) => m.weight > 0).length;
  const combined = consensus.confidence * 0.75 + dataCompleteness * 0.25;

  let grade: QualityGrade;
  if (combined >= 0.92) grade = "A+";
  else if (combined >= 0.85) grade = "A";
  else if (combined >= 0.78) grade = "A-";
  else if (combined >= 0.72) grade = "B+";
  else if (combined >= 0.65) grade = "B";
  else if (combined >= 0.55) grade = "C";
  else grade = "D";

  let tier: BetTier;
  if (filter.allPassed && (grade === "A+" || grade === "A")) tier = "Premium Bet";
  else if (grade === "A" || grade === "A-" || grade === "B+") tier = "Strong Bet";
  else if (grade === "B") tier = "Lean";
  else if (grade === "C") tier = "Pass";
  else tier = "No Bet";

  return { grade, tier };
}
