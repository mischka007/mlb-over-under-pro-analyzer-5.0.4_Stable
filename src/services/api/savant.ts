import { cached } from "@/services/cache/cache";

/**
 * Baseball Savant (Statcast) als zweite Datenquelle für Metriken, die die
 * MLB Stats API nicht liefert (xERA, Hard-Hit %, Barrel %).
 *
 * WICHTIG zur Zuverlässigkeit: Baseball Savant bietet keine offiziell
 * dokumentierte, stabile REST-API. Es gibt aber einen seit Jahren von der
 * Sabermetrics-Community genutzten CSV-Export-Endpunkt
 * (baseballsavant.mlb.com/leaderboard/expected_statistics), den auch
 * zahlreiche Open-Source-Projekte clientseitig nutzen. Da dieses Projekt
 * ohne Netzwerkzugriff entwickelt wurde, konnte der exakte Spalten-Name
 * nicht live verifiziert werden — die Parsing-Funktion ist defensiv
 * geschrieben und liefert bei jedem Format-Problem `null` zurück, statt
 * einen falschen Wert zu erfinden.
 */
export interface SavantPitcherMetrics {
  xera: number | null;
  hardHitPct: number | null;
  barrelPct: number | null;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i]?.trim() ?? ""));
    return row;
  });
}

export async function fetchSavantPitcherMetrics(playerFullName: string, season: number = new Date().getFullYear()): Promise<SavantPitcherMetrics | null> {
  return cached(
    `savant-pitcher:${playerFullName.toLowerCase()}:${season}`,
    async () => {
      const url = `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=pitcher&year=${season}&position=&team=&min=q&csv=true`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Baseball Savant antwortete mit Status ${response.status}`);
      const csv = await response.text();
      const rows = parseCsv(csv);

      const row = rows.find((r) => {
        const name = r["player_name"] ?? r["name"] ?? "";
        return name.toLowerCase().includes(playerFullName.toLowerCase());
      });
      if (!row) throw new Error(`Kein Savant-Eintrag für ${playerFullName} gefunden`);

      const xera = row["xera"] ? Number(row["xera"]) : null;
      const hardHitPct = row["hard_hit_percent"] ? Number(row["hard_hit_percent"]) : null;
      const barrelPct = row["barrel_batted_rate"] ? Number(row["barrel_batted_rate"]) : null;

      return {
        xera: Number.isFinite(xera) ? xera : null,
        hardHitPct: Number.isFinite(hardHitPct) ? hardHitPct : null,
        barrelPct: Number.isFinite(barrelPct) ? barrelPct : null,
      } satisfies SavantPitcherMetrics;
    },
    60 * 60 * 1000 // Savant-Leaderboards ändern sich langsam, 1h Cache
  ).catch(() => null);
}
