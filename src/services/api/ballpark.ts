/**
 * Ballpark-Faktoren.
 *
 * Es gibt keine kostenlose Echtzeit-API für Park-Faktoren; die gängigen
 * Quellen (FanGraphs, Baseball Savant) veröffentlichen diese als jährlich
 * aktualisierte Tabellen, keine live abfragbare API. Statt einen Fake-Fetch
 * vorzutäuschen, wird hier eine transparente, im Code sichtbare
 * Referenztabelle mit gerundeten, öffentlich bekannten Mehrjahres-Park-
 * Faktoren hinterlegt (100 = Liga-Durchschnitt). Diese Werte sollten vor
 * produktivem Einsatz gegen die aktuelle FanGraphs-Park-Factor-Tabelle
 * geprüft und ggf. aktualisiert werden.
 */
export interface BallparkReference {
  runFactor: number;
  hrFactor: number;
  altitudeMeters: number;
  roofType: "open" | "retractable" | "dome";
}

export const BALLPARK_REFERENCE: Record<string, BallparkReference> = {
  "Coors Field": { runFactor: 112, hrFactor: 109, altitudeMeters: 1610, roofType: "open" },
  "Great American Ball Park": { runFactor: 106, hrFactor: 112, altitudeMeters: 149, roofType: "open" },
  "Yankee Stadium": { runFactor: 103, hrFactor: 108, altitudeMeters: 21, roofType: "open" },
  "Fenway Park": { runFactor: 104, hrFactor: 98, altitudeMeters: 6, roofType: "open" },
  "Wrigley Field": { runFactor: 103, hrFactor: 101, altitudeMeters: 179, roofType: "open" },
  "Chase Field": { runFactor: 100, hrFactor: 102, altitudeMeters: 331, roofType: "retractable" },
  "Globe Life Field": { runFactor: 98, hrFactor: 99, altitudeMeters: 152, roofType: "retractable" },
  "Camden Yards": { runFactor: 105, hrFactor: 106, altitudeMeters: 22, roofType: "open" },
  "Dodger Stadium": { runFactor: 97, hrFactor: 95, altitudeMeters: 167, roofType: "open" },
  "Petco Park": { runFactor: 91, hrFactor: 89, altitudeMeters: 62, roofType: "open" },
  "Oracle Park": { runFactor: 90, hrFactor: 84, altitudeMeters: 4, roofType: "open" },
  "T-Mobile Park": { runFactor: 93, hrFactor: 92, altitudeMeters: 40, roofType: "retractable" },
  "Oakland Coliseum": { runFactor: 94, hrFactor: 90, altitudeMeters: 3, roofType: "open" },
  "Citi Field": { runFactor: 96, hrFactor: 93, altitudeMeters: 4, roofType: "open" },
  "Citizens Bank Park": { runFactor: 105, hrFactor: 110, altitudeMeters: 12, roofType: "open" },
  "Truist Park": { runFactor: 101, hrFactor: 103, altitudeMeters: 322, roofType: "open" },
  "loanDepot park": { runFactor: 92, hrFactor: 88, altitudeMeters: 2, roofType: "retractable" },
  "American Family Field": { runFactor: 101, hrFactor: 104, altitudeMeters: 202, roofType: "retractable" },
  "Busch Stadium": { runFactor: 96, hrFactor: 91, altitudeMeters: 142, roofType: "open" },
  "PNC Park": { runFactor: 97, hrFactor: 93, altitudeMeters: 225, roofType: "open" },
  "Nationals Park": { runFactor: 99, hrFactor: 98, altitudeMeters: 6, roofType: "open" },
  "Kauffman Stadium": { runFactor: 98, hrFactor: 92, altitudeMeters: 229, roofType: "open" },
  "Target Field": { runFactor: 99, hrFactor: 97, altitudeMeters: 253, roofType: "open" },
  "Progressive Field": { runFactor: 98, hrFactor: 96, altitudeMeters: 194, roofType: "open" },
  "Comerica Park": { runFactor: 97, hrFactor: 90, altitudeMeters: 183, roofType: "open" },
  "Guaranteed Rate Field": { runFactor: 102, hrFactor: 105, altitudeMeters: 182, roofType: "open" },
  "Minute Maid Park": { runFactor: 100, hrFactor: 101, altitudeMeters: 13, roofType: "retractable" },
  "Angel Stadium": { runFactor: 98, hrFactor: 96, altitudeMeters: 46, roofType: "open" },
  "Rogers Centre": { runFactor: 101, hrFactor: 103, altitudeMeters: 76, roofType: "retractable" },
  "Tropicana Field": { runFactor: 95, hrFactor: 94, altitudeMeters: 15, roofType: "dome" },

  /**
   * Temporäres Heimstadion der Tampa Bay Rays
   * während der MLB-Saison 2025.
   *
   * Für die historische Weather-Pipeline ist
   * vor allem entscheidend, dass das Stadion
   * als offenes Stadion erkannt wird.
   *
   * Die Park-Faktoren werden vorerst neutral
   * angesetzt, bis eine ausreichend belastbare
   * mehrjährige MLB-Datenbasis für dieses
   * temporäre MLB-Stadion vorhanden ist.
   */
  "George M. Steinbrenner Field": {
    runFactor: 100,
    hrFactor: 100,
    altitudeMeters: 10,
    roofType: "open",
  },
};

