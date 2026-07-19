import {
  fetchGamesForDate,
} from "@/services/api/games";

import {
  fetchHistoricalMarketSnapshot,
} from "@/services/api/historicalMarket";

import {
  createHistoricalMarketGameDiagnostic,
  logHistoricalMarketGameDiagnostic,
} from "./historicalMarketDiagnostics";

/**
 * Erstellt ein lokales Datum aus
 * YYYY-MM-DD.
 */
function parseLocalDate(
  value: string
): Date {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value
    );

  if (
    !match
  ) {
    throw new Error(
      `Ungültiges Datum "${value}". Erwartet wird YYYY-MM-DD.`
    );
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0,
      0
    );

  if (
    date.getFullYear() !==
      year ||
    date.getMonth() !==
      month - 1 ||
    date.getDate() !==
      day
  ) {
    throw new Error(
      `Ungültiges Kalenderdatum "${value}".`
    );
  }

  return date;
}

/**
 * Normalisiert einen Teamnamen
 * für die Spielsuche.
 */
function normalizeTeamName(
  value: string
): string {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );
}

/**
 * Prüft, ob zwei Teamnamen
 * zusammenpassen.
 */
function teamMatches(
  actual: string,
  requested: string
): boolean {
  const normalizedActual =
    normalizeTeamName(
      actual
    );

  const normalizedRequested =
    normalizeTeamName(
      requested
    );

  return (
    normalizedActual ===
      normalizedRequested ||
    normalizedActual.includes(
      normalizedRequested
    ) ||
    normalizedRequested.includes(
      normalizedActual
    )
  );
}

/**
 * Optionen für den kontrollierten
 * historischen Market-Einzeltest.
 */
export interface HistoricalMarketTestOptions {
  /**
   * MLB-Spieltag im Format
   * YYYY-MM-DD.
   */
  date:
    string;

  /**
   * Optional:
   * bestimmtes Home-Team.
   */
  homeTeam?:
    string;

  /**
   * Optional:
   * bestimmtes Away-Team.
   */
  awayTeam?:
    string;

  /**
   * Anzahl Minuten vor Spielbeginn,
   * für die der historische Snapshot
   * angefragt werden soll.
   *
   * Standard: 60 Minuten.
   */
  leadMinutes?:
    number;
}

/**
 * Kontrollierter Einzeltest für
 * historische MLB-Totals.
 *
 * WICHTIG:
 *
 * Diese Funktion löst genau EINEN
 * historischen Odds-Snapshot-Request
 * aus.
 *
 * Sie ist deshalb bewusst vollständig
 * vom normalen Backtest getrennt.
 *
 * Dadurch verhindern wir, dass ein
 * normaler Backtest versehentlich
 * viele kostenpflichtige historische
 * API-Abfragen startet.
 */
