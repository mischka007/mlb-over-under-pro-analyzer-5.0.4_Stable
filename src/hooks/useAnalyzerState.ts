import { useCallback, useEffect, useState } from "react";
import type {
  AnalyzerState,
  BallparkInput,
  BullpenInput,
  GameSetup,
  H2HInput,
  MarketInput,
  OffenseInput,
  PitcherInput,
  TeamAnalyzerState,
  TeamFormInput,
  WeatherInput,
} from "@/types";

const STORAGE_KEY = "mlb-analyzer-v4-state";

const emptyForm = (): TeamFormInput => ({
  last10: Array(10).fill(""),
  last20: Array(20).fill(""),
  runsAllowedLast10: Array(10).fill(""),
  streak: 0,
  homeRunsPerGame: "",
  awayRunsPerGame: "",
});

const emptyPitcher = (): PitcherInput => ({
  era: "",
  xera: "",
  fip: "",
  siera: "",
  whip: "",
  babip: "",
  kPct: "",
  bbPct: "",
  hr9: "",
  gbPct: "",
  fbPct: "",
  lobPct: "",
  hardHitPct: "",
  barrelPct: "",
  pitchCount: "",
  restDays: "",
  last5Starts: Array(5).fill(""),
  last10Starts: Array(10).fill(""),
  pitchCountLast5: Array(5).fill(""),
  velocity: "",
  spinRate: "",
  throwsHand: "R",
  dayEraSplit: "",
  nightEraSplit: "",
  homeEraSplit: "",
  awayEraSplit: "",
});

const emptyBullpen = (): BullpenInput => ({
  era: "",
  whip: "",
  fip: "",
  war: "",
  closerAvailable: true,
  middleReliefAvailable: true,
  inningsLast3Days: "",
  inningsLast7Days: "",
  xfip: "",
  kPct: "",
  bbPct: "",
  hr9: "",
  lobPct: "",
  hardHitPct: "",
  highLeverageAvailable: true,
});

const emptyOffense = (): OffenseInput => ({
  runsPerGame: "",
  ops: "",
  wrcPlus: "",
  woba: "",
  iso: "",
  avg: "",
  obp: "",
  slg: "",
  kPct: "",
  bbPct: "",
  babip: "",
  hardHitPct: "",
  barrelPct: "",
  rispAvg: "",
  homeSplitRuns: "",
  awaySplitRuns: "",
  last10Games: Array(10).fill(""),
  xwoba: "",
  exitVelocity: "",
  launchAngle: "",
  contactPct: "",
  chasePct: "",
  zoneContactPct: "",
  swingPct: "",
  vsLhpOps: "",
  vsRhpOps: "",
  last7AvgRuns: "",
  last15AvgRuns: "",
  last30AvgRuns: "",
});

const emptyTeamState = (): TeamAnalyzerState => ({
  form: emptyForm(),
  pitcher: emptyPitcher(),
  bullpen: emptyBullpen(),
  offense: emptyOffense(),
});

const emptyWeather = (): WeatherInput => ({
  temperatureC: "",
  windSpeedMph: "",
  windDirection: "none",
  humidityPct: "",
  pressureHpa: "",
  rainChancePct: "",
  roofState: "none",
});

const emptyBallpark = (): BallparkInput => ({
  runFactor: "100",
  hrFactor: "100",
  singlesFactor: "100",
  doublesFactor: "100",
  triplesFactor: "100",
  altitudeMeters: "",
  leftFieldDistance: "",
  rightFieldDistance: "",
  dayNight: "night",
});

const emptyH2H = (): H2HInput => ({
  last10TotalRuns: Array(10).fill(""),
  last20TotalRuns: Array(20).fill(""),
  firstFiveInningsAvg: "",
  extraInningsGames: "",
});

const emptyMarket = (): MarketInput => ({
  openingLine: "",
  currentLine: "",
  closingLine: "",
  publicOverPct: "",
  sharpOverPct: "",
  marketScore: "",
});

const emptySetup = (): GameSetup => ({
  homeTeamName: "",
  awayTeamName: "",
  line: "8.5",
  bookmaker: "",
  oddsOver: "",
  oddsUnder: "",
  bankroll: "1000",
  isDoubleheader: false,
  lineupsConfirmed: false,
  pitcherConfirmed: false,
  weatherConfirmed: false,
  lineupQualityScore: "",
  runLineFavoriteOdds: "",
  runLineUnderdogOdds: "",
  noInjuryConcerns: true,
});

export const createEmptyAnalyzerState = (): AnalyzerState => ({
  setup: emptySetup(),
  home: emptyTeamState(),
  away: emptyTeamState(),
  weather: emptyWeather(),
  ballpark: emptyBallpark(),
  h2h: emptyH2H(),
  market: emptyMarket(),
});

function loadPersistedState(): AnalyzerState {
  if (typeof window === "undefined") return createEmptyAnalyzerState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyAnalyzerState();
    const parsed = JSON.parse(raw) as AnalyzerState;
    // Grundlegende Validierung: nur übernehmen, wenn Struktur passt
    if (parsed && parsed.setup && parsed.home && parsed.away) return parsed;
    return createEmptyAnalyzerState();
  } catch {
    return createEmptyAnalyzerState();
  }
}

/**
 * Zentraler Hook, der den kompletten Zustand des Analyzers verwaltet und
 * automatisch im localStorage persistiert, damit Eingaben einen
 * Seiten-Reload überstehen.
 */
export function useAnalyzerState() {
  const [state, setState] = useState<AnalyzerState>(loadPersistedState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage kann in seltenen Fällen (Private Mode, Quota) fehlschlagen –
      // die App bleibt trotzdem voll funktionsfähig, nur ohne Persistenz.
    }
  }, [state]);

  const updateSetup = useCallback((patch: Partial<GameSetup>) => {
    setState((prev) => ({ ...prev, setup: { ...prev.setup, ...patch } }));
  }, []);

  const updateTeam = useCallback((side: "home" | "away", patch: Partial<TeamAnalyzerState>) => {
    setState((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }));
  }, []);

  const updateWeather = useCallback((patch: Partial<WeatherInput>) => {
    setState((prev) => ({ ...prev, weather: { ...prev.weather, ...patch } }));
  }, []);

  const updateBallpark = useCallback((patch: Partial<BallparkInput>) => {
    setState((prev) => ({ ...prev, ballpark: { ...prev.ballpark, ...patch } }));
  }, []);

  const updateH2H = useCallback((patch: Partial<H2HInput>) => {
    setState((prev) => ({ ...prev, h2h: { ...prev.h2h, ...patch } }));
  }, []);

  const updateMarket = useCallback((patch: Partial<MarketInput>) => {
    setState((prev) => ({ ...prev, market: { ...prev.market, ...patch } }));
  }, []);

  const resetAll = useCallback(() => {
    setState(createEmptyAnalyzerState());
  }, []);

  const replaceState = useCallback((next: AnalyzerState) => {
    setState(next);
  }, []);

  return {
    state,
    updateSetup,
    updateTeam,
    updateWeather,
    updateBallpark,
    updateH2H,
    updateMarket,
    resetAll,
    replaceState,
  };
}
