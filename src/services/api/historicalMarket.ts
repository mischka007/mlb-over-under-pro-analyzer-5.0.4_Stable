import {
  createHistoricalOddsRequestedAt,
  fetchHistoricalOddsSnapshot,
  findHistoricalOddsEvent,
} from "@/services/api/historicalOdds";

import type {
  HistoricalOddsEvent,
  HistoricalOddsSnapshot,
} from "@/services/api/historicalOdds";

/**
 * Status eines historischen
 * Market-Kontexts.
 *
 * ACTIVE:
 * Echte historische Marktdaten
 * wurden erfolgreich geladen.
 *
 * NO_DATA:
 * Historical-Zugriff ist grundsätzlich
 * möglich, aber für den konkreten
 * Snapshot / das konkrete Spiel sind
 * keine verwendbaren Daten vorhanden.
 *
 * ACCESS_UNAVAILABLE:
 * Die historische Datenquelle ist
 * grundsätzlich nicht verfügbar.
 *
 * Beispiel:
 *
 * - aktueller API-Tarif unterstützt
 *   keine Historical Odds
 *
 * Dieser Status ist ausdrücklich
 * KEIN Datenintegritätsfehler.
 *
 * INVALID:
 * Technischer oder zeitlicher
 * Datenintegritätsfehler.
 */
export type HistoricalMarketStatus =
  | "ACTIVE"
  | "NO_DATA"
  | "ACCESS_UNAVAILABLE"
  | "INVALID";

/**
 * Historische Markt-Momentaufnahme
 * eines einzelnen MLB-Spiels.
 */
export interface HistoricalMarketSnapshot {
  status:
    HistoricalMarketStatus;

  /**
   * Zeitpunkt des Spiels.
   */
  gameStart:
    string;

  /**
   * Von uns gewünschter Snapshot-
   * Zeitpunkt.
   */
  requestedAt:
    string;

  /**
   * Tatsächlicher Snapshot-Zeitpunkt
   * der historischen Odds API.
   */
  snapshotTimestamp:
    string |
    null;

  /**
   * Gematchtes Odds-API-Event.
   */
  eventId:
    string |
    null;

  /**
   * Konsens-/Referenzlinie.
   */
  currentLine:
    number |
    null;

  /**
   * Beste verfügbare Over-Quote
   * auf der ausgewählten Linie.
   */
  bestOddsOver:
    number |
    null;

  /**
   * Beste verfügbare Under-Quote
   * auf der ausgewählten Linie.
   */
  bestOddsUnder:
    number |
    null;

  /**
   * Anzahl verwendbarer Bookmaker.
   */
  bookmakerCount:
    number;

  /**
   * Früheste verwendete
   * Bookmaker-Aktualisierung.
   */
  earliestBookmakerUpdate:
    string |
    null;

  /**
   * Späteste verwendete
   * Bookmaker-Aktualisierung.
   */
  latestBookmakerUpdate:
    string |
    null;

  /**
   * Erklärung für:
   *
   * NO_DATA
   * ACCESS_UNAVAILABLE
   * INVALID
   */
  reason:
    string |
    null;

  /**
   * Rohdaten der tatsächlich
   * verwendbaren Bookmaker.
   */
  bookmakerSnapshots:
    HistoricalOddsSnapshot[];
}

/**
 * Bekannte Fehlermeldungen,
 * die bedeuten, dass Historical Odds
 * mit dem aktuellen API-Zugang
 * nicht verfügbar sind.
 *
 * Wir prüfen bewusst mehrere
 * stabile Textbestandteile.
 *
 * Dadurch funktioniert die Erkennung
 * auch dann, wenn die API zusätzlich
 * Usage-Informationen oder einen Link
 * an die Fehlermeldung anhängt.
 */
const HISTORICAL_ACCESS_UNAVAILABLE_MARKERS =
  [
    "historical-unavailable-on-free-usage-plan",
    "historical odds are only available",
    "historical odds unavailable",
  ];

