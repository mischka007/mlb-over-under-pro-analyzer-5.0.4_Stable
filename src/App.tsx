import { useCallback, useState } from "react";
import { MotionConfig } from "framer-motion";
import type { AnalyzerState, ExtendedMetrics, GameCardSummary, HistoryEntry } from "@/types";
import { Dashboard } from "@/pages/Dashboard";
import { TodaysGamesPage } from "@/pages/TodaysGamesPage";
import { AnalyzeAllPage, type RankedGameResult } from "@/pages/AnalyzeAllPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { BacktestingPage } from "@/pages/BacktestingPage";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { SetupWizard } from "@/components/common/SetupWizard";
import { useTodaysGames } from "@/hooks/useTodaysGames";
import { useGameAutoLoad, type AvailabilityFlags } from "@/hooks/useGameAutoLoad";
import { hasSeenSetupWizard } from "@/services/api/apiKeys";
import { computeFullAnalysis } from "@/models/GameModel";
import { assessQuality } from "@/utils/quality";
import { listHistoryEntries } from "@/utils/history";
import { createEmptyAnalyzerState } from "@/hooks/useAnalyzerState";

type View = "today" | "analysis" | "all" | "history" | "backtesting";

/**
 * Root-Komponente von v5.0.
 *
 * Steuert die Navigation zwischen den vier Ansichten:
 *  - "today": Startseite mit allen heutigen MLB-Spielen als Karten
 *  - "analysis": das vollständige Dashboard (alle bisherigen v4.0-Module
 *    bleiben erhalten), optional mit automatisch geladenem State
 *  - "all": Rangliste aller heutigen Spiele nach Analyse-Wahrscheinlichkeit
 *  - "history": gespeicherte vergangene Analysen
 *
 * Zeigt beim allerersten Start den Setup-Assistenten für die optionalen
 * API-Keys (OpenWeatherMap, The Odds API).
 */
export default function App() {
  const [showSetupWizard, setShowSetupWizard] = useState(!hasSeenSetupWizard());
  const [view, setView] = useState<View>("today");

  const { games, isLoading: gamesLoading, error: gamesError, reload } = useTodaysGames();
  const { loadGame, steps, isLoading: analysisLoading, availability, extended } = useGameAutoLoad();

  const [loadedState, setLoadedState] = useState<AnalyzerState | null>(null);
  const [loadedAvailability, setLoadedAvailability] = useState<AvailabilityFlags | null>(null);
  const [loadedExtended, setLoadedExtended] = useState<ExtendedMetrics | null>(null);

  const [rankedResults, setRankedResults] = useState<RankedGameResult[]>([]);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState(0);
  const [analyzeAllFailedCount, setAnalyzeAllFailedCount] = useState(0);

  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  const handleAnalyze = useCallback(
    async (game: GameCardSummary) => {
      const state = await loadGame(game);
      setLoadedState(state);
      setLoadedAvailability(availability);
      setLoadedExtended(extended);
      setView("analysis");
    },
    [loadGame, availability, extended]
  );

  const handleAnalyzeAll = useCallback(async () => {
    setView("all");
    setIsAnalyzingAll(true);
    setRankedResults([]);
    setAnalyzeAllProgress(0);
    setAnalyzeAllFailedCount(0);

    const results: RankedGameResult[] = [];
    let failedCount = 0;

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      try {
        // Sequenziell statt parallel, um die Rate-Limits der kostenlosen
        // API-Tarife (insbesondere The Odds API, 500 Requests/Monat) zu schonen.
        const state = await loadGame(game);
        const analysis = computeFullAnalysis(state);
        const quality = assessQuality(analysis.consensus, analysis.premiumFilter);
        const line = Number(state.setup.line) || 8.5;
        results.push({ game, pick: analysis.consensus.pick, confidence: analysis.consensus.confidence, grade: quality.grade, tier: quality.tier, line });
      } catch {
        // Ein einzelnes fehlgeschlagenes Spiel (Netzwerkfehler, unvollständige
        // Daten) darf die restliche Rangliste nicht blockieren — übersprungen
        // statt die gesamte Schleife abzubrechen und die UI dauerhaft im
        // Ladezustand hängen zu lassen.
        failedCount += 1;
        setAnalyzeAllFailedCount(failedCount);
      }
      setAnalyzeAllProgress(i + 1);
      setRankedResults([...results]);
    }
    setIsAnalyzingAll(false);
  }, [games, loadGame]);

  const handleOpenRankedGame = useCallback(
    async (game: GameCardSummary) => {
      await handleAnalyze(game);
    },
    [handleAnalyze]
  );

  const openHistory = useCallback(() => {
    setHistoryEntries(listHistoryEntries());
    setView("history");
  }, []);

  const openBacktesting = useCallback(() => {
    setView("backtesting");
  }, []);

  const openHistoryEntry = useCallback((entry: HistoryEntry) => {
    setLoadedState(entry.state);
    setLoadedAvailability(null);
    setLoadedExtended(null);
    setView("analysis");
  }, []);

  if (showSetupWizard) {
    return <SetupWizard onDone={() => setShowSetupWizard(false)} />;
  }

  return (
    <MotionConfig reducedMotion="user">
      {analysisLoading && <LoadingOverlay steps={steps} />}

      {view === "today" && (
        <div className="min-h-screen bg-base-950 px-4 sm:px-8 py-6 max-w-6xl mx-auto">
          <TodaysGamesPage
            games={games}
            isLoading={gamesLoading}
            error={gamesError}
            onReload={reload}
            onAnalyze={handleAnalyze}
            onAnalyzeAll={handleAnalyzeAll}
            onShowHistory={openHistory}
            onShowBacktesting={openBacktesting}
          />
        </div>
      )}

      {view === "analysis" && (
        <Dashboard
          initialState={loadedState ?? createEmptyAnalyzerState()}
          availability={loadedAvailability}
          extendedMetrics={loadedExtended}
          onBack={() => setView("today")}
        />
      )}

      {view === "all" && (
        <div className="min-h-screen bg-base-950 px-4 sm:px-8 py-6 max-w-6xl mx-auto">
          <AnalyzeAllPage
            results={rankedResults}
            isRunning={isAnalyzingAll}
            progress={analyzeAllProgress}
            total={games.length}
            failedCount={analyzeAllFailedCount}
            onBack={() => setView("today")}
            onOpenGame={handleOpenRankedGame}
          />
        </div>
      )}

      {view === "history" && (
        <div className="min-h-screen bg-base-950 px-4 sm:px-8 py-6 max-w-6xl mx-auto">
          <HistoryPage entries={historyEntries} onBack={() => setView("today")} onReload={() => setHistoryEntries(listHistoryEntries())} onOpenEntry={openHistoryEntry} />
        </div>
      )}

      {view === "backtesting" && <BacktestingPage onBack={() => setView("today")} />}
    </MotionConfig>
  );
}
