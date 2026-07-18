/**
 * Historische Odds-Anbindung über
 * den lokalen serverseitigen
 * Historical-Odds-Proxy.
 *
 * WICHTIG:
 *
 * Der Browser kommuniziert NICHT mehr
 * direkt mit The Odds API.
 *
 * Stattdessen:
 *
 * Browser
 *   ↓
 * /api/historical-odds
 *   ↓
 * Vite Development Server
 *   ↓
 * The Odds API
 *
 * Der ODDS_API_KEY bleibt dadurch
 * serverseitig und wird nicht mehr
 * vom React-Code an den Browser
 * übergeben.
 */

import {
  cached,
} from "@/services/cache/cache";

/**
 * Version für Cache-/
 * Datenmodelländerungen.
 */
const HISTORICAL_ODDS_VERSION =
  "v3-proxy";

/**
 * Historische Odds-Snapshots ändern
 * sich für einen bereits vergangenen
 * Zeitpunkt nie wieder.
 *
 * Deshalb ist eine lange TTL sicher
 * und spart wiederholte, kostenpflichtige
 * Requests für denselben Zeitpunkt
 * (z. B. erneutes Ausführen desselben
 * Backtests oder Diagnose-Tests).
 */
const HISTORICAL_ODDS_CACHE_TTL_MS =
  7 * 24 * 60 * 60 * 1000; // 7 Tage

/**
 * Standardmäßig fragen wir einen
 * Snapshot 60 Minuten vor
 * Spielbeginn an.
 */
export const DEFAULT_HISTORICAL_ODDS_LEAD_MINUTES =
  60;

/**
 * Netzwerk-Konfiguration.
 */
const HISTORICAL_ODDS_TIMEOUT_MS =
  25_000;

const HISTORICAL_ODDS_MAX_RETRIES =
  2;

const HISTORICAL_ODDS_RETRY_BASE_DELAY_MS =
  750;

/**
 * Einzelner Totals-Datensatz eines
 * Bookmakers.
 */
export interface HistoricalOddsSnapshot {
  bookmaker:
    string;

  line:
    number;

  oddsOver:
    number;

  oddsUnder:
    number;

  /**
   * Zeitpunkt der letzten
   * Aktualisierung des Bookmakers.
   */
  lastUpdate:
    string;
}

/**
 * API-Credit-Informationen.
 */
export interface HistoricalOddsApiUsage {
  requestsRemaining:
    number |
    null;

  requestsUsed:
    number |
    null;

  requestsLast:
    number |
    null;
}

/**
 * Metadaten der historischen
 * Odds-API-Antwort.
 */
export interface HistoricalOddsResponse {
  /**
   * Tatsächlicher Snapshot-Zeitpunkt,
   * den die API zurückgegeben hat.
   */
  timestamp:
    string;

  /**
   * Vorheriger verfügbarer Snapshot.
   */
  previousTimestamp:
    string |
    null;

  /**
   * Nächster verfügbarer Snapshot.
   */
  nextTimestamp:
    string |
    null;

  /**
   * Alle MLB-Events im historischen
   * Snapshot.
   */
  events:
    HistoricalOddsEvent[];

  /**
   * API-Nutzungsinformationen.
   */
  apiUsage:
    HistoricalOddsApiUsage;
}

/**
 * Historisches MLB-Event.
 */
export interface HistoricalOddsEvent {
  id:
    string;

  sportKey:
    string;

  commenceTime:
    string;

  homeTeam:
    string;

  awayTeam:
    string;

  bookmakers:
    HistoricalOddsBookmaker[];
}

/**
 * Bookmaker eines historischen Events.
 */
export interface HistoricalOddsBookmaker {
  key:
    string;

  title:
    string;

  lastUpdate:
    string;

  totals:
    HistoricalOddsTotalMarket[];
}

/**
 * Einzelne Totals-Linie eines
 * Bookmakers.
 */
export interface HistoricalOddsTotalMarket {
  line:
    number;

  oddsOver:
    number;

  oddsUnder:
    number;
}

/**
 * Rohstruktur der The Odds API.
 */
