import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/**
 * Sammlung kleiner, wiederverwendbarer UI-Atome im Glassmorphism-/Terminal-Stil.
 * Bewusst in einer Datei gebündelt, um die Anzahl trivialer Ein-Komponenten-
 * Dateien gering zu halten, ohne die Modularität (mehrere benannte Exporte)
 * zu verlieren.
 */

// ---------------------------------------------------------------------------
// Card: Glassmorphism-Container mit optionalem Glow-Akzent
// ---------------------------------------------------------------------------
type Accent = "gold" | "teal" | "green" | "red" | "none";

const accentBorder: Record<Accent, string> = {
  gold: "border-t-gold-500",
  teal: "border-t-teal-500",
  green: "border-t-posgreen-500",
  red: "border-t-negred-500",
  none: "border-t-base-600",
};

const accentGlow: Record<Accent, string> = {
  gold: "hover:shadow-glow-gold",
  teal: "hover:shadow-glow-teal",
  green: "hover:shadow-glow-green",
  red: "hover:shadow-glow-red",
  none: "",
};

export function Card({
  children,
  accent = "none",
  className = "",
}: {
  children: ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`rounded-xl border border-base-600/60 border-t-2 ${accentBorder[accent]} bg-base-850/70 backdrop-blur-md shadow-glass transition-shadow duration-300 ${accentGlow[accent]} p-4 sm:p-5 ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader: Modul-Titel mit Icon, Nummer und Gewichtungs-Badge
// ---------------------------------------------------------------------------
export function SectionHeader({
  icon: Icon,
  moduleNumber,
  title,
  weightPct,
  accent = "gold",
}: {
  icon: LucideIcon;
  moduleNumber?: number;
  title: string;
  weightPct?: number;
  accent?: Accent;
}) {
  const colorClass =
    accent === "gold" ? "text-gold-400" : accent === "teal" ? "text-teal-400" : accent === "green" ? "text-posgreen-400" : accent === "red" ? "text-negred-400" : "text-slate-300";

  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className={colorClass} />
        <span className="font-display uppercase tracking-widest text-xs text-slate-200">
          {moduleNumber != null && <span className={`${colorClass} mr-1.5`}>{moduleNumber} ·</span>}
          {title}
        </span>
      </div>
      {weightPct != null && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 bg-base-800 px-2 py-0.5 rounded-full border border-base-600">
          {weightPct}%
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatInput: beschriftetes Zahlenfeld im Terminal-Look
// ---------------------------------------------------------------------------
export function StatInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-base-800/80 border border-base-600 text-center text-xs text-slate-100 font-mono py-2 outline-none transition-colors focus:border-gold-500 focus:shadow-glow-gold"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// TextField: beschriftetes Textfeld (z. B. Teamname)
// ---------------------------------------------------------------------------
export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      {label && <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-transparent border-b border-base-600 text-lg font-display font-semibold text-slate-100 py-1.5 outline-none transition-colors focus:border-gold-500"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// SequenceInput: Reihe von n Zahlenfeldern (z. B. letzte 10 Spiele)
// ---------------------------------------------------------------------------
export function SequenceInput({
  values,
  onChange,
  columns = 5,
}: {
  values: string[];
  onChange: (index: number, value: string) => void;
  columns?: number;
}) {
  return (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {values.map((v, i) => (
        <input
          key={i}
          type="number"
          inputMode="decimal"
          value={v}
          placeholder={`${i + 1}`}
          onChange={(e) => onChange(i, e.target.value)}
          className="w-full rounded-md bg-base-800/80 border border-base-600 text-center text-xs text-slate-100 font-mono py-2 outline-none transition-colors focus:border-teal-500 focus:shadow-glow-teal"
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToggleGroup: Button-Gruppe für kategoriale Auswahl
// ---------------------------------------------------------------------------
export function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] uppercase font-mono tracking-wide border transition-colors ${
                active
                  ? "bg-gold-500/20 border-gold-500 text-slate-100"
                  : "bg-base-800/80 border-base-600 text-slate-500 hover:border-slate-500"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Checkbox: Checkbox-Zeile für Bestätigungen / Filter
// ---------------------------------------------------------------------------
export function Checkbox({
  label,
  sublabel,
  checked,
  onChange,
  readOnly = false,
}: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange?: (value: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={sublabel ? `${label} — ${sublabel}` : label}
      disabled={readOnly}
      onClick={() => onChange?.(!checked)}
      className={`w-full flex items-start gap-2.5 rounded-md px-3 py-2.5 text-left border transition-colors ${
        checked ? "bg-posgreen-500/10 border-posgreen-500/70" : "bg-base-800/60 border-base-600"
      } ${readOnly ? "cursor-default" : "cursor-pointer hover:border-slate-400"}`}
    >
      <div
        className={`w-4 h-4 mt-0.5 rounded-sm shrink-0 border flex items-center justify-center ${
          checked ? "bg-posgreen-500 border-posgreen-500" : "border-slate-500"
        }`}
      >
        {checked && <span className="block w-1.5 h-2.5 border-r-2 border-b-2 border-base-950 rotate-45 -translate-y-px" />}
      </div>
      <div>
        <div className="font-display text-xs font-medium text-slate-100">{label}</div>
        {sublabel && <div className="font-mono text-[10px] text-slate-500 mt-0.5">{sublabel}</div>}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ProgressBar: horizontaler Über/Unter-Balken
// ---------------------------------------------------------------------------
export function ProgressBar({ overShare }: { overShare: number }) {
  return (
    <div className="h-2 rounded-full overflow-hidden flex bg-base-800">
      <motion.div
        className="bg-gold-500"
        initial={{ width: 0 }}
        animate={{ width: `${overShare * 100}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
      <motion.div
        className="bg-teal-500"
        initial={{ width: 0 }}
        animate={{ width: `${(1 - overShare) * 100}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge: kleine Statusmarkierung
// ---------------------------------------------------------------------------
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "red" | "gold" }) {
  const toneClass =
    tone === "green"
      ? "bg-posgreen-500/15 text-posgreen-400 border-posgreen-500/40"
      : tone === "red"
      ? "bg-negred-500/15 text-negred-400 border-negred-500/40"
      : tone === "gold"
      ? "bg-gold-500/15 text-gold-400 border-gold-500/40"
      : "bg-base-700/60 text-slate-400 border-base-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border ${toneClass}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// MetricTile: kleine Kennzahl-Kachel für Premium-Prediction-Karten
// (ursprünglich in PredictionHero.tsx, hierher verschoben, damit sowohl
// die Over/Under- als auch die Run-Line-Premium-Karte dieselbe
// Komponente nutzen — keine Dopplung).
// ---------------------------------------------------------------------------
export function MetricTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "green" | "red" }) {
  const toneClass = tone === "green" ? "text-posgreen-400" : tone === "red" ? "text-negred-400" : "text-slate-100";
  return (
    <div className="rounded-lg border border-base-600 bg-base-800/60 px-3 py-2.5">
      <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`font-numeric text-xl leading-none ${toneClass}`}>{value}</div>
    </div>
  );
}
