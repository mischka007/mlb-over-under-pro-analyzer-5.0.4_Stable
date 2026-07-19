import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { HistoryEntry } from "@/types";
import { Card } from "@/components/common/UI";
import { clearHistory, deleteHistoryEntry } from "@/utils/history";

/** Zeigt alle gespeicherten vergangenen Analysen, neueste zuerst. */
export function HistoryPage({
  entries,
  onBack,
  onReload,
  onOpenEntry,
}: {
  entries: HistoryEntry[];
  onBack: () => void;
  onReload: () => void;
  onOpenEntry: (entry: HistoryEntry) => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-gold-400 transition-colors">
          <ArrowLeft size={14} /> Zurück
        </button>
        {entries.length > 0 && (
          <button
            onClick={() => {
              if (confirmClear) {
                clearHistory();
                onReload();
                setConfirmClear(false);
              } else {
                setConfirmClear(true);
              }
            }}
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-negred-400 hover:text-negred-300 transition-colors"
          >
            <Trash2 size={13} /> {confirmClear ? "Wirklich alles löschen?" : "Historie leeren"}
          </button>
        )}
      </div>

      <h2 className="font-display text-xl font-semibold uppercase tracking-wide text-slate-100">Historie</h2>

      {entries.length === 0 ? (
        <Card>
          <div className="text-center py-8 font-mono text-xs text-slate-500">Noch keine gespeicherten Analysen.</div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => (
            <Card key={entry.id} accent="none">
              <div className="flex items-center justify-between gap-4">
                <button onClick={() => onOpenEntry(entry)} className="text-left flex-1">
                  <div className="font-display text-sm font-semibold text-slate-100">
                    {entry.awayTeamName} @ {entry.homeTeamName}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500">
                    {new Date(entry.timestamp).toLocaleString("de-DE")} · Linie {entry.line}
                  </div>
                </button>
                <div className="flex items-center gap-3">
                  {entry.pick && (
                    <span className={`font-display text-sm font-bold uppercase ${entry.pick === "over" ? "text-gold-400" : "text-teal-400"}`}>
                      {entry.pick === "over" ? "Über" : "Unter"}
                    </span>
                  )}
                  <span className="font-numeric text-lg text-slate-100">{(entry.confidence * 100).toFixed(0)}%</span>
                  <span className="font-mono text-xs px-2 py-1 rounded-md border border-base-600 text-slate-300">{entry.grade}</span>
                  <button
                    onClick={() => {
                      deleteHistoryEntry(entry.id);
                      onReload();
                    }}
                    className="text-slate-600 hover:text-negred-400 transition-colors"
                    aria-label="Löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
