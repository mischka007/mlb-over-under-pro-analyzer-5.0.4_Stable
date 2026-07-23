import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Save } from "lucide-react";
import type { AnalysisMode, AnalyzerState, ExtendedMetrics, GameCardSummary, GameInfo, LineupQualityScore, MarketIntelligenceResult } from "@/types";
import type { AvailabilityFlags } from "@/hooks/useGameAutoLoad";
import { useAnalyzerState } from "@/hooks/useAnalyzerState";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTheme } from "@/hooks/useTheme";
import { computeFullAnalysis } from "@/models/GameModel";
import { computeRunLineAnalysis } from "@/engine/runLineEngine";
import { assessQuality } from "@/utils/quality";
import { saveHistoryEntry } from "@/utils/history";
import { GameSetupBar } from "@/components/dashboard/GameSetupBar";
import { PredictionHero } from "@/components/dashboard/PredictionHero";
import { RunLineHero } from "@/components/dashboard/RunLineHero";
import { DataAvailabilityBanner } from "@/components/dashboard/DataAvailabilityBanner";
import { ExtendedMetricsPanel } from "@/components/dashboard/ExtendedMetricsPanel";
import { DecisionSupportPanel } from "@/components/dashboard/DecisionSupportPanel";
import { SystemStatusPanel } from "@/components/dashboard/SystemStatusPanel";
import { MarketIntelligencePanel } from "@/components/dashboard/MarketIntelligencePanel";
import { LiveMonitoringPanel } from "@/components/dashboard/LiveMonitoringPanel";
import { buildDataQualityReport } from "@/engine/dataQualityEngine";
import { useLiveMonitoring } from "@/hooks/useLiveMonitoring";
import { GameInfoPanel } from "@/components/dashboard/GameInfoPanel";
import { TeamFormModule } from "@/components/modules/TeamFormModule";
import { PitcherModule } from "@/components/modules/PitcherModule";
import { BullpenModule } from "@/components/modules/BullpenModule";
import { OffenseModule } from "@/components/modules/OffenseModule";
import { WeatherModule } from "@/components/modules/WeatherModule";
import { BallparkModule } from "@/components/modules/BallparkModule";
import { H2HModule } from "@/components/modules/H2HModule";
import { MarketModule } from "@/components/modules/MarketModule";
import { ConsensusPanel } from "@/components/consensus/ConsensusPanel";
import { PremiumFilterPanel } from "@/components/consensus/PremiumFilterPanel";
import { BankrollCalculator } from "@/components/bankroll/BankrollCalculator";
import { RunDistributionChart } from "@/components/charts/RunDistributionChart";
import { MonteCarloChart } from "@/components/charts/MonteCarloChart";
import { RadarScoreChart } from "@/components/charts/RadarScoreChart";
import { ConfidenceGauge } from "@/components/charts/ConfidenceGauge";
import { ProbabilityDonut } from "@/components/charts/ProbabilityDonut";
import { LineHeatmap } from "@/components/charts/LineHeatmap";
import { ExportPanel } from "@/components/export/ExportPanel";
import { SettingsPanel, type AccentColor } from "@/components/common/SettingsPanel";
import { toNumber } from "@/utils/math";

/**
 * Haupt-Dashboard-Seite: bindet den zentralen State-Hook ein, berechnet die
 * vollständige Analyse über computeFullAnalysis() und rendert alle Panels
 * in der vom Lastenheft vorgegebenen Reihenfolge.
 *
 * v5.0: kann zusätzlich einen automatisch geladenen `initialState`
 * übernehmen (siehe useGameAutoLoad) und zeigt an, welche Module
 * automatisch befüllt werden konnten ("api") und welche mangels
 * öffentlicher Datenquelle manuell bleiben ("unavailable").
 */
