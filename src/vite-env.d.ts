/// <reference types="vite/client" />

/**
 * Version 5.1 Stable — zur Build-Zeit über `vite.config.ts` (`define`)
 * real erzeugte Konstanten (siehe dort). `__GIT_REVISION__` ist `null`,
 * wenn kein Git-Repository vorhanden ist.
 */
declare const __BUILD_TIMESTAMP__: string;
declare const __GIT_REVISION__: string | null;
