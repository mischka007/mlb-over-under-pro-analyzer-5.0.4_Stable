import { Moon, Settings as SettingsIcon, Sun, Zap, ZapOff } from "lucide-react";
import type { ThemeMode } from "@/hooks/useTheme";
import { Card, SectionHeader } from "@/components/common/UI";

export type AccentColor = "gold" | "teal" | "green" | "red";

const ACCENT_HEX: Record<AccentColor, string> = {
  gold: "#eab308",
  teal: "#14b8ac",
  green: "#22c55e",
  red: "#ef4444",
};

/**
 * Einstellungs-Panel: schaltet Dark/Light-Mode, die Markenakzentfarbe
 * (steuert z. B. den Glow-Rahmen der Premium-Prediction-Karte über die
 * CSS-Variable --brand-accent) sowie Animationen um (via Framer-Motion
 * "reducedMotion"-Steuerung in App.tsx).
 */
export function SettingsPanel({
  theme,
  onThemeChange,
  accent,
  onAccentChange,
  animationsEnabled,
  onAnimationsToggle,
}: {
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
  accent: AccentColor;
  onAccentChange: (a: AccentColor) => void;
  animationsEnabled: boolean;
  onAnimationsToggle: (v: boolean) => void;
}) {
  return (
    <Card accent="gold">
      <SectionHeader icon={SettingsIcon} title="Einstellungen" accent="gold" />

      <div className="space-y-4">
        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Darstellung</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => onThemeChange("dark")}
              aria-pressed={theme === "dark"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase border transition-colors ${
                theme === "dark" ? "bg-gold-500/20 border-gold-500 text-slate-100" : "bg-base-800 border-base-600 text-slate-500"
              }`}
            >
              <Moon size={12} /> Dark
            </button>
            <button
              onClick={() => onThemeChange("light")}
              aria-pressed={theme === "light"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase border transition-colors ${
                theme === "light" ? "bg-gold-500/20 border-gold-500 text-slate-100" : "bg-base-800 border-base-600 text-slate-500"
              }`}
            >
              <Sun size={12} /> Light
            </button>
          </div>
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Akzentfarbe</span>
          <div className="flex gap-2">
            {(Object.keys(ACCENT_HEX) as AccentColor[]).map((c) => (
              <button
                key={c}
                onClick={() => onAccentChange(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${accent === c ? "scale-110 border-slate-100" : "border-transparent"}`}
                style={{ background: ACCENT_HEX[c] }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">Animationen</span>
          <button
            onClick={() => onAnimationsToggle(!animationsEnabled)}
            aria-pressed={animationsEnabled}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase border transition-colors ${
              animationsEnabled ? "bg-gold-500/20 border-gold-500 text-slate-100" : "bg-base-800 border-base-600 text-slate-500"
            }`}
          >
            {animationsEnabled ? <Zap size={12} /> : <ZapOff size={12} />}
            {animationsEnabled ? "Aktiviert" : "Deaktiviert"}
          </button>
        </div>
      </div>
    </Card>
  );
}

export { ACCENT_HEX };
