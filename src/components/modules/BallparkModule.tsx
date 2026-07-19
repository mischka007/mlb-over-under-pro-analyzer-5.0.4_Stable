import { Landmark } from "lucide-react";
import type { BallparkInput } from "@/types";
import { Card, SectionHeader, StatInput, ToggleGroup } from "@/components/common/UI";

/**
 * Modul 6 – Ballpark: Run-/HR-/Hit-Faktoren, Höhenlage, Spielfeld-Dimensionen
 * sowie Tag-/Nachtspiel. Fließt als Multiplikator auf die Baseline-Erwartung
 * ein. Gewichtung im Gesamtmodell: 5 %.
 */
export function BallparkModule({
  data,
  onChange,
}: {
  data: BallparkInput;
  onChange: (patch: Partial<BallparkInput>) => void;
}) {
  return (
    <Card accent="gold">
      <SectionHeader icon={Landmark} moduleNumber={6} title="Ballpark" weightPct={5} accent="gold" />

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Run-Faktor (100 = neutral)" value={data.runFactor} onChange={(v) => onChange({ runFactor: v })} placeholder="100" />
          <StatInput label="HR-Faktor (100 = neutral)" value={data.hrFactor} onChange={(v) => onChange({ hrFactor: v })} placeholder="100" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Singles-Faktor" value={data.singlesFactor} onChange={(v) => onChange({ singlesFactor: v })} placeholder="100" />
          <StatInput label="Doubles-Faktor" value={data.doublesFactor} onChange={(v) => onChange({ doublesFactor: v })} placeholder="100" />
          <StatInput label="Triples-Faktor" value={data.triplesFactor} onChange={(v) => onChange({ triplesFactor: v })} placeholder="100" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Höhenlage (m)" value={data.altitudeMeters} onChange={(v) => onChange({ altitudeMeters: v })} placeholder="0" />
          <StatInput label="Left-Field (m)" value={data.leftFieldDistance} onChange={(v) => onChange({ leftFieldDistance: v })} placeholder="100" />
          <StatInput label="Right-Field (m)" value={data.rightFieldDistance} onChange={(v) => onChange({ rightFieldDistance: v })} placeholder="99" />
        </div>

        <ToggleGroup
          label="Spielzeit"
          value={data.dayNight}
          onChange={(v) => onChange({ dayNight: v })}
          options={[
            { value: "day", label: "Tag" },
            { value: "night", label: "Nacht" },
          ]}
        />
      </div>
    </Card>
  );
}
