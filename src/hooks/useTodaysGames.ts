import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCardSummary } from "@/types";
import { fetchGamesForDate } from "@/services/api/games";
import { fetchOddsForMatchup } from "@/services/api/odds";

/**
 * Lädt den heutigen MLB-Spielplan und reichert jede Karte optional mit der
 * aktuellen Wettlinie an (sofern ein Odds-API-Key hinterlegt ist – siehe
 * services/api/odds.ts). Ohne Key bleiben Linie/Quoten leer, die Karte
 * zeigt das transparent an statt einen Wert zu erfinden.
 *
 * Verwendet ein isMounted-Ref, damit nach dem Unmount der Komponente keine
 * State-Updates mehr ausgelöst werden (verhindert React-Warnungen und
 * potenzielle Speicherlecks bei schnellem Seitenwechsel während des Ladens).
 */
export function useTodaysGames() {
  const [games, setGames] = useState<GameCardSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const schedule = await fetchGamesForDate();
      const withOdds = await Promise.all(
        schedule.map(async (g) => {
          const odds = await fetchOddsForMatchup(g.homeTeamName, g.awayTeamName);
          const best = odds?.[0] ?? null;
          const summary: GameCardSummary = {
            gamePk: g.gamePk,
            gameDate: g.gameDate,
            status: g.status,
            homeTeamId: g.homeTeamId,
            homeTeamName: g.homeTeamName,
            awayTeamId: g.awayTeamId,
            awayTeamName: g.awayTeamName,
            homeProbablePitcherId: g.homeProbablePitcherId,
            homeProbablePitcherName: g.homeProbablePitcherName,
            awayProbablePitcherId: g.awayProbablePitcherId,
            awayProbablePitcherName: g.awayProbablePitcherName,
            venueName: g.venueName,
            line: best?.line ?? null,
            oddsOver: best?.oddsOver ?? null,
            oddsUnder: best?.oddsUnder ?? null,
          };
          return summary;
        })
      );
      if (isMountedRef.current) setGames(withOdds);
    } catch (e) {
      if (isMountedRef.current) setError(e instanceof Error ? e.message : "Spielplan konnte nicht geladen werden.");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { games, isLoading, error, reload: load };
}
