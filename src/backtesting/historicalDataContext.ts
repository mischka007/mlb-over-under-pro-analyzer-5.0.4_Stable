import type {
  ScheduledGame,
} from "@/services/api/games";

import {
  fetchHistoricalTeamOffenseStats,
  fetchTeamForm,
} from "@/services/api/teams";

import type {
  TeamOffenseStats,
} from "@/services/api/teams";

import {
  fetchHistoricalPitcherStats,
} from "@/services/api/pitchers";

import type {
  PitcherStats,
} from "@/services/api/pitchers";

import {
  fetchHistoricalBullpenStats,
} from "@/services/api/bullpen";

import type {
  BullpenStats,
} from "@/services/api/bullpen";

import {
  fetchHistoricalWeatherForCoordinates,
} from "@/services/api/weather";

import type {
  WeatherSnapshot,
} from "@/services/api/weather";

import {
  getBallparkCoordinates,
  getBallparkReference,
} from "@/services/api/ballpark";

import {
  fetchHistoricalHeadToHead,
} from "@/services/api/h2h";

import type {
  H2HGame,
} from "@/services/api/h2h";

/**
 * Historische Daten eines Teams,
 * die ausschließlich aus Informationen
 * VOR dem zu testenden Spiel bestehen.
 */
export interface HistoricalTeamFormContext {
  teamId: number;

  teamName: string;

  last10Runs: number[];

  last10Allowed: number[];

  last20Runs: number[];

  avgLast20:
    number |
    null;

  streak: number;

  offense:
    TeamOffenseStats |
    null;

  pitcherId:
    number |
    null;

  pitcherName:
    string |
    null;

  pitcher:
    PitcherStats |
    null;

  bullpen:
    BullpenStats |
    null;
}

/**
 * Historischer Wetterkontext eines
 * einzelnen MLB-Spiels.
 */
export interface HistoricalWeatherContext {
  venueName:
    string;

  latitude:
    number |
    null;

  longitude:
    number |
    null;

  /**
   * Historische Wetterdaten am
   * Spielort zum Spielzeitpunkt.
   */
  snapshot:
    WeatherSnapshot |
    null;

  /**
   * Stadion-Dachtyp aus der festen
   * Ballpark-Referenz.
   */
  roofType:
    "open" |
    "retractable" |
    "dome" |
    null;
}

/**
 * Historischer Point-in-Time-H2H-
 * Kontext eines einzelnen Spiels.
 *
 * Alle enthaltenen direkten Duelle
 * müssen zeitlich strikt VOR dem
 * aktuellen Backtest-Spiel liegen.
 */
export interface HistoricalH2HContext {
  /**
   * Eindeutige MLB-ID des aktuellen
   * Backtest-Spiels.
   *
   * Dieses Spiel darf niemals in
   * `games` enthalten sein.
   */
  currentGamePk: number;

  /**
   * Point-in-Time-Stichtag.
   */
  asOfDate: Date;

  /**
   * Maximal die letzten 20 direkten
   * Duelle vor dem Stichtag.
   *
   * Die Reihenfolge ist chronologisch:
   * ältestes -> neuestes Spiel.
   */
  games: H2HGame[];
}

/**
 * Historischer Datenkontext
 * für ein einzelnes MLB-Spiel.
 */
export interface HistoricalGameDataContext {
  gamePk: number;

  gameDate: string;

  asOfDate: Date;

  home:
    HistoricalTeamFormContext;

  away:
    HistoricalTeamFormContext;

  /**
   * Wetter gehört zum Spiel und
   * nicht zu einem einzelnen Team.
   */
  weather:
    HistoricalWeatherContext;

  /**
   * Historische direkte Duelle
   * zwischen Home und Away.
   */
  h2h:
    HistoricalH2HContext;
}

/**
 * Lädt historische Point-in-Time-
 * Daten für ein einzelnes Team.
 */
async function loadHistoricalTeamContext(
  teamId: number,
  teamName: string,
  pitcherId:
    number |
    null,
  pitcherName:
    string |
    null,
  asOfDate: Date
): Promise<HistoricalTeamFormContext> {
  const [
    form,
    offense,
    pitcher,
    bullpen,
  ] =
    await Promise.all([
      fetchTeamForm(
        teamId,
        asOfDate
      ),

      fetchHistoricalTeamOffenseStats(
        teamId,
        asOfDate
      ),

      pitcherId !=
      null
        ? fetchHistoricalPitcherStats(
            pitcherId,
            asOfDate
          )
        : Promise.resolve(
            null
          ),

      fetchHistoricalBullpenStats(
        teamId,
        asOfDate
      ),
    ]);

  return {
    teamId,

    teamName,

    last10Runs:
      form?.last10Runs ??
      [],

    last10Allowed:
      form?.last10Allowed ??
      [],

    last20Runs:
      form?.last20Runs ??
      [],

    avgLast20:
      form?.avgLast20 ??
      null,

    streak:
      form?.streak ??
      0,

    offense,

    pitcherId,

    pitcherName,

    pitcher,

    bullpen,
  };
}

