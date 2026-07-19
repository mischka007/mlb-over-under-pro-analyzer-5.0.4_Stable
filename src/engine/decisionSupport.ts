import type {
  AdvancedPrediction,
  ConsensusResult,
  DecisionLabel,
  DecisionSupportModuleNote,
  DecisionSupportSummary,
  ModuleContradiction,
  ModuleInfluence,
  ModuleKey,
  ModuleResult,
  MonteCarloResult,
} from "@/types";
import { clamp, weightedAverage } from "@/utils/math";

/**
 * Tag 8 — Explainable AI & Smart Decision Support.
 *
 * Baut ausschließlich auf bereits bestehenden, unveränderten
 * Berechnungen auf: Modul-Scores/-Gewichte aus dem Konsens
 * (`ModuleResult`), `PredictionSummary`/`ConfidenceBreakdown` aus der
 * Prediction Engine PRO bzw. Confidence Engine (`AdvancedPrediction`)
 * sowie die Monte-Carlo-PRO-Simulationsstabilität (`MonteCarloResult`).
 * Erzeugt daraus eine erklärbare Zusammenfassung der aktuellen
 * Live-Prognose: warum OVER/UNDER, welche Module am meisten/wenigsten
 * Einfluss hatten, welche Module unsicher sind, ob sich Module
 * widersprechen, warum die Confidence so ausfällt, sowie einen
 * zusammengesetzten Decision Score. Erstellt kein neues Prognosemodell —
 * reine Erklärung/Aggregation bestehender Werte.
 */

/** Schwelle (absoluter Einfluss), ab der ein Modul als "spielentscheidend" für die Narrativ-Erzeugung gilt. */
const NARRATIVE_INFLUENCE_THRESHOLD = 1.5;

/** Schwelle (absoluter Einfluss), ab der zwei gegensätzliche Module als echter Widerspruch gelten. */
const CONTRADICTION_INFLUENCE_THRESHOLD = 2;

/** Schwelle, unterhalb derer eine Modul-Datenqualität als unsicher gilt. */
const UNCERTAIN_DATA_QUALITY_THRESHOLD = 50;

/** Mapping von Modul-Schlüssel auf den zugehörigen Datenqualitäts-Faktor der Confidence Engine (siehe `confidenceEngine.ts`). */
const MODULE_DATA_QUALITY_FACTOR_KEYS: Partial<Record<ModuleKey, string>> = {
  pitcher: "pitcherDataQuality",
  bullpen: "bullpenDataQuality",
  offense: "offenseDataQuality",
  weather: "weatherDataQuality",
  market: "marketDataQuality",
};

function computeModuleInfluences(modules: ModuleResult[]): ModuleInfluence[] {
  return modules
    .filter((m) => m.hasData)
    .map((m) => {
      const influence = m.weight * (m.score - 50);
      const direction: ModuleInfluence["direction"] = influence > 0.5 ? "over" : influence < -0.5 ? "under" : "neutral";
      return { moduleKey: m.key, label: m.label, score: m.score, weight: m.weight, influence, direction };
    });
}

/** Schritt 2: das Modul mit dem größten absoluten Einfluss, als lesbarer Satz. */
function describeStrongestSingleReason(influences: ModuleInfluence[]): string | null {
  if (influences.length === 0) return null;
  const strongest = [...influences].sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence))[0];
  if (Math.abs(strongest.influence) < 0.5) {
    return `Kein Modul zeigt einen klar dominanten Ausschlag — ${strongest.label} hat mit Score ${strongest.score}/100 den (schwachen) größten Einfluss.`;
  }
  const directionText = strongest.direction === "over" ? "Over" : strongest.direction === "under" ? "Under" : "eine neutrale Einschätzung";
  return `${strongest.label}: Score ${strongest.score}/100 bei ${(strongest.weight * 100).toFixed(0)}% Gewicht — der stärkste Einzelgrund für ${directionText}.`;
}

/** Schritt 2: Module mit dem geringsten absoluten Einfluss (Gegenstück zu den Top-Einflussfaktoren). */
function findLeastInfluentialModules(influences: ModuleInfluence[]): ModuleInfluence[] {
  return [...influences].sort((a, b) => Math.abs(a.influence) - Math.abs(b.influence)).slice(0, 3);
}

