import {
  runDefaultHistoricalBacktestTest,
  runHistoricalBacktestTest,
} from "./backtestTestRunner";

import {
  runHistoricalMarketTest,
} from "./historicalMarketTest";

import {
  BacktestManager,
} from "./backtestManager";

import {
  formatCalibrationReport,
  runHistoricalCalibration,
} from "./historicalCalibration";

import {
  createPredictedBacktestGames,
  getLatestBacktestDecisionDiagnostics,
} from "./backtestRunner";

import {
  createBacktestingProReportFromPredictedGames,
  formatBacktestingProReport,
} from "./backtestingProAnalytics";

/**
 * Entwicklungsfunktionen für den
 * historischen MLB-Backtest in der
 * Browser-Konsole.
 *
 * Diese Funktionen werden nur im
 * DEV-Modus registriert und sind
 * nicht Bestandteil der produktiven
 * Anwendung.
 */
declare global {
  interface Window {
    /**
     * Standard-Backtest.
     */
    runMLBBacktest?:
      () =>
        Promise<void>;

    /**
     * Benutzerdefinierter
     * historischer Backtest.
     */
    runMLBBacktestCustom?: (
      startDate:
        string,

      endDate:
        string,

      line?:
        number,

      odds?:
        number
    ) =>
      Promise<void>;

    /**
     * Kontrollierter historischer
     * Market-Einzeltest.
     *
     * WICHTIG:
     *
     * Dieser Test kann einen
     * kostenpflichtigen historischen
     * Odds-API-Request auslösen.
     */
    runMLBHistoricalMarketTest?: (
      date:
        string,

      homeTeam?:
        string,

      awayTeam?:
        string,

      leadMinutes?:
        number
    ) =>
      Promise<void>;

    /**
     * Historical Calibration PRO: kalibriert die Modul-Gewichte anhand
     * echter historischer MLB-Spiele im angegebenen Zeitraum und gibt den
     * vollständigen, nachvollziehbaren Kalibrierungs-Report aus.
     *
     * Beispiel:
     *
     * runMLBHistoricalCalibration(
     *   "2025-04-01",
     *   "2025-07-01",
     *   8.5,
     *   1.9
     * )
     */
    runMLBHistoricalCalibration?: (
      startDate:
        string,

      endDate:
        string,

      line?:
        number,

      odds?:
        number
    ) =>
      Promise<void>;

    /**
     * Backtesting PRO: erstellt den vollständigen professionellen
     * Backtest-Report (ROI/Yield/Profit/Win Rate, Over-/Under-/Module-/
     * Confidence-Accuracy, Prediction Accuracy, Average Edge, Drawdown/
     * Serien, Historical Performance) für den angegebenen Zeitraum.
     *
     * Beispiel:
     *
     * runMLBBacktestingProReport(
     *   "2025-04-01",
     *   "2025-07-01",
     *   8.5,
     *   1.9
     * )
     */
    runMLBBacktestingProReport?: (
      startDate:
        string,

      endDate:
        string,

      line?:
        number,

      odds?:
        number
    ) =>
      Promise<void>;
  }
}

/**
 * Registriert die Backtest-Funktionen
 * auf dem globalen window-Objekt.
 */
