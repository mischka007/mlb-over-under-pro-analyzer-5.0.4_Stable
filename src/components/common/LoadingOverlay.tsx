import { Check, Loader2 } from "lucide-react";
import type { LoadingStep } from "@/types";

/**
 * Vollbild-Ladeanzeige während der automatischen Datenpipeline. Zeigt jeden
 * Ladeschritt einzeln mit Status (offen/erledigt) an, wie gefordert
 * ("Lade Spiel...", "Lade Pitcher...", usw.).
 */
export function LoadingOverlay({ steps }: { steps: LoadingStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const progress = steps.length ? (doneCount / steps.length) * 100 : 0;
  const currentStep = steps.find((s) => !s.done)?.label ?? "Analyse abgeschlossen.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base-950/90 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-base-600 bg-base-850 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Loader2 size={18} className="text-gold-400 animate-spin" />
          <span className="font-display text-sm uppercase tracking-widest text-slate-100">{currentStep}</span>
        </div>

        <div className="h-2 rounded-full bg-base-800 overflow-hidden mb-4">
          <div className="h-full bg-gold-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-2 font-mono text-[11px]">
              {step.done ? <Check size={13} className="text-posgreen-400 shrink-0" /> : <div className="w-[13px] h-[13px] rounded-full border border-base-600 shrink-0" />}
              <span className={step.done ? "text-slate-300" : "text-slate-600"}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
