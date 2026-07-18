import type { BankrollResult } from "@/types";
import { clamp } from "@/utils/math";

/**
 * Berechnet Expected Value, Value % und Kelly-Einsätze für eine Wette.
 *
 * @param modelProbability  Modellwahrscheinlichkeit der gewählten Seite (0–1)
 * @param decimalOdds       Dezimalquote des Buchmachers für die gewählte Seite
 * @param bankroll          Verfügbare Bankroll in Währungseinheiten
 * @param flatStakePct      Prozentsatz der Bankroll für Flat-Betting (Standard 1 %)
 */
export function computeBankrollResult(
  modelProbability: number,
  decimalOdds: number,
  bankroll: number,
  flatStakePct = 0.01
): BankrollResult {
  const p = clamp(modelProbability, 0, 1);
  const b = decimalOdds - 1; // Netto-Odds (Gewinn pro eingesetzter Einheit)
  const impliedProbability = decimalOdds > 0 ? 1 / decimalOdds : 0;

  // Expected Value pro eingesetzter Einheit: EV = p * b - (1 - p)
  const expectedValue = b > 0 ? p * b - (1 - p) : -1;

  // Value % = Modellwahrscheinlichkeit minus implizite Buchmacher-Wahrscheinlichkeit
  const valuePct = (p - impliedProbability) * 100;

  // Kelly-Fraktion: f* = (b*p - (1-p)) / b, negative Werte auf 0 gekappt
  const kellyFraction = b > 0 ? clamp((b * p - (1 - p)) / b, 0, 1) : 0;
  const halfKellyFraction = kellyFraction / 2;
  const quarterKellyFraction = kellyFraction / 4;

  const flatStake = bankroll * flatStakePct;
  const kellyStake = bankroll * kellyFraction;
  const halfKellyStake = bankroll * halfKellyFraction;
  const quarterKellyStake = bankroll * quarterKellyFraction;

  return {
    expectedValue,
    valuePct,
    kellyFraction,
    halfKellyFraction,
    quarterKellyFraction,
    flatStake,
    kellyStake,
    halfKellyStake,
    quarterKellyStake,
  };
}
