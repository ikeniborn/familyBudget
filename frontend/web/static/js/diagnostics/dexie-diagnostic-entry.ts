/**
 * Dexie Diagnostic entry point (v11.6.0+)
 *
 * Micro-bundle loaded globally in base.html for authenticated users.
 * Registers window.openDexieDiagnostic on pages that don't include
 * dashboard or lists bundles (e.g. /facts, /analytics, /notifications).
 *
 * Does NOT overwrite if dashboard/lists already registered the function.
 */
import { openDexieDiagnostic } from '../modules/uiComponents/modals/DexieDiagnosticModal';

if (typeof window !== 'undefined' && !(window as any).openDexieDiagnostic) {
  (window as any).openDexieDiagnostic = openDexieDiagnostic;
}
