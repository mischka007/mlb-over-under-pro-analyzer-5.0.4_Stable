import { motion } from "framer-motion";
import { Layers, Star } from "lucide-react";
import type { MarketCandidate, MultiMarketAnalysis } from "@/types";
import { Badge, Card, MetricTile, SectionHeader } from "@/components/common/UI";
import { formatCurrency, formatSigned } from "@/utils/format";

const MARKET_LABEL: Record<MarketCandidate["market"], string> = {
  moneyline: "Moneyline",
  overUnder: "Over/Under",
  runLine: "Run Line",
};

/**
 * Version 7.1 — Multi-Market Premium-Karte: zeigt den besten
 * marktübergreifenden Value-Pick (🥇) sowie die nächstbesten
 * Alternativen (🥈🥉…). Nutzt dieselbe `MetricTile`/`Badge`-Komponente
 * wie die Einzelmarkt-Karten — keine vierte, abweichende
 * Darstellungsform. Rein darstellend, keine eigene Berechnung (siehe
 * `@/engine/multiMarketEngine`).
 */
export function MultiMarketPanel({ analysis }: { analysis: MultiMarketAnalysis }) {
  const { bestValue, alternatives } = analysis;
  const medals = ["🥈", "🥉", "4.", "5."];

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="rounded-2xl border border-gold-500/50 bg-gradient-to-b from-base-850/90 to-base-900/90 backdrop-blur-lg p-6 sm:p-10 text-center shadow-glow-gold"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">🥇 Best Value Pick</div>
        <Badge tone="neutral">{MARKET_LABEL[bestValue.market]}</Badge>

        <div className="font-display text-5xl sm:text-6xl font-bold uppercase text-gold-400 mt-3">{bestValue.label}</div>
        <div className="font-numeric text-6xl sm:text-7xl text-slate-100 leading-none mt-2">{(bestValue.probability * 100).toFixed(1)}%</div>

        <div className="flex items-center justify-center gap-1 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={22} className={i < bestValue.stars ? "text-gold-400 fill-gold-400" : "text-base-600"} />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
          <Badge tone={bestValue.confidence >= 0.85 ? "gold" : "neutral"}>{bestValue.confidence >= 0.85 ? "Premium Pick" : "Standard Pick"}</Badge>
          <Badge tone="neutral">Premium Score {bestValue.premiumScore}</Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 text-left">
          <MetricTile label="Confidence" value={`${(bestValue.confidence * 100).toFixed(1)}%`} />
          <MetricTile label="Expected Value" value={`${formatSigned(bestValue.expectedValue * 100)}%`} tone={bestValue.expectedValue >= 0 ? "green" : "red"} />
          <MetricTile
            label="Value %"
            value={bestValue.valuePct !== null ? `${formatSigned(bestValue.valuePct)}%` : "–"}
            tone={bestValue.valuePct !== null && bestValue.valuePct >= 0 ? "green" : "red"}
          />
          <MetricTile label="Kelly-Einsatz" value={formatCurrency(bestValue.kellyStake)} />
          <MetricTile label="Faire Quote" value={bestValue.fairOdds.toFixed(2)} />
          <MetricTile label="Marktquote" value={bestValue.marketOdds !== null ? bestValue.marketOdds.toFixed(2) : "–"} />
        </div>

        <div className="mt-6 text-left">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Begründung</span>
          <ul className="space-y-1">
            {bestValue.reasoning.map((reason) => (
              <li key={reason} className="font-mono text-[11px] text-slate-300">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      <Card accent="teal">
        <SectionHeader icon={Layers} title="Alternativen" accent="teal" />
        <div className="space-y-2">
          {alternatives.map((candidate, i) => (
            <div key={`${candidate.market}-${candidate.label}`} className="flex items-center justify-between gap-3 rounded-lg border border-base-600 bg-base-800/50 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-500 w-6">{medals[i] ?? i + 2 + "."}</span>
                <div>
                  <div className="font-mono text-sm text-slate-100">{candidate.label}</div>
                  <div className="font-mono text-[10px] text-slate-500">{MARKET_LABEL[candidate.market]}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="font-numeric text-sm text-slate-100">{(candidate.probability * 100).toFixed(1)}%</div>
                  <div className="font-mono text-[9px] text-slate-500">Quote {candidate.marketOdds?.toFixed(2) ?? candidate.fairOdds.toFixed(2)}</div>
                </div>
                <Badge tone={candidate.expectedValue >= 0 ? "green" : "neutral"}>EV {formatSigned(candidate.expectedValue * 100)}%</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
