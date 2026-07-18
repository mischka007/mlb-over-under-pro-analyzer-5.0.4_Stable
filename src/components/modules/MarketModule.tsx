import { LineChart as LineChartIcon } from "lucide-react";
import type { MarketInput } from "@/types";
import { Badge, Card, SectionHeader, StatInput } from "@/components/common/UI";
import { toNumber } from "@/utils/math";

/**
 * Modul 8 – Marktanalyse: Opening/Current/Closing Line, öffentliches Geld
 * vs. Sharp Money. Daraus werden Steam-Move und Reverse-Line-Movement
 * abgeleitet. Dieses Modul dient als informativer Zusatzindikator und
 * fließt aktuell nicht in die gewichtete Konsens-Berechnung ein (keine
 * eigene Gewichtung in der Vorgabe), wird aber vollständig berechnet und
 * angezeigt.
 */
export function MarketModule({
  data,
  onChange,
}: {
  data: MarketInput;
  onChange: (patch: Partial<MarketInput>) => void;
}) {
  const opening = toNumber(data.openingLine);
  const current = toNumber(data.currentLine);
  const publicOver = toNumber(data.publicOverPct);
  const sharpOver = toNumber(data.sharpOverPct);

  const lineMovement = opening !== null && current !== null ? current - opening : null;
  const isSteamMove = lineMovement !== null && Math.abs(lineMovement) >= 0.5;
  const reverseLineMovement =
    lineMovement !== null && publicOver !== null
      ? (publicOver > 55 && lineMovement < 0) || (publicOver < 45 && lineMovement > 0)
      : false;

  return (
    <Card accent="teal">
      <SectionHeader icon={LineChartIcon} moduleNumber={8} title="Marktanalyse" accent="teal" />

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Opening Line" value={data.openingLine} onChange={(v) => onChange({ openingLine: v })} placeholder="8.0" />
          <StatInput label="Current Line" value={data.currentLine} onChange={(v) => onChange({ currentLine: v })} placeholder="8.5" />
          <StatInput label="Closing Line" value={data.closingLine} onChange={(v) => onChange({ closingLine: v })} placeholder="8.5" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Public Über %" value={data.publicOverPct} onChange={(v) => onChange({ publicOverPct: v })} placeholder="62" />
          <StatInput label="Sharp Über %" value={data.sharpOverPct} onChange={(v) => onChange({ sharpOverPct: v })} placeholder="41" />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {lineMovement !== null && (
            <Badge tone={lineMovement > 0 ? "gold" : lineMovement < 0 ? "red" : "neutral"}>
              Linienbewegung {lineMovement > 0 ? "+" : ""}
              {lineMovement.toFixed(2)}
            </Badge>
          )}
          {isSteamMove && <Badge tone="gold">Steam Move erkannt</Badge>}
          {reverseLineMovement && <Badge tone="red">Reverse Line Movement</Badge>}
          {sharpOver !== null && publicOver !== null && (
            <Badge tone="neutral">Sharp − Public: {(sharpOver - publicOver).toFixed(0)} pp</Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
