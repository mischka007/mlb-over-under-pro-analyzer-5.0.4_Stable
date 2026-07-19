import {
  cached,
} from "@/services/cache/cache";

import {
  getOpenWeatherApiKey,
} from "@/services/api/apiKeys";

/**
 * Einheitliches Wetter-Datenmodell.
 *
 * Dieses Modell wird sowohl für:
 *
 * - aktuelle Wetterdaten
 * - historische Point-in-Time-Wetterdaten
 *
 * verwendet.
 */
export interface WeatherSnapshot {
  temperatureC:
    number;

  windSpeedMph:
    number;

  windDegrees:
    number;

  humidityPct:
    number;

  pressureHpa:
    number;

  rainChancePct:
    number |
    null;
}

/**
 * OpenWeatherMap-Antwort für
 * aktuelle Wetterdaten.
 */
interface OpenWeatherResponse {
  main: {
    temp: number;

    humidity: number;

    pressure: number;
  };

  wind: {
    speed: number;

    deg: number;
  };

  rain?: {
    "1h"?: number;
  };

  pop?: number;
}

/**
 * Historische stündliche Antwort
 * der Open-Meteo Archive API.
 */
interface OpenMeteoHistoricalResponse {
  hourly?: {
    time?: string[];

    temperature_2m?: Array<
      number |
      null
    >;

    relative_humidity_2m?: Array<
      number |
      null
    >;

    surface_pressure?: Array<
      number |
      null
    >;

    wind_speed_10m?: Array<
      number |
      null
    >;

    wind_direction_10m?: Array<
      number |
      null
    >;

    precipitation_probability?: Array<
      number |
      null
    >;
  };
}

/**
 * Prüft, ob ein Wert eine
 * gültige endliche Zahl ist.
 */
function isFiniteNumber(
  value:
    number |
    null |
    undefined
): value is number {
  return (
    typeof value ===
      "number" &&
    Number.isFinite(
      value
    )
  );
}

/**
 * Rundet einen Zeitpunkt auf die
 * nächstgelegene volle UTC-Stunde.
 *
 * Historische Wetterdaten liegen
 * stündlich vor.
 */
function roundToNearestUtcHour(
  date: Date
): Date {
  const result =
    new Date(
      date
    );

  const minutes =
    result.getUTCMinutes();

  result.setUTCMinutes(
    0,
    0,
    0
  );

  if (
    minutes >=
    30
  ) {
    result.setUTCHours(
      result.getUTCHours() +
      1
    );
  }

  return result;
}

/**
 * Formatiert ein Datum als
 * YYYY-MM-DD in UTC.
 */
