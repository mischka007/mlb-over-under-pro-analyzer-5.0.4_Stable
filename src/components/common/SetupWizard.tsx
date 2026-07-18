import { useState } from "react";
import { CloudSun, KeyRound, LineChart } from "lucide-react";
import { getStoredApiKeys, markSetupWizardSeen, saveApiKeys } from "@/services/api/apiKeys";

/**
 * Setup-Assistent, der beim ersten Programmstart erscheint und nach den
 * beiden optionalen API-Keys fragt (OpenWeatherMap, The Odds API). Beide
 * sind kostenlos erhältlich. Werden sie übersprungen, arbeitet der
 * Analyzer vollständig weiter — Wetter bzw. Quoten bleiben dann lediglich
 * manuell zu befüllende Felder, es wird nichts deaktiviert oder simuliert.
 */
export function SetupWizard({ onDone }: { onDone: () => void }) {
  const existing = getStoredApiKeys();
  const [openWeatherApiKey, setOpenWeatherApiKey] = useState(existing.openWeatherApiKey);
  const [oddsApiKey, setOddsApiKey] = useState(existing.oddsApiKey);

  const handleSave = () => {
    saveApiKeys({ openWeatherApiKey: openWeatherApiKey.trim(), oddsApiKey: oddsApiKey.trim() });
    markSetupWizardSeen();
    onDone();
  };

  const handleSkip = () => {
    markSetupWizardSeen();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/95 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-xl border border-base-600 bg-base-850 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-gold-400" />
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide text-slate-100">Setup-Assistent</h2>
        </div>
        <p className="font-mono text-[11px] text-slate-500 mb-6">
          Optional, aber empfohlen: trage deine kostenlosen API-Keys ein, damit Wetter und Quoten automatisch geladen
          werden. Ohne Keys funktioniert der Analyzer trotzdem vollständig — diese beiden Bereiche bleiben dann
          manuelle Eingabefelder.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              <CloudSun size={12} /> OpenWeatherMap API-Key
            </label>
            <input
              type="text"
              value={openWeatherApiKey}
              onChange={(e) => setOpenWeatherApiKey(e.target.value)}
              placeholder="z. B. 8f3a1b2c9d..."
              className="w-full rounded-md bg-base-800 border border-base-600 text-xs text-slate-100 font-mono py-2.5 px-3 outline-none focus:border-gold-500"
            />
            <a href="https://openweathermap.org/api" target="_blank" rel="noreferrer" className="font-mono text-[10px] text-teal-400 hover:underline">
              Kostenlosen Key erstellen →
            </a>
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
              <LineChart size={12} /> The Odds API-Key
            </label>
            <input
              type="text"
              value={oddsApiKey}
              onChange={(e) => setOddsApiKey(e.target.value)}
              placeholder="z. B. 4c7e9f1a2b..."
              className="w-full rounded-md bg-base-800 border border-base-600 text-xs text-slate-100 font-mono py-2.5 px-3 outline-none focus:border-gold-500"
            />
            <a href="https://the-odds-api.com" target="_blank" rel="noreferrer" className="font-mono text-[10px] text-teal-400 hover:underline">
              Kostenlosen Key erstellen →
            </a>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={handleSkip} className="rounded-md border border-base-600 px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-slate-400 hover:border-slate-400 transition-colors">
            Überspringen
          </button>
          <button onClick={handleSave} className="rounded-md bg-gold-500 px-5 py-2.5 text-xs font-display font-semibold uppercase tracking-wider text-base-950 hover:bg-gold-400 transition-colors">
            Speichern &amp; starten
          </button>
        </div>
      </div>
    </div>
  );
}
