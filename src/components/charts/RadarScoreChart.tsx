import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import type { ModuleResult } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";

/**
 * Radar-Chart, das alle acht Modul-Scores (0–100) auf einen Blick
 * gegenüberstellt. Module ohne Daten werden mit neutralem Wert (50)
 * dargestellt, damit die Form nicht verzerrt wird, sind aber über die
 * anderen Panels klar als "keine Daten" erkennbar.
 */
export function RadarScoreChart({ modules }: { modules: ModuleResult[] }) {
  const data = modules.map((m) => ({
    module: m.label,
    score: m.hasData ? m.score : 50,
  }));

  return (
    <Card accent="gold">
      <SectionHeader icon={RadarIcon} title="Radar — Modul-Scores" accent="gold" />
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#2B313B" />
            <PolarAngleAxis dataKey="module" tick={{ fill: "#5B6270", fontSize: 10 }} />
            <Radar name="Score" dataKey="score" stroke="#eab308" fill="#eab308" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
