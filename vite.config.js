import { defineConfig, loadEnv, } from "vite";
import react from "@vitejs/plugin-react";
/**
 * Basis-URL der The Odds API.
 */
const ODDS_API_BASE_URL = "https://api.the-odds-api.com";
/**
 * Formatiert ein Date-Objekt für den
 * historischen date-Parameter der
 * The Odds API.
 *
 * Beispiel:
 *
 * JavaScript:
 * 2025-07-01T18:07:00.000Z
 *
 * The Odds API:
 * 2025-07-01T18:07:00Z
 *
 * WICHTIG:
 *
 * Es wird nicht auf einen späteren
 * Zeitpunkt gerundet.
 *
 * Dadurch bleibt der gewünschte
 * Point-in-Time-Zeitpunkt erhalten.
 */
function toHistoricalApiTimestamp(date) {
    return date
        .toISOString()
        .replace(".000Z", "Z");
}
/**
 * Hilfsfunktion:
 *
 * Liest eine unbekannte Eigenschaft
 * sicher aus einem Fehlerobjekt.
 */
function readErrorProperty(value, propertyName) {
    if (typeof value !==
        "object" ||
        value ===
            null) {
        return null;
    }
    return value[propertyName];
}
/**
 * Wandelt einen unbekannten Fehler
 * in ein Diagnoseobjekt um.
 *
 * Besonders wichtig bei Node fetch():
 *
 * Häufig lautet der äußere Fehler nur:
 *
 * "fetch failed"
 *
 * Die eigentliche Ursache steckt dann
 * in:
 *
 * error.cause
 *
 * zum Beispiel:
 *
 * ECONNRESET
 * ETIMEDOUT
 * ENOTFOUND
 * EAI_AGAIN
 */
function createErrorDiagnostic(error) {
    const cause = readErrorProperty(error, "cause");
    return {
        name: error instanceof
            Error
            ? error.name
            : null,
        message: error instanceof
            Error
            ? error.message
            : String(error),
        code: readErrorProperty(error, "code"),
        errno: readErrorProperty(error, "errno"),
        syscall: readErrorProperty(error, "syscall"),
        hostname: readErrorProperty(error, "hostname"),
        causeName: cause instanceof
            Error
            ? cause.name
            : null,
        causeMessage: cause instanceof
            Error
            ? cause.message
            : cause
                ? String(cause)
                : null,
        causeCode: readErrorProperty(cause, "code"),
        causeErrno: readErrorProperty(cause, "errno"),
        causeSyscall: readErrorProperty(cause, "syscall"),
        causeHostname: readErrorProperty(cause, "hostname"),
    };
}
/**
 * Sendet eine JSON-Fehlermeldung.
 */
function sendJsonError(res, status, message) {
    res.statusCode =
        status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
        error: message,
    }));
}
/**
 * Vite-Konfiguration.
 *
 * Der API-Key wird ausschließlich
 * serverseitig aus:
 *
 * ODDS_API_KEY
 *
 * geladen.
 */
