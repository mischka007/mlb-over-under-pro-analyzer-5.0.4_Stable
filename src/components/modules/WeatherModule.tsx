import { CloudSun } from "lucide-react";
import type { WeatherInput } from "@/types";
import { Card, SectionHeader, StatInput, ToggleGroup } from "@/components/common/UI";

/**
 * Modul 5 – Wetter: Temperatur, Wind (Richtung + Geschwindigkeit),
 * Luftfeuchtigkeit, Luftdruck, Regenwahrscheinlichkeit sowie Dachstatus.
 * Fließt als Multiplikator auf die Baseline-Erwartung ein.
 * Gewichtung im Gesamtmodell: 10 %.
 */
export function WeatherModule({
  data,
  onChange,
}: {
  data: WeatherInput;
  onChange: (patch: Partial<WeatherInput>) => void;
}) {
  return (
    <Card accent="teal">
      <SectionHeader icon={CloudSun} moduleNumber={5} title="Wetter" weightPct={10} accent="teal" />

      <div className="space-y-3">
        <ToggleGroup
          label="Windrichtung"
          value={data.windDirection}
          onChange={(v) => onChange({ windDirection: v })}
          options={[
            { value: "out", label: "Raus (Boost)" },
            { value: "in", label: "Rein (Dämpft)" },
            { value: "cross", label: "Seitlich" },
            { value: "none", label: "Kein Wind" },
          ]}
        />

        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Temperatur (°C)" value={data.temperatureC} onChange={(v) => onChange({ temperatureC: v })} placeholder="24" />
          <StatInput label="Wind (mph)" value={data.windSpeedMph} onChange={(v) => onChange({ windSpeedMph: v })} placeholder="9" />
          <StatInput label="Luftfeuchte %" value={data.humidityPct} onChange={(v) => onChange({ humidityPct: v })} placeholder="55" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Luftdruck (hPa)" value={data.pressureHpa} onChange={(v) => onChange({ pressureHpa: v })} placeholder="1013" />
          <StatInput label="Regenwahrsch. %" value={data.rainChancePct} onChange={(v) => onChange({ rainChancePct: v })} placeholder="15" />
        </div>

        <ToggleGroup
          label="Dach"
          value={data.roofState}
          onChange={(v) => onChange({ roofState: v })}
          options={[
            { value: "none", label: "Kein Dach" },
            { value: "open", label: "Offen" },
            { value: "closed", label: "Geschlossen" },
          ]}
        />
      </div>
    </Card>
  );
}
