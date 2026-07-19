import { useMemo } from "react";
import { AlertTriangle, Shield, ShieldCheck, ShieldX, Star } from "lucide-react";
import type { BullpenInput, BullpenQualityAssessment, TeamSide } from "@/types";
import { Badge, Card, Checkbox, SectionHeader, StatInput } from "@/components/common/UI";
import { assessBullpenQuality } from "@/utils/scoring";
import { toNumber } from "@/utils/math";

/**
 * Modul 3 – Bullpen PRO: ERA/xFIP/FIP/WHIP/WAR, K%/BB%, HR/9, LOB%,
 * Hard-Hit %, Bullpen-Workload (Innings letzte 3/7 Tage inkl.
 * Ermüdungserkennung) sowie Verfügbarkeit von Closer, High-Leverage-
 * Reliever und Middle Relief.
 *
 * Zusätzlich: individueller Bullpen Score (0–100), Notenskala,
 * Confidence Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/
 * positive & negative Faktoren, berechnet ausschließlich aus den
 * tatsächlich vorhandenen Werten (siehe `assessBullpenQuality()` in
 * `@/utils/scoring`).
 *
 * Gewichtung im Gesamtmodell (Prediction Engine): 15 % Basis-Gewicht,
 * dynamisch angepasst über `applyBullpenQualityWeighting()` anhand der
 * Confidence dieser Bewertung (siehe `GameModel.ts`).
 */