/**
 * Prüft, ob ein API-Fehler eindeutig
 * auf fehlenden Historical-Zugriff
 * zurückzuführen ist.
 */
function isHistoricalAccessUnavailableError(
  error:
    unknown
): boolean {
  const message =
    error instanceof
      Error
      ? error.message
      : String(
          error
        );

  const normalizedMessage =
    message.toLowerCase();

  return (
    HISTORICAL_ACCESS_UNAVAILABLE_MARKERS.some(
      (
        marker
      ) =>
        normalizedMessage.includes(
          marker
        )
    )
  );
}

/**
 * Leeres Market-Ergebnis.
 */
function createEmptyHistoricalMarketSnapshot(
  status:
    HistoricalMarketStatus,
  gameStart:
    Date,
  requestedAt:
    Date,
  reason:
    string
): HistoricalMarketSnapshot {
  return {
    status,

    gameStart:
      gameStart.toISOString(),

    requestedAt:
      requestedAt.toISOString(),

    snapshotTimestamp:
      null,

    eventId:
      null,

    currentLine:
      null,

    bestOddsOver:
      null,

    bestOddsUnder:
      null,

    bookmakerCount:
      0,

    earliestBookmakerUpdate:
      null,

    latestBookmakerUpdate:
      null,

    reason,

    bookmakerSnapshots:
      [],
  };
}

/**
 * Ermittelt die am häufigsten
 * angebotene Total Line.
 *
 * Bei Gleichstand wird die Linie
 * bevorzugt, die numerisch näher
 * am Durchschnitt aller angebotenen
 * Linien liegt.
 */
function selectConsensusLine(
  snapshots:
    HistoricalOddsSnapshot[]
): number | null {
  if (
    snapshots.length ===
    0
  ) {
    return null;
  }

  const counts =
    new Map<
      number,
      number
    >();

  let sum =
    0;

  for (
    const snapshot of
      snapshots
  ) {
    counts.set(
      snapshot.line,
      (
        counts.get(
          snapshot.line
        ) ??
        0
      ) +
        1
    );

    sum +=
      snapshot.line;
  }

  const average =
    sum /
    snapshots.length;

  return (
    Array.from(
      counts.entries()
    )
      .sort(
        (
          first,
          second
        ) => {
          if (
            first[1] !==
            second[1]
          ) {
            return (
              second[1] -
              first[1]
            );
          }

          return (
            Math.abs(
              first[0] -
                average
            ) -
            Math.abs(
              second[0] -
                average
            )
          );
        }
      )[0]?.[0] ??
    null
  );
}

/**
 * Extrahiert alle vollständigen
 * Totals-Datensätze eines Events.
 */
function flattenEventTotals(
  event:
    HistoricalOddsEvent
): HistoricalOddsSnapshot[] {
  const snapshots:
    HistoricalOddsSnapshot[] =
    [];

  for (
    const bookmaker of
      event.bookmakers
  ) {
    for (
      const total of
        bookmaker.totals
    ) {
      snapshots.push({
        bookmaker:
          bookmaker.title,

        line:
          total.line,

        oddsOver:
          total.oddsOver,

        oddsUnder:
          total.oddsUnder,

        lastUpdate:
          bookmaker.lastUpdate,
      });
    }
  }

  return snapshots;
}

/**
 * Prüft, ob ein ISO-Zeitpunkt
 * vor Spielbeginn liegt.
 */
function isStrictlyBeforeGameStart(
  value:
    string,
  gameStart:
    Date
): boolean {
  const timestamp =
    new Date(
      value
    ).getTime();

  return (
    !Number.isNaN(
      timestamp
    ) &&
    timestamp <
      gameStart.getTime()
  );
}

