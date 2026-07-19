import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, Download, FileJson, FileSpreadsheet, FileText, Loader2, Play, TrendingUp } from "lucide-react";
import { Badge, Card, SectionHeader } from "@/components/common/UI";
import { BacktestManager } from "@/backtesting/backtestManager";
import { buildBacktestDataset } from "@/backtesting/backtestingDatasetBuilder";
import { buildBacktestingDashboardData, type BacktestingDashboardData } from "@/backtesting/backtestingDashboardAnalytics";
import { buildModelOptimizationData, type ModelOptimizationData } from "@/backtesting/modelOptimizationAnalytics";
import { runHistoricalCalibration } from "@/backtesting/historicalCalibration";
import { exportBacktestDatasetAsCsv, exportBacktestDatasetAsJson } from "@/utils/backtestExport";
import { exportElementAsPdf } from "@/utils/pdfExport";
import { formatSigned } from "@/utils/format";

const CHART_COLORS = {
  gold: "#eab308",
  goldLight: "#f5c451",
  teal: "#14b8ac",
  tealLight: "#2dd4c8",
  posgreen: "#22c55e",
  negred: "#ef4444",
  text: "#F1EDE4",
  muted: "#5B6270",
  gridLine: "#2B313B",
  tooltipBg: "#20252D",
};

const tooltipStyle = {
  contentStyle: { background: CHART_COLORS.tooltipBg, border: `1px solid ${CHART_COLORS.gridLine}`, borderRadius: 6 },
  labelStyle: { color: CHART_COLORS.text, fontSize: 11 },
  itemStyle: { color: CHART_COLORS.text, fontSize: 11 },
};

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return formatIsoDate(d);
}

function defaultEndDate(): string {
  return formatIsoDate(new Date());
}

/**
 * Backtesting PRO Phase 3: eigenständige Dashboard-Seite.
 *
 * Lädt echte historische MLB-Spiele über die bestehende, unveränderte
 * Backtest-Datenpipeline (`BacktestManager`), baut daraus den
 * vollständigen Backtest-Datensatz (`buildBacktestDataset`, nutzt
 * ausschließlich die bestehende Prediction Engine PRO) und zeigt die
 * vollständige Auswertung: Kennzahlen, Confidence-/Linien-/Modul-
 * Aufschlüsselung, Kalibrierungs-Empfehlungen sowie Visualisierungen
 * (ROI-/Yield-/Trefferquote-Verlauf, Confidence-Verteilung, Profit nach
 * Linie/Modul, Gewinn-/Verlust-Kurve). Export als CSV, JSON und PDF.
 *
 * Rein additiv: verändert weder das bestehende Dashboard noch andere
 * Seiten. Erreichbar über einen neuen Button auf der Startseite.
 */
