import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import type { PoissonResult } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";
import { formatPercent } from "@/utils/format";

/**
 * Zeigt die vollständige Poisson-Verteilung der erwarteten Gesamt-Runs als
 * Histogramm, mit eingezeichneter Wettlinie und farblicher Trennung
 * Über/Unter.
 */
export function RunDistributionChart({ poisson, line }: { poisson: PoissonResult; line: number }) {
  const chartData = poisson.distribution.filter((d) => d.probability > 0.002).slice(0, 26);

  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Poisson — Run Distribution" accent="gold" />

      <div className="flex flex-wrap gap-4 mb-3">
        <Stat label="Erwartete Runs (λ)" value={poisson.expectedRuns.toFixed(2)} />
        <Stat label="Über" value={formatPercent(poisson.overProbability)} tone="gold" />
        <Stat label="Unter" value={formatPercent(poisson.underProbability)} tone="teal" />
        <Stat label="Push" value={formatPercent(poisson.pushProbability)} />
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="runs" tick={{ fill: "#5B6270", fontSize: 10 }} axisLine={{ stroke: "#2B313B" }} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{ background: "#20252D", border: "1px solid #2B313B", borderRadius: 6 }}
              labelStyle={{ color: "#F1EDE4", fontSize: 11 }}
              itemStyle={{ color: "#F1EDE4", fontSize: 11 }}
              formatter={(v: number) => [formatPercent(v), "Wahrsch."]}
              labelFormatter={(k) => `${k} Runs`}
            />
            <ReferenceLine x={line} stroke="#F1EDE4" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Bar dataKey="probability" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.runs > line ? "#eab308" : d.runs < line ? "#14b8ac" : "#F1EDE4"} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" | "teal" }) {
  const color = tone === "gold" ? "text-gold-400" : tone === "teal" ? "text-teal-400" : "text-slate-100";
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-numeric text-xl leading-none ${color}`}>{value}</div>
    </div>
  );
}
