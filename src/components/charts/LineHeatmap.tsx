import { LayoutGrid } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/UI";
import { computePoissonModel } from "@/utils/poisson";
import { formatPercent } from "@/utils/format";

/**
 * Heatmap, die die Über-Wahrscheinlichkeit für die aktuelle Wettlinie sowie
 * benachbarte Linien (±2 in 0,5er-Schritten) darstellt. Hilfreich für
 * Line-Shopping zwischen verschiedenen Buchmachern.
 */
export function LineHeatmap({ expectedRuns, line }: { expectedRuns: number; line: number }) {
  const offsets = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];

  // Performance PRO: `computePoissonModel` baut pro Aufruf eine vollständige
  // Run-Verteilung auf (nicht trivial — Array-Allokation + Objekt-Erzeugung
  // je Zelle). Die Ergebnisse werden hier einmal pro Offset berechnet und
  // wiederverwendet, statt die aktuelle Linie (offset = 0) am Ende der
  // Komponente ein zweites Mal separat neu zu berechnen.
  const cells = offsets.map((offset) => {
    const candidateLine = line + offset;
    return { offset, candidateLine, result: computePoissonModel(expectedRuns, candidateLine) };
  });
  const currentLineCell = cells.find((c) => c.offset === 0) ?? cells[Math.floor(cells.length / 2)];

  return (
    <Card accent="gold">
      <SectionHeader icon={LayoutGrid} title="Heatmap — Linien-Vergleich" accent="gold" />
      <div className="grid grid-cols-9 gap-1">
        {cells.map(({ offset, candidateLine, result }) => {
          const intensity = Math.round(result.overProbability * 100);
          return (
            <div
              key={offset}
              className="rounded-md py-2 text-center border border-base-600"
              style={{ background: `rgba(234,179,8,${result.overProbability * 0.55 + 0.05})` }}
            >
              <div className="font-mono text-[9px] text-slate-300">{candidateLine.toFixed(1)}</div>
              <div className="font-numeric text-sm text-slate-100 leading-none">{intensity}%</div>
            </div>
          );
        })}
      </div>
      <div className="font-mono text-[10px] text-slate-500 mt-2">
        Zelle zeigt Über-Wahrscheinlichkeit bei λ = {expectedRuns.toFixed(2)} für die jeweilige Linie. Aktuelle Linie:{" "}
        {formatPercent(currentLineCell.result.overProbability)}
      </div>
    </Card>
  );
}