/**
 * Lädt den historischen Wetterkontext
 * eines einzelnen Spiels.
 */
async function loadHistoricalWeatherContext(
  game: ScheduledGame,
  asOfDate: Date
): Promise<HistoricalWeatherContext> {
  const coordinates =
    getBallparkCoordinates(
      game.venueName
    );

  const ballparkReference =
    getBallparkReference(
      game.venueName
    );

  /**
   * Ohne bekannte Stadionkoordinaten
   * können wir keine belastbaren
   * historischen Wetterdaten laden.
   */
  if (
    !coordinates
  ) {
    return {
      venueName:
        game.venueName,

      latitude:
        null,

      longitude:
        null,

      snapshot:
        null,

      roofType:
        ballparkReference
          ?.roofType ??
        null,
    };
  }

  /**
   * Bei einem permanenten Dome
   * beeinflusst das Außenwetter das
   * Spiel nicht direkt.
   *
   * Wir laden deshalb keine externen
   * historischen Wetterwerte.
   */
  if (
    ballparkReference
      ?.roofType ===
    "dome"
  ) {
    return {
      venueName:
        game.venueName,

      latitude:
        coordinates.lat,

      longitude:
        coordinates.lon,

      snapshot:
        null,

      roofType:
        "dome",
    };
  }

  const snapshot =
    await fetchHistoricalWeatherForCoordinates(
      coordinates.lat,
      coordinates.lon,
      asOfDate
    ).catch(
      (
        error
      ) => {
        console.warn(
          "[Historical Weather] Wetterdaten konnten nicht geladen werden.",
          {
            gamePk:
              game.gamePk,

            venueName:
              game.venueName,

            gameDate:
              game.gameDate,

            error,
          }
        );

        return null;
      }
    );

  return {
    venueName:
      game.venueName,

    latitude:
      coordinates.lat,

    longitude:
      coordinates.lon,

    snapshot,

    roofType:
      ballparkReference
        ?.roofType ??
      null,
  };
}

/**
 * Lädt den historischen Point-in-Time-
 * H2H-Kontext eines Spiels.
 */
async function loadHistoricalH2HContext(
  game: ScheduledGame,
  asOfDate: Date
): Promise<HistoricalH2HContext> {
  const games =
    await fetchHistoricalHeadToHead(
      game.homeTeamId,
      game.awayTeamId,
      asOfDate,
      20,
      game.gamePk
    ).catch(
      (
        error
      ) => {
        console.warn(
          "[Historical H2H] Direkte Duelle konnten nicht geladen werden.",
          {
            gamePk:
              game.gamePk,

            matchup:
              `${game.awayTeamName} @ ${game.homeTeamName}`,

            gameDate:
              game.gameDate,

            error,
          }
        );

        return [];
      }
    );

  return {
    currentGamePk:
      game.gamePk,

    asOfDate:
      new Date(
        asOfDate
      ),

    games,
  };
}

/**
 * Erstellt den historischen
 * Point-in-Time-Datenkontext
 * für ein einzelnes Spiel.
 *
 * Teamdaten, Wetter und H2H werden
 * parallel geladen.
 */
export async function createHistoricalGameDataContext(
  game: ScheduledGame
): Promise<HistoricalGameDataContext> {
  const asOfDate =
    new Date(
      game.gameDate
    );

  const [
    home,
    away,
    weather,
    h2h,
  ] =
    await Promise.all([
      loadHistoricalTeamContext(
        game.homeTeamId,
        game.homeTeamName,
        game.homeProbablePitcherId,
        game.homeProbablePitcherName,
        asOfDate
      ),

      loadHistoricalTeamContext(
        game.awayTeamId,
        game.awayTeamName,
        game.awayProbablePitcherId,
        game.awayProbablePitcherName,
        asOfDate
      ),

      loadHistoricalWeatherContext(
        game,
        asOfDate
      ),

      loadHistoricalH2HContext(
        game,
        asOfDate
      ),
    ]);

  return {
    gamePk:
      game.gamePk,

    gameDate:
      game.gameDate,

    asOfDate,

    home,

    away,

    weather,

    h2h,
  };
}

/**
 * Erstellt historische Datenkontexte
 * für mehrere Spiele.
 *
 * Die Spiele werden bewusst
 * sequenziell verarbeitet.
 *
 * Dadurch reduzieren wir die Gefahr,
 * externe APIs mit zu vielen
 * parallelen Requests zu belasten.
 *
 * Innerhalb eines Spiels werden:
 *
 * - Home-Team-Daten
 * - Away-Team-Daten
 * - Weather
 * - H2H
 *
 * parallel geladen.
 */
export async function createHistoricalGameDataContexts(
  games: ScheduledGame[]
): Promise<HistoricalGameDataContext[]> {
  const contexts:
    HistoricalGameDataContext[] = [];

  for (
    const game of games
  ) {
    const context =
      await createHistoricalGameDataContext(
        game
      );

    contexts.push(
      context
    );
  }

  return contexts;
}