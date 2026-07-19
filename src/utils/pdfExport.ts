import { isoDateStamp } from "@/utils/format";

/**
 * Backtesting PRO Phase 3: generischer PDF-Export eines beliebigen
 * DOM-Elements. Nutzt exakt dasselbe Muster wie der bestehende PDF-
 * Export im Haupt-Dashboard (`ExportPanel.tsx`: html2canvas-Screenshot →
 * jsPDF), hier als eigenständige, wiederverwendbare Funktion extrahiert,
 * damit die neue Backtesting-PRO-Seite denselben, bereits bewährten
 * Mechanismus nutzen kann, ohne `ExportPanel.tsx` selbst zu verändern.
 * Beide dynamischen Importe (html2canvas, jspdf) laden weiterhin nur bei
 * tatsächlicher Nutzung, damit das initiale Bundle klein bleibt.
 */
export async function exportElementAsPdf(element: HTMLElement, filenamePrefix: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const canvas = await html2canvas(element, { backgroundColor: "#12151A", scale: 2 });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filenamePrefix}-${isoDateStamp()}.pdf`);
}
