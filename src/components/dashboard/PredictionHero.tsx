import { motion } from "framer-motion";
import { Star, TrendingDown, TrendingUp } from "lucide-react";
import type { BankrollResult, ConsensusResult, QualityAssessment } from "@/types";
import { Badge, MetricTile } from "@/components/common/UI";
import { formatCurrency, formatPercent, formatSigned } from "@/utils/format";

/**
 * Die große "Premium Prediction"-Karte ganz oben im Dashboard: zeigt
 * OVER/UNDER, Wahrscheinlichkeit, Sterne-Bewertung, Confidence Score,
 * Expected Value, Value % sowie Kelly-Empfehlung mit Einsatzhöhe.
 * v5.0: zusätzlich Schulnote (A+ bis D) und Bet-Tier (Premium Bet ... No Bet).
 */
export function PredictionHero({
  consensus,
  bankroll,
  line,
  quality,
}: {
  consensus: ConsensusResult;
  bankroll: BankrollResult;
  line: string;
  quality?: QualityAssessment;
}) {
  const hasPick = consensus.pick !== null;
  const pickColor = consensus.pick === "over" ? "text-gold-400" : "text-teal-400";
  const glow = consensus.pick === "over" ? "shadow-glow-gold" : consensus.pick === "under" ? "shadow-glow-teal" : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`rounded-2xl border border-base-600/70 bg-gradient-to-b from-base-850/90 to-base-900/90 backdrop-blur-lg p-6 sm:p-10 text-center ${glow}`}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
        Premium Prediction · Linie {line || "–"}
      </div>

      {!hasPick ? (
        <div className="font-display text-2xl text-slate-500 py-6">Trage Daten ein, um eine Prognose zu erhalten</div>
      ) : (
        <>
          <div className={`flex items-center justify-center gap-3 font-display text-5xl sm:text-6xl font-bold uppercase ${pickColor}`}>
            {consensus.pick === "over" ? <TrendingUp size={40} /> : <TrendingDown size={40} />}
            {consensus.pick === "over" ? "Über" : "Unter"}
          </div>
          <div className="font-numeric text-6xl sm:text-7xl text-slate-100 leading-none mt-2">
            {formatPercent(consensus.confidence, 1)}
          </div>

          <div className="flex items-center justify-center gap-1 mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={22} className={i < consensus.stars ? "text-gold-400 fill-gold-400" : "text-base-600"} />
            ))}
          </div>

          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge tone={consensus.confidence >= 0.85 ? "gold" : "neutral"}>
              {consensus.confidence >= 0.85 ? "Premium Pick" : "Standard Pick"}
            </Badge>
            {quality && (
              <>
                <Badge tone="neutral">Note {quality.grade}</Badge>
                <Badge tone={quality.tier === "Premium Bet" ? "gold" : quality.tier === "No Bet" ? "neutral" : "neutral"}>{quality.tier}</Badge>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 text-left">
            <MetricTile label="Confidence Score" value={formatPercent(consensus.confidence, 1)} />
            <MetricTile
              label="Expected Value"
              value={`${formatSigned(bankroll.expectedValue * 100)}%`}
              tone={bankroll.expectedValue >= 0 ? "green" : "red"}
            />
            <MetricTile
              label="Value %"
              value={`${formatSigned(bankroll.valuePct)}%`}
              tone={bankroll.valuePct >= 0 ? "green" : "red"}
            />
            <MetricTile label="Kelly-Einsatz" value={formatCurrency(bankroll.kellyStake)} />
          </div>
        </>
      )}
    </motion.div>
  );
}
