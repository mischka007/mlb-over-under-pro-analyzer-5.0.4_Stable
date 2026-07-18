import { useMemo } from "react";
import { AlertTriangle, ShieldCheck, ShieldX, Star, Swords } from "lucide-react";
import type { OffenseInput, OffenseQualityAssessment, TeamSide } from "@/types";
import { Badge, Card, SectionHeader, SequenceInput, StatInput } from "@/components/common/UI";
import { assessOffenseQuality } from "@/utils/scoring";
import { mean, toNumberArray } from "@/utils/math";

/**
 * Modul 4 – Offense PRO: klassische und fortgeschrittene
 * Schlagstatistiken (OPS, wRC+, wOBA, xwOBA, ISO, AVG/OBP/SLG,
 * BABIP), Plate-Discipline (K%/BB%/Contact%/Chase%), Batted-Ball-
 * Qualität (Hard-Hit%/Barrel%/Exit Velocity/Launch Angle), RISP-Quote,
 * Heim-/Auswärts-Splits, Splits vs Links-/Rechtshänder sowie Form der
 * letzten 7/10/15/30 Spiele.
 *
 * Zusätzlich: individueller Offense Score (0–100), Notenskala,
 * Confidence Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/
 * positive & negative Faktoren, berechnet ausschließlich aus den
 * tatsächlich vorhandenen Werten (siehe `assessOffenseQuality()` in
 * `@/utils/scoring`).
 *
 * Gewichtung im Gesamtmodell (Prediction Engine): 15 % Basis-Gewicht,
 * dynamisch angepasst über `applyOffenseQualityWeighting()` anhand der
 * Confidence dieser Bewertung (siehe `GameModel.ts`).
 */
