import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App";

import {
  ErrorBoundary,
} from "@/components/common/ErrorBoundary";

import {
  registerBacktestDevHook,
} from "@/backtesting/backtestDevHook";

import "@/index.css";

/**
 * Registriert im Entwicklungsmodus
 * die manuellen Backtest-Funktionen
 * für die Browser-Konsole.
 *
 * Im Production-Build registriert
 * registerBacktestDevHook() nichts.
 */
registerBacktestDevHook();

const rootElement =
  document.getElementById(
    "root"
  );

if (!rootElement) {
  throw new Error(
    "Root-Element '#root' wurde nicht gefunden."
  );
}

ReactDOM
  .createRoot(
    rootElement
  )
  .render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )