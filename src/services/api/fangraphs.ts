/**
 * FanGraphs als vierte Prioritätsstufe der Datenquellen-Kette.
 *
 * FanGraphs bietet KEINE öffentliche API, und die Nutzungsbedingungen von
 * FanGraphs untersagen automatisiertes Scraping ihrer Seiten ausdrücklich.
 * Aus diesem Grund bleibt dieser Service bewusst deaktiviert: er liefert
 * immer `null` zurück, statt Daten durch Scraping zu beschaffen (rechtlich
 * riskant und technisch instabil) oder Werte zu erfinden.
 *
 * Metriken, die sonst nur über FanGraphs verfügbar wären (z. B. FIP, SIERA,
 * wRC+ mit exakter FanGraphs-Berechnungsmethode), bleiben daher in der
 * Anwendung als "nicht verfügbar" markiert und können manuell ergänzt
 * werden, falls du selbst Zugriff auf einen FanGraphs-Datenexport hast
 * (z. B. über eine eigene, lizenzierte CSV-Datei, die du lokal einliest).
 */

export interface FanGraphsPitcherMetrics {
  fip: null;
  siera: null;
}

export async function fetchFanGraphsPitcherMetrics(): Promise<FanGraphsPitcherMetrics | null> {
  return null;
}
