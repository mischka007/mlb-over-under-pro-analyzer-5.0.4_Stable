import { Wallet } from "lucide-react";
import type { BankrollResult } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";
import { formatCurrency, formatPercent, formatSigned } from "@/utils/format";

/**
 * Bankroll-Rechner: stellt Flat-Betting, Kelly, Half-Kelly und Quarter-Kelly
 * mit den jeweils empfohlenen Einsatzhöhen sowie ROI/Yield-Kennzahlen
 * gegenüber.
 */
export function BankrollCalculator({ result, bankroll }: { result: BankrollResult; bankroll: number }) {
  const roi = result.expectedValue * 100;
  const yieldPct = result.kellyFraction > 0 ? result.expectedValue * result.kellyFraction * 100 : 0;

  return (
    <Card accent="teal">
      <SectionHeader icon={Wallet} title="Bankroll-Rechner" accent="teal" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StakeTile label="Flat Betting (1%)" stake={result.flatStake} fraction={0.01} />
        <StakeTile label="Kelly" stake={result.kellyStake} fraction={result.kellyFraction} highlight />
        <StakeTile label="Half Kelly" stake={result.halfKellyStake} fraction={result.halfKellyFraction} />
        <StakeTile label="Quarter Kelly" stake={result.quarterKellyStake} fraction={result.quarterKellyFraction} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-lg border border-base-600 bg-base-800/50 p-3">
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">ROI (pro Einsatz)</div>
          <div className={`font-numeric text-xl leading-none ${roi >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>{formatSigned(roi)}%</div>
        </div>
        <div className="rounded-lg border border-base-600 bg-base-800/50 p-3">
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Yield (Kelly-gewichtet)</div>
          <div className={`font-numeric text-xl leading-none ${yieldPct >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
            {formatSigned(yieldPct, 2)}%
          </div>
        </div>
      </div>

      <div className="font-mono text-[10px] text-slate-500 mt-3">
        Bankroll: {formatCurrency(bankroll)} · Kelly-Fraktion: {formatPercent(result.kellyFraction, 1)}
      </div>
    </Card>
  );
}

function StakeTile({ label, stake, fraction, highlight = false }: { label: string; stake: number; fraction: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${highlight ? "border-gold-500 bg-gold-500/10 shadow-glow-gold" : "border-base-600 bg-base-800/50"}`}
    >
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="font-numeric text-lg leading-none text-slate-100">{formatCurrency(Math.max(0, stake))}</div>
      <div className="font-mono text-[10px] text-slate-500 mt-0.5">{formatPercent(Math.max(0, fraction), 1)} d. Bankroll</div>
    </div>
  );
}