export function Dashboard({
  initialState,
  availability,
  extendedMetrics,
  marketIntelligence,
  gameInfo,
  lineupQuality,
  game,
  onBack,
}: {
  initialState?: AnalyzerState | null;
  availability?: AvailabilityFlags | null;
  extendedMetrics?: ExtendedMetrics | null;
  marketIntelligence?: MarketIntelligenceResult | null;
  gameInfo?: GameInfo | null;
  lineupQuality?: LineupQualityScore | null;
  game?: GameCardSummary | null;
  onBack?: () => void;
} = {}) {
  const { state, updateSetup, updateTeam, updateWeather, updateBallpark, updateH2H, updateMarket, resetAll, replaceState } = useAnalyzerState();
  const { theme, setTheme } = useTheme();
  const [accent, setAccent] = useState<AccentColor>("gold");
  /**
   * Version 7.0: Umschaltfunktion zwischen Over/Under- und Run-Line-
   * Modus. Öffnet keine neue Seite — schaltet lediglich um, welche
   * prognosespezifischen Panels angezeigt werden. Alle Eingabemodule
   * (Form, Pitcher, Bullpen, Offense, Wetter, Ballpark, H2H, Markt)
   * bleiben in beiden Modi unverändert sichtbar, da sie dieselbe
   * zugrunde liegende Datenbasis für beide Analysearten liefern.
   */
  const [mode, setMode] = useState<AnalysisMode>("overUnder");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Übernimmt einen automatisch geladenen State (z. B. nach "Analyse starten"
  // auf der Today's-Games-Seite). Reagiert auf Referenzänderungen von
  // initialState, damit jeder neue Auto-Load auch wirklich übernommen wird.
  useEffect(() => {
    if (initialState) replaceState(initialState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState]);

  // Die vollständige Analyse (inkl. 20.000-Durchlauf-Monte-Carlo-PRO-Simulation)
  // ist rechenintensiv. Um sie nicht bei jedem einzelnen Tastendruck neu
  // auszuführen, wird ein um 300ms verzögerter Snapshot von `state`
  // verwendet. Die Eingabefelder selbst bleiben sofort responsiv, da sie
  // direkt an `state` (nicht debouncedState) gebunden sind.
  const debouncedState = useDebouncedValue(state, 300);
  // Release Dashboard (Tag 9): misst die tatsächliche Berechnungsdauer der
  // bereits bestehenden `computeFullAnalysis()`-Pipeline — reine Messung
  // um den unveränderten Aufruf herum, keine Änderung an der Berechnung
  // selbst.
  const { analysis, computationDurationMs } = useMemo(() => {
    const start = performance.now();
    const result = computeFullAnalysis(debouncedState);
    return { analysis: result, computationDurationMs: performance.now() - start };
  }, [debouncedState]);
  const quality = useMemo(() => assessQuality(analysis.consensus, analysis.premiumFilter), [analysis]);

  // Version 7.0: Run-Line-Analyse — nutzt ausschließlich das bereits
  // validierte `analysis.finalExpectedRuns`-Total und die bestehende
  // Gesamt-Confidence, keine eigene Neuberechnung der Kern-Statistik.
  // Bewusst immer berechnet (nicht nur bei aktivem Run-Line-Modus) —
  // die Berechnung ist günstig (siehe `@/engine/runLineEngine`), so
  // schaltet der Modus-Umschalter sofort um, ohne erneut zu laden.
  //
  // Live Monitoring (Paket 7A–7C) unterstützt den Run-Line-Modus bereits
  // vollständig automatisch, ohne zusätzlichen Code: `onWeatherChange`/
  // `onMarketChange` aktualisieren `state` über die bereits bestehenden
  // Setter, `runLineAnalysis` hängt (wie `analysis`) reaktiv von `state`
  // ab und wird dadurch bei jeder erkannten Wetter-/Odds-Änderung
  // automatisch neu berechnet — derselbe Mechanismus wie für den
  // Over/Under-Modus, keine Dopplung nötig.
  const runLineAnalysis = useMemo(
    () =>
      computeRunLineAnalysis({
        state,
        finalExpectedRuns: analysis.finalExpectedRuns,
        confidence: analysis.consensus.confidence,
        expectedRunsHome: analysis.advancedPrediction.expectedRunsHome,
        expectedRunsAway: analysis.advancedPrediction.expectedRunsAway,
      }),
    [state, analysis]
  );

  // Version 6.0 (Paket 7D): EINZIGE, kanonische Data-Quality-Berechnung
  // für diese Analyse — wird sowohl von Live Monitoring (Paket 7A) als
  // auch vom System-Status-Panel (Tag 9/Paket 5) genutzt. Vorher wurde
  // `buildDataQualityReport()` bei jedem Render zweimal aufgerufen
  // (einmal hier, einmal erneut intern in `SystemStatusPanel.tsx`) —
  // im Rahmen des Paket-7D-Performance-Reviews behoben.
  const gameInfoComplete = gameInfo
    ? gameInfo.venueName !== "" && gameInfo.localTimeLabel !== "" && gameInfo.seasonPhaseLabel !== "Unbekannt"
    : undefined;
  const dataQuality = useMemo(
    () =>
      buildDataQualityReport(
        state,
        analysis,
        availability?.lineups,
        lineupQuality?.score ?? null,
        marketIntelligence?.marketScore ?? (marketIntelligence === null ? null : undefined),
        gameInfoComplete
      ),
    [state, analysis, availability, lineupQuality, marketIntelligence, gameInfoComplete]
  );
  const liveMonitoring = useLiveMonitoring({
    game: game ?? null,
    dataQualityScore: dataQuality.overallScore,
    predictionPick: analysis.consensus.pick,
    confidencePct: analysis.consensus.confidence * 100,
    onWeatherChange: updateWeather,
    onMarketChange: updateMarket,
  });
  const line = toNumber(state.setup.line) ?? 8.5;

  // Überschreibt die vorläufigen Werte aus dem Auto-Load (Pitcher-/Bullpen-/
  // Offense-Matchup, Momentum, Recent Form) durch die tatsächlich aus den
  // 8 Kern-Modulen berechneten Scores. So basiert auch dieser Zusatzblock
  // ausschließlich auf echten, im Modell berechneten Werten.
  const resolvedExtendedMetrics = useMemo(() => {
    if (!extendedMetrics) return null;
    const scoreOf = (key: string) => analysis.modules.find((m) => m.key === key)?.score ?? 50;
    return {
      ...extendedMetrics,
      pitcherMatchupScore: scoreOf("pitcher"),
      bullpenMatchupScore: scoreOf("bullpen"),
      offenseMatchupScore: scoreOf("offense"),
      momentumScore: scoreOf("form"),
      recentFormScore: scoreOf("form"),
    };
  }, [extendedMetrics, analysis]);

  const handleSaveHistory = () => {
    saveHistoryEntry({
      homeTeamName: state.setup.homeTeamName || "Heimteam",
      awayTeamName: state.setup.awayTeamName || "Auswärtsteam",
      line,
      pick: analysis.consensus.pick,
      confidence: analysis.consensus.confidence,
      grade: quality.grade,
      tier: quality.tier,
      state,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Statische Klassen-Map (wichtig für Tailwind-JIT: Klassennamen müssen als
  // Literale im Quelltext vorkommen, damit sie ins gebaute CSS aufgenommen werden).
  const accentGradient: Record<AccentColor, string> = {
    gold: "from-gold-500 to-gold-600 shadow-glow-gold",
    teal: "from-teal-500 to-teal-600 shadow-glow-teal",
    green: "from-posgreen-500 to-posgreen-600 shadow-glow-green",
    red: "from-negred-500 to-negred-600 shadow-glow-red",
  };

  return (
    <div ref={dashboardRef} className="min-h-screen bg-base-950 pb-16">
      {/* Kopfbereich */}
      <header className="border-b border-base-700 px-4 sm:px-8 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} aria-label="Zurück" className="rounded-md border border-base-600 p-2 text-slate-400 hover:border-gold-500 hover:text-gold-400 transition-colors">
                <ArrowLeft size={16} />
              </button>
            )}
            <div className={`w-11 h-11 rounded-lg bg-gradient-to-br ${accentGradient[accent]} flex items-center justify-center font-numeric text-xl text-base-950 font-bold`}>
              O/U
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-semibold uppercase tracking-wide text-slate-100">
                MLB Over/Under Pro Analyzer <span className="text-gold-400">5.0</span>
              </h1>
              <p className="font-mono text-[11px] text-slate-500">Automatisches Laden · 8 Module · Poisson · Monte Carlo · KI-Konsens</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveHistory}
              className="flex items-center gap-1.5 rounded-md border border-base-600 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:border-posgreen-500 hover:text-posgreen-400 transition-colors"
            >
              <Save size={13} /> {saved ? "Gespeichert!" : "In Historie speichern"}
            </button>
            <button
              onClick={resetAll}
              className="hidden sm:flex items-center gap-1.5 rounded-md border border-base-600 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-slate-400 hover:border-negred-500 hover:text-negred-400 transition-colors"
            >
              <RotateCcw size={13} /> Zurücksetzen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {availability && <DataAvailabilityBanner availability={availability} />}

        {/* Dashboard-Kopf: Spiel-Setup */}
        {/* Spielinformationen (Version 6.0, Paket 5) — oberhalb der Analyse */}
        <GameInfoPanel data={gameInfo} />

        {/* Version 7.0: Umschaltfunktion Over/Under ↔ Run Line — oberhalb der Analyse, gut sichtbar */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("overUnder")}
            aria-pressed={mode === "overUnder"}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-mono uppercase tracking-wider border transition-colors ${
              mode === "overUnder" ? "bg-gold-500/20 border-gold-500 text-slate-100" : "bg-base-800 border-base-600 text-slate-500 hover:text-slate-300"
            }`}
          >
            Over / Under
          </button>
          <button
            type="button"
            onClick={() => setMode("runLine")}
            aria-pressed={mode === "runLine"}
            className={`flex-1 px-4 py-2.5 rounded-md text-sm font-mono uppercase tracking-wider border transition-colors ${
              mode === "runLine" ? "bg-gold-500/20 border-gold-500 text-slate-100" : "bg-base-800 border-base-600 text-slate-500 hover:text-slate-300"
            }`}
          >
            Run Line (Asian Handicap)
          </button>
        </div>

        <GameSetupBar setup={state.setup} onChange={updateSetup} accent={accent} />

        {/* Hauptkarte: Premium Prediction — je nach Modus Over/Under oder Run Line */}
        {mode === "overUnder" ? (
          <PredictionHero consensus={analysis.consensus} bankroll={analysis.bankroll} line={state.setup.line} quality={quality} />
        ) : (
          <RunLineHero analysis={runLineAnalysis} />
        )}

        {resolvedExtendedMetrics && <ExtendedMetricsPanel metrics={resolvedExtendedMetrics} />}

        {/* Konsens + Premium-Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConsensusPanel modules={analysis.modules} accent={accent} />
          <PremiumFilterPanel result={analysis.premiumFilter} />
        </div>

        {/* Modul 1: Team-Form (Heim/Auswärts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TeamFormModule side="home" teamLabel={state.setup.homeTeamName || "Heimteam"} data={state.home.form} onChange={(p) => updateTeam("home", { form: { ...state.home.form, ...p } })} />
          <TeamFormModule side="away" teamLabel={state.setup.awayTeamName || "Auswärtsteam"} data={state.away.form} onChange={(p) => updateTeam("away", { form: { ...state.away.form, ...p } })} />
        </div>

        {/* Modul 2: Starting Pitcher (Heim/Auswärts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PitcherModule
            side="home"
            teamLabel={state.setup.homeTeamName || "Heimteam"}
            data={state.home.pitcher}
            opponentOffense={state.away.offense}
            onChange={(p) => updateTeam("home", { pitcher: { ...state.home.pitcher, ...p } })}
          />
          <PitcherModule
            side="away"
            teamLabel={state.setup.awayTeamName || "Auswärtsteam"}
            data={state.away.pitcher}
            opponentOffense={state.home.offense}
            onChange={(p) => updateTeam("away", { pitcher: { ...state.away.pitcher, ...p } })}
          />
        </div>

        {/* Modul 3: Bullpen (Heim/Auswärts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BullpenModule side="home" teamLabel={state.setup.homeTeamName || "Heimteam"} data={state.home.bullpen} onChange={(p) => updateTeam("home", { bullpen: { ...state.home.bullpen, ...p } })} />
          <BullpenModule side="away" teamLabel={state.setup.awayTeamName || "Auswärtsteam"} data={state.away.bullpen} onChange={(p) => updateTeam("away", { bullpen: { ...state.away.bullpen, ...p } })} />
        </div>

        {/* Modul 4: Offense (Heim/Auswärts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OffenseModule side="home" teamLabel={state.setup.homeTeamName || "Heimteam"} data={state.home.offense} onChange={(p) => updateTeam("home", { offense: { ...state.home.offense, ...p } })} />
          <OffenseModule side="away" teamLabel={state.setup.awayTeamName || "Auswärtsteam"} data={state.away.offense} onChange={(p) => updateTeam("away", { offense: { ...state.away.offense, ...p } })} />
        </div>

        {/* Modul 5+6: Wetter & Ballpark */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeatherModule data={state.weather} onChange={updateWeather} />
          <BallparkModule data={state.ballpark} onChange={updateBallpark} />
        </div>

        {/* Modul 7+8: H2H & Marktanalyse */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <H2HModule data={state.h2h} onChange={updateH2H} />
          <MarketModule data={state.market} onChange={updateMarket} />
        </div>

        {mode === "overUnder" && (
          <>
            {/* Poisson-Modell */}
            <RunDistributionChart poisson={analysis.poisson} line={line} />

            {/* Monte-Carlo-Simulation */}
            <MonteCarloChart result={analysis.montecarlo} line={line} />
          </>
        )}

        {/* Explainable AI & Smart Decision Support (Tag 8) */}
        <DecisionSupportPanel analysis={analysis} accent={accent} />

        {/* Release Dashboard: Systemstatus, Data Quality, Smart Warnings, API Health (Tag 9) */}
        <SystemStatusPanel
          state={state}
          analysis={analysis}
          availability={availability ?? null}
          computationDurationMs={computationDurationMs}
          dataQuality={dataQuality}
        />

        {/* Market Intelligence (Version 6.0, Paket 4) */}
        <MarketIntelligencePanel data={marketIntelligence} />

        {/* Live Monitoring (Version 6.0, Paket 7A) */}
        <LiveMonitoringPanel monitoring={liveMonitoring} predictionPick={analysis.consensus.pick} confidencePct={analysis.consensus.confidence * 100} />

        {/* Weitere Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RadarScoreChart modules={analysis.modules} />
          <ConfidenceGauge confidence={analysis.consensus.confidence} />
          {mode === "overUnder" && (
            <ProbabilityDonut
              overProbability={analysis.poisson.overProbability}
              underProbability={analysis.poisson.underProbability}
              pushProbability={analysis.poisson.pushProbability}
            />
          )}
        </div>

        {mode === "overUnder" && <LineHeatmap expectedRuns={analysis.finalExpectedRuns} line={line} />}

        {/* Bankroll-Rechner */}
        <BankrollCalculator result={analysis.bankroll} bankroll={toNumber(state.setup.bankroll) ?? 0} />

        {/* Export & Einstellungen */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ExportPanel
            state={state}
            consensus={analysis.consensus}
            poisson={analysis.poisson}
            dashboardRef={dashboardRef}
            gameInfo={gameInfo}
            marketIntelligence={marketIntelligence}
            lineupQuality={lineupQuality}
            changeHistory={liveMonitoring.changeHistory}
            mode={mode}
            runLineAnalysis={runLineAnalysis}
          />
          <SettingsPanel
            theme={theme}
            onThemeChange={setTheme}
            accent={accent}
            onAccentChange={setAccent}
            animationsEnabled={animationsEnabled}
            onAnimationsToggle={setAnimationsEnabled}
          />
        </div>

        <p className="text-center font-mono text-[10px] text-slate-600 leading-relaxed px-4">
          Statistisches Analyse-Modell auf Basis von Poisson-Verteilung und Monte-Carlo-Simulation über vereinfachte,
          transparente Heuristiken. Keine Garantie für zukünftige Ergebnisse, keine Wett- oder Finanzberatung. Daten
          werden, wo möglich, automatisch über öffentliche APIs geladen (siehe Banner oben); nicht verfügbare Werte
          werden transparent als solche markiert und nicht erfunden — sie bleiben manuell editierbar. Bitte
          verantwortungsbewusst wetten.
        </p>
      </main>
    </div>
  );
}
