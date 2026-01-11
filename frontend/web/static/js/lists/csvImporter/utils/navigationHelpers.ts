/**
 * CSV Importer - Navigation Helpers
 *
 * Navigation onclick handler generators for wizard steps.
 *
 * Phase 3: ES Modules Migration (Step 7)
 * Extracted from: frontend/web/static/js/lists/csvImporter.ts lines 186-206
 */

import { getGlobalVarName, getOnBackToStep1 } from '../core/stateManager';

// ============================================================================
// Navigation Handlers
// ============================================================================

/**
 * Get onclick handler for step 1 navigation.
 * Returns custom callback if set (for GoogleSheetsImporter delegation),
 * otherwise default renderStep1.
 *
 * @returns Onclick handler string
 */
export function getStep1OnClick(): string {
  const customCallback = getOnBackToStep1();
  if (customCallback) {
    // Custom callback is already a function, wrap in onclick
    return `(${customCallback})()`;
  }

  const varName = getGlobalVarName();
  return `window.${varName}.renderStep1()`;
}

/**
 * Get onclick handler for any step navigation.
 *
 * @param step - Step number (1-5)
 * @returns Onclick handler string
 */
export function getStepOnClick(step: number): string {
  if (step === 1) {
    return getStep1OnClick();
  }

  const varName = getGlobalVarName();
  return `window.${varName}.renderStep${step}()`;
}
