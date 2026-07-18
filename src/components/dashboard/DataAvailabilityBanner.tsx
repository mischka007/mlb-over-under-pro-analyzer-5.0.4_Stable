import { CheckCircle2, XCircle } from "lucide-react";
import type { AvailabilityFlags } from "@/hooks/useGameAutoLoad";
import { Card } from "@/components/common/UI";

const LABELS: Record<keyof AvailabilityFlags, string> = {
  homeOffense: "Offense (Heim)",
  awayOffense: "Offense (Auswärts)",
  homePitcher: "Pitcher (Heim)",
  awayPitcher: "Pitcher (Auswärts)",
  homeBullpen: "Bullpen (Heim)",
  awayBullpen: "Bullpen (Auswärts)",
  homeForm: "Form (Heim)",
  awayForm: "Form (Auswärts)",
  weather: "Wetter",
  ballpark: "Ballpark",
  h2h: "Head-to-Head",
  market: "Quoten/Markt",
  lineups: "Lineups",
};

/**
 * Zeigt transparent an, welche der automatisch ladbaren Datenblöcke
 * tatsächlich befüllt werden konnten und welche mangels verfügbarer
 * Quelle (noch) manuell ergänzt werden müssen. Erfüllt die Vorgabe
 * "wenn Daten nicht verfügbar sind, transparent anzeigen".
 */
export function DataAvailabilityBanner({ availability }: { availability: AvailabilityFlags }) {
  const keys = Object.keys(availability) as (keyof AvailabilityFlags)[];
  const loaded = keys.filter((k) => availability[k]);
  const missing = keys.filter((k) => !availability[k]);

  return (
    <Card accent={missing.length === 0 ? "green" : "gold"}>
      <div className="flex flex-wrap gap-2">
        {loaded.map((k) => (
          <span key={k} className="flex items-center gap-1 rounded-full border border-posgreen-500/40 bg-posgreen-500/10 px-2.5 py-1 text-[10px] font-mono text-posgreen-400">
            <CheckCircle2 size={11} /> {LABELS[k]}
          </span>
        ))}
        {missing.map((k) => (
          <span key={k} className="flex items-center gap-1 rounded-full border border-base-600 bg-base-800 px-2.5 py-1 text-[10px] font-mono text-slate-500">
            <XCircle size={11} /> {LABELS[k]} — nicht verfügbar
          </span>
        ))}
      </div>
      {missing.length > 0 && (
        <p className="font-mono text-[10px] text-slate-500 mt-2">
          Nicht automatisch geladene Bereiche bleiben unten als manuelle Eingabefelder bestehen — es wurden keine Werte erfunden.
        </p>
      )}
    </Card>
  );
}