export function BacktestingPage({ onBack }: { onBack: () => void }) {
  const [startDate, setStartDate] = useState(defaultStartDate());
  const [endDate, setEndDate] = useState(defaultEndDate());
  const [line, setLine] = useState("8.5");
  const [odds, setOdds] = useState("1.91");
  const [runCalibration, setRunCalibration] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BacktestingDashboardData | null>(null);
  const [modelOptimization, setModelOptimization] = useState<ModelOptimizationData | null>(null);
  const [loadedGameCount, setLoadedGameCount] = useState(0);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const runBacktest = async () => {
    setIsRunning(true);
    setError(null);
    setData(null);
    setModelOptimization(null);

    try {
      const parsedStart = new Date(`${startDate}T12:00:00`);
      const parsedEnd = new Date(`${endDate}T12:00:00`);
      const parsedLine = Number(line);
      const parsedOdds = Number(odds);

      if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
        throw new Error("Ungültiger Datumsbereich.");
      }
      if (parsedStart.getTime() > parsedEnd.getTime()) {
        throw new Error("Das Startdatum darf nicht nach dem Enddatum liegen.");
      }
      if (!Number.isFinite(parsedLine) || parsedLine <= 0) {
        throw new Error("Ungültige Wettlinie.");
      }
      if (!Number.isFinite(parsedOdds) || parsedOdds <= 1) {
        throw new Error("Ungültige Quote.");
      }

      const manager = new BacktestManager();
      const dataset = await manager.prepareHistoricalBacktestDataset(parsedStart, parsedEnd, parsedLine, parsedOdds);
      setLoadedGameCount(dataset.backtestGames.length);

      const records = buildBacktestDataset(dataset.states, dataset.backtestGames);
      const dashboardData = buildBacktestingDashboardData(records);
      setData(dashboardData);

      // Model Optimization (Tag 7): die Gewichtungsanalyse (Schritt 3) nutzt
      // die bereits bestehende Historical-Calibration-PRO-Engine, die
      // intern einen eigenen, zweiten Analyse-Durchlauf über alle Spiele
      // macht — deshalb bewusst optional (Checkbox), damit der normale
      // Backtest nicht standardmäßig doppelt rechnet.
      const calibrationResult = runCalibration ? runHistoricalCalibration(dataset.states, dataset.backtestGames) : null;
      const optimizationData = buildModelOptimizationData({
        records,
        modulePerformance: dashboardData.modulePerformance,
        summary: dashboardData.summary,
        calibration: calibrationResult,
      });
      setModelOptimization(optimizationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Backtest.");
    } finally {
      setIsRunning(false);
    }
  };

  const handlePdfExport = async () => {
    if (!reportRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportElementAsPdf(reportRef.current, "mlb-backtest-report");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-950 px-4 sm:px-8 py-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-md border border-base-600 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:border-gold-500 hover:text-gold-400 transition-colors"
          >
            <ArrowLeft size={13} /> Zurück
          </button>
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-slate-100">Backtesting PRO</h2>
        </div>

        {data && (
          <div className="flex flex-wrap gap-2">
            <ExportButton icon={FileSpreadsheet} label="CSV" onClick={() => exportBacktestDatasetAsCsv(data.records)} />
            <ExportButton icon={FileJson} label="JSON" onClick={() => exportBacktestDatasetAsJson(data.records)} />
            <ExportButton icon={FileText} label="PDF" onClick={handlePdfExport} loading={isExportingPdf} />
          </div>
        )}
      </div>

      <Card accent="gold">
        <SectionHeader icon={BarChart3} title="Backtest-Zeitraum" accent="gold" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DateField label="Von" value={startDate} onChange={setStartDate} />
          <DateField label="Bis" value={endDate} onChange={setEndDate} />
          <NumberField label="Wettlinie (Standard)" value={line} onChange={setLine} step="0.5" />
          <NumberField label="Quote (Standard)" value={odds} onChange={setOdds} step="0.01" />
        </div>
        <label className="mt-3 flex items-center gap-2 font-mono text-[11px] text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={runCalibration}
            onChange={(e) => setRunCalibration(e.target.checked)}
            className="accent-gold-500"
          />
          Gewichtungsanalyse berechnen (Historical Calibration PRO — zweiter Analyse-Durchlauf, dauert länger)
        </label>
        <button
          onClick={runBacktest}
          disabled={isRunning}
          className="mt-4 flex items-center gap-2 rounded-md border border-gold-500 bg-gold-500/10 px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-gold-400 hover:bg-gold-500/20 transition-colors disabled:opacity-50"
        >
          {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {isRunning ? "Backtest läuft…" : "Backtest starten"}
        </button>
        {error && <p className="mt-3 font-mono text-xs text-negred-400">{error}</p>}
        {isRunning && (
          <p className="mt-3 font-mono text-[11px] text-slate-500">
            Lädt historische Spiele und berechnet die vollständige Prognose je Spiel — kann bei größeren Zeiträumen einen Moment dauern.
          </p>
        )}
      </Card>

      {data && (
        <div ref={reportRef} className="space-y-4">
          <SummaryCards data={data} loadedGameCount={loadedGameCount} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RoiYieldChart data={data} />
            <HitRateChart data={data} />
            <EquityCurveChart data={data} />
            <ConfidenceDistributionChart data={data} />
            <ProfitByLineChart data={data} />
            <ProfitByModuleChart data={data} />
          </div>

          <BestWorstAreasPanel data={data} />
          <OverUnderAccuracyTable data={data} />
          <ConfidenceBucketTable data={data} />
          <LineBucketTable data={data} />
          <ModulePerformanceTable data={data} />
          <PremiumFilterEfficacyPanel data={data} />
          <RecommendationsPanel data={data} />
        </div>
      )}

      {modelOptimization && (
        <div className="space-y-4">
          <ModelQualityPanel optimization={modelOptimization} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ConfidenceCalibrationChart optimization={modelOptimization} />
            <StrongestWeakestModulesPanel optimization={modelOptimization} />
          </div>
          <ErrorCausesPanel optimization={modelOptimization} />
          <WeightingAnalysisTable optimization={modelOptimization} />
        </div>
      )}
    </div>
  );
}

function ModelQualityPanel({ optimization }: { optimization: ModelOptimizationData }) {
  const q = optimization.modelQuality;
  const toneForScore = (score: number): "green" | "gold" | "red" => (score >= 70 ? "green" : score >= 50 ? "gold" : "red");

  return (
    <Card accent="gold">
      <SectionHeader icon={TrendingUp} title="Modellqualität" accent="gold" />
      <div className="flex items-center gap-3 mb-4">
        <span className="font-numeric text-4xl leading-none text-slate-100">{q.overallScore.toFixed(0)}</span>
        <Badge tone={toneForScore(q.overallScore)}>{q.grade}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Genauigkeit</div>
          <div className="font-numeric text-xl text-slate-100">{q.accuracyScore.toFixed(0)}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Kalibrierung</div>
          <div className="font-numeric text-xl text-slate-100">{q.calibrationScore.toFixed(0)}</div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">Stabilität</div>
          <div className="font-numeric text-xl text-slate-100">{q.stabilityScore.toFixed(0)}</div>
        </div>
      </div>
    </Card>
  );
}

function ConfidenceCalibrationChart({ optimization }: { optimization: ModelOptimizationData }) {
  const chartData = optimization.confidenceCalibration.map((c) => ({
    bucket: c.bucket,
    Vorhergesagt: c.predictedPct,
    Tatsächlich: c.actualPct,
  }));

  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Confidence-Kalibrierung" accent="teal" />
      <p className="font-mono text-[10px] text-slate-500 mb-2">Vorhergesagte Confidence vs. tatsächliche Trefferquote je Bereich.</p>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis
              tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
              axisLine={{ stroke: CHART_COLORS.gridLine }}
              tickLine={false}
              unit="%"
              domain={[0, 100]}
            />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)} %`} />
            <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text }} />
            <Bar dataKey="Vorhergesagt" fill={CHART_COLORS.muted} radius={[3, 3, 0, 0]} />
            <Bar dataKey="Tatsächlich" fill={CHART_COLORS.gold} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableShell headers={["Bereich", "Vorhergesagt", "Tatsächlich", "Abweichung", "Wetten"]}>
        {optimization.confidenceCalibration.map((c) => (
          <tr key={c.bucket} className="border-t border-base-600/60">
            <td className="py-2 px-2 font-mono text-xs text-slate-200">{c.bucket}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{c.predictedPct.toFixed(0)} %</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{c.decidedBets > 0 ? `${c.actualPct.toFixed(1)} %` : "–"}</td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${Math.abs(c.gap) <= 5 ? "text-posgreen-400" : "text-negred-400"}`}>
              {c.decidedBets > 0 ? `${formatSigned(c.gap)} pp` : "–"}
            </td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{c.decidedBets}</td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function StrongestWeakestModulesPanel({ optimization }: { optimization: ModelOptimizationData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={TrendingUp} title="Stärkste / schwächste Module" accent="gold" />
      <div className="space-y-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-posgreen-400 mb-1.5">Stärkste Module</div>
          <ul className="space-y-1">
            {optimization.strongestModules.length === 0 && <li className="font-mono text-[11px] text-slate-500">Noch nicht genügend Daten.</li>}
            {optimization.strongestModules.map((m) => (
              <li key={m.moduleKey} className="flex items-center justify-between font-mono text-xs text-slate-300">
                <span>{m.label}</span>
                <span className="text-posgreen-400">ROI {(m.roi * 100).toFixed(1)} %</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-negred-400 mb-1.5">Schwächste Module</div>
          <ul className="space-y-1">
            {optimization.weakestModules.length === 0 && <li className="font-mono text-[11px] text-slate-500">Noch nicht genügend Daten.</li>}
            {optimization.weakestModules.map((m) => (
              <li key={m.moduleKey} className="flex items-center justify-between font-mono text-xs text-slate-300">
                <span>{m.label}</span>
                <span className="text-negred-400">ROI {(m.roi * 100).toFixed(1)} %</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function ErrorCausesPanel({ optimization }: { optimization: ModelOptimizationData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Fehleranalyse (verlorene Predictions)" accent="teal" />
      {optimization.errorCauses.length === 0 ? (
        <p className="font-mono text-xs text-slate-500">Noch keine verlorenen Predictions mit erkennbarer Fehlerursache im Zeitraum.</p>
      ) : (
        <ul className="space-y-2">
          {optimization.errorCauses.map((cause) => (
            <li key={`${cause.moduleKey}-${cause.label}`} className="font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between mb-0.5">
                <span>{cause.label}</span>
                <Badge tone="red">
                  {cause.count}× ({cause.pct.toFixed(1)} %)
                </Badge>
              </div>
              <p className="text-[10px] text-slate-500">{cause.description}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WeightingAnalysisTable({ optimization }: { optimization: ModelOptimizationData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Optimale Gewichtungen" accent="gold" />
      <p className="font-mono text-[10px] text-slate-500 mb-3">{optimization.calibrationNote}</p>
      {optimization.weightingAnalysis.length > 0 && (
        <TableShell headers={["Modul", "Aktuelles Gewicht", "Optimales Gewicht", "Empfohlene Änderung", "Erw. Verbesserung"]}>
          {optimization.weightingAnalysis.map((w) => (
            <tr key={w.moduleKey} className="border-t border-base-600/60">
              <td className="py-2 px-2 font-mono text-xs text-slate-200">{w.label}</td>
              <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{(w.currentWeight * 100).toFixed(1)} %</td>
              <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{(w.optimalWeight * 100).toFixed(1)} %</td>
              <td
                className={`py-2 px-2 font-mono text-xs text-right ${
                  w.recommendedChangePct > 0.5 ? "text-posgreen-400" : w.recommendedChangePct < -0.5 ? "text-negred-400" : "text-slate-400"
                }`}
              >
                {formatSigned(w.recommendedChangePct)} %
              </td>
              <td className={`py-2 px-2 font-mono text-xs text-right ${w.expectedImprovementPct >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
                {formatSigned(w.expectedImprovementPct)} pp
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </Card>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-base-800/80 border border-base-600 text-center text-xs text-slate-100 font-mono py-2 outline-none transition-colors focus:border-gold-500"
      />
    </label>
  );
}

function NumberField({ label, value, onChange, step }: { label: string; value: string; onChange: (v: string) => void; step: string }) {
  return (
    <label className="block">
      <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md bg-base-800/80 border border-base-600 text-center text-xs text-slate-100 font-mono py-2 outline-none transition-colors focus:border-gold-500"
      />
    </label>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick,
  loading = false,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-md border border-base-600 bg-base-800/70 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-300 hover:border-teal-500 hover:text-teal-400 transition-colors disabled:opacity-50"
    >
      <Icon size={13} />
      {loading ? "Erzeuge…" : label}
    </button>
  );
}

function SummaryCards({ data, loadedGameCount }: { data: BacktestingDashboardData; loadedGameCount: number }) {
  const stats: { label: string; value: string; tone?: "gold" | "green" | "red" }[] = [
    { label: "Spiele geladen", value: String(loadedGameCount) },
    { label: "Wetten platziert", value: String(data.summary.decidedBets) },
    { label: "Trefferquote", value: `${(data.summary.hitRate * 100).toFixed(1)} %`, tone: data.summary.hitRate >= 0.5 ? "green" : "red" },
    { label: "ROI", value: `${(data.summary.roi * 100).toFixed(1)} %`, tone: data.summary.roi >= 0 ? "green" : "red" },
    { label: "Yield", value: `${(data.summary.yield * 100).toFixed(1)} %`, tone: data.summary.yield >= 0 ? "green" : "red" },
    { label: "Gewinn/Verlust", value: `${formatSigned(data.summary.profit, 2)} u`, tone: data.summary.profit >= 0 ? "green" : "red" },
    { label: "Ø Expected Value", value: `${formatSigned(data.averageEv)} %` },
    { label: "Ø Confidence", value: `${data.averageConfidence.toFixed(1)} %` },
    { label: "Ø Fair Odds", value: data.averageFairOdds.toFixed(2) },
    { label: "Ø Edge", value: `${formatSigned(data.averageEdge)} %` },
    { label: "Ø Expected Runs", value: data.averageExpectedRuns.toFixed(2) },
    { label: "Längste Gewinnserie", value: String(data.risk.longestWinStreak) },
    { label: "Längste Verlustserie", value: String(data.risk.longestLossStreak) },
    { label: "Max. Drawdown", value: `${data.risk.maximumDrawdown.toFixed(2)} u (${data.risk.maximumDrawdownPct.toFixed(1)} %)`, tone: "red" },
  ];

  return (
    <Card accent="teal">
      <SectionHeader icon={TrendingUp} title="Kennzahlen" accent="teal" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label}>
            <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{s.label}</div>
            <div
              className={`font-numeric text-2xl leading-none ${
                s.tone === "green" ? "text-posgreen-400" : s.tone === "red" ? "text-negred-400" : "text-slate-100"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RoiYieldChart({ data }: { data: BacktestingDashboardData }) {
  const chartData = data.roiTimeSeries.map((point, i) => ({
    index: point.index,
    roi: point.value * 100,
    yield: (data.yieldTimeSeries[i]?.value ?? 0) * 100,
  }));

  return (
    <Card accent="gold">
      <SectionHeader icon={TrendingUp} title="ROI- / Yield-Verlauf" accent="gold" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="index" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} unit="%" />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)} %`} />
            <Legend wrapperStyle={{ fontSize: 11, color: CHART_COLORS.text }} />
            <Line type="monotone" dataKey="roi" name="ROI (kumuliert)" stroke={CHART_COLORS.gold} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="yield" name="Yield (kumuliert)" stroke={CHART_COLORS.teal} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function HitRateChart({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={TrendingUp} title="Trefferquote über Zeit" accent="teal" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.hitRateTimeSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="index" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis
              tick={{ fill: CHART_COLORS.muted, fontSize: 10 }}
              axisLine={{ stroke: CHART_COLORS.gridLine }}
              tickLine={false}
              unit="%"
              domain={[0, 100]}
            />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)} %`} />
            <Line type="monotone" dataKey="value" name="Trefferquote" stroke={CHART_COLORS.tealLight} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function EquityCurveChart({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={TrendingUp} title="Gewinn-/Verlust-Kurve" accent="gold" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.equityCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.gold} stopOpacity={0.4} />
                <stop offset="95%" stopColor={CHART_COLORS.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="index" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} unit="u" />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} Units`} />
            <Area type="monotone" dataKey="value" name="Kumulierter Gewinn/Verlust" stroke={CHART_COLORS.gold} fill="url(#equityGradient)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ConfidenceDistributionChart({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Confidence-Verteilung" accent="teal" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.confidenceDistribution} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="bucket" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} allowDecimals={false} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [v, "Wetten"]} />
            <Bar dataKey="count" fill={CHART_COLORS.tealLight} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProfitByLineChart({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Profit nach Wettlinie" accent="gold" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.profitByLine} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="line" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} unit="u" />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} Units`} />
            <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
              {data.profitByLine.map((d, i) => (
                <Cell key={i} fill={d.profit >= 0 ? CHART_COLORS.posgreen : CHART_COLORS.negred} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProfitByModuleChart({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Profit nach Modul" accent="teal" />
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.profitByModule} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.gridLine} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: CHART_COLORS.muted, fontSize: 9 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} />
            <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} axisLine={{ stroke: CHART_COLORS.gridLine }} tickLine={false} unit="u" />
            <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(2)} Units`} />
            <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
              {data.profitByModule.map((d, i) => (
                <Cell key={i} fill={d.profit >= 0 ? CHART_COLORS.posgreen : CHART_COLORS.negred} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ConfidenceBucketTable({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Auswertung nach Confidence" accent="gold" />
      <TableShell headers={["Bereich", "Wetten", "Trefferquote", "ROI", "Yield"]}>
        {data.confidenceBuckets.map((b) => (
          <tr key={b.bucket} className="border-t border-base-600/60">
            <td className="py-2 px-2 font-mono text-xs text-slate-200">{b.bucket}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{b.decidedBets}</td>
            <td className="py-2 px-2 font-mono text-xs text-right">
              <Badge tone={b.hitRate >= 0.5 ? "green" : "red"}>{(b.hitRate * 100).toFixed(1)} %</Badge>
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${b.roi >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {(b.roi * 100).toFixed(1)} %
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${(b.decidedBets > 0 ? b.profit / b.decidedBets : 0) >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {b.decidedBets > 0 ? `${((b.profit / b.decidedBets) * 100).toFixed(1)} %` : "–"}
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function LineBucketTable({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Auswertung nach Wettlinie" accent="teal" />
      <TableShell headers={["Linie", "Wetten", "Trefferquote", "ROI", "Profit"]}>
        {data.lineBuckets.map((b) => (
          <tr key={b.line} className="border-t border-base-600/60">
            <td className="py-2 px-2 font-mono text-xs text-slate-200">{b.line.toFixed(1)}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{b.bets}</td>
            <td className="py-2 px-2 font-mono text-xs text-right">
              {b.decidedBets > 0 ? <Badge tone={b.hitRate >= 0.5 ? "green" : "red"}>{(b.hitRate * 100).toFixed(1)} %</Badge> : "–"}
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${b.roi >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {b.bets > 0 ? `${(b.roi * 100).toFixed(1)} %` : "–"}
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${b.profit >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {b.profit.toFixed(2)}
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function ModulePerformanceTable({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Auswertung nach Modul" accent="gold" />
      <TableShell headers={["Modul", "Ø Einfluss", "Ø Gewichtung", "Pos. / Neg.", "Trefferquote", "ROI", "Stärkstes Modul"]}>
        {data.modulePerformance.map((m) => (
          <tr key={m.moduleKey} className="border-t border-base-600/60">
            <td className="py-2 px-2 font-mono text-xs text-slate-200">{m.label}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{m.averageInfluence.toFixed(2)}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{(m.averageWeight * 100).toFixed(0)} %</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">
              {m.positiveInfluencePct.toFixed(0)} % / {m.negativeInfluencePct.toFixed(0)} %
            </td>
            <td className="py-2 px-2 font-mono text-xs text-right">
              {m.gamesWithData > 0 ? <Badge tone={m.hitRate >= 0.5 ? "green" : "red"}>{(m.hitRate * 100).toFixed(1)} %</Badge> : "–"}
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${m.roi >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {m.gamesWithData > 0 ? `${(m.roi * 100).toFixed(1)} %` : "–"}
            </td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">
              {m.strongestCount}× ({m.strongestPct.toFixed(1)} %)
            </td>
          </tr>
        ))}
      </TableShell>
      <div className="mt-3 pt-3 border-t border-base-600/60 space-y-1.5">
        {data.modulePerformance.map((m) => (
          <p key={m.moduleKey} className="font-mono text-[10px] text-slate-500">
            <span className="text-slate-300">{m.label}:</span> {m.weightingRecommendation}
          </p>
        ))}
      </div>
    </Card>
  );
}

function TableShell({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-1.5 px-2 font-mono text-[9px] uppercase tracking-wider text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function OverUnderAccuracyTable({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={BarChart3} title="Over / Under Genauigkeit" accent="teal" />
      <TableShell headers={["Seite", "Wetten", "Trefferquote", "ROI", "Profit"]}>
        {data.overUnderPerformance.map((p) => (
          <tr key={p.pick} className="border-t border-base-600/60">
            <td className="py-2 px-2 font-mono text-xs text-slate-200 uppercase">{p.pick}</td>
            <td className="py-2 px-2 font-mono text-xs text-slate-400 text-right">{p.decidedBets}</td>
            <td className="py-2 px-2 font-mono text-xs text-right">
              {p.decidedBets > 0 ? <Badge tone={p.hitRate >= 0.5 ? "green" : "red"}>{(p.hitRate * 100).toFixed(1)} %</Badge> : "–"}
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${p.roi >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {p.decidedBets > 0 ? `${(p.roi * 100).toFixed(1)} %` : "–"}
            </td>
            <td className={`py-2 px-2 font-mono text-xs text-right ${p.profit >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              {p.profit.toFixed(2)}
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function PremiumFilterEfficacyPanel({ data }: { data: BacktestingDashboardData }) {
  const efficacy = data.premiumFilterEfficacy;
  return (
    <Card accent="gold">
      <SectionHeader icon={BarChart3} title="Premium-Filter-Wirksamkeit" accent="gold" />
      <p className="font-mono text-[10px] text-slate-500 mb-3">
        Vergleicht Spiele, die den Premium-Filter (Lineup/Pitcher/Wetter bestätigt, positive EV) bestanden haben, mit solchen, die ihn nicht
        bestanden haben.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Filter bestanden ({efficacy.gamesPassed})</div>
          <div className="flex items-center gap-2">
            <Badge tone={efficacy.hitRatePassed >= 0.5 ? "green" : "red"}>{(efficacy.hitRatePassed * 100).toFixed(1)} % Trefferquote</Badge>
            <span className={`font-mono text-xs ${efficacy.roiPassed >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              ROI {(efficacy.roiPassed * 100).toFixed(1)} %
            </span>
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500 mb-1">Filter nicht bestanden ({efficacy.gamesFailed})</div>
          <div className="flex items-center gap-2">
            <Badge tone={efficacy.hitRateFailed >= 0.5 ? "green" : "red"}>{(efficacy.hitRateFailed * 100).toFixed(1)} % Trefferquote</Badge>
            <span className={`font-mono text-xs ${efficacy.roiFailed >= 0 ? "text-posgreen-400" : "text-negred-400"}`}>
              ROI {(efficacy.roiFailed * 100).toFixed(1)} %
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function BestWorstAreasPanel({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={TrendingUp} title="Beste und schlechteste Modellbereiche" accent="teal" />
      <div className="space-y-2">
        <p className="font-mono text-xs text-posgreen-400">
          <span className="uppercase text-[9px] tracking-wider text-slate-500 mr-2">Bester Bereich</span>
          {data.bestModelArea}
        </p>
        <p className="font-mono text-xs text-negred-400">
          <span className="uppercase text-[9px] tracking-wider text-slate-500 mr-2">Schwächster Bereich</span>
          {data.worstModelArea}
        </p>
      </div>
    </Card>
  );
}

function RecommendationsPanel({ data }: { data: BacktestingDashboardData }) {
  return (
    <Card accent="teal">
      <SectionHeader icon={TrendingUp} title="Kalibrierungs-Empfehlungen" accent="teal" />
      <p className="font-mono text-[10px] text-slate-500 mb-3">
        Rein informativ, aus den obigen Backtest-Ergebnissen abgeleitet — passt keine Modul-Gewichte automatisch an.
      </p>
      <ul className="space-y-2">
        {data.recommendations.map((r, i) => (
          <li key={i} className="flex items-start gap-2 font-mono text-xs text-slate-300">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />
            {r.text}
          </li>
        ))}
      </ul>
    </Card>
  );
}
