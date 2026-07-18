import { fetchOddsForMatchup } from "@/services/api/odds";
import { recordAndGetOpeningLine } from "@/services/api/odds";

export interface MarketSnapshot {
  openingLine: number | null;
  currentLine: number | null;
  bestOddsOver: number | null;
  bestOddsUnder: number | null;
  bookmakerCount: number;
  /** Erfordert eine kostenpflichtige Datenquelle für Einsatzverteilung — nicht verfügbar */
  publicOverPct: null;
  sharpOverPct: null;
}

/**
 * Baut eine Markt-Momentaufnahme aus den (falls vorhanden) live geladenen
 * Quoten. Die "Opening Line" wird beim ersten Abruf eines Matchups lokal
 * gespeichert (siehe odds.ts) und bei jedem weiteren Abruf desselben Spiels
 * wiederverwendet — so entsteht eine echte, selbst beobachtete Linien-
 * historie, ohne Werte zu erfinden. Public-%/Sharp-% erfordern kommerzielle
 * Datenfeeds (z. B. Action Network) und bleiben bewusst leer.
 */
export async function fetchMarketSnapshot(homeTeamName: string, awayTeamName: string): Promise<MarketSnapshot | null> {
  const odds = await fetchOddsForMatchup(homeTeamName, awayTeamName);
  if (!odds || odds.length === 0) {
    return { openingLine: null, currentLine: null, bestOddsOver: null, bestOddsUnder: null, bookmakerCount: 0, publicOverPct: null, sharpOverPct: null };
  }

  const currentLine = odds[0].line;
  const matchupKey = `${homeTeamName.toLowerCase()}-${awayTeamName.toLowerCase()}`;
  const openingLine = recordAndGetOpeningLine(matchupKey, currentLine);

  const bestOddsOver = Math.max(...odds.map((o) => o.oddsOver));
  const bestOddsUnder = Math.max(...odds.map((o) => o.oddsUnder));

  return {
    openingLine,
    currentLine,
    bestOddsOver,
    bestOddsUnder,
    bookmakerCount: odds.length,
    publicOverPct: null,
    sharpOverPct: null,
  };
}
