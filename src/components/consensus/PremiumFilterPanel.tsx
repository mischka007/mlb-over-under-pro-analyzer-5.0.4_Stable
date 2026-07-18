import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PremiumFilterResult } from "@/types";
import { Card, Checkbox, SectionHeader } from "@/components/common/UI";

const CHECK_LABELS: Record<keyof PremiumFilterResult["checks"], string> = {
  pitcherConfirmed: "Pitcher bestätigt",
  lineupsConfirmed: "Lineups bestätigt",
  weatherConfirmed: "Wetter bestätigt",
  confidenceAtLeast85: "Confidence ≥ 85 %",
  positiveExpectedValue: "Expected Value positiv",
  positiveKelly: "Kelly positiv",
  noDoubleheader: "Kein Doubleheader",
  rainBelow60: "Regenwahrscheinlichkeit < 60 %",
};

/**
 * Premium-Filter: Eine Wette wird nur freigegeben, wenn ALLE acht
 * Bedingungen erfüllt sind. Jede Bedingung wird einzeln als Checkliste
 * angezeigt (grün = erfüllt, grau = nicht erfüllt), am Ende steht die
 * finale Ampel "WETTE FREIGEGEBEN" oder "NO BET".
 */
export function PremiumFilterPanel({ result }: { result: PremiumFilterResult }) {
  return (
    <Card accent={result.allPassed ? "green" : "red"}>
      <SectionHeader icon={result.allPassed ? ShieldCheck : ShieldAlert} title="Premium-Filter" accent={result.allPassed ? "green" : "red"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {(Object.keys(result.checks) as (keyof PremiumFilterResult["checks"])[]).map((key) => (
          <Checkbox key={key} label={CHECK_LABELS[key]} checked={result.checks[key]} readOnly />
        ))}
      </div>

      <div
        className={`rounded-lg py-3.5 flex items-center justify-center gap-2 border ${
          result.allPassed ? "bg-posgreen-500/10 border-posgreen-500 shadow-glow-green" : "bg-negred-500/10 border-negred-500 shadow-glow-red"
        }`}
      >
        {result.allPassed ? <ShieldCheck size={20} className="text-posgreen-400" /> : <ShieldAlert size={20} className="text-negred-400" />}
        <span className={`font-display text-sm font-bold uppercase tracking-wider ${result.allPassed ? "text-posgreen-400" : "text-negred-400"}`}>
          {result.allPassed ? "Wette freigegeben" : "No Bet"}
        </span>
      </div>
    </Card>
  );
}
