/**
 * Basis-Client für die öffentliche MLB Stats API
 * (statsapi.mlb.com).
 *
 * WICHTIG:
 *
 * Dies ist die frei zugängliche MLB Stats API,
 * die für Spielplan, Boxscores, Kader und
 * Statistiken verwendet wird.
 *
 * Sie erfordert keinen API-Key.
 *
 * Robustheit:
 *
 * - Timeout über AbortController
 * - automatischer Retry
 * - kontrollierte Fehlerbehandlung
 * - keine erfundenen Daten
 */

const BASE_URL =
  "https://statsapi.mlb.com/api/v1";

const BASE_URL_V1_1 =
  "https://statsapi.mlb.com/api/v1.1";

const DEFAULT_TIMEOUT_MS =
  8000;

const MAX_RETRIES =
  2;

const RETRY_BASE_DELAY_MS =
  400;

/**
 * Allgemeiner API-Fehler.
 */
export class ApiError
  extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(
      message
    );

    this.name =
      "ApiError";
  }
}

/**
 * Fehler bei Zeitüberschreitung.
 */
export class ApiTimeoutError
  extends Error {
  constructor(
    message: string
  ) {
    super(
      message
    );

    this.name =
      "ApiTimeoutError";
  }
}

/**
 * Wartet eine bestimmte Anzahl
 * Millisekunden.
 */
function delay(
  ms: number
): Promise<void> {
  return new Promise(
    (
      resolve
    ) =>
      setTimeout(
        resolve,
        ms
      )
  );
}

/**
 * Führt einen Fetch-Request
 * mit Timeout aus.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    );

  try {
    return await fetch(
      url,
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
    err
  ) {
    if (
      err instanceof Error &&
      err.name ===
        "AbortError"
    ) {
      throw new ApiTimeoutError(
        `Zeitüberschreitung nach ${timeoutMs}ms bei ${url}`
      );
    }

    throw err;
  } finally {
    clearTimeout(
      timer
    );
  }
}

/**
 * Liefert true, wenn ein erneuter
 * Versuch sinnvoll ist.
 */
function isRetryable(
  err: unknown
): boolean {
  if (
    err instanceof
    ApiTimeoutError
  ) {
    return true;
  }

  if (
    err instanceof
    ApiError
  ) {
    return (
      err.status == null ||
      err.status >= 500
    );
  }

  /**
   * Netzwerkfehler wie:
   *
   * Failed to fetch
   * ERR_CONNECTION_RESET
   *
   * können vorübergehend sein.
   */
  return true;
}

/**
 * Führt einen JSON-Request
 * mit Retry-Logik aus.
 */
async function fetchJson<T>(
  url: string,
  timeoutMs: number =
    DEFAULT_TIMEOUT_MS
): Promise<T> {
  let lastError:
    unknown;

  for (
    let attempt =
      0;
    attempt <=
    MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await fetchWithTimeout(
          url,
          timeoutMs
        );

      if (
        !response.ok
      ) {
        throw new ApiError(
          `MLB Stats API antwortete mit Status ${response.status} für ${url}`,
          response.status
        );
      }

      return (
        await response.json()
      ) as T;
    } catch (
      err
    ) {
      lastError =
        err;

      if (
        attempt <
          MAX_RETRIES &&
        isRetryable(
          err
        )
      ) {
        await delay(
          RETRY_BASE_DELAY_MS *
            Math.pow(
              2,
              attempt
            )
        );

        continue;
      }

      break;
    }
  }

  throw lastError;
}

/**
 * GET gegen die MLB Stats API v1
 * mit Query-Parametern.
 */
export function mlbGet<T>(
  path: string,
  params: Record<
    string,
    | string
    | number
    | boolean
    | undefined
  > = {}
): Promise<T> {
  const url =
    new URL(
      `${BASE_URL}${path}`
    );

  Object.entries(
    params
  ).forEach(
    (
      [
        key,
        value,
      ]
    ) => {
      if (
        value !==
        undefined
      ) {
        url.searchParams.set(
          key,
          String(
            value
          )
        );
      }
    }
  );

  return fetchJson<T>(
    url.toString()
  );
}

/**
 * GET gegen die MLB Stats API v1.1.
 *
 * Zum Beispiel für Live-Game-Feeds.
 */
export function mlbGetV11<T>(
  path: string,
  params: Record<
    string,
    | string
    | number
    | boolean
    | undefined
  > = {}
): Promise<T> {
  const url =
    new URL(
      `${BASE_URL_V1_1}${path}`
    );

  Object.entries(
    params
  ).forEach(
    (
      [
        key,
        value,
      ]
    ) => {
      if (
        value !==
        undefined
      ) {
        url.searchParams.set(
          key,
          String(
            value
          )
        );
      }
    }
  );

  return fetchJson<T>(
    url.toString()
  );
}

/**
 * Formatiert ein Date-Objekt als
 * YYYY-MM-DD für die MLB Stats API.
 *
 * WICHTIG:
 *
 * Wir verwenden hier bewusst NICHT:
 *
 * date.toISOString().slice(0, 10)
 *
 * Denn toISOString() wandelt das Datum
 * zuerst nach UTC um.
 *
 * Dadurch kann sich der Kalendertag
 * gegenüber dem lokal erzeugten
 * Backtest-Datum verschieben.
 *
 * Beispiel:
 *
 * Ein lokal erzeugtes Date für:
 *
 * 2025-07-01
 *
 * soll auch als:
 *
 * 2025-07-01
 *
 * an die MLB API gesendet werden.
 *
 * Deshalb lesen wir Jahr, Monat und Tag
 * direkt aus dem lokalen Date-Objekt.
 */
export function toMlbDate(
  date: Date
): string {
  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    throw new Error(
      "Ungültiges Date-Objekt für MLB-Datumsformatierung."
    );
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}

/**
 * Generischer Wrapper.
 *
 * Führt eine API-Abfrage aus und gibt
 * bei einem Fehler null zurück.
 *
 * Dadurch kann die Analyse mit den
 * noch verfügbaren Daten weiterlaufen.
 */
export async function safe<T>(
  fn: () =>
    Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}