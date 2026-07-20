import { Activity, ArrowDownRight, ArrowUpRight, Gauge, Minus, TrendingUp, Zap } from "lucide-react";
import type { MarketIntelligenceResult } from "@/types";
import { Badge, Card, SectionHeader } from "@/components/common/UI";
import { formatSigned } from "@/utils/format";

/**
 * Version 6.0 (Paket 4): Market Intelligence Panel.
 *
 * Zeigt das vollständige Ergebnis der Market Intelligence Engine
 * (siehe `@/engine/marketIntelligenceEngine`) — Line Movement, Sharp-/
 * Reverse-/Steam-Heuristiken, Marktkonsens/-volatilität, CLV und den
 * Market Score. Rein darstellend, keine eigene Berechnung.
 */
export function MarketIntelligencePanel({ data }: { data: MarketIntelligenceResult | null | undefined }) {
  if (!data || data.currentLine === null) {
    return (
      <Card accent="teal">
        <SectionHeader icon={Activity} title="Market Intelligence" accent="teal" />
        <p className="font-mono text-xs text-slate-500">
          Keine Marktdaten verfügbar (kein Odds-API-Key hinterlegt oder kein passendes Spiel gefunden).
        </p>
      </Card>
    );
  }

  const DirectionIcon = data.movementDirection === "over" ? ArrowUpRight : data.movementDirection === "under" ? ArrowDownRight : Minus;
  const directionColor =
    data.movementDirection === "over" ? "text-posgreen-400" : data.movementDirection === "under" ? "text-negred-400" : "text-slate-400";

  return (
    <Card accent="teal">
      <SectionHeader icon={Activity} title="Market Intelligence" accent="teal" />

      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-600/60">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mr-1">Market Score</span>
        <span className="font-numeric text-3xl leading-none text-slate-100">{data.marketScore}</span>
        <Badge tone={data.marketScore >= 70 ? "green" : data.marketScore >= 40 ? "gold" : "neutral"}>
          {data.marketScore >= 70 ? "hohe Marktqualität" : data.marketScore >= 40 ? "moderate Marktqualität" : "niedrige Marktqualität"}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Opening Line</span>
          <span className="font-numeric text-lg text-slate-100">{data.openingLine?.toFixed(1) ?? "–"}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Current Line</span>
          <span className="font-numeric text-lg text-slate-100">{data.currentLine?.toFixed(1) ?? "–"}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Closing Line</span>
          <span className="font-numeric text-lg text-slate-100">{data.closingLine?.toFixed(1) ?? "–"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 rounded-md border border-base-600 bg-base-800/50 px-3 py-2.5">
        <DirectionIcon size={16} className={directionColor} />
        <span className="font-mono text-xs text-slate-200">
          Line Movement: {data.lineMovement !== null ? formatSigned(data.lineMovement, 2) : "–"}
          {data.lineMovementPct !== null && ` (${formatSigned(data.lineMovementPct)}%)`}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">
          Stärke {data.movementStrength.toFixed(0)}/100 · {data.movementSpeed}
          {data.movementSpeedPerHour !== null && ` (${data.movementSpeedPerHour.toFixed(2)}/h)`}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Badge tone={data.sharpMovementDetected ? "gold" : "neutral"}>
          <Zap size={11} className="inline mr-1" /> Sharp Money
        </Badge>
        <Badge tone={data.reverseLineMovementDetected ? "gold" : "neutral"}>RLM</Badge>
        <Badge tone={data.steamMoveDetected ? "red" : "neutral"}>Steam Move</Badge>
        <Badge tone={data.lateSharpAction ? "gold" : "neutral"}>Late Sharp Action</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
            <Gauge size={11} /> Marktvertrauen
          </span>
          <span className="font-numeric text-lg text-slate-100">{data.marketConsensusPct.toFixed(0)}</span>
          <span className="font-mono text-[10px] text-slate-500 ml-1">({data.bookmakerCount} Buchmacher)</span>
        </div>
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">
            <TrendingUp size={11} /> Marktvolatilität
          </span>
          <span className="font-numeric text-lg text-slate-100">{data.marketVolatility.toFixed(0)}</span>
          <span className="font-mono text-[10px] text-slate-500 ml-1">({data.historyLength} Beobachtungen)</span>
        </div>
      </div>

      {data.clv.outcome !== "unbekannt" && (
        <div className="mb-4 rounded-md border border-base-600 bg-base-800/50 px-3 py-2.5">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Closing Line Value (CLV)</span>
          <div className="flex items-center gap-2">
            <span
              className={`font-numeric text-xl ${
                data.clv.outcome === "positive" ? "text-posgreen-400" : data.clv.outcome === "negative" ? "text-negred-400" : "text-slate-300"
              }`}
            >
              {data.clv.clv !== null ? formatSigned(data.clv.clv, 2) : "–"}
            </span>
            <Badge tone={data.clv.outcome === "positive" ? "green" : data.clv.outcome === "negative" ? "red" : "neutral"}>{data.clv.outcome}</Badge>
          </div>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
          Details anzeigen
        </summary>
        <ul className="mt-2 space-y-1">
          {data.notes.map((note) => (
            <li key={note} className="font-mono text-[10px] text-slate-500">
              {note}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
