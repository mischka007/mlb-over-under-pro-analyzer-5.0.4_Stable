import { Gauge as GaugeIcon, Plane, TrendingUp } from "lucide-react";
import type { ExtendedMetrics } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";

/**
 * Zeigt die in v5.0 neu hinzugekommenen Kennzahlen: Pitcher-/Bullpen-/
 * Offense-Matchup-Score, Momentum, Rest-/Reise-Hinweise. Felder ohne
 * verlässliche freie Datenquelle (Expected HR, Lineup-Strength, Umpire)
 * werden transparent als "nicht verfügbar" markiert statt geschätzt.
 */
export function ExtendedMetricsPanel({ metrics }: { metrics: ExtendedMetrics }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={TrendingUp} title="Erweiterte Analysen" accent="gold" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Pitcher-Matchup" value={`${metrics.pitcherMatchupScore.toFixed(0)}`} />
        <Metric label="Bullpen-Matchup" value={`${metrics.bullpenMatchupScore.toFixed(0)}`} />
        <Metric label="Offense-Matchup" value={`${metrics.offenseMatchupScore.toFixed(0)}`} />
        <Metric label="Momentum" value={`${metrics.momentumScore.toFixed(0)}`} />
        <Metric label="Recent Form" value={`${metrics.recentFormScore.toFixed(0)}`} />
        <Metric label="Lineup-Stärke" value={metrics.lineupStrengthScore != null ? metrics.lineupStrengthScore.toFixed(0) : "Nicht verfügbar"} muted={metrics.lineupStrengthScore == null} />
        <Metric label="Expected HR" value={metrics.expectedHomeRuns != null ? metrics.expectedHomeRuns.toFixed(2) : "Nicht verfügbar"} muted={metrics.expectedHomeRuns == null} />
        <Metric label="Umpire" value={metrics.umpireName ?? "Nicht verfügbar"} muted={!metrics.umpireName} />
      </div>

      {(metrics.restAdvantageNote || metrics.travelFatigueNote) && (
        <div className="mt-3 pt-3 border-t border-base-600 space-y-1.5">
          {metrics.restAdvantageNote && (
            <div className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
              <GaugeIcon size={13} className="mt-0.5 text-teal-400 shrink-0" /> {metrics.restAdvantageNote}
            </div>
          )}
          {metrics.travelFatigueNote && (
            <div className="flex items-start gap-2 font-mono text-[11px] text-slate-400">
              <Plane size={13} className="mt-0.5 text-gold-400 shrink-0" /> {metrics.travelFatigueNote}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-lg border border-base-600 bg-base-800/50 p-3">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`font-numeric text-lg leading-none ${muted ? "text-slate-600" : "text-slate-100"}`}>{value}</div>
    </div>
  );
}
