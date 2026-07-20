/**
 * Einfacher TTL-Cache für API-Antworten. Kombiniert einen In-Memory-Map
 * (schnell, für die laufende Session) mit einer localStorage-Spiegelung
 * (übersteht Seiten-Reloads). Standard-TTL: 10 Minuten, wie gefordert –
 * wird dieselbe Analyse innerhalb dieses Fensters erneut angefragt, erfolgt
 * KEINE erneute Netzwerkanfrage.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 Minuten
const STORAGE_PREFIX = "mlb-analyzer-cache:";

const memoryCache = new Map<string, CacheEntry<unknown>>();

// Verhindert Race Conditions: wenn zwei Aufrufer nahezu gleichzeitig
// denselben (noch nicht gecachten) Key anfragen, würden ohne diese Map
// beide einen eigenen Netzwerk-Request auslösen. Stattdessen teilen sie
// sich hier dasselbe In-Flight-Promise.
const inFlightRequests = new Map<string, Promise<unknown>>();

function readFromStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (typeof parsed.expiresAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage<T>(key: string, entry: CacheEntry<T>): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // localStorage kann fehlschlagen (Quota, Private Mode) – Memory-Cache
    // funktioniert trotzdem für die laufende Session weiter.
  }
}

/**
 * Version 6.0 (Paket 5), Schritt 8: echte API-Antwortzeit-/Erfolgs-
 * Instrumentierung. Wird zentral in `cached()` erfasst (dem bereits
 * bestehenden, einzigen Chokepoint, den alle `services/api/*.ts`-Module
 * für echte Netzwerkaufrufe nutzen) — schließt die in Tag 9 bewusst
 * offen gelassene Lücke ("keine Instrumentierung vorhanden"), ohne
 * jedes einzelne Service-Modul anfassen zu müssen. Nur echte
 * Netzwerkaufrufe (Cache-Treffer laufen NICHT durch diesen Pfad) werden
 * gemessen — keine erfundenen Werte.
 */
export interface ApiRequestMetric {
  lastCallTimestamp: number;
  lastResponseTimeMs: number;
  lastSuccess: boolean;
  lastErrorMessage: string | null;
  successCount: number;
  errorCount: number;
}

const requestMetrics = new Map<string, ApiRequestMetric>();

/** Extrahiert den Cache-Key-Präfix (vor dem ersten `:`) als groben Herkunfts-Bucket. */
function keyPrefix(key: string): string {
  const idx = key.indexOf(":");
  return idx >= 0 ? key.slice(0, idx) : key;
}

function recordRequestMetric(prefix: string, result: { success: boolean; responseTimeMs: number; errorMessage?: string }): void {
  const existing = requestMetrics.get(prefix);
  requestMetrics.set(prefix, {
    lastCallTimestamp: Date.now(),
    lastResponseTimeMs: result.responseTimeMs,
    lastSuccess: result.success,
    lastErrorMessage: result.success ? null : (result.errorMessage ?? "Unbekannter Fehler"),
    successCount: (existing?.successCount ?? 0) + (result.success ? 1 : 0),
    errorCount: (existing?.errorCount ?? 0) + (result.success ? 0 : 1),
  });
}

/** Liefert die aktuellen Metriken für einen einzelnen Cache-Key-Präfix (z. B. `"odds"`, `"weather"`). */
export function getRequestMetric(prefix: string): ApiRequestMetric | null {
  return requestMetrics.get(prefix) ?? null;
}

/** Liefert alle bisher erfassten Präfixe mit ihren Metriken (für die API-Health-Übersicht). */
export function getAllRequestMetrics(): Map<string, ApiRequestMetric> {
  return new Map(requestMetrics);
}
export function getCached<T>(key: string): T | null {
  const mem = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (mem && mem.expiresAt > Date.now()) return mem.value;

  const stored = readFromStorage<T>(key);
  if (stored && stored.expiresAt > Date.now()) {
    memoryCache.set(key, stored);
    return stored.value;
  }
  return null;
}

/** Speichert einen Wert im Cache mit optionaler TTL (Standard 10 Minuten). */
export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
  memoryCache.set(key, entry);
  writeToStorage(key, entry);
}

/**
 * Führt eine Fetch-Funktion nur aus, wenn kein gültiger Cache-Eintrag
 * existiert. Zentrales Hilfsmittel, das von allen API-Modulen genutzt wird.
 *
 * Parallele Aufrufe mit demselben Key innerhalb desselben Ladevorgangs
 * (z. B. wenn "Alle Spiele analysieren" mehrere Karten gleichzeitig lädt)
 * teilen sich dasselbe In-Flight-Promise, statt doppelte Requests
 * auszulösen.
 */
export async function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs?: number): Promise<T> {
  const existing = getCached<T>(key);
  if (existing !== null) return existing;

  const pending = inFlightRequests.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    const prefix = keyPrefix(key);
    const start = performance.now();
    try {
      const value = await fetcher();
      recordRequestMetric(prefix, { success: true, responseTimeMs: performance.now() - start });
      setCached(key, value, ttlMs);
      return value;
    } catch (err) {
      recordRequestMetric(prefix, {
        success: false,
        responseTimeMs: performance.now() - start,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/** Löscht einen einzelnen Cache-Eintrag (z. B. für einen "Neu laden"-Button). */
export function invalidateCache(key: string): void {
  memoryCache.delete(key);
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignorieren
  }
}

/**
 * Release Dashboard (Tag 9): liest den tatsächlichen, aktuellen Zustand
 * des In-Memory-Caches aus — rein additive Introspektion, verändert
 * nichts am bestehenden Cache-Verhalten. `staleEntries` zählt Einträge,
 * deren TTL bereits abgelaufen ist, aber noch nicht durch einen erneuten
 * Zugriff (`getCached`) bereinigt wurden.
 */
export function getCacheStats(): { totalEntries: number; freshEntries: number; staleEntries: number } {
  const now = Date.now();
  let freshEntries = 0;
  let staleEntries = 0;

  for (const entry of memoryCache.values()) {
    if (entry.expiresAt > now) freshEntries++;
    else staleEntries++;
  }

  return { totalEntries: memoryCache.size, freshEntries, staleEntries };
}