export function BullpenModule({
  side,
  teamLabel,
  data,
  onChange,
}: {
  side: TeamSide;
  teamLabel: string;
  data: BullpenInput;
  onChange: (patch: Partial<BullpenInput>) => void;
}) {
  const accent = side === "home" ? "gold" : "teal";

  const assessment = useMemo(() => assessBullpenQuality(data), [data]);

  const ip3 = toNumber(data.inningsLast3Days);
  const ip7 = toNumber(data.inningsLast7Days);
  const isFatigued = (ip3 !== null && ip3 > 9) || (ip7 !== null && ip7 > 15);

  return (
    <Card accent={accent}>
      <SectionHeader icon={Shield} moduleNumber={3} title={`Bullpen — ${teamLabel}`} weightPct={15} accent={accent} />

      <div className="space-y-3">
        <BullpenQualityPanel assessment={assessment} accent={accent} />

        <div className="grid grid-cols-3 gap-2">
          <StatInput label="ERA" value={data.era} onChange={(v) => onChange({ era: v })} placeholder="3.95" />
          <StatInput label="FIP" value={data.fip} onChange={(v) => onChange({ fip: v })} placeholder="4.05" />
          <StatInput label="xFIP" value={data.xfip} onChange={(v) => onChange({ xfip: v })} placeholder="4.10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="WHIP" value={data.whip} onChange={(v) => onChange({ whip: v })} placeholder="1.30" />
          <StatInput label="WAR" value={data.war} onChange={(v) => onChange({ war: v })} placeholder="1.8" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="K %" value={data.kPct} onChange={(v) => onChange({ kPct: v })} placeholder="23.5" />
          <StatInput label="BB %" value={data.bbPct} onChange={(v) => onChange({ bbPct: v })} placeholder="9.0" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="HR/9" value={data.hr9} onChange={(v) => onChange({ hr9: v })} placeholder="1.10" />
          <StatInput label="LOB %" value={data.lobPct} onChange={(v) => onChange({ lobPct: v })} placeholder="74" />
          <StatInput label="Hard-Hit %" value={data.hardHitPct} onChange={(v) => onChange({ hardHitPct: v })} placeholder="35" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Checkbox label="Closer verfügbar" checked={data.closerAvailable} onChange={(v) => onChange({ closerAvailable: v })} />
          <Checkbox
            label="High-Leverage-Reliever verfügbar"
            checked={data.highLeverageAvailable}
            onChange={(v) => onChange({ highLeverageAvailable: v })}
          />
        </div>
        <Checkbox label="Middle Relief verfügbar" checked={data.middleReliefAvailable} onChange={(v) => onChange({ middleReliefAvailable: v })} />

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Innings letzte 3 Tage" value={data.inningsLast3Days} onChange={(v) => onChange({ inningsLast3Days: v })} placeholder="6.0" />
          <StatInput label="Innings letzte 7 Tage" value={data.inningsLast7Days} onChange={(v) => onChange({ inningsLast7Days: v })} placeholder="14.0" />
        </div>

        {isFatigued && (
          <div className="rounded-md border border-negred-500/40 bg-negred-500/10 px-3 py-2 text-[11px] font-mono text-negred-400">
            Bullpen-Ermüdung erkannt (&gt; 9 IP in 3 Tagen oder &gt; 15 IP in 7 Tagen) — erhöht Runs-Erwartung.
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Zeigt den individuellen Bullpen Score, die Notenskala, den Confidence
 * Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/positive &
 * negative Faktoren an. Rendert einen neutralen Hinweis, solange nicht
 * genügend Advanced-Metrics vorhanden sind (`hasData === false`), statt
 * einen unbegründeten Score vorzutäuschen.
 */
function BullpenQualityPanel({ assessment, accent }: { assessment: BullpenQualityAssessment; accent: "gold" | "teal" }) {
  const gradeTone = assessment.score >= 80 ? "green" : assessment.score >= 60 ? "gold" : assessment.score >= 40 ? "neutral" : "red";
  const confidenceTone = assessment.confidence >= 70 ? "green" : assessment.confidence >= 45 ? "gold" : "red";

  return (
    <div className="rounded-lg border border-base-600 bg-base-800/50 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Star size={14} className={accent === "gold" ? "text-gold-400" : "text-teal-400"} />
          <span className="font-display text-xs uppercase tracking-wider text-slate-200">Bullpen Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-numeric text-2xl text-slate-100 leading-none">{assessment.score}</span>
          <Badge tone={gradeTone}>{assessment.grade}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Bullpen Confidence</span>
        <Badge tone={confidenceTone}>{assessment.confidence} / 100</Badge>
      </div>

      {!assessment.hasData ? (
        <p className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-gold-400 shrink-0" />
          {assessment.warnings[0]}
        </p>
      ) : (
        <>
          {assessment.topMetrics.length > 0 && (
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Top Metrics</span>
              <div className="flex flex-wrap gap-1.5">
                {assessment.topMetrics.map((metric) => (
                  <Badge key={metric} tone="gold">
                    {metric}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {assessment.strengths.length > 0 && (
            <div>
              <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-posgreen-400 mb-1">
                <ShieldCheck size={12} /> Stärken
              </span>
              <ul className="space-y-0.5">
                {assessment.strengths.map((s) => (
                  <li key={s.metric} className="font-mono text-[10px] text-slate-400">
                    <span className="text-slate-200">{s.metric} {s.value}</span> — {s.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.weaknesses.length > 0 && (
            <div>
              <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-negred-400 mb-1">
                <ShieldX size={12} /> Schwächen
              </span>
              <ul className="space-y-0.5">
                {assessment.weaknesses.map((w) => (
                  <li key={w.metric} className="font-mono text-[10px] text-slate-400">
                    <span className="text-slate-200">{w.metric} {w.value}</span> — {w.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.positiveFactors.length > 0 && (
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-posgreen-400 mb-1">Positive Faktoren</span>
              <ul className="space-y-0.5">
                {assessment.positiveFactors.map((f) => (
                  <li key={f} className="font-mono text-[10px] text-slate-400">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.negativeFactors.length > 0 && (
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-negred-400 mb-1">Negative Faktoren</span>
              <ul className="space-y-0.5">
                {assessment.negativeFactors.map((f) => (
                  <li key={f} className="font-mono text-[10px] text-slate-400">
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assessment.warnings.length > 0 && (
            <div>
              <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-gold-400 mb-1">
                <AlertTriangle size={12} /> Warnungen
              </span>
              <ul className="space-y-0.5">
                {assessment.warnings.map((w) => (
                  <li key={w} className="font-mono text-[10px] text-slate-400">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