export default defineConfig(({ mode, }) => {
    /**
     * Der leere Prefix "" ist
     * absichtlich gesetzt.
     *
     * Dadurch kann Vite auch
     * serverseitige Variablen ohne
     * VITE_-Prefix laden.
     */
    const env = loadEnv(mode, process.cwd(), "");
    const oddsApiKey = env.ODDS_API_KEY;
    return {
        plugins: [
            react(),
            /**
             * Lokaler Historical-Odds-Proxy.
             */
            {
                name: "historical-odds-proxy",
                configureServer(server) {
                    server.middlewares.use("/api/historical-odds", async (req, res) => {
                        /**
                         * Nur GET erlauben.
                         */
                        if (req.method !==
                            "GET") {
                            sendJsonError(res, 405, "Method Not Allowed");
                            return;
                        }
                        /**
                         * Prüfen, ob der
                         * serverseitige API-Key
                         * vorhanden ist.
                         */
                        if (!oddsApiKey) {
                            sendJsonError(res, 500, "ODDS_API_KEY ist serverseitig nicht konfiguriert.");
                            return;
                        }
                        try {
                            /**
                             * Query-Parameter aus der
                             * lokalen Proxy-URL lesen.
                             */
                            const localUrl = new URL(req.url ||
                                "/", "http://localhost");
                            const date = localUrl.searchParams.get("date");
                            if (!date) {
                                sendJsonError(res, 400, "Der Query-Parameter date fehlt.");
                                return;
                            }
                            const parsedDate = new Date(date);
                            /**
                             * Kompatible Prüfung auf
                             * ein ungültiges Datum.
                             */
                            if (isNaN(parsedDate.getTime())) {
                                sendJsonError(res, 400, "Der Query-Parameter date ist ungültig.");
                                return;
                            }
                            /**
                             * API-kompatibler historischer
                             * Timestamp ohne Millisekunden.
                             *
                             * Beispiel:
                             *
                             * 2025-07-01T18:07:00Z
                             */
                            const historicalApiTimestamp = toHistoricalApiTimestamp(parsedDate);
                            /**
                             * Ziel-URL für
                             * The Odds API.
                             *
                             * Diese URL existiert nur
                             * serverseitig.
                             */
                            const targetUrl = new URL("/v4/historical/sports/baseball_mlb/odds", ODDS_API_BASE_URL);
                            targetUrl.searchParams.set("apiKey", oddsApiKey);
                            targetUrl.searchParams.set("regions", "eu,us");
                            targetUrl.searchParams.set("markets", "totals");
                            targetUrl.searchParams.set("oddsFormat", "decimal");
                            targetUrl.searchParams.set("dateFormat", "iso");
                            targetUrl.searchParams.set("date", historicalApiTimestamp);
                            /**
                             * Keine vollständige URL
                             * und keinen API-Key loggen.
                             */
                            console.log("[Historical Odds Proxy] Request:", {
                                requestedDate: parsedDate.toISOString(),
                                apiDate: historicalApiTimestamp,
                                endpoint: "baseball_mlb historical totals",
                            });
                            /**
                             * Serverseitiger Request
                             * an The Odds API.
                             */
                            const upstreamResponse = await fetch(targetUrl.toString(), {
                                method: "GET",
                                headers: {
                                    Accept: "application/json",
                                    "User-Agent": "MLB-Analyzer/5.0.4",
                                },
                            });
                            /**
                             * Antwort zunächst als Text
                             * lesen.
                             */
                            const body = await upstreamResponse.text();
                            /**
                             * HTTP-Status übernehmen.
                             */
                            res.statusCode =
                                upstreamResponse.status;
                            /**
                             * Content-Type übernehmen.
                             */
                            const contentType = upstreamResponse.headers.get("content-type");
                            if (contentType) {
                                res.setHeader("Content-Type", contentType);
                            }
                            else {
                                res.setHeader("Content-Type", "application/json; charset=utf-8");
                            }
                            /**
                             * API-Nutzungsinformationen
                             * weiterreichen.
                             */
                            const requestsRemaining = upstreamResponse.headers.get("x-requests-remaining");
                            const requestsUsed = upstreamResponse.headers.get("x-requests-used");
                            const requestsLast = upstreamResponse.headers.get("x-requests-last");
                            if (requestsRemaining) {
                                res.setHeader("x-requests-remaining", requestsRemaining);
                            }
                            if (requestsUsed) {
                                res.setHeader("x-requests-used", requestsUsed);
                            }
                            if (requestsLast) {
                                res.setHeader("x-requests-last", requestsLast);
                            }
                            res.setHeader("Cache-Control", "no-store");
                            res.end(body);
                            console.log("[Historical Odds Proxy] Response:", {
                                status: upstreamResponse.status,
                                requestsRemaining,
                                requestsUsed,
                                requestsLast,
                            });
                        }
                        catch (error) {
                            /**
                             * Versteckte Node-fetch-
                             * Ursache ausgeben.
                             */
                            const diagnostic = createErrorDiagnostic(error);
                            console.error("========================================");
                            console.error("[Historical Odds Proxy] UPSTREAM ERROR DIAGNOSTIC");
                            console.error("========================================");
                            console.error(diagnostic);
                            console.error("========================================");
                            /**
                             * An den Browser senden wir
                             * bewusst keine internen
                             * Netzwerkdetails.
                             */
                            sendJsonError(res, 502, "Historical Odds Upstream Request fehlgeschlagen. Details siehe Server-Terminal.");
                        }
                    });
                },
            },
        ],
        resolve: {
            alias: {
                "@": "/src",
            },
        },
        server: {
            port: 5173,
            open: true,
        },
        build: {
            outDir: "dist",
            sourcemap: true,
        },
    };
});