export async function runHistoricalMarketTest(
  options:
    HistoricalMarketTestOptions
): Promise<void> {
  const date =
    parseLocalDate(
      options.date
    );

  const leadMinutes =
    Math.max(
      1,
      Math.floor(
        options.leadMinutes ??
          60
      )
    );

  console.log(
    "========================================"
  );

  console.log(
    "MLB HISTORICAL MARKET SINGLE TEST"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Datum:",
    options.date
  );

  console.log(
    "Lead Minutes:",
    leadMinutes
  );

  console.log(
    "Kostenhinweis: Dieser Test kann historische Odds-API-Credits verbrauchen."
  );

  /**
   * Zuerst laden wir ausschließlich
   * den MLB-Spielplan des gewünschten
   * Tages.
   *
   * Dieser Request verwendet die
   * kostenlose MLB Stats API.
   */
  const games =
    await fetchGamesForDate(
      date
    );

  if (
    games.length ===
    0
  ) {
    throw new Error(
      `Keine MLB-Spiele für ${options.date} gefunden.`
    );
  }

  /**
   * Wenn Home- und Away-Team angegeben
   * wurden, suchen wir genau dieses
   * Matchup.
   *
   * Ohne Teamangaben verwenden wir
   * bevorzugt das erste abgeschlossene
   * Spiel des Tages.
   */
  const game =
    options.homeTeam &&
    options.awayTeam
      ? (
          games.find(
            (
              candidate
            ) =>
              teamMatches(
                candidate.homeTeamName,
                options.homeTeam!
              ) &&
              teamMatches(
                candidate.awayTeamName,
                options.awayTeam!
              )
          ) ??
          null
        )
      : (
          games.find(
            (
              candidate
            ) =>
              candidate.status ===
              "Final"
          ) ??
          games[0] ??
          null
        );

  if (
    !game
  ) {
    /**
     * Falls ein bestimmtes Matchup
     * nicht gefunden wurde, zeigen wir
     * die verfügbaren Spiele an.
     */
    console.table(
      games.map(
        (
          candidate
        ) => ({
          gamePk:
            candidate.gamePk,

          matchup:
            `${candidate.awayTeamName} @ ${candidate.homeTeamName}`,

          gameDate:
            candidate.gameDate,

          status:
            candidate.status,
        })
      )
    );

    throw new Error(
      `Kein passendes Spiel gefunden. Prüfe die Teamnamen für ${options.date}.`
    );
  }

  const gameStart =
    new Date(
      game.gameDate
    );

  if (
    Number.isNaN(
      gameStart.getTime()
    )
  ) {
    throw new Error(
      `Ungültiger Spielzeitpunkt für gamePk ${game.gamePk}.`
    );
  }

  console.log(
    "Ausgewähltes Spiel:",
    `${game.awayTeamName} @ ${game.homeTeamName}`
  );

  console.log(
    "gamePk:",
    game.gamePk
  );

  console.log(
    "Spielbeginn:",
    game.gameDate
  );

  console.log(
    "Historischer Odds-Snapshot wird jetzt einmalig geladen ..."
  );

  /**
   * Genau hier findet der eine
   * historische Odds-Request statt.
   */
  const market =
    await fetchHistoricalMarketSnapshot(
      game.homeTeamName,
      game.awayTeamName,
      gameStart,
      leadMinutes
    );

  /**
   * Point-in-Time-Diagnose erzeugen.
   */
  const diagnostic =
    createHistoricalMarketGameDiagnostic(
      game.gamePk,
      game.homeTeamName,
      game.awayTeamName,
      market
    );

  /**
   * Diagnose vollständig ausgeben.
   */
  logHistoricalMarketGameDiagnostic(
    diagnostic
  );

  console.log(
    "Vollständiger Historical Market Snapshot:"
  );

  console.log(
    market
  );

  /**
   * Abschließende Bewertung.
   *
   * ACTIVE:
   * Echte historische Marktdaten
   * wurden erfolgreich geladen.
   *
   * NO_DATA:
   * Die Datenquelle war grundsätzlich
   * erreichbar, aber für diesen
   * Snapshot waren keine verwendbaren
   * Marktdaten vorhanden.
   *
   * ACCESS_UNAVAILABLE:
   * Die Historical-Odds-Funktion ist
   * mit dem aktuellen API-Zugang bzw.
   * Tarif nicht verfügbar.
   *
   * Das ist kein Fehler unserer
   * Point-in-Time-Architektur.
   *
   * INVALID oder eine erkannte
   * Look-Ahead-Verletzung:
   * Echter Testfehler.
   */
  if (
    market.status ===
      "ACTIVE" &&
    !diagnostic.lookAheadViolation
  ) {
    console.log(
      "✅ HISTORICAL MARKET SINGLE TEST: PASS – echte historische Marktdaten wurden erfolgreich geladen und der Point-in-Time-Schutz wurde eingehalten."
    );
  } else if (
    market.status ===
    "NO_DATA"
  ) {
    console.warn(
      "⚠️ HISTORICAL MARKET SINGLE TEST: NO_DATA – Architektur funktioniert, aber für diesen Snapshot wurden keine verwendbaren historischen Marktdaten geliefert."
    );
  } else if (
    market.status ===
    "ACCESS_UNAVAILABLE"
  ) {
    console.warn(
      "⚠️ HISTORICAL MARKET SINGLE TEST: ACCESS_UNAVAILABLE – Der Test wurde durch die externe API-Zugriffs- bzw. Tarifbeschränkung blockiert. Dies ist kein Fehler der Historical-Market-Architektur."
    );
  } else {
    console.error(
      "❌ HISTORICAL MARKET SINGLE TEST: FAIL – Es wurde ein technischer, zeitlicher oder Point-in-Time-Integritätsfehler erkannt."
    );
  }

  /**
   * Testergebnis zusätzlich global
   * verfügbar machen.
   *
   * Dadurch kann das Ergebnis später
   * in der Browser-Konsole genauer
   * untersucht werden:
   *
   * __MLB_HISTORICAL_MARKET_TEST__
   */
  (
    window as Window & {
      __MLB_HISTORICAL_MARKET_TEST__?: {
        game:
          typeof game;

        market:
          typeof market;

        diagnostic:
          typeof diagnostic;
      };
    }
  ).__MLB_HISTORICAL_MARKET_TEST__ =
    {
      game,

      market,

      diagnostic,
    };
}