/**
 * Speichert die vom Nutzer im Setup-Assistenten eingegebenen API-Keys
 * lokal im Browser (localStorage). So muss der Key nur einmal eingegeben
 * werden. Fällt zusätzlich auf Build-Time-Environment-Variablen zurück
 * (VITE_OPENWEATHER_API_KEY / VITE_ODDS_API_KEY), falls ein Entwickler die
 * App stattdessen über eine .env-Datei konfigurieren möchte.
 */

const STORAGE_KEY = "mlb-analyzer-api-keys";

export interface StoredApiKeys {
  openWeatherApiKey: string;
  oddsApiKey: string;
}

function readKeys(): StoredApiKeys {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { openWeatherApiKey: "", oddsApiKey: "" };
    return JSON.parse(raw) as StoredApiKeys;
  } catch {
    return { openWeatherApiKey: "", oddsApiKey: "" };
  }
}

export function getStoredApiKeys(): StoredApiKeys {
  return readKeys();
}

export function saveApiKeys(keys: StoredApiKeys): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // localStorage nicht verfügbar – Keys müssten dann pro Sitzung erneut
    // eingegeben werden; die App bleibt ansonsten funktionsfähig.
  }
}

export function hasSeenSetupWizard(): boolean {
  try {
    return window.localStorage.getItem("mlb-analyzer-setup-seen") === "true";
  } catch {
    return true; // im Zweifel nicht wiederholt aufdrängen
  }
}

export function markSetupWizardSeen(): void {
  try {
    window.localStorage.setItem("mlb-analyzer-setup-seen", "true");
  } catch {
    // ignorieren
  }
}

/** Liefert den effektiven OpenWeatherMap-Key: zuerst localStorage, dann .env. */
export function getOpenWeatherApiKey(): string | undefined {
  const stored = readKeys().openWeatherApiKey;
  if (stored) return stored;
  return import.meta.env.VITE_OPENWEATHER_API_KEY as string | undefined;
}

/** Liefert den effektiven The-Odds-API-Key: zuerst localStorage, dann .env. */
export function getOddsApiKey(): string | undefined {
  const stored = readKeys().oddsApiKey;
  if (stored) return stored;
  return import.meta.env.VITE_ODDS_API_KEY as string | undefined;
}
