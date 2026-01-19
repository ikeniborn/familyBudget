/**
 * Dashboard State Manager
 *
 * Handles state initialization and synchronization with global window objects.
 * Ensures backward compatibility with existing inline JavaScript.
 */

import {
  getState,
  updateState,
  setTransactionCategoryTreeSelect,
  setPlanCategoryTreeSelect,
  setEditCategoryTreeSelect,
} from './DashboardState';

import type { CategoryTreeSelectInstance } from '../types/globals.d';
import type { CostCenter, DropdownCache } from '../types/dashboard.d';

// ============================================================================
// State Initialization
// ============================================================================

/**
 * Initialize dashboard state from existing window globals
 * Called during module initialization to pick up any pre-existing state
 */
export function initializeStateFromGlobals(): void {
  // Sync widget instances from window if they exist
  if (window.transactionCategoryTreeSelect) {
    setTransactionCategoryTreeSelect(window.transactionCategoryTreeSelect);
  }
  if (window.planCategoryTreeSelect) {
    setPlanCategoryTreeSelect(window.planCategoryTreeSelect);
  }
  if (window.editCategoryTreeSelect) {
    setEditCategoryTreeSelect(window.editCategoryTreeSelect);
  }

  // Sync cost centers
  if (window.allCostCenters) {
    updateState({ allCostCenters: window.allCostCenters });
  }

  // Sync dropdown cache
  if (window.dropdownCache) {
    updateState({ dropdownCache: window.dropdownCache });
  }
}

/**
 * Sync module state back to window globals
 * Called after state updates to maintain backward compatibility
 */
export function syncStateToGlobals(): void {
  const state = getState();

  // Sync widget instances
  window.transactionCategoryTreeSelect = state.transactionCategoryTreeSelect;
  window.planCategoryTreeSelect = state.planCategoryTreeSelect;
  window.editCategoryTreeSelect = state.editCategoryTreeSelect;

  // Sync data
  window.allCostCenters = state.allCostCenters;
  window.dropdownCache = state.dropdownCache;
}

// ============================================================================
// Reactive Property Definitions
// ============================================================================

/**
 * Define reactive getters on window for widget instances
 * This allows external code to access widget instances via window.<name>
 * while the actual state is managed by the module
 */
export function defineReactiveProperties(): void {
  // Transaction category tree select
  if (!Object.getOwnPropertyDescriptor(window, 'transactionCategoryTreeSelect')?.get) {
    Object.defineProperty(window, 'transactionCategoryTreeSelect', {
      get: () => getState().transactionCategoryTreeSelect,
      set: (value: CategoryTreeSelectInstance | null) => {
        setTransactionCategoryTreeSelect(value);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // Plan category tree select
  if (!Object.getOwnPropertyDescriptor(window, 'planCategoryTreeSelect')?.get) {
    Object.defineProperty(window, 'planCategoryTreeSelect', {
      get: () => getState().planCategoryTreeSelect,
      set: (value: CategoryTreeSelectInstance | null) => {
        setPlanCategoryTreeSelect(value);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // Edit category tree select
  if (!Object.getOwnPropertyDescriptor(window, 'editCategoryTreeSelect')?.get) {
    Object.defineProperty(window, 'editCategoryTreeSelect', {
      get: () => getState().editCategoryTreeSelect,
      set: (value: CategoryTreeSelectInstance | null) => {
        setEditCategoryTreeSelect(value);
      },
      configurable: true,
      enumerable: true,
    });
  }

  // Cost centers array
  if (!Object.getOwnPropertyDescriptor(window, 'allCostCenters')?.get) {
    Object.defineProperty(window, 'allCostCenters', {
      get: () => getState().allCostCenters,
      set: (value: CostCenter[]) => {
        updateState({ allCostCenters: value });
      },
      configurable: true,
      enumerable: true,
    });
  }

  // Dropdown cache
  if (!Object.getOwnPropertyDescriptor(window, 'dropdownCache')?.get) {
    Object.defineProperty(window, 'dropdownCache', {
      get: () => getState().dropdownCache,
      set: (value: DropdownCache) => {
        updateState({ dropdownCache: value });
      },
      configurable: true,
      enumerable: true,
    });
  }
}

// ============================================================================
// Initialization Check
// ============================================================================

/**
 * Check if dashboard state is initialized
 */
export function isInitialized(): boolean {
  return getState().initialized;
}

/**
 * Mark dashboard as initialized
 */
export function setInitialized(value: boolean): void {
  updateState({ initialized: value });
}
