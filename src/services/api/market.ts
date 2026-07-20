import type { MarketIntelligenceResult } from "@/types";
import { fetchOddsForMatchup, recordAndGetOpeningLine, recordLineSnapshot } from "@/services/api/odds";
import { computeMarketIntelligence } from "@/engine/marketIntelligenceEngine";

export interface MarketSnapshot {
  openingLine: number | null;
  currentLine: number | null;
  bestOddsOver: number | null;
  bestOddsUnder: number | null;
  bookmakerCount: number;
  /** Erfordert eine kostenpflichtige Datenquelle für Einsatzverteilung — nicht verfügbar */
  publicOverPct: null;
  sharpOverPct: null;
  /**
   * Version 6.0 (Paket 4): vollständiges Market-Intelligence-Ergebnis
   * (Line Movement, Sharp/Reverse/Steam-Heuristiken, Marktkonsens/
   * -volatilität, CLV, Market Score). `null`, wenn keine Odds verfügbar
   * sind. CLV bleibt an dieser Stelle "unbekannt" (kein Pick bekannt —
   * die Modell-Prognose läuft erst NACH dem Laden dieser Markt-Daten);
   * für eine echte CLV-Berechnung siehe `computeMarketIntelligence()`
   * direkt mit einem bekannten `pickDirection`, z. B. beim Speichern in
   * der Historie.
   */
  marketIntelligence: MarketIntelligenceResult | null;
}

/**
 * Baut eine Markt-Momentaufnahme aus den (falls vorhanden) live geladenen
 * Quoten. Die "Opening Line" wird beim ersten Abruf eines Matchups lokal
 * gespeichert (siehe odds.ts) und bei jedem weiteren Abruf desselben Spiels
 * wiederverwendet — so entsteht eine echte, selbst beobachtete Linien-
 * historie, ohne Werte zu erfinden. Public-%/Sharp-% erfordern kommerzielle
 * Datenfeeds (z. B. Action Network) und bleiben bewusst leer.
 *
 * Version 6.0 (Paket 4): zusätzlich wird bei jedem Abruf ein echter,
 * zeitgestempelter Linien-Snapshot dauerhaft gespeichert
 * (`recordLineSnapshot`) und daraus die vollständige Market Intelligence
 * berechnet (`computeMarketIntelligence`).
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
    marketIntelligence: null,
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

  // Version 6.0 (Paket 4): echten, zeitgestempelten Snapshot dauerhaft
  // anhängen (Basis für Bewegungsgeschwindigkeit/Steam-Move-Erkennung),
  // dann die vollständige Market Intelligence aus der aktualisierten
  // Historie und den aktuell gleichzeitig abgefragten Buchmachern
  // berechnen.
  const history = recordLineSnapshot(matchupKey, {
    timestamp: Date.now(),
    line: currentLine,
    oddsOver: odds[0].oddsOver,
    oddsUnder: odds[0].oddsUnder,
    bookmakerCount: odds.length,
  });

  const marketIntelligence = computeMarketIntelligence({
    currentSnapshots: odds,
    history,
    openingLine,
  });

  return {
    openingLine,
    currentLine,
    bestOddsOver,
    bestOddsUnder,
    bookmakerCount: odds.length,
    publicOverPct: null,
    sharpOverPct: null,
    marketIntelligence,
  };
}
