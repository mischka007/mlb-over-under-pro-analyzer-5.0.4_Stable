import { Activity } from "lucide-react";
import type { TeamFormInput, TeamSide } from "@/types";
import { Card, SectionHeader, SequenceInput, StatInput } from "@/components/common/UI";
import { mean, toNumberArray } from "@/utils/math";

/**
 * Modul 1 – Team-Form: letzte 10 / 20 Spiele, Heim-/Auswärtsschnitt,
 * zugelassene Runs. Gewichtung im Gesamtmodell: 10 %.
 */
export function TeamFormModule({
  side,
  teamLabel,
  data,
  onChange,
}: {
  side: TeamSide;
  teamLabel: string;
  data: TeamFormInput;
  onChange: (patch: Partial<TeamFormInput>) => void;
}) {
  const accent = side === "home" ? "gold" : "teal";
  const avgLast10 = mean(toNumberArray(data.last10));
  const avgAllowed = mean(toNumberArray(data.runsAllowedLast10));

  return (
    <Card accent={accent}>
      <SectionHeader icon={Activity} moduleNumber={1} title={`Team-Form — ${teamLabel}`} weightPct={10} accent={accent} />

      <div className="space-y-3">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Runs — letzte 10 Spiele
          </span>
          <SequenceInput values={data.last10} onChange={(i, v) => onChange({ last10: patch(data.last10, i, v) })} />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Zugelassene Runs — letzte 10 Spiele
          </span>
          <SequenceInput
            values={data.runsAllowedLast10}
            onChange={(i, v) => onChange({ runsAllowedLast10: patch(data.runsAllowedLast10, i, v) })}
          />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Runs — letzte 20 Spiele
          </span>
          <SequenceInput
            values={data.last20}
            onChange={(i, v) => onChange({ last20: patch(data.last20, i, v) })}
            columns={10}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Serie (+ Sieg / - Niederlage)" value={String(data.streak)} onChange={(v) => onChange({ streak: Number(v) || 0 })} placeholder="3" />
          <StatInput label="Ø Heim R/Spiel" value={data.homeRunsPerGame} onChange={(v) => onChange({ homeRunsPerGame: v })} placeholder="4.8" />
          <StatInput label="Ø Auswärts R/Spiel" value={data.awayRunsPerGame} onChange={(v) => onChange({ awayRunsPerGame: v })} placeholder="4.3" />
        </div>

        <div className="pt-2 border-t border-base-600 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Ø erzielt / Ø zugelassen</span>
          <span className="font-numeric text-2xl text-slate-100 leading-none">
            {avgLast10.toFixed(2)} <span className="text-slate-500 text-sm">/</span> {avgAllowed.toFixed(2)}
          </span>
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
