import { motion } from "framer-motion";
import { Star, TrendingDown, TrendingUp } from "lucide-react";
import type { QualityAssessment, RunLineAnalysis } from "@/types";
import { Badge, MetricTile } from "@/components/common/UI";
import { formatCurrency, formatPercent, formatSigned } from "@/utils/format";

/**
 * Die große "Premium Prediction"-Karte für den Run-Line-Modus —
 * bewusst 1:1 dieselbe Struktur, Typografie, Abstände, Animation und
 * Farbwelt wie `PredictionHero.tsx` (Over/Under-Modus), nur mit
 * Run-Line-Daten befüllt. Nutzt dieselbe `MetricTile`-Komponente
 * (`@/components/common/UI`) — keine zweite Kachel-Implementierung.
 * Grade/Tier stammen aus derselben, unveränderten `assessQuality()`
 * wie im Over/Under-Modus (in `Dashboard.tsx` mit Run-Line-Daten
 * aufgerufen) — "gleiche Qualitätsmaßstäbe".
 */
export function RunLineHero({ analysis, quality }: { analysis: RunLineAnalysis; quality?: QualityAssessment }) {
  const { recommendation } = analysis;
  const teamLabel = recommendation.team === "home" ? "HOME" : "AWAY";
  const sideSign = recommendation.side === "favorite" ? "−" : "+";
  const pickColor = recommendation.team === "home" ? "text-gold-400" : "text-teal-400";
  const glow = recommendation.team === "home" ? "shadow-glow-gold" : "shadow-glow-teal";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`rounded-2xl border border-base-600/70 bg-gradient-to-b from-base-850/90 to-base-900/90 backdrop-blur-lg p-6 sm:p-10 text-center ${glow}`}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Premium Prediction · Run Line</div>

      <div className={`flex items-center justify-center gap-3 font-display text-5xl sm:text-6xl font-bold uppercase ${pickColor}`}>
        {recommendation.side === "favorite" ? <TrendingUp size={40} /> : <TrendingDown size={40} />}
        {teamLabel} {sideSign}
        {recommendation.line}
      </div>
      <div className="font-numeric text-6xl sm:text-7xl text-slate-100 leading-none mt-2">
        {formatPercent(recommendation.probability, 1)}
      </div>

      <div className="flex items-center justify-center gap-1 mt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={22} className={i < recommendation.stars ? "text-gold-400 fill-gold-400" : "text-base-600"} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
        <Badge tone={recommendation.confidence >= 0.85 ? "gold" : "neutral"}>
          {recommendation.confidence >= 0.85 ? "Premium Pick" : "Standard Pick"}
        </Badge>
        {quality && (
          <>
            <Badge tone="neutral">Note {quality.grade}</Badge>
            <Badge tone={quality.tier === "Premium Bet" ? "gold" : quality.tier === "No Bet" ? "neutral" : "neutral"}>{quality.tier}</Badge>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 text-left">
        <MetricTile label="Confidence" value={formatPercent(recommendation.confidence, 1)} />
        <MetricTile
          label="Expected Value"
          value={`${formatSigned(analysis.bankroll.expectedValue * 100)}%`}
          tone={analysis.bankroll.expectedValue >= 0 ? "green" : "red"}
        />
        <MetricTile
          label="Value %"
          value={recommendation.valuePct !== null ? `${formatSigned(recommendation.valuePct)}%` : "–"}
          tone={recommendation.valuePct !== null && recommendation.valuePct >= 0 ? "green" : "red"}
        />
        <MetricTile label="Kelly-Einsatz" value={formatCurrency(analysis.bankroll.kellyStake)} />
        <MetricTile label="Faire Quote" value={recommendation.fairOdds.toFixed(2)} />
        <MetricTile label="Marktquote" value={recommendation.marketOdds !== null ? recommendation.marketOdds.toFixed(2) : "–"} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {analysis.outcomes.map((outcome) => (
          <div key={outcome.line} className="rounded-lg border border-base-600 bg-base-800/60 px-3 py-2.5 text-left">
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Linie ±{outcome.line}</div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-300">
              <span>
                {outcome.favoriteTeam === "home" ? "Heim" : "Auswärts"} −{outcome.line}
              </span>
              <span className="text-slate-100">
                {(outcome.favoriteCoverProbability * 100).toFixed(1)}% ({outcome.favoriteFairOdds.toFixed(2)})
              </span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>
                {outcome.favoriteTeam === "home" ? "Auswärts" : "Heim"} +{outcome.line}
              </span>
              <span>
                {(outcome.underdogCoverProbability * 100).toFixed(1)}% ({outcome.underdogFairOdds.toFixed(2)})
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-left">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Begründung</span>
        <ul className="space-y-1">
          {recommendation.reasoning.map((reason) => (
            <li key={reason} className="font-mono text-[11px] text-slate-300">
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 pt-4 border-t border-base-600/60 text-left">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Explainable AI — Team-Vergleich</span>
        <ul className="space-y-1">
          {analysis.explainableReasons.map((reason) => (
            <li
              key={reason}
              className={`font-mono text-[11px] ${reason.startsWith("+") ? "text-posgreen-400" : reason.startsWith("−") ? "text-negred-400" : "text-slate-300"}`}
            >
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
