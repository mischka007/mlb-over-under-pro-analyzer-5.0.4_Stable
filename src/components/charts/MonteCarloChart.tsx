import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Dices } from "lucide-react";
import type { MonteCarloResult } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";
import { formatPercent } from "@/utils/format";

/**
 * Zeigt das Ergebnis der Monte-Carlo-PRO-Simulation (20.000 Durchläufe) als
 * Histogramm sowie die wichtigsten deskriptiven Kennzahlen
 * (Durchschnitt, Median, Min, Max, 95 %-Konfidenzintervall).
 */
export function MonteCarloChart({ result, line }: { result: MonteCarloResult; line: number }) {
  const chartData = result.histogram.filter((d) => d.count > 0);

  return (
    <Card accent="teal">
      <SectionHeader icon={Dices} title={`Monte Carlo — ${result.simulations.toLocaleString("de-DE")} Simulationen`} accent="teal" />

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
        <Stat label="Ø" value={result.mean.toFixed(2)} />
        <Stat label="Median" value={result.median.toFixed(2)} />
        <Stat label="Min" value={result.min.toFixed(0)} />
        <Stat label="Max" value={result.max.toFixed(0)} />
        <Stat label="95%-CI" value={`${result.ciLow.toFixed(0)}–${result.ciHigh.toFixed(0)}`} />
        <Stat label="Über" value={formatPercent(result.overProbability)} tone="gold" />
      </div>

      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="bucket" tick={{ fill: "#5B6270", fontSize: 10 }} axisLine={{ stroke: "#2B313B" }} tickLine={false} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{ background: "#20252D", border: "1px solid #2B313B", borderRadius: 6 }}
              labelStyle={{ color: "#F1EDE4", fontSize: 11 }}
              itemStyle={{ color: "#F1EDE4", fontSize: 11 }}
              formatter={(v: number) => [v, "Simulationen"]}
              labelFormatter={(k) => `${k} Runs`}
            />
            <ReferenceLine x={line} stroke="#F1EDE4" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.bucket > line ? "#eab308" : d.bucket < line ? "#14b8ac" : "#F1EDE4"} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "gold" }) {
  const color = tone === "gold" ? "text-gold-400" : "text-slate-100";
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-numeric text-lg leading-none ${color}`}>{value}</div>
    </div>
  );
}
