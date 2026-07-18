import { mlbGetV11, safe } from "@/services/api/mlbStatsClient";
import { cached } from "@/services/cache/cache";

export interface LineupPlayer {
  id: number;
  fullName: string;
  battingOrder: number | null;
}

interface MlbGameFeedResponse {
  gameData: {
    status: { abstractGameState: string };
  };
  liveData: {
    boxscore: {
      teams: {
        home: { battingOrder?: number[]; players: Record<string, { person: { id: number; fullName: string }; battingOrder?: string }> };
        away: { battingOrder?: number[]; players: Record<string, { person: { id: number; fullName: string }; battingOrder?: string }> };
      };
    };
  };
}

/**
 * Lädt die Starting Lineups eines Spiels. Wichtiger Hinweis: die MLB Stats
 * API veröffentlicht offizielle Lineups i. d. R. erst 1–3 Stunden vor
 * Spielbeginn. Vor diesem Zeitpunkt liefert diese Funktion `null` zurück
 * (kein Platzhalter-Lineup) — die UI zeigt dann "Lineup noch nicht
 * veröffentlicht" an.
 */
export async function fetchLineups(gamePk: number): Promise<{ home: LineupPlayer[]; away: LineupPlayer[] } | null> {
  return safe(async () =>
    cached(
      `lineups:${gamePk}`,
      async () => {
        const data = await mlbGetV11<MlbGameFeedResponse>(`/game/${gamePk}/feed/live`);
        const extract = (players: Record<string, { person: { id: number; fullName: string }; battingOrder?: string }>): LineupPlayer[] =>
          Object.values(players)
            .filter((p) => p.battingOrder != null)
            .map((p) => ({ id: p.person.id, fullName: p.person.fullName, battingOrder: p.battingOrder ? Number(p.battingOrder) / 100 : null }))
            .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));

        const home = extract(data.liveData.boxscore.teams.home.players);
        const away = extract(data.liveData.boxscore.teams.away.players);
        if (home.length === 0 && away.length === 0) throw new Error("Lineup noch nicht veröffentlicht");
        return { home, away };
      },
      5 * 60 * 1000
    )
  );
}
