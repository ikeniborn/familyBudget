/**
 * Context Modal Opener
 * Opens appropriate modal based on current page
 *
 * @module fab/contextModal
 */

import { openModalFact } from '../modalFact/index';
import { openModalPlan } from '../modalPlan/index';

declare const debugLog: (...args: any[]) => void;

const PAGE_CONTEXT_MAP: Record<string, 'fact' | 'plan'> = {
  '/': 'fact',        // Default to fact on home
  '/facts': 'fact',
  '/plan': 'plan'
};

/**
 * Open context-appropriate modal
 */
export function openContextModal(): void {
  const currentPage = window.location.pathname;
  const context = PAGE_CONTEXT_MAP[currentPage];

  debugLog('[ContextModal] Opening modal for page:', currentPage, 'context:', context);

  if (context === 'fact') {
    openModalFact();
  } else if (context === 'plan') {
    openModalPlan();
  } else {
    console.warn('[ContextModal] Unknown page context:', currentPage);
  }
}

// Export to window is handled by windowExports.ts
// No need to declare or assign here
