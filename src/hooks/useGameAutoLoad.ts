import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalyzerState, ExtendedMetrics, GameCardSummary, LoadingStep } from "@/types";
import { createEmptyAnalyzerState } from "@/hooks/useAnalyzerState";
import { fetchTeamOffenseStats, fetchTeamForm, findTeamByName } from "@/services/api/teams";
import { fetchPitcherSeasonStats } from "@/services/api/pitchers";
import { fetchBullpenStats } from "@/services/api/bullpen";
import { fetchHeadToHead } from "@/services/api/h2h";
import { fetchWeatherForCoordinates } from "@/services/api/weather";
import { getBallparkReference, getBallparkCoordinates } from "@/services/api/ballpark";
import { fetchMarketSnapshot } from "@/services/api/market";
import { fetchLineups } from "@/services/api/lineups";
import { fetchRestAndTravel } from "@/services/api/games";

const STEP_LABELS = [
  "Lade Spiel...",
  "Lade Teams...",
  "Lade Pitcher...",
  "Lade Bullpen...",
  "Lade Statistiken...",
  "Lade Ballpark...",
  "Lade Wetter...",
  "Lade H2H...",
  "Lade Quoten...",
  "Lade Lineups...",
  "Berechne Analyse...",
];

/** Welche Datenquellen für ein Feld genutzt wurden – zur transparenten Anzeige in der UI. */
export interface AvailabilityFlags {
  homeOffense: boolean;
  awayOffense: boolean;
  homePitcher: boolean;
  awayPitcher: boolean;
  homeBullpen: boolean;
  awayBullpen: boolean;
  homeForm: boolean;
  awayForm: boolean;
  weather: boolean;
  ballpark: boolean;
  h2h: boolean;
  market: boolean;
  lineups: boolean;
}

const emptyAvailability = (): AvailabilityFlags => ({
  homeOffense: false, awayOffense: false, homePitcher: false, awayPitcher: false,
  homeBullpen: false, awayBullpen: false, homeForm: false, awayForm: false,
  weather: false, ballpark: false, h2h: false, market: false, lineups: false,
});

