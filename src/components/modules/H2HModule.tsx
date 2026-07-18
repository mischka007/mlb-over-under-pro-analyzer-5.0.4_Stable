import { Swords as Duel } from "lucide-react";
import type { H2HInput } from "@/types";
import { Card, SectionHeader, SequenceInput, StatInput } from "@/components/common/UI";
import { mean, toNumberArray } from "@/utils/math";

/**
 * Modul 7 – Head-to-Head: Gesamtpunkte (beide Teams) je Duell der letzten
 * 10 und 20 Begegnungen, First-Five-Innings-Schnitt sowie Anzahl Extra-
 * Innings-Spiele. Gewichtung im Gesamtmodell: 10 %.
 */
export function H2HModule({
  data,
  onChange,
}: {
  data: H2HInput;
  onChange: (patch: Partial<H2HInput>) => void;
}) {
  const avg10 = mean(toNumberArray(data.last10TotalRuns));
  const overCount10 = toNumberArray(data.last10TotalRuns);

  return (
    <Card accent="gold">
      <SectionHeader icon={Duel} moduleNumber={7} title="Head-to-Head" weightPct={10} accent="gold" />

      <div className="space-y-3">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Gesamtpunkte (beide Teams) — letzte 10 Duelle
          </span>
          <SequenceInput
            values={data.last10TotalRuns}
            onChange={(i, v) => onChange({ last10TotalRuns: patch(data.last10TotalRuns, i, v) })}
          />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Gesamtpunkte (beide Teams) — letzte 20 Duelle
          </span>
          <SequenceInput
            values={data.last20TotalRuns}
            onChange={(i, v) => onChange({ last20TotalRuns: patch(data.last20TotalRuns, i, v) })}
            columns={10}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatInput
            label="Ø 1.–5. Inning (beide Teams)"
            value={data.firstFiveInningsAvg}
            onChange={(v) => onChange({ firstFiveInningsAvg: v })}
            placeholder="4.9"
          />
          <StatInput
            label="Extra-Innings-Spiele (Anzahl)"
            value={data.extraInningsGames}
            onChange={(v) => onChange({ extraInningsGames: v })}
            placeholder="1"
          />
        </div>

        <div className="pt-2 border-t border-base-600 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            Ø Gesamtpunkte ({overCount10.length}/10 erfasst)
          </span>
          <span className="font-numeric text-2xl text-slate-100 leading-none">{avg10.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
}

function patch(arr: string[], index: number, value: string): string[] {
  const next = [...arr];
  next[index] = value;
  return next;
}
