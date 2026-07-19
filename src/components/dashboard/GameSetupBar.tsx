import { CalendarClock } from "lucide-react";
import type { GameSetup } from "@/types";
import { Card, Checkbox, StatInput, TextField } from "@/components/common/UI";

const BOOKMAKERS = ["DraftKings", "FanDuel", "BetMGM", "Caesars", "Bet365", "Bwin", "Winamax", "Sonstige"];

type Accent = "gold" | "teal" | "green" | "red";

/**
 * Kopfzeile des Dashboards: Team-Namen, Wettlinie, Quoten, Bookmaker,
 * Bankroll sowie die drei manuellen Bestätigungs-Checkboxen, die vom
 * Premium-Filter benötigt werden (Pitcher/Lineups/Wetter bestätigt) und
 * der Doubleheader-Schalter.
 */
export function GameSetupBar({
  setup,
  onChange,
  accent = "gold",
}: {
  setup: GameSetup;
  onChange: (patch: Partial<GameSetup>) => void;
  accent?: Accent;
}) {
  return (
    <Card accent={accent} className="sticky top-2 z-10">
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={16} className="text-gold-400" />
        <span className="font-display uppercase tracking-widest text-xs text-slate-200">Spiel-Setup</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <TextField label="Heimteam" value={setup.homeTeamName} onChange={(v) => onChange({ homeTeamName: v })} placeholder="z. B. Yankees" />
        <TextField label="Auswärtsteam" value={setup.awayTeamName} onChange={(v) => onChange({ awayTeamName: v })} placeholder="z. B. Red Sox" />
        <StatInput label="MLB Wettlinie" value={setup.line} onChange={(v) => onChange({ line: v })} placeholder="8.5" />
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Bookmaker</span>
          <select
            value={setup.bookmaker}
            onChange={(e) => onChange({ bookmaker: e.target.value })}
            className="w-full rounded-md bg-base-800/80 border border-base-600 text-xs text-slate-100 font-mono py-2 px-2 outline-none focus:border-gold-500"
          >
            <option value="">Wählen…</option>
            {BOOKMAKERS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <StatInput label="Quote Über" value={setup.oddsOver} onChange={(v) => onChange({ oddsOver: v })} placeholder="1.90" />
        <StatInput label="Quote Unter" value={setup.oddsUnder} onChange={(v) => onChange({ oddsUnder: v })} placeholder="1.90" />
        <StatInput label="Bankroll (€)" value={setup.bankroll} onChange={(v) => onChange({ bankroll: v })} placeholder="1000" />
        <Checkbox label="Doubleheader" checked={setup.isDoubleheader} onChange={(v) => onChange({ isDoubleheader: v })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Checkbox label="Pitcher bestätigt" sublabel="Kein kurzfristiger Wechsel" checked={setup.pitcherConfirmed} onChange={(v) => onChange({ pitcherConfirmed: v })} />
        <Checkbox label="Lineups bestätigt" sublabel="Startaufstellung final" checked={setup.lineupsConfirmed} onChange={(v) => onChange({ lineupsConfirmed: v })} />
        <Checkbox label="Wetter bestätigt" sublabel="Prognose final geprüft" checked={setup.weatherConfirmed} onChange={(v) => onChange({ weatherConfirmed: v })} />
        <Checkbox
          label="Keine Verletzungssorgen"
          sublabel="Kein Schlüsselspieler verletzt/fraglich"
          checked={setup.noInjuryConcerns}
          onChange={(v) => onChange({ noInjuryConcerns: v })}
        />
      </div>
    </Card>
  );
}
