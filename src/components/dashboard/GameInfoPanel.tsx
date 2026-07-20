import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, RefreshCw, Timer, Trophy } from "lucide-react";
import type { GameInfo } from "@/types";
import { Badge, Card } from "@/components/common/UI";

/**
 * Version 6.0 (Paket 5, Priorität 1; erweitert in Paket 6, Schritt 8):
 * Spielinformationen-Panel.
 *
 * Zeigt alle automatisch aus der MLB Stats API abgeleiteten
 * Spielinformationen (siehe `@/engine/gameInfoEngine`) — ausschließlich
 * bereits geladene Daten, keine zusätzlichen API-Aufrufe. Wird
 * oberhalb der eigentlichen Analyse angezeigt. Countdown bis
 * Spielbeginn und "Zeit seit letzter Aktualisierung" ticken live
 * (reine Anzeige-Logik, keine neue Datenquelle).
 */
export function GameInfoPanel({ data }: { data: GameInfo | null | undefined }) {
  // Ticking-Uhr für Countdown/Aktualisierungszeit — aktualisiert sich
  // selbst jede Sekunde, ohne dass neue Daten geladen werden müssen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (!data) return null;

  const statusTone = data.status === "Live" ? "red" : data.status === "Beendet" ? "neutral" : data.status === "Verschoben" ? "gold" : "green";

  const countdownLabel = formatCountdown(data.gameStartTimestamp, now);
  const lastUpdatedLabel = formatElapsed(data.loadedAt, now);

  return (
    <Card accent="gold">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
        <div>
          <h2 className="font-numeric text-xl text-slate-100 leading-tight">
            {data.awayTeamName} <span className="text-slate-500">@</span> {data.homeTeamName}
          </h2>
          <div className="flex items-center gap-2 mt-1 font-mono text-xs text-slate-400">
            <Calendar size={13} />
            <span>
              {data.dateLabel}
              {data.weekdayLabel && ` · ${data.weekdayLabel}`}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={statusTone}>
            {data.status}
            {data.doubleheaderGameNumber !== null && data.status !== "Doubleheader Spiel 1" && data.status !== "Doubleheader Spiel 2"
              ? ` (Spiel ${data.doubleheaderGameNumber})`
              : ""}
          </Badge>
          {countdownLabel && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
              <Timer size={10} /> {countdownLabel}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            <Clock size={11} /> US-Zeit
          </span>
          <span className="font-numeric text-sm text-slate-100">{data.localTimeLabel || "–"}</span>
        </div>
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            <Clock size={11} /> Lokale Zeit
          </span>
          <span className="font-numeric text-sm text-slate-100">{data.germanTimeLabel || "–"}</span>
        </div>
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            <MapPin size={11} /> Stadion
          </span>
          <span className="font-mono text-xs text-slate-100">{data.venueName || "–"}</span>
        </div>
        <div>
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">
            <Trophy size={11} /> Saisonphase
          </span>
          <span className="font-mono text-xs text-slate-100">{data.seasonPhaseLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-slate-500 pt-2 border-t border-base-600/60">
        <span>Game-ID: {data.gameId}</span>
        {data.venueId !== null && <span>Venue-ID: {data.venueId}</span>}
        {data.seriesGameNumber !== null && data.gamesInSeries !== null && (
          <span>
            Serie: Spiel {data.seriesGameNumber} von {data.gamesInSeries}
          </span>
        )}
        {data.doubleheaderGameNumber !== null && <span>Doubleheader: Spiel {data.doubleheaderGameNumber}</span>}
        <span className="flex items-center gap-1 ml-auto">
          <RefreshCw size={10} /> Aktualisiert vor {lastUpdatedLabel}
        </span>
      </div>
    </Card>
  );
}

/** Formatiert die verbleibende Zeit bis Spielbeginn. `null`, wenn das Spiel bereits begonnen hat oder kein Zeitpunkt bekannt ist. */
function formatCountdown(gameStartTimestamp: number | null, now: number): string | null {
  if (gameStartTimestamp === null) return null;
  const diffMs = gameStartTimestamp - now;
  if (diffMs <= 0) return null;

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `Beginnt in ${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `Beginnt in ${hours}h ${minutes}m ${seconds}s`;
  return `Beginnt in ${minutes}m ${seconds}s`;
}

/** Formatiert die verstrichene Zeit seit dem letzten Laden dieser Spielinformationen. */
function formatElapsed(loadedAt: number, now: number): string {
  const totalSeconds = Math.max(0, Math.floor((now - loadedAt) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}
