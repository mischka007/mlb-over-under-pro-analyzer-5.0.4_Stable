import type {
  BankrollResult,
  ConsensusResult,
  GameSetup,
  ModuleResult,
  OUPick,
  PremiumFilterChecks,
  PremiumFilterResult,
} from "@/types";
import { clamp } from "@/utils/math";

/**
 * Leitet die 1–5-Sterne-Bewertung aus einer Confidence (0–1) ab.
 * Extrahiert aus `computeConsensus()` (identische Schwellenwerte, keine
 * Verhaltensänderung), damit sowohl der Over/Under- als auch der
 * Run-Line-Modus (`@/engine/runLineEngine`) dieselbe Formel
 * wiederverwenden — keine Dopplung.
 */
export function starsFromConfidence(confidence: number): number {
  return confidence >= 0.9 ? 5 : confidence >= 0.8 ? 4 : confidence >= 0.7 ? 3 : confidence >= 0.6 ? 2 : confidence > 0.5 ? 1 : 0;
}

/**
 * Kombiniert alle Modul-Scores zu einem gewichteten Gesamtscore (0–100).
 * Module ohne Daten (hasData = false) werden ausgeschlossen; die Gewichte
 * der verbleibenden Module werden proportional neu normalisiert, damit die
 * Summe stets 100 % ergibt.
 */
export function computeConsensus(modules: ModuleResult[]): ConsensusResult {
  const active = modules.filter((m) => m.hasData && m.weight > 0);
  const weightSum = active.reduce((acc, m) => acc + m.weight, 0);

  if (active.length === 0 || weightSum === 0) {
    return { modules, finalScore: 50, pick: null, confidence: 0, stars: 0 };
  }

  const finalScore = clamp(
    active.reduce((acc, m) => acc + m.score * (m.weight / weightSum), 0),
    0,
    100
  );

  const pick: OUPick = finalScore === 50 ? null : finalScore > 50 ? "over" : "under";
  const confidence = pick === null ? 0.5 : Math.abs(finalScore - 50) / 50 * 0.5 + 0.5;

  const stars = starsFromConfidence(confidence);

  return { modules, finalScore, pick, confidence, stars };
}

/**
 * Prüft alle Bedingungen des Premium-Filters. Eine Wette gilt nur dann als
 * freigegeben, wenn ALLE Bedingungen erfüllt sind.
 */
export function evaluatePremiumFilter(
  setup: GameSetup,
  consensus: ConsensusResult,
  bankroll: BankrollResult,
  rainChancePct: number | null
): PremiumFilterResult {
  const checks: PremiumFilterChecks = {
    pitcherConfirmed: setup.pitcherConfirmed,
    lineupsConfirmed: setup.lineupsConfirmed,
    weatherConfirmed: setup.weatherConfirmed,
    confidenceAtLeast85: consensus.confidence >= 0.85,
    positiveExpectedValue: bankroll.expectedValue > 0,
    positiveKelly: bankroll.kellyFraction > 0,
    noDoubleheader: !setup.isDoubleheader,
    rainBelow60: rainChancePct === null ? true : rainChancePct < 60,
  };

  const allPassed = Object.values(checks).every(Boolean) && consensus.pick !== null;

  return { checks, allPassed };
}
