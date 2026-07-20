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
  const emptySnapshot: MarketSnapshot = {
    openingLine: null,
    currentLine: null,
    bestOddsOver: null,
    bestOddsUnder: null,
    bookmakerCount: 0,
    publicOverPct: null,
    sharpOverPct: null,
  };

  // `fetchOddsForMatchup()` wirft bewusst, wenn kein passendes Spiel bei
  // The Odds API gefunden wird (z. B. noch nicht gelistet, verschoben).
  // Das darf den Ladevorgang des restlichen Spiels nicht abbrechen —
  // wird identisch zum "keine Quote verfügbar"-Fall (kein API-Key)
  // behandelt: leere, transparente Markt-Momentaufnahme statt Absturz.
  let odds: Awaited<ReturnType<typeof fetchOddsForMatchup>> = null;
  try {
    odds = await fetchOddsForMatchup(homeTeamName, awayTeamName);
  } catch (oddsError) {
    console.debug(
      `[Market] Keine Odds für "${awayTeamName}" @ "${homeTeamName}" — Markt-Daten bleiben leer.`,
      oddsError instanceof Error ? oddsError.message : oddsError
    );
    return emptySnapshot;
  }

  if (!odds || odds.length === 0) {
    return emptySnapshot;
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
