import type { HistoryEntry } from "@/types";

const STORAGE_KEY = "mlb-analyzer-history-v5";
const MAX_ENTRIES = 200;

function readAll(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function writeAll(entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // localStorage kann fehlschlagen (Quota) – Historie ist ein reines
    // Komfort-Feature, die App bleibt ansonsten voll funktionsfähig.
  }
}

/** Speichert eine abgeschlossene Analyse in der Historie. */
export function saveHistoryEntry(entry: Omit<HistoryEntry, "id" | "timestamp">): HistoryEntry {
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
  const all = readAll();
  all.push(full);
  writeAll(all);
  return full;
}

/** Liefert alle gespeicherten Analysen, neueste zuerst. */
export function listHistoryEntries(): HistoryEntry[] {
  return readAll().slice().reverse();
}

/** Löscht einen einzelnen Historien-Eintrag. */
export function deleteHistoryEntry(id: string): void {
  writeAll(readAll().filter((e) => e.id !== id));
}

/** Löscht die komplette Historie. */
export function clearHistory(): void {
  writeAll([]);
}
