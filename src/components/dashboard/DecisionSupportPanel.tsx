import { AlertTriangle, Brain, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { DecisionLabel } from "@/types";
import type { FullAnalysis } from "@/models/GameModel";
import { Badge, Card, SectionHeader } from "@/components/common/UI";

/**
 * Tag 8 — Explainable AI & Smart Decision Support.
 *
 * Zeigt die erklärbare Zusammenfassung der aktuellen Prognose: warum
 * OVER/UNDER, die stärksten und schwächsten Einflussfaktoren, die
 * dynamisch erzeugten Entscheidungssätze, Hauptrisiken/Widersprüche,
 * die Confidence-Begründung sowie den Decision Score/Label. Liest
 * ausschließlich bereits von `computeFullAnalysis()` berechnete Werte
 * — erzeugt keine neue Prognose.
 */
export function DecisionSupportPanel({ analysis, accent }: { analysis: FullAnalysis; accent: "gold" | "teal" | "green" | "red" }) {
  const { decisionSupport, advancedPrediction, consensus } = analysis;
  const summary = advancedPrediction.predictionSummary;

  const moduleAgreementFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "moduleAgreement");

  return (
    <Card accent={accent}>
      <SectionHeader icon={Brain} title="Prediction Explanation" accent={accent} />

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-base-600/60">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Decision Score</span>
          <div className="flex items-center gap-2">
            <span className="font-numeric text-4xl leading-none text-slate-100">{decisionSupport.decisionScore}</span>
            <DecisionLabelBadge label={decisionSupport.decisionLabel} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Datenqualität</span>
            <span className="font-numeric text-xl text-slate-100">
              {summary.dataQualityPct.toFixed(0)} <span className="text-sm text-slate-500">({summary.dataQualityLabel})</span>
            </span>
          </div>
          <div>
            <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Modulübereinstimmung</span>
            <span className="font-numeric text-xl text-slate-100">{moduleAgreementFactor ? moduleAgreementFactor.score.toFixed(0) : "–"}</span>
          </div>
        </div>
      </div>

      {consensus.pick === null ? (
        <p className="font-mono text-xs text-slate-500">Kein eindeutiger Pick — keine Begründung verfügbar.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-posgreen-400 mb-1.5">
              <TrendingUp size={12} /> Warum Over?
            </span>
            {summary.topReasonsForOver.length === 0 ? (
              <p className="font-mono text-[11px] text-slate-500">Keine überwiegenden Over-Signale.</p>
            ) : (
              <ul className="space-y-1">
                {summary.topReasonsForOver.map((r) => (
                  <li key={r} className="font-mono text-[11px] text-slate-300">
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-negred-400 mb-1.5">
              <TrendingDown size={12} /> Warum Under?
            </span>
            {summary.topReasonsForUnder.length === 0 ? (
              <p className="font-mono text-[11px] text-slate-500">Keine überwiegenden Under-Signale.</p>
            ) : (
              <ul className="space-y-1">
                {summary.topReasonsForUnder.map((r) => (
                  <li key={r} className="font-mono text-[11px] text-slate-300">
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {decisionSupport.strongestSingleReason && (
        <div className="mb-4 rounded-md border border-base-600 bg-base-800/50 px-3 py-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-gold-400 mb-1">
            <Sparkles size={12} /> Stärkster Einzelgrund
          </span>
          <p className="font-mono text-xs text-slate-200">{decisionSupport.strongestSingleReason}</p>
        </div>
      )}

      <div className="mb-4">
        <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Entscheidungszusammenfassung</span>
        <ul className="space-y-1">
          {decisionSupport.narrativeSentences.map((s) => (
            <li key={s} className="flex items-start gap-2 font-mono text-xs text-slate-300">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Größter Einfluss</span>
          <ul className="space-y-1">
            {summary.topInfluencingModules.slice(0, 3).map((m) => (
              <li key={m.moduleKey} className="flex items-center justify-between font-mono text-[11px] text-slate-300">
                <span>{m.label}</span>
                <Badge tone={m.direction === "over" ? "gold" : m.direction === "under" ? "green" : "neutral"}>
                  {m.direction === "over" ? "Over" : m.direction === "under" ? "Under" : "neutral"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Geringster Einfluss</span>
          <ul className="space-y-1">
            {decisionSupport.leastInfluentialModules.map((m) => (
              <li key={m.moduleKey} className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                <span>{m.label}</span>
                <span>{m.influence.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(summary.biggestRisks.length > 0 || decisionSupport.moduleContradictions.length > 0 || decisionSupport.mostUncertainModules.length > 0) && (
        <div className="mb-4">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-negred-400 mb-1.5">
            <ShieldAlert size={12} /> Hauptrisiken
          </span>
          <ul className="space-y-1">
            {summary.biggestRisks.map((r) => (
              <li key={r} className="flex items-start gap-2 font-mono text-[11px] text-slate-300">
                <AlertTriangle size={11} className="mt-0.5 text-gold-400 shrink-0" />
                {r}
              </li>
            ))}
            {decisionSupport.moduleContradictions.map((c) => (
              <li key={c.description} className="flex items-start gap-2 font-mono text-[11px] text-slate-300">
                <AlertTriangle size={11} className="mt-0.5 text-negred-400 shrink-0" />
                {c.description}
              </li>
            ))}
            {decisionSupport.mostUncertainModules.map((u) => (
              <li key={u.moduleKey} className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
                <AlertTriangle size={11} className="mt-0.5 text-slate-500 shrink-0" />
                {u.label}: {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors">
          Confidence-Begründung anzeigen
        </summary>
        <ul className="mt-2 space-y-1">
          {decisionSupport.confidenceRationale.map((r) => (
            <li key={r} className="font-mono text-[10px] text-slate-500">
              {r}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

function DecisionLabelBadge({ label }: { label: DecisionLabel }) {
  const tone = label === "Elite" || label === "Sehr gut" ? "gold" : label === "Gut" ? "green" : label === "Neutral" ? "neutral" : "red";
  return <Badge tone={tone}>{label}</Badge>;
}
