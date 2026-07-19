import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import type { BetTier, GameCardSummary, QualityGrade } from "@/types";
import { Card } from "@/components/common/UI";

export interface RankedGameResult {
  game: GameCardSummary;
  pick: "over" | "under" | null;
  confidence: number;
  grade: QualityGrade;
  tier: BetTier;
  line: number;
}

const TIER_TONE: Record<BetTier, "gold" | "green" | "neutral" | "red"> = {
  "Elite Bet": "gold",
  "Premium Bet": "gold",
  "Strong Bet": "green",
  "Good Bet": "green",
  Lean: "neutral",
  Pass: "neutral",
  "No Bet": "red",
};

/**
 * Zeigt alle heutigen Spiele als nach Wahrscheinlichkeit sortierte
 * Rangliste, jeweils mit Empfehlung, Confidence, Schulnote und Bet-Tier.
 */
export function AnalyzeAllPage({
  results,
  isRunning,
  progress,
  total,
  failedCount = 0,
  onBack,
  onOpenGame,
}: {
  results: RankedGameResult[];
  isRunning: boolean;
  progress: number;
  total: number;
  failedCount?: number;
  onBack: () => void;
  onOpenGame: (game: GameCardSummary) => void;
}) {
  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-gold-400 transition-colors">
          <ArrowLeft size={14} /> Zurück
        </button>
        {isRunning && (
          <span className="font-mono text-[11px] text-slate-500">
            Analysiere Spiel {progress} von {total}…
          </span>
        )}
      </div>

      <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-slate-100">Rangliste — Alle heutigen Spiele</h2>

      {isRunning && (
        <div className="h-2 rounded-full bg-base-800 overflow-hidden">
          <div className="h-full bg-gold-500 transition-all duration-300" style={{ width: `${total ? (progress / total) * 100 : 0}%` }} />
        </div>
      )}

      {failedCount > 0 && (
        <Card accent="red">
          <div className="font-mono text-xs text-negred-400">
            {failedCount} von {total} Spielen konnten nicht geladen werden (übersprungen) — die übrigen Ergebnisse sind vollständig.
          </div>
        </Card>
      )}

      <div className="space-y-2.5">
        {sorted.map((r, i) => (
          <Card key={r.game.gamePk} accent={r.pick === "over" ? "gold" : r.pick === "under" ? "teal" : "none"} className="cursor-pointer">
            <button onClick={() => onOpenGame(r.game)} className="w-full flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3">
                <span className="font-numeric text-2xl text-slate-600 w-8">{i + 1}.</span>
                <div>
                  <div className="font-display text-sm font-semibold text-slate-100">
                    {r.game.awayTeamName} @ {r.game.homeTeamName}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">Linie {r.line}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {r.pick && (
                  <span className={`flex items-center gap-1 font-display text-sm font-bold uppercase ${r.pick === "over" ? "text-gold-400" : "text-teal-400"}`}>
                    {r.pick === "over" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    {r.pick === "over" ? "Über" : "Unter"} {r.line}
                  </span>
                )}
                <span className="font-numeric text-lg text-slate-100">{(r.confidence * 100).toFixed(0)}%</span>
                <span className="font-mono text-xs px-2 py-1 rounded-md border border-base-600 text-slate-300">{r.grade}</span>
                <span className={`font-mono text-[10px] px-2 py-1 rounded-full border ${tierClass(TIER_TONE[r.tier])}`}>{r.tier}</span>
              </div>
            </button>
          </Card>
        ))}
      </div>

      {!isRunning && sorted.length === 0 && (
        <Card>
          <div className="text-center py-8 font-mono text-xs text-slate-500">Noch keine Ergebnisse.</div>
        </Card>
      )}
    </div>
  );
}

function tierClass(tone: "gold" | "green" | "neutral" | "red"): string {
  if (tone === "gold") return "border-gold-500/50 bg-gold-500/10 text-gold-400";
  if (tone === "green") return "border-posgreen-500/50 bg-posgreen-500/10 text-posgreen-400";
  if (tone === "red") return "border-negred-500/50 bg-negred-500/10 text-negred-400";
  return "border-base-600 bg-base-800 text-slate-400";
}
