import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Gauge } from "lucide-react";
import { Card, SectionHeader } from "@/components/common/UI";
import { formatPercent } from "@/utils/format";

/**
 * Halbkreisförmige Confidence-Gauge (Tacho-Optik), gebaut mit einem
 * Recharts-Donut, der auf 180° begrenzt ist. Der Zeiger-Bereich wird farblich
 * in Rot/Gold/Grün nach Konfidenz-Zonen unterteilt, der aktuelle Wert wird
 * als überlagerter Text in der Mitte angezeigt.
 */
export function ConfidenceGauge({ confidence }: { confidence: number }) {
  const value = Math.round(confidence * 100);
  const data = [
    { name: "low", value: 60, color: "#c02f2f" },
    { name: "mid", value: 25, color: "#eab308" },
    { name: "high", value: 15, color: "#22c55e" },
  ];
  const needleRotation = -90 + confidence * 180;

  return (
    <Card accent="green">
      <SectionHeader icon={Gauge} title="Confidence Gauge" accent="green" />
      <div className="relative" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx="50%"
              cy="90%"
              innerRadius="65%"
              outerRadius="100%"
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} fillOpacity={0.85} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Zeiger */}
        <div
          className="absolute left-1/2 bottom-[10%] w-[2px] h-[58%] bg-slate-100 origin-bottom rounded-full"
          style={{ transform: `translateX(-50%) rotate(${needleRotation}deg)` }}
        />
        <div className="absolute left-1/2 bottom-[10%] -translate-x-1/2 w-3 h-3 rounded-full bg-slate-100" />

        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="font-numeric text-3xl text-slate-100 leading-none">{formatPercent(confidence, 0)}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Confidence</div>
        </div>
      </div>
      <div className="text-center font-mono text-[10px] text-slate-500 mt-2">{value}/100</div>
    </Card>
  );
}