export function registerBacktestDevHook():
  void {
  if (
    !import.meta.env.DEV
  ) {
    return;
  }

  /**
   * Standard-Test.
   */
  window.runMLBBacktest =
    async (): Promise<void> => {
      await runDefaultHistoricalBacktestTest();
    };

  /**
   * Benutzerdefinierter
   * Fixed-Line-Backtest.
   *
   * Beispiel:
   *
   * runMLBBacktestCustom(
   *   "2025-07-01",
   *   "2025-07-03",
   *   8.5,
   *   1.9
   * )
   */
  window.runMLBBacktestCustom =
    async (
      startDate:
        string,

      endDate:
        string,

      line =
        8.5,

      odds =
        1.9
    ): Promise<void> => {
      const parsedStartDate =
        new Date(
          `${startDate}T12:00:00`
        );

      const parsedEndDate =
        new Date(
          `${endDate}T12:00:00`
        );

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        ) ||
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        throw new Error(
          "Ungültiges Datum. Bitte YYYY-MM-DD verwenden."
        );
      }

      if (
        parsedStartDate.getTime() >
        parsedEndDate.getTime()
      ) {
        throw new Error(
          "Das Startdatum darf nicht nach dem Enddatum liegen."
        );
      }

      await runHistoricalBacktestTest({
        startDate:
          parsedStartDate,

        endDate:
          parsedEndDate,

        line,

        odds,
      });
    };

  /**
   * Kontrollierter Einzeltest für
   * historische Odds.
   *
   * Ohne Teamnamen:
   *
   * Es wird bevorzugt das erste
   * abgeschlossene Spiel des Tages
   * verwendet.
   *
   * Mit Teamnamen:
   *
   * Es wird ein bestimmtes Matchup
   * ausgewählt.
   *
   * WICHTIG:
   *
   * Jeder Aufruf kann historische
   * Odds-API-Credits verbrauchen.
   *
   * Deshalb ist diese Funktion
   * bewusst NICHT Teil des normalen
   * Backtests.
   */
  window.runMLBHistoricalMarketTest =
    async (
      date:
        string,

      homeTeam?:
        string,

      awayTeam?:
        string,

      leadMinutes =
        60
    ): Promise<void> => {
      await runHistoricalMarketTest({
        date,

        homeTeam,

        awayTeam,

        leadMinutes,
      });
    };

  /**
   * Historical Calibration PRO.
   *
   * Lädt echte historische MLB-Spiele über die bestehende
   * Backtest-Datenpipeline (`BacktestManager`), kalibriert daraus die
   * Modul-Gewichte (Koordinaten-Suche, Train-/Validierungs-Split,
   * Overfitting-Schutz) und gibt den vollständigen, nachvollziehbaren
   * Report in der Konsole aus.
   *
   * Beispiel:
   *
   * runMLBHistoricalCalibration(
   *   "2025-04-01",
   *   "2025-07-01",
   *   8.5,
   *   1.9
   * )
   */
  window.runMLBHistoricalCalibration =
    async (
      startDate:
        string,

      endDate:
        string,

      line =
        8.5,

      odds =
        1.9
    ): Promise<void> => {
      const parsedStartDate =
        new Date(
          `${startDate}T12:00:00`
        );

      const parsedEndDate =
        new Date(
          `${endDate}T12:00:00`
        );

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        ) ||
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        throw new Error(
          "Ungültiges Datum. Bitte YYYY-MM-DD verwenden."
        );
      }

      if (
        parsedStartDate.getTime() >
        parsedEndDate.getTime()
      ) {
        throw new Error(
          "Das Startdatum darf nicht nach dem Enddatum liegen."
        );
      }

      const manager =
        new BacktestManager();

      console.log(
        "[Historical Calibration] Lade historische Datenbasis ..."
      );

      const dataset =
        await manager.prepareHistoricalBacktestDataset(
          parsedStartDate,
          parsedEndDate,
          line,
          odds
        );

      console.log(
        `[Historical Calibration] ${dataset.states.length} Point-in-Time-Zustände, ${dataset.backtestGames.length} auswertbare Spiele geladen.`
      );

      const result =
        runHistoricalCalibration(
          dataset.states,
          dataset.backtestGames
        );

      console.log(
        formatCalibrationReport(
          result
        )
      );
    };

  /**
   * Backtesting PRO.
   *
   * Lädt echte historische MLB-Spiele über die bestehende
   * Backtest-Datenpipeline (`BacktestManager`), erzeugt daraus die
   * tatsächlichen Modell-Prognosen samt Entscheidungsdiagnose
   * (`createPredictedBacktestGames`, bereits bestehend) und erstellt den
   * vollständigen Backtesting-PRO-Report.
   *
   * Beispiel:
   *
   * runMLBBacktestingProReport(
   *   "2025-04-01",
   *   "2025-07-01",
   *   8.5,
   *   1.9
   * )
   */
  window.runMLBBacktestingProReport =
    async (
      startDate:
        string,

      endDate:
        string,

      line =
        8.5,

      odds =
        1.9
    ): Promise<void> => {
      const parsedStartDate =
        new Date(
          `${startDate}T12:00:00`
        );

      const parsedEndDate =
        new Date(
          `${endDate}T12:00:00`
        );

      if (
        Number.isNaN(
          parsedStartDate.getTime()
        ) ||
        Number.isNaN(
          parsedEndDate.getTime()
        )
      ) {
        throw new Error(
          "Ungültiges Datum. Bitte YYYY-MM-DD verwenden."
        );
      }

      if (
        parsedStartDate.getTime() >
        parsedEndDate.getTime()
      ) {
        throw new Error(
          "Das Startdatum darf nicht nach dem Enddatum liegen."
        );
      }

      const manager =
        new BacktestManager();

      console.log(
        "[Backtesting PRO] Lade historische Datenbasis ..."
      );

      const dataset =
        await manager.prepareHistoricalBacktestDataset(
          parsedStartDate,
          parsedEndDate,
          line,
          odds
        );

      console.log(
        `[Backtesting PRO] ${dataset.states.length} Point-in-Time-Zustände, ${dataset.backtestGames.length} auswertbare Spiele geladen.`
      );

      const predictedGames =
        createPredictedBacktestGames(
          dataset.states,
          dataset.backtestGames
        );

      const diagnostics =
        getLatestBacktestDecisionDiagnostics();

      const report =
        createBacktestingProReportFromPredictedGames(
          predictedGames,
          diagnostics
        );

      console.log(
        formatBacktestingProReport(
          report
        )
      );
    };

  console.log(
    "[MLB Backtest] Development Hook aktiv."
  );

  console.log(
    "[MLB Backtest] Standardtest: runMLBBacktest()"
  );

  console.log(
    "[MLB Backtest] Eigener Zeitraum: runMLBBacktestCustom('2025-07-01', '2025-07-03', 8.5, 1.9)"
  );

  console.log(
    "[MLB Backtest] Historical Market Einzeltest: runMLBHistoricalMarketTest('2025-07-01')"
  );

  console.log(
    "[MLB Backtest] Bestimmtes Matchup: runMLBHistoricalMarketTest('2025-07-01', 'Philadelphia Phillies', 'San Diego Padres', 60)"
  );

  console.log(
    "[MLB Backtest] Historical Calibration PRO: runMLBHistoricalCalibration('2025-04-01', '2025-07-01', 8.5, 1.9)"
  );

  console.log(
    "[MLB Backtest] Backtesting PRO Report: runMLBBacktestingProReport('2025-04-01', '2025-07-01', 8.5, 1.9)"
  );
}