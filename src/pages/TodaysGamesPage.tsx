import { AlertTriangle, Clock, ListChecks, RefreshCw, Trophy } from "lucide-react";
import type { GameCardSummary } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";

/**
 * Startseite von v5.0: zeigt "Today's MLB Games" als Kartenliste. Jede
 * Karte zeigt Teams, Startzeit, Probable Pitcher sowie – falls ein
 * Odds-API-Key hinterlegt ist – die aktuelle Wettlinie. Über den Button
 * "Analyse starten" wird die vollautomatische Ladepipeline ausgelöst.
 */
export function TodaysGamesPage({
  games,
  isLoading,
  error,
  onReload,
  onAnalyze,
  onAnalyzeAll,
  onShowHistory,
}: {
  games: GameCardSummary[];
  isLoading: boolean;
  error: string | null;
  onReload: () => void;
  onAnalyze: (game: GameCardSummary) => void;
  onAnalyzeAll: () => void;
  onShowHistory: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-slate-100">Today&apos;s MLB Games</h2>
        <div className="flex gap-2">
          <button
            onClick={onReload}
            className="flex items-center gap-1.5 rounded-md border border-base-600 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:border-gold-500 hover:text-gold-400 transition-colors"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Neu laden
          </button>
          <button
            onClick={onAnalyzeAll}
            disabled={games.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-gold-500 bg-gold-500/10 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-40"
          >
            <ListChecks size={13} /> Alle Spiele analysieren
          </button>
          <button
            onClick={onShowHistory}
            className="flex items-center gap-1.5 rounded-md border border-base-600 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:border-teal-500 hover:text-teal-400 transition-colors"
          >
            <Trophy size={13} /> Historie
          </button>
        </div>
      </div>

      {error && (
        <Card accent="red">
          <div className="flex items-center gap-2 text-negred-400">
            <AlertTriangle size={16} />
            <span className="font-mono text-xs">{error}</span>
          </div>
        </Card>
      )}

      {isLoading && games.length === 0 && (
        <Card>
          <div className="text-center py-8 font-mono text-xs text-slate-500">Lade heutigen Spielplan…</div>
        </Card>
      )}

      {!isLoading && games.length === 0 && !error && (
        <Card>
          <div className="text-center py-8 font-mono text-xs text-slate-500">Heute sind keine MLB-Spiele angesetzt.</div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {games.map((game) => (
          <GameCard key={game.gamePk} game={game} onAnalyze={() => onAnalyze(game)} />
        ))}
      </div>
    </div>
  );
}

function GameCard({ game, onAnalyze }: { game: GameCardSummary; onAnalyze: () => void }) {
  const time = new Date(game.gameDate).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return (
    <Card accent="gold" className="flex flex-col justify-between">
      <div>
        <SectionHeader icon={Clock} title={time} weightPct={undefined} />
        <div className="font-display text-base font-semibold text-slate-100 mb-1">
          {game.awayTeamName} @ {game.homeTeamName}
        </div>
        <div className="font-mono text-[11px] text-slate-500 mb-2">{game.venueName}</div>
        <div className="font-mono text-[11px] text-slate-400 mb-3">
          {game.awayProbablePitcherName ?? "Pitcher TBD"} vs. {game.homeProbablePitcherName ?? "Pitcher TBD"}
        </div>
        {game.line != null ? (
          <div className="flex gap-2 mb-3">
            <span className="rounded-full border border-gold-500/40 bg-gold-500/10 px-2.5 py-1 text-[10px] font-mono text-gold-400">
              Linie {game.line}
            </span>
            {game.oddsOver != null && (
              <span className="rounded-full border border-base-600 bg-base-800 px-2.5 py-1 text-[10px] font-mono text-slate-400">
                Ü {game.oddsOver.toFixed(2)} / U {game.oddsUnder?.toFixed(2)}
              </span>
            )}
          </div>
        ) : (
          <div className="font-mono text-[10px] text-slate-600 mb-3">Keine Quoten verfügbar (kein Odds-API-Key hinterlegt)</div>
        )}
      </div>
      <button
        onClick={onAnalyze}
        className="w-full rounded-md bg-gold-500 text-base-950 font-display font-semibold text-sm uppercase tracking-wide py-2.5 hover:bg-gold-400 transition-colors"
      >
        Analyse starten
      </button>
    </Card>
  );
}