/** Schritt 4: Module mit unterdurchschnittlicher Datenqualität bzw. ohne Datenbasis. */
function findMostUncertainModules(modules: ModuleResult[], advancedPrediction: AdvancedPrediction): DecisionSupportModuleNote[] {
  const notes: DecisionSupportModuleNote[] = [];

  for (const module of modules) {
    const factorKey = MODULE_DATA_QUALITY_FACTOR_KEYS[module.key];

    if (factorKey) {
      const factor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === factorKey);
      if (factor && factor.score < UNCERTAIN_DATA_QUALITY_THRESHOLD) {
        notes.push({
          moduleKey: module.key,
          label: module.label,
          reason: `Datenqualität unterdurchschnittlich (${Math.round(factor.score)}/100) — ${factor.note}`,
        });
      } else if (!module.hasData) {
        notes.push({ moduleKey: module.key, label: module.label, reason: "Keine ausreichende Datenbasis vorhanden." });
      }
    } else if (!module.hasData) {
      notes.push({ moduleKey: module.key, label: module.label, reason: "Keine ausreichende Datenbasis vorhanden." });
    }
  }

  return notes;
}

/** Schritt 4: erkennt starke, aber gegensätzliche Modul-Ausschläge. */
function findModuleContradictions(influences: ModuleInfluence[]): ModuleContradiction[] {
  const overModules = influences.filter((i) => i.direction === "over" && Math.abs(i.influence) >= CONTRADICTION_INFLUENCE_THRESHOLD);
  const underModules = influences.filter((i) => i.direction === "under" && Math.abs(i.influence) >= CONTRADICTION_INFLUENCE_THRESHOLD);

  if (overModules.length === 0 || underModules.length === 0) return [];

  const strongestOver = [...overModules].sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence))[0];
  const strongestUnder = [...underModules].sort((a, b) => Math.abs(b.influence) - Math.abs(a.influence))[0];

  return [
    {
      overModule: strongestOver.label,
      underModule: strongestUnder.label,
      description: `${strongestOver.label} spricht für Over, ${strongestUnder.label} spricht für Under — die Module widersprechen sich.`,
    },
  ];
}

/** Schritt 4: menschlich lesbare Begründung der Confidence, aus den bestehenden Confidence-Engine-Faktoren. */
function describeConfidenceRationale(advancedPrediction: AdvancedPrediction): string[] {
  const factorSentences = [...advancedPrediction.confidenceBreakdown.factors]
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .map((f) => `${f.label}: ${Math.round(f.score)}/100 — ${f.note}`);

  return [...factorSentences, ...advancedPrediction.confidenceBreakdown.penalties];
}

/**
 * Schritt 3 — Smart Decision Support: erzeugt dynamische
 * Entscheidungssätze ausschließlich aus tatsächlich überschrittenen
 * Schwellenwerten je Modul (keine vorformulierten, für jede Prognose
 * gleichen Texte — jeder Satz ist an eine reale Bedingung geknüpft).
 */