interface OddsApiHistoricalResponse {
  timestamp:
    string;

  previous_timestamp?:
    string;

  next_timestamp?:
    string;

  data:
    OddsApiEvent[];
}

interface OddsApiEvent {
  id:
    string;

  sport_key:
    string;

  commence_time:
    string;

  home_team:
    string;

  away_team:
    string;

  bookmakers:
    OddsApiBookmaker[];
}

interface OddsApiBookmaker {
  key:
    string;

  title:
    string;

  last_update:
    string;

  markets:
    OddsApiMarket[];
}

interface OddsApiMarket {
  key:
    string;

  outcomes:
    OddsApiOutcome[];
}

interface OddsApiOutcome {
  name:
    string;

  price:
    number;

  point?:
    number;
}

/**
 * Fehler des historischen
 * Odds-Clients.
 */
export class HistoricalOddsApiError
  extends Error {
  constructor(
    message:
      string,

    public readonly status?:
      number,

    public readonly retryable =
      false
  ) {
    super(
      message
    );

    this.name =
      "HistoricalOddsApiError";
  }
}

/**
 * Timeout-Fehler.
 */
export class HistoricalOddsTimeoutError
  extends Error {
  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "HistoricalOddsTimeoutError";
  }
}

/**
 * Netzwerkfehler.
 */
export class HistoricalOddsNetworkError
  extends Error {
  constructor(
    message:
      string
  ) {
    super(
      message
    );

    this.name =
      "HistoricalOddsNetworkError";
  }
}

/**
 * Wartet eine bestimmte Anzahl
 * Millisekunden.
 */
function delay(
  ms:
    number
): Promise<void> {
  return new Promise(
    (
      resolve
    ) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}

/**
 * Liest einen numerischen
 * Response-Header.
 */
function readNumberHeader(
  response:
    Response,
  headerName:
    string
): number | null {
  const rawValue =
    response.headers.get(
      headerName
    );

  if (
    rawValue ==
    null
  ) {
    return null;
  }

  const value =
    Number(
      rawValue
    );

  return Number.isFinite(
    value
  )
    ? value
    : null;
}

/**
 * Liest die API-Nutzungsinformationen
 * aus den Response-Headern.
 *
 * Der lokale Proxy reicht diese
 * ausgewählten Header an den Browser
 * weiter.
 */
function readApiUsage(
  response:
    Response
): HistoricalOddsApiUsage {
  return {
    requestsRemaining:
      readNumberHeader(
        response,
        "x-requests-remaining"
      ),

    requestsUsed:
      readNumberHeader(
        response,
        "x-requests-used"
      ),

    requestsLast:
      readNumberHeader(
        response,
        "x-requests-last"
      ),
  };
}

/**
 * Versucht, eine sichere
 * Fehlermeldung aus einer
 * HTTP-Antwort auszulesen.
 */
async function readSafeErrorMessage(
  response:
    Response
): Promise<string | null> {
  try {
    const text =
      await response.text();

    if (
      !text
    ) {
      return null;
    }

    /**
     * Begrenzen, damit keine riesige
     * HTML- oder Proxy-Antwort in der
     * Konsole landet.
     */
    return text.slice(
      0,
      500
    );
  } catch {
    return null;
  }
}

/**
 * Liefert true, wenn ein HTTP-Status
 * typischerweise temporär sein kann.
 */
function isRetryableHttpStatus(
  status:
    number
): boolean {
  return (
    status ===
      408 ||
    status ===
      425 ||
    status ===
      429 ||
    status ===
      502 ||
    status ===
      503 ||
    status ===
      504 ||
    status >=
      500
  );
}

/**
 * Liefert true, wenn ein Fehler
 * erneut versucht werden darf.
 */
function isRetryableError(
  error:
    unknown
): boolean {
  if (
    error instanceof
    HistoricalOddsTimeoutError
  ) {
    return true;
  }

  if (
    error instanceof
    HistoricalOddsNetworkError
  ) {
    return true;
  }

  if (
    error instanceof
    HistoricalOddsApiError
  ) {
    return error.retryable;
  }

  return false;
}

/**
 * Führt einen einzelnen Request
 * mit Timeout aus.
 */
async function fetchHistoricalOddsWithTimeout(
  url:
    URL
): Promise<Response> {
  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      HISTORICAL_ODDS_TIMEOUT_MS
    );

  try {
    return await fetch(
      url.toString(),
      {
        headers: {
          Accept:
            "application/json",
        },

        signal:
          controller.signal,
      }
    );
  } catch (
    error
  ) {
    if (
      error instanceof
        DOMException &&
      error.name ===
        "AbortError"
    ) {
      throw new HistoricalOddsTimeoutError(
        `Historical Odds Request nach ${HISTORICAL_ODDS_TIMEOUT_MS} ms abgebrochen.`
      );
    }

    if (
      error instanceof
        Error &&
      error.name ===
        "AbortError"
    ) {
      throw new HistoricalOddsTimeoutError(
        `Historical Odds Request nach ${HISTORICAL_ODDS_TIMEOUT_MS} ms abgebrochen.`
      );
    }

    throw new HistoricalOddsNetworkError(
      error instanceof
        Error
        ? `Historical Odds Netzwerkfehler: ${error.message}`
        : "Unbekannter Historical Odds Netzwerkfehler."
    );
  } finally {
    clearTimeout(
      timeout
    );
  }
}

