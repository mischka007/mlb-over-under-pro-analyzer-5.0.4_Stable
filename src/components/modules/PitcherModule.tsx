import { useMemo } from "react";
import { AlertTriangle, ShieldCheck, ShieldX, Star, Zap } from "lucide-react";
import type { OffenseInput, PitcherInput, PitcherQualityAssessment, TeamSide } from "@/types";
import { Badge, Card, SectionHeader, SequenceInput, StatInput, ToggleGroup } from "@/components/common/UI";
import { assessPitcherQuality } from "@/utils/scoring";

/**
 * Modul 2 – Starting Pitcher PRO: ERA/xERA/FIP/SIERA/WHIP/BABIP, K%/BB%, HR/9,
 * Batted-Ball-Profile, LOB%, Pitch-Count (letzter Start + letzte 5 Starts),
 * Ruhetage, letzte 5/10 Starts, Velocity, Spin Rate, Wurfhand sowie
 * Tag/Nacht- und Heim/Auswärts-Splits.
 *
 * Zusätzlich: individueller Pitcher Score (0–100), Notenskala, Confidence
 * Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/positive & negative
 * Faktoren, berechnet ausschließlich aus den tatsächlich vorhandenen Werten
 * (siehe `assessPitcherQuality()` in `@/utils/scoring`).
 *
 * Gewichtung im Gesamtmodell (Prediction Engine): 35 %.
 */