export function OffenseModule({
  side,
  teamLabel,
  data,
  onChange,
}: {
  side: TeamSide;
  teamLabel: string;
  data: OffenseInput;
  onChange: (patch: Partial<OffenseInput>) => void;
}) {
  const accent = side === "home" ? "gold" : "teal";
  const formAvg = mean(toNumberArray(data.last10Games));

  const assessment = useMemo(() => assessOffenseQuality(data), [data]);

  return (
    <Card accent={accent}>
      <SectionHeader icon={Swords} moduleNumber={4} title={`Offense — ${teamLabel}`} weightPct={15} accent={accent} />

      <div className="space-y-3">
        <OffenseQualityPanel assessment={assessment} accent={accent} />

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Runs / Spiel" value={data.runsPerGame} onChange={(v) => onChange({ runsPerGame: v })} placeholder="4.6" />
          <StatInput label="OPS" value={data.ops} onChange={(v) => onChange({ ops: v })} placeholder="0.745" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="wRC+" value={data.wrcPlus} onChange={(v) => onChange({ wrcPlus: v })} placeholder="108" />
          <StatInput label="wOBA" value={data.woba} onChange={(v) => onChange({ woba: v })} placeholder="0.325" />
          <StatInput label="xwOBA" value={data.xwoba} onChange={(v) => onChange({ xwoba: v })} placeholder="0.330" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="AVG" value={data.avg} onChange={(v) => onChange({ avg: v })} placeholder="0.255" />
          <StatInput label="OBP" value={data.obp} onChange={(v) => onChange({ obp: v })} placeholder="0.325" />
          <StatInput label="SLG" value={data.slg} onChange={(v) => onChange({ slg: v })} placeholder="0.420" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="ISO" value={data.iso} onChange={(v) => onChange({ iso: v })} placeholder="0.165" />
          <StatInput label="K %" value={data.kPct} onChange={(v) => onChange({ kPct: v })} placeholder="23" />
          <StatInput label="BB %" value={data.bbPct} onChange={(v) => onChange({ bbPct: v })} placeholder="8.5" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Contact %" value={data.contactPct} onChange={(v) => onChange({ contactPct: v })} placeholder="76" />
          <StatInput label="Zone-Contact %" value={data.zoneContactPct} onChange={(v) => onChange({ zoneContactPct: v })} placeholder="85" />
          <StatInput label="Chase %" value={data.chasePct} onChange={(v) => onChange({ chasePct: v })} placeholder="28" />
        </div>
        <StatInput label="Swing %" value={data.swingPct} onChange={(v) => onChange({ swingPct: v })} placeholder="47" />
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="BABIP" value={data.babip} onChange={(v) => onChange({ babip: v })} placeholder="0.300" />
          <StatInput label="Hard-Hit %" value={data.hardHitPct} onChange={(v) => onChange({ hardHitPct: v })} placeholder="38" />
          <StatInput label="Barrel %" value={data.barrelPct} onChange={(v) => onChange({ barrelPct: v })} placeholder="8.2" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Exit Velocity (mph)" value={data.exitVelocity} onChange={(v) => onChange({ exitVelocity: v })} placeholder="89.5" />
          <StatInput label="Launch Angle (°)" value={data.launchAngle} onChange={(v) => onChange({ launchAngle: v })} placeholder="13" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="RISP AVG" value={data.rispAvg} onChange={(v) => onChange({ rispAvg: v })} placeholder="0.270" />
          <StatInput label="Heim-Split R/Sp." value={data.homeSplitRuns} onChange={(v) => onChange({ homeSplitRuns: v })} placeholder="4.9" />
          <StatInput label="Auswärts-Split R/Sp." value={data.awaySplitRuns} onChange={(v) => onChange({ awaySplitRuns: v })} placeholder="4.3" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="OPS vs LHP" value={data.vsLhpOps} onChange={(v) => onChange({ vsLhpOps: v })} placeholder="0.760" />
          <StatInput label="OPS vs RHP" value={data.vsRhpOps} onChange={(v) => onChange({ vsRhpOps: v })} placeholder="0.735" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="Ø Runs letzte 7" value={data.last7AvgRuns} onChange={(v) => onChange({ last7AvgRuns: v })} placeholder="4.8" />
          <StatInput label="Ø Runs letzte 15" value={data.last15AvgRuns} onChange={(v) => onChange({ last15AvgRuns: v })} placeholder="4.6" />
          <StatInput label="Ø Runs letzte 30" value={data.last30AvgRuns} onChange={(v) => onChange({ last30AvgRuns: v })} placeholder="4.5" />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Runs — letzte 10 Spiele
          </span>
          <SequenceInput values={data.last10Games} onChange={(i, v) => onChange({ last10Games: patch(data.last10Games, i, v) })} />
        </div>

        <div className="pt-2 border-t border-base-600 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Form-Schnitt</span>
          <span className="font-numeric text-2xl text-slate-100 leading-none">{formAvg.toFixed(2)}</span>
        </div>
      </div>
    </Card>
  );
}

function patch(arr: string[], index: number, value: string): string[] {
  const next = [...arr];
  next[index] = value;
  return next;
}

/**
 * Zeigt den individuellen Offense Score, die Notenskala, den
 * Confidence Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/
 * positive & negative Faktoren an. Rendert einen neutralen Hinweis,
 * solange nicht genügend Advanced-Metrics vorhanden sind
 * (`hasData === false`), statt einen unbegründeten Score vorzutäuschen.
 */
function OffenseQualityPanel({ assessment, accent }: { assessment: OffenseQualityAssessment; accent: "gold" | "teal" }) {
  const gradeTone = assessment.score >= 80 ? "green" : assessment.score >= 60 ? "gold" : assessment.score >= 40 ? "neutral" : "red";
  const confidenceTone = assessment.confidence >= 70 ? "green" : assessment.confidence >= 45 ? "gold" : "red";

  return (
    <div className="rounded-lg border border-base-600 bg-base-800/50 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Star size={14} className={accent === "gold" ? "text-gold-400" : "text-teal-400"} />
          <span className="font-display text-xs uppercase tracking-wider text-slate-200">Offense Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-numeric text-2xl text-slate-100 leading-none">{assessment.score}</span>
          <Badge tone={gradeTone}>{assessment.grade}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Offense Confidence</span>
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