export function useGameAutoLoad() {
  const [steps, setSteps] = useState<LoadingStep[]>(STEP_LABELS.map((label) => ({ label, done: false })));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityFlags>(emptyAvailability());
  const [extended, setExtended] = useState<ExtendedMetrics | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const markDone = (index: number) => {
    if (!isMountedRef.current) return;
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)));
  };

  const loadGame = useCallback(async (game: GameCardSummary): Promise<AnalyzerState> => {
    setIsLoading(true);
    setError(null);
    setSteps(STEP_LABELS.map((label) => ({ label, done: false })));
    const flags = emptyAvailability();

    const state = createEmptyAnalyzerState();
    state.setup.homeTeamName = game.homeTeamName;
    state.setup.awayTeamName = game.awayTeamName;
    state.setup.line = game.line != null ? String(game.line) : state.setup.line;
    state.setup.oddsOver = game.oddsOver != null ? String(game.oddsOver) : "";
    state.setup.oddsUnder = game.oddsUnder != null ? String(game.oddsUnder) : "";
    markDone(0);

    try {
      // Performance PRO: Wetter, Markt und Lineups hängen von keinem der
      // nachfolgenden Team-/Pitcher-/Bullpen-Ergebnisse ab (nur von
      // bereits aus `game` bekannten Werten). Die Requests werden daher
      // schon jetzt im Hintergrund gestartet und erst an ihrer
      // ursprünglichen Stelle im Ladeverlauf ausgewertet — die sichtbare
      // Reihenfolge der Fortschrittsanzeige bleibt exakt gleich, aber die
      // tatsächliche Wartezeit sinkt, weil diese Requests die gesamte
      // Team-/Pitcher-/Bullpen-Ladezeit über bereits parallel im
      // Hintergrund laufen, statt erst danach zu starten.
      const earlyCoords = getBallparkCoordinates(game.venueName);
      const weatherPromise = earlyCoords ? fetchWeatherForCoordinates(earlyCoords.lat, earlyCoords.lon) : Promise.resolve(null);
      const marketPromise = fetchMarketSnapshot(game.homeTeamName, game.awayTeamName);
      const lineupsPromise = fetchLineups(game.gamePk);

      // Performance PRO: Teams und Pitcher sind voneinander unabhängig
      // (der Pitcher-Abruf nutzt die Personen-ID direkt aus dem
      // Spielplan, nicht die Team-ID) — beide werden daher in EINEM
      // Promise.all parallel geladen statt nacheinander auf Teams zu
      // warten, bevor der Pitcher-Abruf überhaupt startet.
      const [homeTeam, awayTeam, homePitcher, awayPitcher] = await Promise.all([
        findTeamByName(game.homeTeamName),
        findTeamByName(game.awayTeamName),
        game.homeProbablePitcherId ? fetchPitcherSeasonStats(game.homeProbablePitcherId) : Promise.resolve(null),
        game.awayProbablePitcherId ? fetchPitcherSeasonStats(game.awayProbablePitcherId) : Promise.resolve(null),
      ]);
      markDone(1);
      markDone(2);

      // Performance PRO: Bullpen, Team-Form und Offense hängen alle nur
      // von den bereits geladenen Team-IDs ab — nicht voneinander.
      // Deshalb ebenfalls EIN gemeinsames Promise.all statt zwei
      // sequenzieller Ladephasen.
      const [homeBullpen, awayBullpen, homeForm, awayForm, homeOffense, awayOffense] = await Promise.all([
        homeTeam ? fetchBullpenStats(homeTeam.id) : null,
        awayTeam ? fetchBullpenStats(awayTeam.id) : null,
        homeTeam ? fetchTeamForm(homeTeam.id) : null,
        awayTeam ? fetchTeamForm(awayTeam.id) : null,
        homeTeam ? fetchTeamOffenseStats(homeTeam.id) : null,
        awayTeam ? fetchTeamOffenseStats(awayTeam.id) : null,
      ]);
      markDone(3);
      markDone(4);

      // Ballpark
      const ballpark = getBallparkReference(game.venueName);
      markDone(5);

      // Wetter (Request lief bereits seit Ladebeginn im Hintergrund)
      const weather = await weatherPromise;
      markDone(6);

      // H2H (benötigt Team-IDs, kann erst jetzt starten)
      const h2h = homeTeam && awayTeam ? await fetchHeadToHead(homeTeam.id, awayTeam.id, 20) : null;
      markDone(7);

      // Quoten / Markt (Request lief bereits seit Ladebeginn im Hintergrund)
      const market = await marketPromise;
      markDone(8);

      // Lineups (Request lief bereits seit Ladebeginn im Hintergrund)
      const lineups = await lineupsPromise;
      markDone(9);

      // ---- State befüllen ----
      if (homeForm) {
        state.home.form.last10 = homeForm.last10Runs.map(String);
        state.home.form.runsAllowedLast10 = homeForm.last10Allowed.map(String);
        state.home.form.streak = homeForm.streak;
        flags.homeForm = true;
      }
      if (awayForm) {
        state.away.form.last10 = awayForm.last10Runs.map(String);
        state.away.form.runsAllowedLast10 = awayForm.last10Allowed.map(String);
        state.away.form.streak = awayForm.streak;
        flags.awayForm = true;
      }

      if (homeOffense) {
        state.home.offense.runsPerGame = homeOffense.runsPerGame != null ? String(homeOffense.runsPerGame.toFixed(2)) : "";
        state.home.offense.ops = homeOffense.ops != null ? String(homeOffense.ops) : "";
        state.home.offense.avg = homeOffense.avg != null ? String(homeOffense.avg) : "";
        state.home.offense.obp = homeOffense.obp != null ? String(homeOffense.obp) : "";
        state.home.offense.slg = homeOffense.slg != null ? String(homeOffense.slg) : "";
        state.home.offense.kPct = homeOffense.strikeoutPct != null ? String(homeOffense.strikeoutPct.toFixed(1)) : "";
        state.home.offense.bbPct = homeOffense.walkPct != null ? String(homeOffense.walkPct.toFixed(1)) : "";
        flags.homeOffense = true;
      }
      if (awayOffense) {
        state.away.offense.runsPerGame = awayOffense.runsPerGame != null ? String(awayOffense.runsPerGame.toFixed(2)) : "";
        state.away.offense.ops = awayOffense.ops != null ? String(awayOffense.ops) : "";
        state.away.offense.avg = awayOffense.avg != null ? String(awayOffense.avg) : "";
        state.away.offense.obp = awayOffense.obp != null ? String(awayOffense.obp) : "";
        state.away.offense.slg = awayOffense.slg != null ? String(awayOffense.slg) : "";
        state.away.offense.kPct = awayOffense.strikeoutPct != null ? String(awayOffense.strikeoutPct.toFixed(1)) : "";
        state.away.offense.bbPct = awayOffense.walkPct != null ? String(awayOffense.walkPct.toFixed(1)) : "";
        flags.awayOffense = true;
      }

      if (homePitcher) {
        applyPitcherStats(state.home.pitcher, homePitcher);
        flags.homePitcher = true;
      }
      if (awayPitcher) {
        applyPitcherStats(state.away.pitcher, awayPitcher);
        flags.awayPitcher = true;
      }

      if (homeBullpen) {
        state.home.bullpen.era = homeBullpen.era != null ? String(homeBullpen.era.toFixed(2)) : "";
        state.home.bullpen.whip = homeBullpen.whip != null ? String(homeBullpen.whip.toFixed(2)) : "";
        flags.homeBullpen = homeBullpen.era != null;
      }
      if (awayBullpen) {
        state.away.bullpen.era = awayBullpen.era != null ? String(awayBullpen.era.toFixed(2)) : "";
        state.away.bullpen.whip = awayBullpen.whip != null ? String(awayBullpen.whip.toFixed(2)) : "";
        flags.awayBullpen = awayBullpen.era != null;
      }

      if (ballpark) {
        state.ballpark.runFactor = String(ballpark.runFactor);
        state.ballpark.hrFactor = String(ballpark.hrFactor);
        state.ballpark.altitudeMeters = String(ballpark.altitudeMeters);
        flags.ballpark = true;
      }

      if (weather) {
        state.weather.temperatureC = String(Math.round(weather.temperatureC));
        state.weather.windSpeedMph = String(Math.round(weather.windSpeedMph));
        state.weather.humidityPct = String(Math.round(weather.humidityPct));
        state.weather.pressureHpa = String(weather.pressureHpa);
        state.weather.rainChancePct = weather.rainChancePct != null ? String(Math.round(weather.rainChancePct)) : "";
        flags.weather = true;
      }

      if (h2h && h2h.length > 0) {
        const last10 = h2h.slice(-10).map((g) => String(g.totalRuns));
        state.h2h.last10TotalRuns = [...Array(10 - last10.length).fill(""), ...last10];
        state.h2h.last20TotalRuns = h2h.slice(-20).map((g) => String(g.totalRuns));
        flags.h2h = true;
      }

      if (market) {
        state.market.openingLine = market.openingLine != null ? String(market.openingLine) : "";
        state.market.currentLine = market.currentLine != null ? String(market.currentLine) : "";
        if (market.currentLine != null) state.setup.line = String(market.currentLine);
        if (market.bestOddsOver != null) state.setup.oddsOver = String(market.bestOddsOver);
        if (market.bestOddsUnder != null) state.setup.oddsUnder = String(market.bestOddsUnder);
        flags.market = market.currentLine != null;
      }

      if (lineups) flags.lineups = true;

      // Rest/Reise (best-effort, aus echten Spielplandaten)
      const [homeRest, awayRest] = await Promise.all([
        homeTeam ? fetchRestAndTravel(homeTeam.id, game.venueName) : null,
        awayTeam ? fetchRestAndTravel(awayTeam.id, game.venueName) : null,
      ]);

      if (isMountedRef.current) {
        setExtended({
          expectedHomeRuns: null, // benötigt HR/9 + Barrel% beider Seiten, die über die freie API nicht vollständig verfügbar sind
          pitcherMatchupScore: 50, // Initialwert, wird unmittelbar im Dashboard durch den echten Pitcher-Modul-Score überschrieben
          bullpenMatchupScore: 50, // Initialwert, wird unmittelbar im Dashboard durch den echten Bullpen-Modul-Score überschrieben
          offenseMatchupScore: 50, // Initialwert, wird unmittelbar im Dashboard durch den echten Offense-Modul-Score überschrieben
          lineupStrengthScore: null,
          momentumScore: 50, // Initialwert, wird unmittelbar im Dashboard durch den echten Form-Modul-Score überschrieben
          recentFormScore: 50, // Initialwert, wird unmittelbar im Dashboard durch den echten Form-Modul-Score überschrieben
          travelFatigueNote: awayRest?.traveledSinceLastGame ? `${game.awayTeamName} ist seit dem letzten Spiel umgezogen (${awayRest.lastVenueName ?? "unbekannt"} → ${game.venueName})` : null,
          restAdvantageNote:
            homeRest?.restDays != null && awayRest?.restDays != null
              ? `${game.homeTeamName}: ${homeRest.restDays} Ruhetage · ${game.awayTeamName}: ${awayRest.restDays} Ruhetage`
              : null,
          umpireName: null,
        });
        markDone(10);
        setAvailability(flags);
      }
      return state;
    } catch (e) {
      if (isMountedRef.current) setError(e instanceof Error ? e.message : "Unbekannter Fehler beim Laden der Daten.");
      return state;
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  return { loadGame, steps, isLoading, error, availability, extended };
}

function applyPitcherStats(target: AnalyzerState["home"]["pitcher"], stats: NonNullable<Awaited<ReturnType<typeof fetchPitcherSeasonStats>>>): void {
  target.era = stats.era != null ? String(stats.era) : "";
  target.whip = stats.whip != null ? String(stats.whip) : "";
  target.kPct = stats.strikeoutPct != null ? String(stats.strikeoutPct.toFixed(1)) : "";
  target.bbPct = stats.walkPct != null ? String(stats.walkPct.toFixed(1)) : "";
  target.hr9 = stats.hr9 != null ? String(stats.hr9.toFixed(2)) : "";
  target.gbPct = stats.groundOutPct != null ? String(stats.groundOutPct.toFixed(1)) : "";
  target.fbPct = stats.flyOutPct != null ? String(stats.flyOutPct.toFixed(1)) : "";
  target.last5Starts = stats.last5Starts.length ? stats.last5Starts.map(String) : Array(5).fill("");
  target.last10Starts = stats.last10Starts.length ? stats.last10Starts.map(String) : Array(10).fill("");
  target.throwsHand = stats.throws ?? "R";
  target.xera = stats.xera != null ? String(stats.xera) : "";
  target.hardHitPct = stats.hardHitPct != null ? String(stats.hardHitPct) : "";
  target.barrelPct = stats.barrelPct != null ? String(stats.barrelPct) : "";
  // Starting Pitcher PRO: real, formula-derived metrics (see pitchers.ts) —
  // no scraping, no invented values, only actual MLB Stats API components.
  target.fip = stats.fip != null ? String(stats.fip.toFixed(2)) : "";
  target.babip = stats.babip != null ? String(stats.babip.toFixed(3)) : "";
  target.lobPct = stats.lobPct != null ? String(stats.lobPct.toFixed(1)) : "";
  target.pitchCount = stats.pitchCount != null ? String(stats.pitchCount) : "";
  target.pitchCountLast5 = stats.pitchCountLast5.length ? stats.pitchCountLast5.map(String) : Array(5).fill("");
  target.restDays = stats.restDays != null ? String(stats.restDays) : "";
}
