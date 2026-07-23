import { useState } from "react";
import type { RefObject } from "react";
import { Download, FileImage, FileSpreadsheet, FileText, History } from "lucide-react";
import type { AnalysisMode, AnalyzerState, ConsensusResult, GameInfo, LineupQualityScore, MarketIntelligenceResult, PoissonResult, RunLineAnalysis, SmartAlert } from "@/types";
import { Card, SectionHeader } from "@/components/common/UI";
import { exportAnalysisAsCsv, exportChangeHistoryAsCsv } from "@/utils/csv";
import { isoDateStamp } from "@/utils/format";

/**
 * Export-Panel: ermöglicht den Export der Analyse als CSV (sofort
 * funktionsfähig, ohne externe Abhängigkeit), sowie als PNG-Screenshot und
 * PDF-Report des Dashboards (via html2canvas + jsPDF, dynamisch importiert
 * damit das initiale Bundle klein bleibt).
 */
export function ExportPanel({
  state,
  consensus,
  poisson,
  dashboardRef,
  gameInfo,
  marketIntelligence,
  lineupQuality,
  changeHistory,
  mode,
  runLineAnalysis,
}: {
  state: AnalyzerState;
  consensus: ConsensusResult;
  poisson: PoissonResult;
  dashboardRef: RefObject<HTMLDivElement | null>;
  gameInfo?: GameInfo | null;
  marketIntelligence?: MarketIntelligenceResult | null;
  lineupQuality?: LineupQualityScore | null;
  /** Version 6.0 (Paket 7B): Live-Monitoring-Change-History, sofern vorhanden. */
  changeHistory?: SmartAlert[];
  /** Version 7.0: aktueller Analysemodus + Run-Line-Ergebnis, fließen automatisch in den CSV-Export ein. */
  mode?: AnalysisMode;
  runLineAnalysis?: RunLineAnalysis | null;
}) {
  const [isExporting, setIsExporting] = useState<"png" | "pdf" | null>(null);

  const handleCsvExport = () => {
    exportAnalysisAsCsv(state, consensus, poisson, gameInfo, marketIntelligence, lineupQuality, mode, runLineAnalysis);
  };

  const handleChangeHistoryExport = () => {
    if (changeHistory) exportChangeHistoryAsCsv(changeHistory);
  };

  const handlePngExport = async () => {
    if (!dashboardRef.current) return;
    setIsExporting("png");
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: "#12151A", scale: 2 });
      const link = document.createElement("a");
      link.download = `mlb-analyzer-${isoDateStamp()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setIsExporting(null);
    }
  };

  const handlePdfExport = async () => {
    if (!dashboardRef.current) return;
    setIsExporting("pdf");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(dashboardRef.current, { backgroundColor: "#12151A", scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`mlb-analyzer-${isoDateStamp()}.pdf`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <Card accent="gold">
      <SectionHeader icon={Download} title="Export" accent="gold" />
      <div className="flex flex-wrap gap-2">
        <ExportButton icon={FileSpreadsheet} label="CSV exportieren" onClick={handleCsvExport} />
        {changeHistory && changeHistory.length > 0 && (
          <ExportButton icon={History} label={`Change History (${changeHistory.length})`} onClick={handleChangeHistoryExport} />
        )}
        <ExportButton icon={FileImage} label="Als PNG" onClick={handlePngExport} loading={isExporting === "png"} />
        <ExportButton icon={FileText} label="Als PDF" onClick={handlePdfExport} loading={isExporting === "pdf"} />
      </div>
    </Card>
  );
}

function ExportButton({
  icon: Icon,
  label,
  onClick,
  loading = false,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-md border border-base-600 bg-base-800/70 px-3.5 py-2.5 text-xs font-mono uppercase tracking-wider text-slate-300 transition-colors hover:border-gold-500 hover:text-gold-400 disabled:opacity-50"
    >
      <Icon size={14} />
      {loading ? "Erzeuge…" : label}
    </button>
  );
}
