import { useEffect, useState } from "react";

/**
 * Gibt eine "verzögerte" Kopie von `value` zurück, die sich erst aktualisiert,
 * nachdem sich `value` für `delayMs` nicht mehr geändert hat.
 *
 * Wird genutzt, um die rechenintensive Analyse (insbesondere die
 * 20.000-Durchlauf-Monte-Carlo-PRO-Simulation) nicht bei jedem einzelnen
 * Tastendruck in einem Eingabefeld neu auszuführen, sondern erst, wenn der
 * Nutzer kurz innehält. Die Eingabefelder selbst bleiben dabei sofort
 * responsiv, da sie weiterhin direkt an den ungefilterten State gebunden
 * sind — nur die abgeleitete, teure Berechnung wird entkoppelt.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
