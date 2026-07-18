import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/UI";
import { formatPercent } from "@/utils/format";

/**
 * Donut-Chart, das die finale Über-/Unter-/Push-Wahrscheinlichkeit als
 * Kreisdiagramm darstellt.
 */
export function ProbabilityDonut({
  overProbability,
  underProbability,
  pushProbability,
}: {
  overProbability: number;
  underProbability: number;
  pushProbability: number;
}) {
  const data = [
    { name: "Über", value: overProbability, color: "#eab308" },
    { name: "Unter", value: underProbability, color: "#14b8ac" },
    ...(pushProbability > 0.001 ? [{ name: "Push", value: pushProbability, color: "#5B6270" }] : []),
  ];

  return (
    <Card accent="teal">
      <SectionHeader icon={PieChartIcon} title="Probability Donut" accent="teal" />
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.9} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#20252D", border: "1px solid #2B313B", borderRadius: 6 }}
              labelStyle={{ color: "#F1EDE4", fontSize: 11 }}
              itemStyle={{ color: "#F1EDE4", fontSize: 11 }}
              formatter={(v: number, name: string) => [formatPercent(v), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-1">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="font-mono text-[11px] text-slate-400">
              {d.name} {formatPercent(d.value)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