/**
 * Lädt einen historischen
 * Market-Snapshot für ein MLB-Spiel.
 *
 * Standard:
 * 60 Minuten vor Spielbeginn.
 *
 * WICHTIG:
 *
 * Diese Funktion kann einen
 * kostenpflichtigen historischen
 * Odds-API-Request auslösen.
 */
export async function fetchHistoricalMarketSnapshot(
  homeTeamName:
    string,
  awayTeamName:
    string,
  gameStart:
    Date,
  leadMinutes =
    60
): Promise<HistoricalMarketSnapshot> {
  if (
    Number.isNaN(
      gameStart.getTime()
    )
  ) {
    const fallbackDate =
      new Date(
        0
      );

    return createEmptyHistoricalMarketSnapshot(
      "INVALID",
      fallbackDate,
      fallbackDate,
      "Ungültiger Spielbeginn."
    );
  }

  const requestedAt =
    createHistoricalOddsRequestedAt(
      gameStart,
      leadMinutes
    );

  /**
   * Point-in-Time-Grundregel.
   */
  if (
    requestedAt.getTime() >=
    gameStart.getTime()
  ) {
    return createEmptyHistoricalMarketSnapshot(
      "INVALID",
      gameStart,
      requestedAt,
      "Der angeforderte Snapshot liegt nicht vor Spielbeginn."
    );
  }

  let response;

  try {
    response =
      await fetchHistoricalOddsSnapshot(
        requestedAt
      );
  } catch (
    error
  ) {
    /**
     * Fehlender Historical-Zugriff
     * wird ausdrücklich von normalem
     * NO_DATA getrennt.
     *
     * Beispiel:
     *
     * Historical odds are only available
     * on paid usage plans.
     */
    if (
      isHistoricalAccessUnavailableError(
        error
      )
    ) {
      return createEmptyHistoricalMarketSnapshot(
        "ACCESS_UNAVAILABLE",
        gameStart,
        requestedAt,
        "Historical Odds sind mit dem aktuellen API-Zugang nicht verfügbar."
      );
    }

    /**
     * Andere API-/Netzwerkfehler bleiben
     * NO_DATA.
     *
     * Dadurch erfinden wir keine
     * Marktdaten und der restliche
     * Backtest kann kontrolliert
     * weiterlaufen.
     */
    return createEmptyHistoricalMarketSnapshot(
      "NO_DATA",
      gameStart,
      requestedAt,
      error instanceof Error
        ? error.message
        : "Historische Odds konnten nicht geladen werden."
    );
  }

  if (
    !response
  ) {
    return createEmptyHistoricalMarketSnapshot(
      "NO_DATA",
      gameStart,
      requestedAt,
      "Kein historischer Odds-Snapshot verfügbar."
    );
  }

  const snapshotTimestamp =
    new Date(
      response.timestamp
    );

  if (
    Number.isNaN(
      snapshotTimestamp.getTime()
    )
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "INVALID",
        gameStart,
        requestedAt,
        "Historischer Snapshot besitzt einen ungültigen Zeitstempel."
      ),

      snapshotTimestamp:
        response.timestamp,
    };
  }

  /**
   * Zusätzlicher Point-in-Time-Schutz:
   *
   * Der tatsächliche API-Snapshot
   * darf niemals NACH unserem
   * angeforderten Zeitpunkt liegen.
   *
   * Beispiel:
   *
   * requestedAt:
   * 18:07
   *
   * erlaubt:
   * 18:07 oder früher
   *
   * nicht erlaubt:
   * 18:08 oder später
   *
   * Dadurch verhindern wir
   * Look-Ahead-Bias.
   */
  if (
    snapshotTimestamp.getTime() >
    requestedAt.getTime()
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "INVALID",
        gameStart,
        requestedAt,
        "Der tatsächliche historische Snapshot liegt nach dem angeforderten Point-in-Time-Zeitpunkt."
      ),

      snapshotTimestamp:
        response.timestamp,
    };
  }

  /**
   * Der tatsächlich zurückgegebene
   * Snapshot muss zusätzlich vor
   * Spielbeginn liegen.
   */
  if (
    snapshotTimestamp.getTime() >=
    gameStart.getTime()
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "INVALID",
        gameStart,
        requestedAt,
        "Der tatsächliche historische Snapshot liegt nicht vor Spielbeginn."
      ),

      snapshotTimestamp:
        response.timestamp,
    };
  }

  const event =
    findHistoricalOddsEvent(
      response,
      homeTeamName,
      awayTeamName
    );

  if (
    !event
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "NO_DATA",
        gameStart,
        requestedAt,
        "Kein passendes MLB-Event im historischen Odds-Snapshot gefunden."
      ),

      snapshotTimestamp:
        response.timestamp,
    };
  }

  const allSnapshots =
    flattenEventTotals(
      event
    );

  /**
   * Nur Bookmaker-Daten verwenden,
   * deren lastUpdate strikt vor
   * Spielbeginn liegt.
   */
  const validSnapshots =
    allSnapshots.filter(
      (
        snapshot
      ) =>
        isStrictlyBeforeGameStart(
          snapshot.lastUpdate,
          gameStart
        )
    );

  if (
    validSnapshots.length ===
    0
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "INVALID",
        gameStart,
        requestedAt,
        "Totals vorhanden, aber keine Bookmaker-Aktualisierung liegt sicher vor Spielbeginn."
      ),

      snapshotTimestamp:
        response.timestamp,

      eventId:
        event.id,
    };
  }

  const consensusLine =
    selectConsensusLine(
      validSnapshots
    );

  if (
    consensusLine ==
    null
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "NO_DATA",
        gameStart,
        requestedAt,
        "Keine vollständige historische Total Line verfügbar."
      ),

      snapshotTimestamp:
        response.timestamp,

      eventId:
        event.id,
    };
  }

  /**
   * Für Over und Under müssen wir
   * dieselbe ausgewählte Total Line
   * verwenden.
   */
  const selectedLineSnapshots =
    validSnapshots.filter(
      (
        snapshot
      ) =>
        snapshot.line ===
        consensusLine
    );

  if (
    selectedLineSnapshots.length ===
    0
  ) {
    return {
      ...createEmptyHistoricalMarketSnapshot(
        "NO_DATA",
        gameStart,
        requestedAt,
        "Keine Bookmaker-Daten für die ausgewählte Konsenslinie verfügbar."
      ),

      snapshotTimestamp:
        response.timestamp,

      eventId:
        event.id,
    };
  }

  const bestOddsOver =
    Math.max(
      ...selectedLineSnapshots.map(
        (
          snapshot
        ) =>
          snapshot.oddsOver
      )
    );

  const bestOddsUnder =
    Math.max(
      ...selectedLineSnapshots.map(
        (
          snapshot
        ) =>
          snapshot.oddsUnder
      )
    );

  const updateTimes =
    selectedLineSnapshots
      .map(
        (
          snapshot
        ) =>
          new Date(
            snapshot.lastUpdate
          )
      )
      .filter(
        (
          date
        ) =>
          !Number.isNaN(
            date.getTime()
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          first.getTime() -
          second.getTime()
      );

  return {
    status:
      "ACTIVE",

    gameStart:
      gameStart.toISOString(),

    requestedAt:
      requestedAt.toISOString(),

    snapshotTimestamp:
      response.timestamp,

    eventId:
      event.id,

    currentLine:
      consensusLine,

    bestOddsOver,

    bestOddsUnder,

    bookmakerCount:
      selectedLineSnapshots.length,

    earliestBookmakerUpdate:
      updateTimes[0]
        ?.toISOString() ??
      null,

    latestBookmakerUpdate:
      updateTimes[
        updateTimes.length -
          1
      ]?.toISOString() ??
      null,

    reason:
      null,

    bookmakerSnapshots:
      selectedLineSnapshots,
  };
}