function toUtcDateString(
  date: Date
): string {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() +
      1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

/**
 * Findet den historischen Wetterwert,
 * dessen Zeitstempel am nächsten am
 * Spielzeitpunkt liegt.
 */
function findNearestHourlyIndex(
  times: string[],
  targetDate: Date
): number {
  const targetTimestamp =
    targetDate.getTime();

  let bestIndex =
    -1;

  let bestDistance =
    Number.POSITIVE_INFINITY;

  for (
    let index = 0;
    index < times.length;
    index += 1
  ) {
    const timestamp =
      new Date(
        times[index]
      ).getTime();

    if (
      !Number.isFinite(
        timestamp
      )
    ) {
      continue;
    }

    const distance =
      Math.abs(
        timestamp -
        targetTimestamp
      );

    if (
      distance <
      bestDistance
    ) {
      bestDistance =
        distance;

      bestIndex =
        index;
    }
  }

  return bestIndex;
}

/**
 * Lädt aktuelle Wetterdaten über
 * OpenWeatherMap.
 *
 * Ohne API-Key wird bewusst null
 * zurückgegeben.
 */
export async function fetchWeatherForCoordinates(
  lat: number,
  lon: number
): Promise<
  WeatherSnapshot |
  null
> {
  const API_KEY =
    getOpenWeatherApiKey();

  if (
    !API_KEY
  ) {
    return null;
  }

  return cached(
    `weather:${lat.toFixed(2)}:${lon.toFixed(2)}`,
    async () => {
      const url =
        new URL(
          "https://api.openweathermap.org/data/2.5/weather"
        );

      url.searchParams.set(
        "lat",
        String(
          lat
        )
      );

      url.searchParams.set(
        "lon",
        String(
          lon
        )
      );

      url.searchParams.set(
        "units",
        "metric"
      );

      url.searchParams.set(
        "appid",
        API_KEY
      );

      const response =
        await fetch(
          url.toString()
        );

      if (
        !response.ok
      ) {
        throw new Error(
          `OpenWeatherMap antwortete mit Status ${response.status}`
        );
      }

      const data =
        (
          await response.json()
        ) as OpenWeatherResponse;

      return {
        temperatureC:
          data.main.temp,

        windSpeedMph:
          data.wind.speed *
          2.237,

        windDegrees:
          data.wind.deg,

        humidityPct:
          data.main.humidity,

        pressureHpa:
          data.main.pressure,

        rainChancePct:
          data.pop !=
          null
            ? data.pop *
              100
            : null,
      } satisfies WeatherSnapshot;
    },
    30 *
      60 *
      1000
  );
}

/**
 * Lädt historische Wetterdaten für
 * einen exakten Standort und einen
 * historischen Zeitpunkt.
 *
 * Datenquelle:
 * Open-Meteo Historical Weather API.
 *
 * Die API-Abfrage verwendet:
 *
 * - Stadion-Koordinaten
 * - UTC-Spielzeitpunkt
 * - historische stündliche Messwerte
 *
 * WICHTIG:
 *
 * Die Funktion verwendet keine
 * aktuellen Wetterdaten für ein
 * historisches Spiel.
 */
export async function fetchHistoricalWeatherForCoordinates(
  lat: number,
  lon: number,
  gameDate: Date
): Promise<
  WeatherSnapshot |
  null
> {
  const gameTimestamp =
    gameDate.getTime();

  if (
    !Number.isFinite(
      gameTimestamp
    )
  ) {
    return null;
  }

  /**
   * Für zukünftige Zeitpunkte ist
   * die historische Archive API
   * nicht zuständig.
   */
  if (
    gameTimestamp >
    Date.now()
  ) {
    return null;
  }

  const roundedGameDate =
    roundToNearestUtcHour(
      gameDate
    );

  const dateString =
    toUtcDateString(
      roundedGameDate
    );

  const cacheKey =
    [
      "historical-weather",
      lat.toFixed(
        4
      ),
      lon.toFixed(
        4
      ),
      roundedGameDate.toISOString(),
    ].join(
      ":"
    );

  return cached(
    cacheKey,
    async () => {
      const url =
        new URL(
          "https://archive-api.open-meteo.com/v1/archive"
        );

      url.searchParams.set(
        "latitude",
        String(
          lat
        )
      );

      url.searchParams.set(
        "longitude",
        String(
          lon
        )
      );

      url.searchParams.set(
        "start_date",
        dateString
      );

      url.searchParams.set(
        "end_date",
        dateString
      );

      url.searchParams.set(
        "hourly",
        [
          "temperature_2m",
          "relative_humidity_2m",
          "surface_pressure",
          "wind_speed_10m",
          "wind_direction_10m",
          "precipitation_probability",
        ].join(
          ","
        )
      );

      /**
       * UTC verhindert eine fehlerhafte
       * Zuordnung durch lokale Zeitzonen
       * und Sommerzeit.
       */
      url.searchParams.set(
        "timezone",
        "UTC"
      );

      /**
       * Windgeschwindigkeit direkt in mph.
       */
      url.searchParams.set(
        "wind_speed_unit",
        "mph"
      );

      const response =
        await fetch(
          url.toString()
        );

      if (
        !response.ok
      ) {
        console.warn(
          "[Historical Weather] Open-Meteo antwortete mit Status",
          response.status,
          {
            lat,
            lon,
            gameDate:
              gameDate.toISOString(),
          }
        );

        return null;
      }

      const data =
        (
          await response.json()
        ) as OpenMeteoHistoricalResponse;

      const hourly =
        data.hourly;

      const times =
        hourly?.time ??
        [];

      if (
        times.length ===
        0
      ) {
        return null;
      }

      const nearestIndex =
        findNearestHourlyIndex(
          times,
          roundedGameDate
        );

      if (
        nearestIndex <
        0
      ) {
        return null;
      }

      const temperatureC =
        hourly
          ?.temperature_2m
          ?.[nearestIndex];

      const windSpeedMph =
        hourly
          ?.wind_speed_10m
          ?.[nearestIndex];

      const windDegrees =
        hourly
          ?.wind_direction_10m
          ?.[nearestIndex];

      const humidityPct =
        hourly
          ?.relative_humidity_2m
          ?.[nearestIndex];

      const pressureHpa =
        hourly
          ?.surface_pressure
          ?.[nearestIndex];

      const rainChancePct =
        hourly
          ?.precipitation_probability
          ?.[nearestIndex];

      /**
       * Mindestens ein zentraler
       * Wetterwert muss vorhanden sein.
       */
      const hasData =
        isFiniteNumber(
          temperatureC
        ) ||
        isFiniteNumber(
          windSpeedMph
        ) ||
        isFiniteNumber(
          humidityPct
        ) ||
        isFiniteNumber(
          pressureHpa
        );

      if (
        !hasData
      ) {
        return null;
      }

      return {
        temperatureC:
          isFiniteNumber(
            temperatureC
          )
            ? temperatureC
            : 21,

        windSpeedMph:
          isFiniteNumber(
            windSpeedMph
          )
            ? windSpeedMph
            : 0,

        windDegrees:
          isFiniteNumber(
            windDegrees
          )
            ? windDegrees
            : 0,

        humidityPct:
          isFiniteNumber(
            humidityPct
          )
            ? humidityPct
            : 50,

        pressureHpa:
          isFiniteNumber(
            pressureHpa
          )
            ? pressureHpa
            : 1013,

        rainChancePct:
          isFiniteNumber(
            rainChancePct
          )
            ? rainChancePct
            : null,
      } satisfies WeatherSnapshot;
    },
    /**
     * Historische Wetterdaten ändern
     * sich praktisch nicht mehr.
     *
     * Deshalb 30 Tage cachen.
     */
    30 *
      24 *
      60 *
      60 *
      1000
  );
}

/**
 * Ordnet eine Windrichtung grob
 * den Modellkategorien zu.
 *
 * Ohne Kenntnis der exakten
 * Center-Field-Ausrichtung eines
 * Stadions kann aus Kompassgraden
 * nicht zuverlässig "in" oder "out"
 * berechnet werden.
 *
 * Deshalb bleibt diese Funktion für
 * die bestehende Live-Pipeline bewusst
 * konservativ.
 */
export function classifyWindDirection(
  isBlowingOutToCenterField: boolean
): "out" | "cross" {
  return isBlowingOutToCenterField
    ? "out"
    : "cross";
}