/**
 * Führt den historischen Request
 * mit kontrollierter Retry-Logik aus.
 *
 * Maximal:
 *
 * 1 initialer Versuch
 * +
 * 2 Wiederholungen
 */
async function fetchHistoricalOddsWithRetry(
  url:
    URL
): Promise<Response> {
  let lastError:
    unknown;

  for (
    let attempt =
      0;
    attempt <=
      HISTORICAL_ODDS_MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await fetchHistoricalOddsWithTimeout(
          url
        );

      if (
        !response.ok
      ) {
        const status =
          response.status;

        const apiUsage =
          readApiUsage(
            response
          );

        const responseMessage =
          await readSafeErrorMessage(
            response
          );

        const retryable =
          isRetryableHttpStatus(
            status
          );

        const usageText =
          [
            apiUsage.requestsRemaining !=
            null
              ? `Remaining: ${apiUsage.requestsRemaining}`
              : null,

            apiUsage.requestsUsed !=
            null
              ? `Used: ${apiUsage.requestsUsed}`
              : null,

            apiUsage.requestsLast !=
            null
              ? `Last: ${apiUsage.requestsLast}`
              : null,
          ]
            .filter(
              (
                value
              ): value is string =>
                value !=
                null
            )
            .join(
              ", "
            );

        throw new HistoricalOddsApiError(
          [
            `Historical Odds API/Proxy antwortete mit HTTP ${status}.`,

            responseMessage
              ? `Antwort: ${responseMessage}`
              : null,

            usageText
              ? `API Usage: ${usageText}.`
              : null,
          ]
            .filter(
              (
                value
              ): value is string =>
                value !=
                null
            )
            .join(
              " "
            ),

          status,

          retryable
        );
      }

      return response;
    } catch (
      error
    ) {
      lastError =
        error;

      const canRetry =
        attempt <
          HISTORICAL_ODDS_MAX_RETRIES &&
        isRetryableError(
          error
        );

      if (
        !canRetry
      ) {
        break;
      }

      const delayMs =
        HISTORICAL_ODDS_RETRY_BASE_DELAY_MS *
        Math.pow(
          2,
          attempt
        );

      console.warn(
        [
          "[Historical Odds]",
          "Request fehlgeschlagen.",
          `Retry ${attempt + 1}/${HISTORICAL_ODDS_MAX_RETRIES}`,
          `in ${delayMs} ms.`,
          error instanceof
            Error
            ? `Grund: ${error.message}`
            : "",
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
      );

      await delay(
        delayMs
      );
    }
  }

  if (
    lastError instanceof
    Error
  ) {
    throw lastError;
  }

  throw new HistoricalOddsNetworkError(
    "Historical Odds Request ist aus unbekanntem Grund fehlgeschlagen."
  );
}