function generateNarrativeSentences(
  influences: ModuleInfluence[],
  consensus: ConsensusResult,
  contradictions: ModuleContradiction[]
): string[] {
  const sentences: string[] = [];
  const byKey = new Map(influences.map((i) => [i.moduleKey, i]));

  const pitcher = byKey.get("pitcher");
  if (pitcher && Math.abs(pitcher.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(pitcher.direction === "under" ? "Starke Pitcher sprechen gegen viele Runs." : "Schwache Pitcher-Matchups sprechen für viele Runs.");
  }

  const bullpen = byKey.get("bullpen");
  if (bullpen && Math.abs(bullpen.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(bullpen.direction === "under" ? "Starke Bullpens begrenzen die Run-Erwartung." : "Schwache Bullpens erhöhen die Run-Erwartung.");
  }

  const offense = byKey.get("offense");
  if (offense && Math.abs(offense.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(
      offense.direction === "over" ? "Offensive beider Teams aktuell überdurchschnittlich." : "Offensive beider Teams aktuell unterdurchschnittlich."
    );
  }

  const ballpark = byKey.get("ballpark");
  if (ballpark && Math.abs(ballpark.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(ballpark.direction === "over" ? "Ballpark erhöht die Run-Produktion." : "Ballpark reduziert die Run-Produktion.");
  }

  const weather = byKey.get("weather");
  if (weather && Math.abs(weather.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(weather.direction === "over" ? "Wetterbedingungen begünstigen mehr Runs." : "Wetterbedingungen dämpfen die Run-Produktion.");
  }

  const market = byKey.get("market");
  if (market && market.direction !== "neutral" && consensus.pick !== null) {
    sentences.push(market.direction === consensus.pick ? "Markt bestätigt die Modellprognose." : "Markt widerspricht der Modellprognose.");
  }

  const h2h = byKey.get("h2h");
  if (h2h && Math.abs(h2h.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(h2h.direction === "over" ? "Direkter Vergleich beider Teams spricht für viele Runs." : "Direkter Vergleich beider Teams spricht für wenige Runs.");
  }

  const form = byKey.get("form");
  if (form && Math.abs(form.influence) >= NARRATIVE_INFLUENCE_THRESHOLD) {
    sentences.push(form.direction === "over" ? "Aktuelle Team-Form spricht für viele Runs." : "Aktuelle Team-Form spricht für wenige Runs.");
  }

  if (contradictions.length > 0) {
    sentences.push("Mehrere Module widersprechen sich.");
  }

  if (sentences.length === 0) {
    sentences.push("Kein Modul zeigt aktuell einen klar dominanten Ausschlag — die Prognose beruht auf einer ausgewogenen Gesamtsicht.");
  }

  return sentences;
}

/** Leitet aus dem Decision Score (0–100) das sechsstufige Decision Label ab. */
function decisionLabelFor(score: number): DecisionLabel {
  if (score >= 88) return "Elite";
  if (score >= 75) return "Sehr gut";
  if (score >= 60) return "Gut";
  if (score >= 45) return "Neutral";
  if (score >= 30) return "Schwach";
  return "Sehr schwach";
}

/**
 * Schritt 5 — Decision Score: gewichtete Kombination aus Prediction
 * Confidence, Datenqualität, Modulübereinstimmung, Modellstabilität
 * (Monte-Carlo-PRO-Simulationsstabilität) sowie — sofern verfügbar —
 * Backtesting-Ergebnissen (Historical Accuracy). Fehlt Letzteres (im
 * Live-Betrieb ohne vorherigen Backtest), wird der Faktor konsequent
 * ausgeschlossen statt erfunden — identisches Verhalten wie bereits in
 * der Confidence Engine PRO etabliert.
 */
function computeDecisionScore(advancedPrediction: AdvancedPrediction, montecarlo: MonteCarloResult): number {
  const moduleAgreementFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "moduleAgreement");
  const historicalAccuracyFactor = advancedPrediction.confidenceBreakdown.factors.find((f) => f.key === "historicalAccuracy");

  const components: { value: number | null; weight: number }[] = [
    { value: advancedPrediction.confidence * 100, weight: 0.3 },
    { value: advancedPrediction.predictionSummary.dataQualityPct, weight: 0.2 },
    { value: moduleAgreementFactor?.score ?? null, weight: 0.2 },
    { value: montecarlo.simulationConfidence, weight: 0.15 },
  ];

  if (historicalAccuracyFactor) {
    components.push({ value: historicalAccuracyFactor.score, weight: 0.15 });
  }

  return clamp(Math.round(weightedAverage(components) ?? 50), 0, 100);
}

/**
 * Baut die vollständige Explainable-AI-/Decision-Support-Zusammenfassung
 * für die aktuelle Live-Prognose auf.
 */
export function buildDecisionSupportSummary(params: {
  modules: ModuleResult[];
  consensus: ConsensusResult;
  advancedPrediction: AdvancedPrediction;
  montecarlo: MonteCarloResult;
}): DecisionSupportSummary {
  const influences = computeModuleInfluences(params.modules);
  const moduleContradictions = findModuleContradictions(influences);

  const decisionScore = computeDecisionScore(params.advancedPrediction, params.montecarlo);

  return {
    narrativeSentences: generateNarrativeSentences(influences, params.consensus, moduleContradictions),
    strongestSingleReason: describeStrongestSingleReason(influences),
    leastInfluentialModules: findLeastInfluentialModules(influences),
    mostUncertainModules: findMostUncertainModules(params.modules, params.advancedPrediction),
    moduleContradictions,
    confidenceRationale: describeConfidenceRationale(params.advancedPrediction),
    decisionScore,
    decisionLabel: decisionLabelFor(decisionScore),
  };
}
