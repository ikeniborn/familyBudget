/**
 * Transfer Module - Central State Management
 *
 * This module has ZERO dependencies to prevent circular dependencies.
 * All state mutations should go through updateState() to maintain consistency.
 *
 * Migrated from: frontend/web/static/js/transfer.js (lines 7-19)
 */

export {}; // Force module scope

// ============================================================================
// Type Definitions
// ============================================================================

import type { FinancialCenter, CostCenter, HintsData, TransferFormData } from '../types/transfer';

export type { TransferFormData };

export interface TransferState {
  // Record type
  recordType: 'fact' | 'plan';

  // Widget instances (initialized by stateManager)
  dateWidget: any | null; // CalendarWidget
  fromCategoryTree: any | null; // ChoicesCategoryTree (debit)
  toCategoryTree: any | null; // ChoicesCategoryTree (credit)

  // Data cache (IndexedDB)
  financialCenters: FinancialCenter[];
  costCenters: CostCenter[];

  // Debounce state for hints loading
  hintsFrom: {
    timeout: number | null;
    controller: AbortController | null;
  };
  hintsTo: {
    timeout: number | null;
    controller: AbortController | null;
  };

  // Current hints data
  fromHints: HintsData | null;
  toHints: HintsData | null;
}

// ============================================================================
// State Storage (Singleton)
// ============================================================================

/**
 * Create initial state
 */
function createInitialState(): TransferState {
  return {
    recordType: 'fact',
    dateWidget: null,
    fromCategoryTree: null,
    toCategoryTree: null,
    financialCenters: [],
    costCenters: [],
    hintsFrom: {
      timeout: null,
      controller: null
    },
    hintsTo: {
      timeout: null,
      controller: null
    },
    fromHints: null,
    toHints: null
  };
}

let state: TransferState = createInitialState();

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current state (read-only)
 *
 * Returns a readonly reference to prevent accidental mutations.
 * Use updateState() to modify state.
 *
 * @example
 * const state = getState();
 * debugLog('[Transfer] Record type:', state.recordType); // 'fact'
 */
export const getState = (): Readonly<TransferState> => state;

/**
 * Update state (partial updates)
 *
 * @param updates - Partial state object with fields to update
 *
 * @example
 * updateState({ recordType: 'plan' });
 * updateState({ financialCenters: [...], costCenters: [...] });
 */
export const updateState = (updates: Partial<TransferState>): void => {
  state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 *
 * Called when modal is closed or on cleanup.
 */
export const resetState = (): void => {
  // Abort any pending hints requests
  state.hintsFrom.controller?.abort();
  state.hintsTo.controller?.abort();

  // Clear timeouts
  if (state.hintsFrom.timeout !== null) {
    clearTimeout(state.hintsFrom.timeout);
  }
  if (state.hintsTo.timeout !== null) {
    clearTimeout(state.hintsTo.timeout);
  }

  state = createInitialState();
};
