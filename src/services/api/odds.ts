import { cached } from "@/services/cache/cache";
import { getOddsApiKey } from "@/services/api/apiKeys";

/**
 * Quoten-Anbindung über The Odds API (https://the-odds-api.com), die einen
 * kostenlosen Free-Tier (500 Requests/Monat) anbietet.
 *
 * Key in .env eintragen:
 *   VITE_ODDS_API_KEY=dein_key
 *
 * Ohne Key liefert diese Funktion `null` — Quoten/Bookmaker-Felder bleiben
 * dann manuell editierbar, es werden keine Werte erfunden.
 */
export interface OddsSnapshot {
  bookmaker: string;
  line: number;
  oddsOver: number;
  oddsUnder: number;
  lastUpdate: string;
}

interface OddsApiEvent {
  home_team: string;
  away_team: string;
  bookmakers: {
    title: string;
    last_update: string;
    markets: { key: string; outcomes: { name: string; point?: number; price: number }[] }[];
  }[];
}

export async function fetchOddsForMatchup(homeTeamName: string, awayTeamName: string): Promise<OddsSnapshot[] | null> {
  const API_KEY = getOddsApiKey();
  if (!API_KEY) return null;

  return cached(
    `odds:${homeTeamName.toLowerCase()}:${awayTeamName.toLowerCase()}`,
    async () => {
      const url = new URL("https://api.the-odds-api.com/v4/sports/baseball_mlb/odds");
      url.searchParams.set("apiKey", API_KEY);
      url.searchParams.set("regions", "eu,us");
      url.searchParams.set("markets", "totals");
      url.searchParams.set("oddsFormat", "decimal");

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`The Odds API antwortete mit Status ${response.status}`);
      const events = (await response.json()) as OddsApiEvent[];

      const match = events.find(
        (e) =>
          e.home_team.toLowerCase().includes(homeTeamName.toLowerCase()) &&
          e.away_team.toLowerCase().includes(awayTeamName.toLowerCase())
      );
      if (!match) throw new Error("Kein passendes Spiel bei The Odds API gefunden");

      const snapshots: OddsSnapshot[] = [];
      match.bookmakers.forEach((bm) => {
        const totals = bm.markets.find((m) => m.key === "totals");
        const over = totals?.outcomes.find((o) => o.name === "Over");
        const under = totals?.outcomes.find((o) => o.name === "Under");
        if (over && under && over.point != null) {
          snapshots.push({ bookmaker: bm.title, line: over.point, oddsOver: over.price, oddsUnder: under.price, lastUpdate: bm.last_update });
        }
      });
      return snapshots;
    },
    5 * 60 * 1000 // Quoten nur 5 Min. cachen, da sich Linien schneller bewegen
  );
}

/**
 * Speichert für ein Spiel die erste beobachtete Linie als "Opening Line"
 * dauerhaft (nicht TTL-begrenzt) im localStorage. So entsteht über die Zeit
 * eine echte, selbst beobachtete Linienhistorie, ohne Daten zu erfinden.
 */
const OPENING_LINE_PREFIX = "mlb-analyzer-opening-line:";

export function recordAndGetOpeningLine(matchupKey: string, currentLine: number): number {
  try {
    const existing = window.localStorage.getItem(OPENING_LINE_PREFIX + matchupKey);
    if (existing) return Number(existing);
    window.localStorage.setItem(OPENING_LINE_PREFIX + matchupKey, String(currentLine));
    return currentLine;
  } catch {
    return currentLine;
  }
}