/** Liefert die Referenzwerte für einen Venue-Namen, oder null falls unbekannt. */
export function getBallparkReference(venueName: string): BallparkReference | null {
  return BALLPARK_REFERENCE[venueName] ?? null;
}

/**
 * Geokoordinaten der MLB-Stadien (öffentlich bekannte, feste Standorte).
 * Wird benötigt, um für ein Spiel echte Live-Wetterdaten abzurufen, da die
 * MLB Stats API selbst keine Lat/Lon-Werte im Schedule-Feed liefert.
 */
export const BALLPARK_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "Coors Field": { lat: 39.7559, lon: -104.9942 },
  "Great American Ball Park": { lat: 39.0975, lon: -84.5061 },
  "Yankee Stadium": { lat: 40.8296, lon: -73.9262 },
  "Fenway Park": { lat: 42.3467, lon: -71.0972 },
  "Wrigley Field": { lat: 41.9484, lon: -87.6553 },
  "Chase Field": { lat: 33.4453, lon: -112.0667 },
  "Globe Life Field": { lat: 32.7473, lon: -97.0842 },
  "Camden Yards": { lat: 39.2839, lon: -76.6218 },
  "Dodger Stadium": { lat: 34.0739, lon: -118.24 },
  "Petco Park": { lat: 32.7076, lon: -117.1569 },
  "Oracle Park": { lat: 37.7786, lon: -122.3893 },
  "T-Mobile Park": { lat: 47.5914, lon: -122.3325 },
  "Oakland Coliseum": { lat: 37.7516, lon: -122.2005 },
  "Citi Field": { lat: 40.7571, lon: -73.8458 },
  "Citizens Bank Park": { lat: 39.9061, lon: -75.1665 },
  "Truist Park": { lat: 33.8908, lon: -84.4678 },
  "loanDepot park": { lat: 25.7781, lon: -80.2196 },
  "American Family Field": { lat: 43.028, lon: -87.9712 },
  "Busch Stadium": { lat: 38.6226, lon: -90.1928 },
  "PNC Park": { lat: 40.4469, lon: -80.0057 },
  "Nationals Park": { lat: 38.873, lon: -77.0074 },
  "Kauffman Stadium": { lat: 39.0517, lon: -94.4803 },
  "Target Field": { lat: 44.9817, lon: -93.2776 },
  "Progressive Field": { lat: 41.4962, lon: -81.6852 },
  "Comerica Park": { lat: 42.339, lon: -83.0485 },
  "Guaranteed Rate Field": { lat: 41.83, lon: -87.6338 },
  "Minute Maid Park": { lat: 29.757, lon: -95.3555 },
  "Angel Stadium": { lat: 33.8003, lon: -117.8827 },
  "Rogers Centre": { lat: 43.6414, lon: -79.3894 },
  "Tropicana Field": { lat: 27.7683, lon: -82.6534 },

  /**
   * George M. Steinbrenner Field
   * Tampa, Florida.
   *
   * Temporäres Heimstadion der
   * Tampa Bay Rays in der Saison 2025.
   */
  "George M. Steinbrenner Field": {
    lat: 27.9803,
    lon: -82.5067,
  },
};

export function getBallparkCoordinates(
  venueName: string
): {
  lat: number;
  lon: number;
} | null {
  return BALLPARK_COORDINATES[venueName] ?? null;
}