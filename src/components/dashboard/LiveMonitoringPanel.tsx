import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowRightLeft, Gauge, Radio, RefreshCw } from "lucide-react";
import type { AlertSeverity } from "@/types";
import type { UseLiveMonitoringResult } from "@/hooks/useLiveMonitoring";
import { Badge, Card, SectionHeader } from "@/components/common/UI";

/**
 * Version 6.0 (Paket 7A/7B/7C): Live Monitoring Panel.
 *
 * Paket 7A: Statusanzeige (aktiv/inaktiv, letzte/nächste
 * Aktualisierung, API-Status). Paket 7B: Alert Panel und
 * chronologische Change History mit Schweregrad. Paket 7C (neu,
 * additiv): Live Prediction/Confidence (aus dem bereits reaktiv
 * neuberechneten `analysis.consensus`, unverändert übernommen), Live
 * Status (Live Stability/Update Confidence/Prediction Reliability) und
 * eine auf Prediction-/Confidence-Änderungen gefilterte Sicht der
 * Change History. Rein darstellend, keine eigene Berechnung.
 */
export function LiveMonitoringPanel({
  monitoring,
  predictionPick,
  confidencePct,
}: {
  monitoring: UseLiveMonitoringResult;
  predictionPick: "over" | "under" | null;
  confidencePct: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!monitoring.isActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [monitoring.isActive]);

  const predictionChanges = monitoring.changeHistory.filter((a) => a.category === "prediction" || a.category === "confidence");

  return (
    <Card accent="teal">
      <SectionHeader icon={Radio} title="Live Monitoring" accent="teal" />

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Badge tone={monitoring.isActive ? "green" : "neutral"}>{monitoring.isActive ? "Aktiv" : "Inaktiv"}</Badge>
          <span className="font-mono text-[10px] text-slate-500">Intervall: {Math.round(monitoring.checkIntervalMs / 60000)} Min.</span>
        </div>
        <button
          type="button"
          onClick={monitoring.toggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase border transition-colors ${
            monitoring.isActive ? "bg-posgreen-500/15 border-posgreen-500 text-posgreen-400" : "bg-base-800 border-base-600 text-slate-400"
          }`}
        >
          <RefreshCw size={12} className={monitoring.isActive ? "animate-spin" : ""} />
          {monitoring.isActive ? "Deaktivieren" : "Aktivieren"}
        </button>
      </div>

      {monitoring.isActive && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-base-600/60">
            <div>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
                <ArrowRightLeft size={11} /> Live Prediction
              </span>
              <span className="font-numeric text-lg text-slate-100">{predictionPick ? (predictionPick === "over" ? "Over" : "Under") : "kein Pick"}</span>
            </div>
            <div>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
                <Gauge size={11} /> Live Confidence
              </span>
              <span className="font-numeric text-lg text-slate-100">{confidencePct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Live Stability</span>
              <span className="font-numeric text-lg text-slate-100">{monitoring.liveQuality.liveStability}</span>
            </div>
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Update Confidence</span>
              <span className="font-numeric text-lg text-slate-100">{monitoring.liveQuality.updateConfidence}</span>
            </div>
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Prediction Reliability</span>
              <span className="font-numeric text-lg text-slate-100">{monitoring.liveQuality.livePredictionReliability}</span>
            </div>
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500">Alert Confidence</span>
              <span className="font-numeric text-lg text-slate-100">{monitoring.liveQuality.averageAlertConfidence}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Letzte Aktualisierung</span>
              <span className="font-mono text-xs text-slate-100">
                {monitoring.lastCheckedAt ? formatElapsedShort(monitoring.lastCheckedAt, now) : "wird geprüft…"}
              </span>
            </div>
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Nächste Aktualisierung</span>
              <span className="font-mono text-xs text-slate-100">
                {monitoring.nextCheckAt ? formatCountdownShort(monitoring.nextCheckAt, now) : "–"}
              </span>
            </div>
          </div>
        </>
      )}

      {monitoring.isActive && monitoring.apiStatus.length > 0 && (
        <div className="mb-4">
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">API-Status</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {monitoring.apiStatus.map((s) => (
              <div key={s.source} className="flex items-center justify-between rounded-md border border-base-600 bg-base-800/50 px-2.5 py-1.5">
                <span className="font-mono text-[11px] text-slate-300">{s.source}</span>
                <Badge tone={s.status === "verfügbar" ? "green" : s.status === "eingeschränkt" ? "gold" : "red"}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {monitoring.isActive && predictionChanges.length > 0 && (
        <div className="mb-4">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            <Activity size={11} /> Prediction Changes ({predictionChanges.length})
          </span>
          <ul className="space-y-1">
            {predictionChanges.slice(0, 5).map((alert) => (
              <li key={alert.id} className="flex items-center justify-between rounded-md border border-base-600 bg-base-800/50 px-2.5 py-1.5">
                <span className="font-mono text-[10px] text-slate-300">
                  {alert.oldValue} <span className="text-slate-600">→</span> {alert.newValue}
                </span>
                <span className="font-mono text-[9px] text-slate-500">{formatTimeOfDay(alert.timestamp)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {monitoring.isActive && (
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            <AlertTriangle size={11} /> Change History ({monitoring.changeHistory.length})
          </span>
          {monitoring.changeHistory.length === 0 ? (
            <p className="font-mono text-[11px] text-slate-500">Noch keine Änderungen erkannt.</p>
          ) : (
            <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {monitoring.changeHistory.map((alert) => (
                <li key={alert.id} className="rounded-md border border-base-600 bg-base-800/50 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-[11px] text-slate-200">{alert.description}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <SeverityBadge severity={alert.severity} />
                      <span className="font-mono text-[9px] text-slate-500">{formatTimeOfDay(alert.timestamp)}</span>
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {alert.oldValue} <span className="text-slate-600">→</span> {alert.newValue}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                    {alert.impact} <span className="text-slate-600">(Alert Confidence: {alert.confidencePct})</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!monitoring.isActive && (
        <p className="font-mono text-[11px] text-slate-500">
          Live Monitoring ist deaktiviert. Bei Aktivierung werden Starting Pitcher, Lineups, Wetter, Odds/Market Score, Steam Move/Reverse Line
          Movement, Prediction, Confidence und Data Quality alle {Math.round(monitoring.checkIntervalMs / 60000)} Minuten automatisch geprüft;
          Wetter- und Marktänderungen aktualisieren automatisch die betroffenen Analyse-Felder (ausschließlich bereits bestehende Datenquellen,
          cache-schonend).
        </p>
      )}
    </Card>
  );
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const tone = severity === "kritisch" ? "red" : severity === "hoch" ? "gold" : severity === "mittel" ? "neutral" : "green";
  return <Badge tone={tone}>{severity}</Badge>;
}

function formatElapsedShort(timestamp: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (totalSeconds < 60) return `vor ${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  return `vor ${minutes}min`;
}

function formatCountdownShort(timestamp: number, now: number): string {
  const diffMs = timestamp - now;
  if (diffMs <= 0) return "in Kürze";
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `in ${minutes}m ${seconds}s`;
}

function formatTimeOfDay(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