/**
 * Normalisiert einen Teamnamen
 * für robustere Vergleiche.
 */
function normalizeTeamName(
  value:
    string
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
export function historicalOddsTeamNamesMatch(
  firstName:
    string,
  secondName:
    string
): boolean {
  const first =
    normalizeTeamName(
      firstName
    );

  const second =
    normalizeTeamName(
      secondName
    );

  return (
    first ===
      second ||
    first.includes(
      second
    ) ||
    second.includes(
      first
    )
  );
}

/**
 * Wandelt die Rohdaten eines
 * Bookmakers in unser historisches
 * Format um.
 */
function mapHistoricalBookmaker(
  bookmaker:
    OddsApiBookmaker
): HistoricalOddsBookmaker {
  const totalsMarket =
    bookmaker.markets.find(
      (
        market
      ) =>
        market.key ===
        "totals"
    );

  if (
    !totalsMarket
  ) {
    return {
      key:
        bookmaker.key,

      title:
        bookmaker.title,

      lastUpdate:
        bookmaker.last_update,

      totals:
        [],
    };
  }

  /**
   * Gruppierung nach Total Line.
   *
   * Manche Bookmaker können
   * theoretisch mehrere Totals-Linien
   * liefern.
   */
  const totalsByLine =
    new Map<
      number,
      {
        over:
          number |
          null;

        under:
          number |
          null;
      }
    >();

  for (
    const outcome of
      totalsMarket.outcomes
  ) {
    if (
      outcome.point ==
        null ||
      !Number.isFinite(
        outcome.point
      ) ||
      !Number.isFinite(
        outcome.price
      )
    ) {
      continue;
    }

    const existing =
      totalsByLine.get(
        outcome.point
      ) ?? {
        over:
          null,

        under:
          null,
      };

    if (
      outcome.name ===
      "Over"
    ) {
      existing.over =
        outcome.price;
    }

    if (
      outcome.name ===
      "Under"
    ) {
      existing.under =
        outcome.price;
    }

    totalsByLine.set(
      outcome.point,
      existing
    );
  }

  const totals:
    HistoricalOddsTotalMarket[] =
    [];

  for (
    const [
      line,
      prices,
    ] of totalsByLine
  ) {
    if (
      prices.over ==
        null ||
      prices.under ==
        null
    ) {
      continue;
    }

    totals.push({
      line,

      oddsOver:
        prices.over,

      oddsUnder:
        prices.under,
    });
  }

  return {
    key:
      bookmaker.key,

    title:
      bookmaker.title,

    lastUpdate:
      bookmaker.last_update,

    totals,
  };
}

/**
 * Wandelt ein historisches Event
 * in unser internes Format um.
 */
function mapHistoricalEvent(
  event:
    OddsApiEvent
): HistoricalOddsEvent {
  return {
    id:
      event.id,

    sportKey:
      event.sport_key,

    commenceTime:
      event.commence_time,

    homeTeam:
      event.home_team,

    awayTeam:
      event.away_team,

    bookmakers:
      event.bookmakers.map(
        mapHistoricalBookmaker
      ),
  };
}

/**
 * Lädt einen historischen
 * MLB-Odds-Snapshot für einen
 * bestimmten Zeitpunkt.
 *
 * WICHTIG:
 *
 * Der Browser ruft ausschließlich
 * unseren lokalen Proxy auf.
 *
 * Der API-Key befindet sich nicht
 * in dieser Datei und wird nicht
 * an den Browser übergeben.
 *
 * Der serverseitige Proxy kann
 * weiterhin API-Credits verbrauchen.
 */
export async function fetchHistoricalOddsSnapshot(
  requestedAt:
    Date
): Promise<
  HistoricalOddsResponse |
  null
> {
  if (
    Number.isNaN(
      requestedAt.getTime()
    )
  ) {
    console.warn(
      "[Historical Odds] Ungültiger Snapshot-Zeitpunkt."
    );

    return null;
  }

  /**
   * Performance PRO: derselbe historische
   * Zeitpunkt liefert immer dieselbe
   * Antwort (die Vergangenheit ändert
   * sich nicht). Ein Cache-Treffer
   * spart hier einen echten,
   * kostenpflichtigen API-Request.
   */
  const cacheKey =
    `historical-odds:${HISTORICAL_ODDS_VERSION}:${requestedAt.toISOString()}`;

  return cached(
    cacheKey,
    async () =>
      fetchHistoricalOddsSnapshotUncached(
        requestedAt
      ),
    HISTORICAL_ODDS_CACHE_TTL_MS
  );
}

/**
 * Tatsächliche Netzwerklogik des
 * historischen Odds-Requests, OHNE
 * Caching — wird ausschließlich von
 * `fetchHistoricalOddsSnapshot()`
 * über `cached()` aufgerufen.
 */
async function fetchHistoricalOddsSnapshotUncached(
  requestedAt:
    Date
): Promise<
  HistoricalOddsResponse |
  null
> {
  /**
   * Lokaler Proxy-Endpunkt.
   *
   * Im Browser ist jetzt nur noch
   * diese lokale URL sichtbar.
   *
   * Kein API-Key.
   */
  const url =
    new URL(
      "/api/historical-odds",
      window.location.origin
    );

  url.searchParams.set(
    "date",
    requestedAt.toISOString()
  );

  /**
   * Der Browser sendet jetzt nur noch
   * den gewünschten historischen
   * Zeitpunkt an unseren lokalen Proxy.
   *
   * Der ODDS_API_KEY befindet sich
   * ausschließlich auf der Serverseite
   * im Vite Development Server.
   */
  const response =
    await fetchHistoricalOddsWithRetry(
      url
    );

  const apiUsage =
    readApiUsage(
      response
    );

  const data =
    (
      await response.json()
    ) as OddsApiHistoricalResponse;

  /**
   * Grundlegende Validierung der
   * API-Antwort.
   */
  if (
    !data ||
    typeof data.timestamp !==
      "string" ||
    !Array.isArray(
      data.data
    )
  ) {
    throw new HistoricalOddsApiError(
      "Historical Odds API/Proxy lieferte eine unerwartete Datenstruktur.",
      undefined,
      false
    );
  }

  console.log(
    "[Historical Odds] Snapshot erfolgreich geladen.",
    {
      requestedAt:
        requestedAt.toISOString(),

      snapshotTimestamp:
        data.timestamp,

      eventCount:
        data.data.length,

      apiUsage,
    }
  );

  return {
    timestamp:
      data.timestamp,

    previousTimestamp:
      data.previous_timestamp ??
      null,

    nextTimestamp:
      data.next_timestamp ??
      null,

    events:
      data.data.map(
        mapHistoricalEvent
      ),

    apiUsage,
  };
}

/**
 * Sucht ein bestimmtes MLB-Matchup
 * innerhalb eines historischen
 * Snapshot-Datensatzes.
 */
export function findHistoricalOddsEvent(
  response:
    HistoricalOddsResponse,
  homeTeamName:
    string,
  awayTeamName:
    string
): HistoricalOddsEvent | null {
  return (
    response.events.find(
      (
        event
      ) =>
        historicalOddsTeamNamesMatch(
          event.homeTeam,
          homeTeamName
        ) &&
        historicalOddsTeamNamesMatch(
          event.awayTeam,
          awayTeamName
        )
    ) ??
    null
  );
}

/**
 * Erstellt den gewünschten Zeitpunkt
 * vor Spielbeginn.
 */
export function createHistoricalOddsRequestedAt(
  gameStart:
    Date,
  leadMinutes =
    DEFAULT_HISTORICAL_ODDS_LEAD_MINUTES
): Date {
  const normalizedLeadMinutes =
    Math.max(
      1,
      Math.floor(
        leadMinutes
      )
    );

  return new Date(
    gameStart.getTime() -
      normalizedLeadMinutes *
        60 *
        1000
  );
}

/**
 * Versionskennung für
 * Diagnosezwecke.
 */
export function getHistoricalOddsVersion():
  string {
  return HISTORICAL_ODDS_VERSION;
}