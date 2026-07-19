import { useMemo } from "react";
import { Activity, AlertTriangle, Database, Gauge, HardDrive, ShieldCheck } from "lucide-react";
import type { AnalyzerState } from "@/types";
import type { FullAnalysis } from "@/models/GameModel";
import type { AvailabilityFlags } from "@/hooks/useGameAutoLoad";
import { Badge, Card, SectionHeader } from "@/components/common/UI";
import { buildDataQualityReport } from "@/engine/dataQualityEngine";
import { buildSmartWarnings } from "@/engine/smartWarnings";
import { buildApiHealthReport } from "@/engine/apiHealth";
import { getCacheStats } from "@/services/cache/cache";

/** Echte, aktuelle Projektversion (aus `package.json`). */
const APP_VERSION = "5.1.0";
const APP_STATUS = "Stable";

/**
 * Version 5.1 Stable (Tag 12): Build-Datum/-Zeit sowie Git-Revision
 * stammen aus den zur tatsächlichen Build-Zeit von `vite.config.ts`
 * gesetzten Konstanten (`define`, siehe `src/vite-env.d.ts`) — keine
 * geschätzten Werte. `__GIT_REVISION__` ist `null`, wenn kein
 * Git-Repository vorhanden ist ("falls vorhanden").
 */
const buildDate = new Date(__BUILD_TIMESTAMP__);
const buildDateLabel = buildDate.toLocaleDateString("de-DE");
const buildTimeLabel = buildDate.toLocaleTimeString("de-DE");
const gitRevisionLabel = __GIT_REVISION__ ?? "nicht verfügbar";

/**
 * Tag 9 — Release Dashboard.
 *
 * Führt Data Quality Engine, Smart Warnings und API Health (alle Tag 9,
 * additiv) sowie die reale Cache-Introspektion und Berechnungsdauer zu
 * einem technischen Systemstatus-Panel zusammen. Liest ausschließlich
 * bereits vorhandene bzw. neu, aber additiv berechnete Werte — keine
 * Platzhalter.
 */
export function SystemStatusPanel({
  state,
  analysis,
  availability,
  computationDurationMs,
}: {
  state: AnalyzerState;
  analysis: FullAnalysis;
  availability: AvailabilityFlags | null;
  computationDurationMs: number;
}) {
  const dataQuality = useMemo(
    () => buildDataQualityReport(state, analysis, availability?.lineups),
    [state, analysis, availability]
  );
  const warnings = useMemo(() => buildSmartWarnings(state, analysis, dataQuality), [state, analysis, dataQuality]);
  const apiHealth = useMemo(() => buildApiHealthReport(dataQuality, availability ?? undefined), [dataQuality, availability]);
  const cacheStatus = useMemo(() => getCacheStats(), [analysis]);

  return (
    <Card accent="teal">
      <SectionHeader icon={Activity} title="Release Dashboard — Systemstatus" accent="teal" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 pb-4 border-b border-base-600/60">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Version</span>
          <span className="font-numeric text-xl text-slate-100">{APP_VERSION}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Berechnungsdauer</span>
          <span className="font-numeric text-xl text-slate-100">{computationDurationMs.toFixed(0)} ms</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Datenqualität</span>
          <span className="font-numeric text-xl text-slate-100">
            {dataQuality.overallScore} <span className="text-sm text-slate-500">({dataQuality.overallLabel})</span>
          </span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Cache</span>
          <span className="font-numeric text-xl text-slate-100">
            {cacheStatus.freshEntries}
            <span className="text-sm text-slate-500">/{cacheStatus.totalEntries}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 pb-4 border-b border-base-600/60">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Build Date</span>
          <span className="font-numeric text-lg text-slate-100">{buildDateLabel}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Build Time</span>
          <span className="font-numeric text-lg text-slate-100">{buildTimeLabel}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Git Revision</span>
          <span className="font-mono text-sm text-slate-100">{gitRevisionLabel}</span>
        </div>
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Projektstatus</span>
          <Badge tone="green">{APP_STATUS}</Badge>
        </div>
      </div>

      <div className="mb-4">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">
          <Database size={12} /> Data Quality je Bereich
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {dataQuality.areas.map((a) => (
            <div key={a.area} className="rounded-md border border-base-600 bg-base-800/50 px-2.5 py-2">
              <div className="font-mono text-[10px] text-slate-400">{a.area}</div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-numeric text-lg text-slate-100 leading-none">{a.qualityScore}</span>
                <Badge tone={a.qualityScore >= 70 ? "green" : a.qualityScore >= 50 ? "gold" : "red"}>{a.qualityLabel}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">
          <Gauge size={12} /> API Health ({apiHealth.overallCompletenessPct}% Vollständigkeit)
        </span>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="py-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-left">Quelle</th>
                <th className="py-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-right">Status</th>
                <th className="py-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-right">Vollständigkeit</th>
                <th className="py-1 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500 text-right">Felder</th>
              </tr>
            </thead>
            <tbody>
              {apiHealth.sources.map((s) => (
                <tr key={s.source} className="border-t border-base-600/60">
                  <td className="py-1.5 px-2 font-mono text-[11px] text-slate-200">{s.source}</td>
                  <td className="py-1.5 px-2 font-mono text-[11px] text-right">
                    <Badge tone={s.status === "verfügbar" ? "green" : s.status === "eingeschränkt" ? "gold" : "red"}>{s.status}</Badge>
                  </td>
                  <td className="py-1.5 px-2 font-mono text-[11px] text-slate-400 text-right">{s.completenessPct.toFixed(0)}%</td>
                  <td className="py-1.5 px-2 font-mono text-[11px] text-slate-400 text-right">
                    {s.fieldsExpected > 0 ? `${s.fieldsLoaded}/${s.fieldsExpected}` : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[9px] text-slate-600 mt-1.5">
          Antwortzeit/Fehlerrate nicht instrumentiert (keine bestehende Zeit-/Fehler-Erfassung je Request im Projekt).
        </p>
      </div>

      <div>
        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-2">
          <ShieldCheck size={12} /> Warnungen ({warnings.length})
        </span>
        {warnings.length === 0 ? (
          <p className="font-mono text-[11px] text-posgreen-400">Keine Warnungen — Datenbasis und Modell-Konsens unauffällig.</p>
        ) : (
          <ul className="space-y-1.5">
            {warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 font-mono text-[11px] text-slate-300">
                <AlertTriangle
                  size={12}
                  className={`mt-0.5 shrink-0 ${
                    w.priority === "kritisch" ? "text-negred-400" : w.priority === "hoch" ? "text-gold-400" : "text-slate-500"
                  }`}
                />
                <span>
                  <Badge tone={w.priority === "kritisch" ? "red" : w.priority === "hoch" ? "gold" : "neutral"}>{w.priority}</Badge>{" "}
                  <span className="text-slate-500">[{w.category}]</span> {w.description}
                  <span className="block text-[10px] text-slate-500 mt-0.5">→ {w.recommendation}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-base-600/60 flex items-center gap-1.5 font-mono text-[9px] text-slate-600">
        <HardDrive size={11} />
        Cache: {cacheStatus.freshEntries} aktuell, {cacheStatus.staleEntries} abgelaufen, {cacheStatus.totalEntries} gesamt (In-Memory, diese Session).
      </div>
    </Card>
  );
}
