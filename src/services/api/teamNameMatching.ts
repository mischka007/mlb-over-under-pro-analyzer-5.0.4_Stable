/**
 * Version 6.0 — Odds API Match Fix.
 *
 * Ursache des bisherigen Fehlers: `fetchOddsForMatchup()` verglich Team-
 * namen bislang per `e.home_team.toLowerCase().includes(homeTeamName.toLowerCase())`.
 * Das funktioniert nur, wenn unser (von der MLB Stats API stammender,
 * immer vollständiger) Name als exakter Teilstring im Namen von The Odds
 * API vorkommt. Nennt The Odds API dieselbe Stadt anders (z. B. "LA
 * Dodgers" statt "Los Angeles Dodgers", oder ein Team ganz ohne Stadt
 * wie inzwischen bei den Athletics üblich), schlägt der Vergleich
 * zwangsläufig fehl — unabhängig vom eigentlichen Team.
 *
 * Diese Datei normalisiert beide Seiten auf den reinen Team-Namen ohne
 * Stadt/Region und vergleicht ausschließlich diesen. Die 30 MLB-Team-
 * Nicknames sind eine stabile, öffentlich bekannte Fakten-Tabelle (wie
 * bereits die bestehende `ballpark.ts`-Referenztabelle im Projekt) —
 * keine spielspezifischen Hardcodes.
 */

/**
 * Die eigentlichen Team-Namen (ohne Stadt/Region) aller 30 aktuellen
 * MLB-Franchises, in Kleinbuchstaben. Deckt sowohl Ein- als auch
 * Zwei-Wort-Nicknames korrekt ab (z. B. "red sox", "blue jays") — ein
 * rein algorithmisches "letztes Wort abschneiden" würde bei diesen
 * Teams falsche Ergebnisse liefern.
 */
const MLB_TEAM_NICKNAMES: readonly string[] = [
  "diamondbacks",
  "braves",
  "orioles",
  "red sox",
  "cubs",
  "white sox",
  "reds",
  "guardians",
  "rockies",
  "tigers",
  "astros",
  "royals",
  "angels",
  "dodgers",
  "marlins",
  "brewers",
  "twins",
  "mets",
  "yankees",
  "athletics",
  "phillies",
  "pirates",
  "padres",
  "giants",
  "mariners",
  "cardinals",
  "rays",
  "rangers",
  "blue jays",
  "nationals",
]
  // Längere (Zwei-Wort-)Nicknames zuerst prüfen, damit z. B. "red sox"
  // sicher erkannt wird, bevor ein kürzeres, zufällig enthaltenes Wort
  // fälschlich träfe.
  .sort((a, b) => b.length - a.length);

/**
 * Normalisiert einen Team-Namen für den Vergleich (Schritt 2):
 * Groß-/Kleinschreibung, Punkte, Bindestriche und doppelte Leerzeichen
 * werden ignoriert; anschließend wird — sofern erkennbar — ausschließlich
 * der eigentliche Team-Name (ohne Stadt/Region) zurückgegeben.
 *
 * Beispiele: "LA Dodgers" / "Los Angeles Dodgers" / "L.A. Dodgers" → "dodgers".
 * "NY Yankees" / "New York Yankees" → "yankees".
 * "Boston Red Sox" → "red sox".
 */
export function normalizeTeamName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const nickname of MLB_TEAM_NICKNAMES) {
    if (cleaned === nickname || cleaned.endsWith(` ${nickname}`) || cleaned.startsWith(`${nickname} `)) {
      return nickname;
    }
  }

  // Fallback für unbekannte/zukünftige Schreibweisen: gibt den bereits
  // normalisierten Volltext zurück, statt zu scheitern — die
  // nachgelagerte Matching-Funktion vergleicht dann weiterhin robust
  // per Teilstring.
  return cleaned;
}

/**
 * Robuste Matching-Funktion (Schritt 3): vergleicht zwei Team-Namen
 * unabhängig von Stadt-Schreibweise, Groß-/Kleinschreibung, Punkten und
 * Bindestrichen. Keine Fuzzy-Library — ausschließlich Normalisierung +
 * Teilstring-Vergleich auf den bereits auf den Team-Namen reduzierten
 * Strings.
 */
export function teamNamesMatch(nameA: string, nameB: string): boolean {
  const normalizedA = normalizeTeamName(nameA);
  const normalizedB = normalizeTeamName(nameB);

  if (normalizedA === normalizedB) return true;

  // Deckt den Fallback-Fall ab (kein bekannter Nickname erkannt): dann
  // sind die normalisierten Strings noch vollständige, aber bereinigte
  // Namen — ein Teilstring-Vergleich bleibt in diesem Fall sinnvoll.
  return normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA);
}
