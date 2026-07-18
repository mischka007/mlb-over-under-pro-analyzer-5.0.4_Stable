import { BrainCircuit } from "lucide-react";
import type { ModuleResult } from "@/types";
import { Card, ProgressBar, SectionHeader } from "@/components/common/UI";

type Accent = "gold" | "teal" | "green" | "red";

/**
 * Zeigt für jedes der acht Analyse-Module eine eigene Über/Unter-
 * Wahrscheinlichkeit inkl. Gewichtung an ("KI Konsens").
 * Module ohne Daten werden klar als solche markiert und fließen nicht in
 * den finalen Score ein (siehe utils/consensus.ts).
 */
export function ConsensusPanel({ modules, accent = "gold" }: { modules: ModuleResult[]; accent?: Accent }) {
  return (
    <Card accent={accent}>
      <SectionHeader icon={BrainCircuit} title="KI Konsens — Score je Modul" accent={accent} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {modules.map((m) => (
          <div key={m.key} className="rounded-lg border border-base-600 bg-base-800/50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-display text-xs font-medium text-slate-100">{m.label}</span>
              <span className="font-mono text-[10px] text-slate-500">Gewicht {Math.round(m.weight * 100)}%</span>
            </div>
            {!m.hasData ? (
              <div className="font-mono text-[10px] text-slate-500 py-1">Keine Daten — wird ignoriert</div>
            ) : (
              <>
                <ProgressBar overShare={m.score / 100} />
                <div className="flex justify-between mt-1.5">
                  <span className="font-mono text-[11px] text-gold-400">Über {m.score.toFixed(0)}%</span>
                  <span className="font-mono text-[11px] text-teal-400">Unter {(100 - m.score).toFixed(0)}%</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
