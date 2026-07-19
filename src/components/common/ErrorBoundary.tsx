import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Fängt Rendering-Fehler in der gesamten Komponenten-Baum-Unterebene ab.
 * Ohne diese Boundary würde ein einzelner unerwarteter Fehler (z. B. eine
 * unerwartete API-Antwortform) die komplette App zu einem weißen Bildschirm
 * zusammenbrechen lassen. Stattdessen zeigt die App eine verständliche
 * Fehlermeldung mit der Möglichkeit, neu zu starten — sie stürzt nie
 * vollständig ab.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In einer echten Produktivumgebung würde hier ein Fehler-Tracking-
    // Dienst (z. B. Sentry) angebunden. Für dieses Projekt genügt eine
    // Konsolen-Ausgabe, damit der Fehler beim Debuggen sichtbar bleibt.
    console.error("MLB Analyzer – unerwarteter Rendering-Fehler:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-base-950 flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-negred-500/50 bg-base-850 p-6 text-center">
            <AlertOctagon size={32} className="text-negred-400 mx-auto mb-3" />
            <h2 className="font-display text-lg font-semibold text-slate-100 uppercase tracking-wide mb-2">
              Unerwarteter Fehler
            </h2>
            <p className="font-mono text-[11px] text-slate-500 mb-1">
              Etwas ist beim Rendern schiefgelaufen. Deine Eingaben sind nicht verloren — versuche es erneut.
            </p>
            {this.state.error && (
              <p className="font-mono text-[10px] text-negred-400/80 mb-4 break-words">{this.state.error.message}</p>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 rounded-md bg-gold-500 text-base-950 font-display font-semibold text-sm uppercase tracking-wide px-4 py-2.5 hover:bg-gold-400 transition-colors"
            >
              <RotateCcw size={14} /> Erneut versuchen
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
