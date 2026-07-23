import { Target, TrendingDown, TrendingUp } from "lucide-react";
import type { RunLineAnalysis } from "@/types";
import { Badge, Card, SectionHeader } from "@/components/common/UI";
import { formatSigned } from "@/utils/format";

/**
 * Version 7.0 — Run Line (Asian Handicap) Hero-Panel.
 *
 * Zeigt die Haupt-Empfehlung des Run-Line-Analyzers (siehe
 * `@/engine/runLineEngine`) — analog zu `PredictionHero.tsx` im
 * Over/Under-Modus, aber für Run-Line-Wahrscheinlichkeiten, faire
 * Quote, Value % und die Zielquoten-Begründung. Rein darstellend,
 * keine eigene Berechnung.
 */
export function RunLineHero({ analysis }: { analysis: RunLineAnalysis }) {
  const { recommendation } = analysis;
  const teamLabel = recommendation.team === "home" ? "Heimteam" : "Auswärtsteam";
  const sideLabel = recommendation.side === "favorite" ? `−${recommendation.line}` : `+${recommendation.line}`;

  return (
    <Card accent="gold">
      <SectionHeader icon={Target} title="Run Line — Empfehlung" accent="gold" />

      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-base-600/60">
        <span className="font-numeric text-2xl text-slate-100">
          {teamLabel} {sideLabel}
        </span>
        <Badge tone={recommendation.probability >= 0.55 ? "green" : recommendation.probability >= 0.5 ? "gold" : "neutral"}>
          {(recommendation.probability * 100).toFixed(1)} %
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Faire Quote</span>
          <span className="font-numeric text-lg text-slate-100">{recommendation.fairOdds.toFixed(2)}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Marktquote</span>
          <span className="font-numeric text-lg text-slate-100">{recommendation.marketOdds?.toFixed(2) ?? "–"}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Value</span>
          <span className={`font-numeric text-lg ${recommendation.valuePct !== null && recommendation.valuePct >= 0 ? "text-posgreen-400" : "text-slate-100"}`}>
            {recommendation.valuePct !== null ? `${formatSigned(recommendation.valuePct)}%` : "–"}
          </span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Confidence</span>
          <span className="font-numeric text-lg text-slate-100">{(recommendation.confidence * 100).toFixed(1)} %</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 rounded-md border border-base-600 bg-base-800/50 px-3 py-2.5">
        {analysis.expectedRunDifferential >= 0 ? (
          <TrendingUp size={16} className="text-posgreen-400" />
        ) : (
          <TrendingDown size={16} className="text-negred-400" />
        )}
        <span className="font-mono text-xs text-slate-200">
          Erwartete Run-Differenz: {formatSigned(analysis.expectedRunDifferential, 2)} (Heim {analysis.homeExpectedRuns.toFixed(2)} · Auswärts{" "}
          {analysis.awayExpectedRuns.toFixed(2)})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {analysis.outcomes.map((outcome) => (
          <div key={outcome.line} className="rounded-md border border-base-600 bg-base-800/50 px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Linie ±{outcome.line}</div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-300">
              <span>{outcome.favoriteTeam === "home" ? "Heim" : "Auswärts"} −{outcome.line}</span>
              <span className="text-slate-100">{(outcome.favoriteCoverProbability * 100).toFixed(1)}% ({outcome.favoriteFairOdds.toFixed(2)})</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
              <span>{outcome.favoriteTeam === "home" ? "Auswärts" : "Heim"} +{outcome.line}</span>
              <span>{(outcome.underdogCoverProbability * 100).toFixed(1)}% ({outcome.underdogFairOdds.toFixed(2)})</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Begründung</span>
        <ul className="space-y-1">
          {recommendation.reasoning.map((reason) => (
            <li key={reason} className="font-mono text-[11px] text-slate-300">
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 pt-4 border-t border-base-600/60">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Explainable AI — Team-Vergleich</span>
        <ul className="space-y-1">
          {analysis.explainableReasons.map((reason) => (
            <li key={reason} className={`font-mono text-[11px] ${reason.startsWith("+") ? "text-posgreen-400" : reason.startsWith("−") ? "text-negred-400" : "text-slate-300"}`}>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