export function PitcherModule({
  side,
  teamLabel,
  data,
  opponentOffense,
  onChange,
}: {
  side: TeamSide;
  teamLabel: string;
  data: PitcherInput;
  /** Offense-Daten des gegnerischen Teams — fließt nur in den Confidence-Score (Matchup-Faktor) ein. */
  opponentOffense?: OffenseInput;
  onChange: (patch: Partial<PitcherInput>) => void;
}) {
  const accent = side === "home" ? "gold" : "teal";

  const assessment = useMemo(() => assessPitcherQuality(data, opponentOffense), [data, opponentOffense]);

  return (
    <Card accent={accent}>
      <SectionHeader icon={Zap} moduleNumber={2} title={`Starting Pitcher — ${teamLabel}`} weightPct={35} accent={accent} />

      <div className="space-y-3">
        <PitcherQualityPanel assessment={assessment} accent={accent} />

        <div className="grid grid-cols-3 gap-2">
          <StatInput label="ERA" value={data.era} onChange={(v) => onChange({ era: v })} placeholder="4.10" />
          <StatInput label="xERA" value={data.xera} onChange={(v) => onChange({ xera: v })} placeholder="4.30" />
          <StatInput label="FIP" value={data.fip} onChange={(v) => onChange({ fip: v })} placeholder="4.05" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="SIERA" value={data.siera} onChange={(v) => onChange({ siera: v })} placeholder="4.15" />
          <StatInput label="WHIP" value={data.whip} onChange={(v) => onChange({ whip: v })} placeholder="1.25" />
          <StatInput label="BABIP" value={data.babip} onChange={(v) => onChange({ babip: v })} placeholder="0.295" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="K %" value={data.kPct} onChange={(v) => onChange({ kPct: v })} placeholder="22.5" />
          <StatInput label="BB %" value={data.bbPct} onChange={(v) => onChange({ bbPct: v })} placeholder="8.0" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="HR/9" value={data.hr9} onChange={(v) => onChange({ hr9: v })} placeholder="1.20" />
          <StatInput label="GB %" value={data.gbPct} onChange={(v) => onChange({ gbPct: v })} placeholder="42" />
          <StatInput label="FB %" value={data.fbPct} onChange={(v) => onChange({ fbPct: v })} placeholder="38" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatInput label="LOB %" value={data.lobPct} onChange={(v) => onChange({ lobPct: v })} placeholder="73" />
          <StatInput label="Hard-Hit %" value={data.hardHitPct} onChange={(v) => onChange({ hardHitPct: v })} placeholder="36" />
          <StatInput label="Barrel %" value={data.barrelPct} onChange={(v) => onChange({ barrelPct: v })} placeholder="7.5" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Pitch Count (letzter Start)" value={data.pitchCount} onChange={(v) => onChange({ pitchCount: v })} placeholder="94" />
          <StatInput label="Ruhetage" value={data.restDays} onChange={(v) => onChange({ restDays: v })} placeholder="5" />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Zugelassene Runs — letzte 5 Starts
          </span>
          <SequenceInput values={data.last5Starts} onChange={(i, v) => onChange({ last5Starts: patch(data.last5Starts, i, v) })} />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Zugelassene Runs — letzte 10 Starts
          </span>
          <SequenceInput
            values={data.last10Starts ?? Array(10).fill("")}
            onChange={(i, v) => onChange({ last10Starts: patch(data.last10Starts ?? Array(10).fill(""), i, v) })}
            columns={5}
          />
        </div>

        <div>
          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1.5">
            Pitch Count — letzte 5 Starts
          </span>
          <SequenceInput
            values={data.pitchCountLast5 ?? Array(5).fill("")}
            onChange={(i, v) => onChange({ pitchCountLast5: patch(data.pitchCountLast5 ?? Array(5).fill(""), i, v) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="Velocity (mph)" value={data.velocity} onChange={(v) => onChange({ velocity: v })} placeholder="94.2" />
          <StatInput label="Spin Rate (rpm)" value={data.spinRate} onChange={(v) => onChange({ spinRate: v })} placeholder="2250" />
        </div>

        <ToggleGroup
          label="Wurfhand"
          value={data.throwsHand}
          onChange={(v) => onChange({ throwsHand: v })}
          options={[
            { value: "R", label: "Rechts" },
            { value: "L", label: "Links" },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          <StatInput label="ERA Tag-Spiele" value={data.dayEraSplit} onChange={(v) => onChange({ dayEraSplit: v })} placeholder="4.40" />
          <StatInput label="ERA Nacht-Spiele" value={data.nightEraSplit} onChange={(v) => onChange({ nightEraSplit: v })} placeholder="3.95" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatInput label="ERA Heim" value={data.homeEraSplit} onChange={(v) => onChange({ homeEraSplit: v })} placeholder="3.85" />
          <StatInput label="ERA Auswärts" value={data.awayEraSplit} onChange={(v) => onChange({ awayEraSplit: v })} placeholder="4.35" />
        </div>
      </div>
    </Card>
  );
}

/**
 * Zeigt den individuellen Pitcher Score, die Notenskala, den Confidence
 * Score sowie Stärken/Schwächen/Top-Kennzahlen/Warnungen/positive &
 * negative Faktoren an. Rendert einen neutralen Hinweis, solange nicht
 * genügend Advanced-Metrics vorhanden sind (`hasData === false`), statt
 * einen unbegründeten Score vorzutäuschen.
 */
function PitcherQualityPanel({ assessment, accent }: { assessment: PitcherQualityAssessment; accent: "gold" | "teal" }) {
  const gradeTone = assessment.score >= 80 ? "green" : assessment.score >= 60 ? "gold" : assessment.score >= 40 ? "neutral" : "red";
  const confidenceTone = assessment.confidence >= 70 ? "green" : assessment.confidence >= 45 ? "gold" : "red";

  return (
    <div className="rounded-lg border border-base-600 bg-base-800/50 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Star size={14} className={accent === "gold" ? "text-gold-400" : "text-teal-400"} />
          <span className="font-display text-xs uppercase tracking-wider text-slate-200">Pitcher Score</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-numeric text-2xl text-slate-100 leading-none">{assessment.score}</span>
          <Badge tone={gradeTone}>{assessment.grade}</Badge>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Pitcher Confidence</span>
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

function patch(arr: string[], index: number, value: string): string[] {
  const next = [...arr];
  next[index] = value;
  return next;
}
