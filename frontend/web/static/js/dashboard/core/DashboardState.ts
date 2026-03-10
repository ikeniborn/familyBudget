/**
 * Dashboard State Management
 *
 * Central state container for dashboard module.
 * Follows the pattern from TransferState.ts in transfers module.
 *
 * Key principles:
 * - Single source of truth for dashboard state
 * - Immutable reads via getState()
 * - Controlled mutations via updateState()
 * - State reset capability for cleanup
 */

import type {
  Category,
  CostCenter,
  DropdownCache,
  EditRecordType,
} from '../types/dashboard.d';
import type {
  CategoryTreeSelectInstance,
  CalendarWidgetInstance,
} from '../types/globals.d';

// ============================================================================
// State Interface
// ============================================================================

export interface DashboardState {
  // Widget instances
  transactionCategoryTreeSelect: CategoryTreeSelectInstance | null;
  planCategoryTreeSelect: CategoryTreeSelectInstance | null;
  editCategoryTreeSelect: CategoryTreeSelectInstance | null;

  // Transfer tab widget instances (for modal_fact and modal_plan)
  factTransferFromCategoryTree: CategoryTreeSelectInstance | null;
  factTransferToCategoryTree: CategoryTreeSelectInstance | null;
  planTransferFromCategoryTree: CategoryTreeSelectInstance | null;
  planTransferToCategoryTree: CategoryTreeSelectInstance | null;

  // Calendar widget instances
  editDateCalendar: CalendarWidgetInstance | null;
  editReminderCalendar: CalendarWidgetInstance | null;
  reminderCalendarWidget: CalendarWidgetInstance | null;
  recurringEndDateCalendarWidget: CalendarWidgetInstance | null;

  // Data cache
  allCategories: Category[];
  allCostCenters: CostCenter[];
  dropdownCache: DropdownCache;

  // Edit modal state
  currentEditingRecordType: EditRecordType;
  currentEditingPendingId: number | null;

  // Pending records deduplication
  loadPendingLock: Promise<void> | null;
  loadPendingCallCount: number;

  // Mobile UI state
  quickStatsExpanded: boolean;
  accountBalancesExpanded: boolean;

  // Hints debounce state
  planHintsTimeout: ReturnType<typeof setTimeout> | null;
  planHintsController: AbortController | null;
  factHintsTimeout: ReturnType<typeof setTimeout> | null;
  factHintsController: AbortController | null;

  // Module initialization flag
  initialized: boolean;
}

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function createDefaultState(): DashboardState {
  return {
    // Widget instances
    transactionCategoryTreeSelect: null,
    planCategoryTreeSelect: null,
    editCategoryTreeSelect: null,

    // Transfer tab widget instances
    factTransferFromCategoryTree: null,
    factTransferToCategoryTree: null,
    planTransferFromCategoryTree: null,
    planTransferToCategoryTree: null,

    // Calendar widget instances
    editDateCalendar: null,
    editReminderCalendar: null,
    reminderCalendarWidget: null,
    recurringEndDateCalendarWidget: null,

    // Data cache
    allCategories: [],
    allCostCenters: [],
    dropdownCache: {
      categories: { data: null, timestamp: 0, ttl: DEFAULT_CACHE_TTL },
      financialCenters: { data: null, timestamp: 0, ttl: DEFAULT_CACHE_TTL },
      costCenters: { data: null, timestamp: 0, ttl: DEFAULT_CACHE_TTL },
    },

    // Edit modal state
    currentEditingRecordType: null,
    currentEditingPendingId: null,

    // Pending records deduplication
    loadPendingLock: null,
    loadPendingCallCount: 0,

    // Mobile UI state
    quickStatsExpanded: false,
    accountBalancesExpanded: false,

    // Hints debounce state
    planHintsTimeout: null,
    planHintsController: null,
    factHintsTimeout: null,
    factHintsController: null,

    // Module initialization flag
    initialized: false,
  };
}

// ============================================================================
// State Instance (Module-Level Singleton)
// ============================================================================

let state: DashboardState = createDefaultState();

// ============================================================================
// State Accessors
// ============================================================================

/**
 * Get current state (readonly)
 * Returns a frozen copy to prevent direct mutations
 */
export function getState(): Readonly<DashboardState> {
  return state;
}

/**
 * Update state with partial updates
 * @param updates - Partial state to merge
 */
export function updateState(updates: Partial<DashboardState>): void {
  state = {
    ...state,
    ...updates,
  };
}

/**
 * Reset state to initial values
 * Useful for cleanup on page unload or testing
 */
export function resetState(): void {
  // Cleanup existing widget instances
  if (state.transactionCategoryTreeSelect) {
    try {
      state.transactionCategoryTreeSelect.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.planCategoryTreeSelect) {
    try {
      state.planCategoryTreeSelect.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.editCategoryTreeSelect) {
    try {
      state.editCategoryTreeSelect.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.planTransferFromCategoryTree) {
    try {
      state.planTransferFromCategoryTree.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.planTransferToCategoryTree) {
    try {
      state.planTransferToCategoryTree.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.editDateCalendar) {
    try {
      state.editDateCalendar.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.reminderCalendarWidget) {
    try {
      state.reminderCalendarWidget.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  if (state.recurringEndDateCalendarWidget) {
    try {
      state.recurringEndDateCalendarWidget.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  // Cancel pending hints requests
  if (state.planHintsTimeout) {
    clearTimeout(state.planHintsTimeout);
  }
  if (state.factHintsTimeout) {
    clearTimeout(state.factHintsTimeout);
  }
  if (state.planHintsController) {
    state.planHintsController.abort();
  }
  if (state.factHintsController) {
    state.factHintsController.abort();
  }

  // Reset to default
  state = createDefaultState();
}

// ============================================================================
// Dropdown Cache Helpers
// ============================================================================

/**
 * Check if cache entry is valid (not expired)
 */
export function isCacheValid<T>(cache: { data: T | null; timestamp: number; ttl: number }): boolean {
  if (!cache.data) return false;
  return Date.now() - cache.timestamp < cache.ttl;
}

/**
 * Invalidate a specific cache entry
 */
export function invalidateCache(cacheKey: keyof DropdownCache): void {
  state.dropdownCache[cacheKey].data = null;
  state.dropdownCache[cacheKey].timestamp = 0;
}

/**
 * Update cache entry with new data
 */
export function setCacheData<T>(
  cacheKey: keyof DropdownCache,
  data: T,
  ttl: number = DEFAULT_CACHE_TTL
): void {
  (state.dropdownCache[cacheKey] as { data: T | null; timestamp: number; ttl: number }) = {
    data,
    timestamp: Date.now(),
    ttl,
  };
}

// ============================================================================
// Widget Instance Helpers
// ============================================================================

/**
 * Set transaction category tree select instance
 */
export function setTransactionCategoryTreeSelect(instance: CategoryTreeSelectInstance | null): void {
  state.transactionCategoryTreeSelect = instance;
}

/**
 * Set plan category tree select instance
 */
export function setPlanCategoryTreeSelect(instance: CategoryTreeSelectInstance | null): void {
  state.planCategoryTreeSelect = instance;
}

/**
 * Set edit category tree select instance
 */
export function setEditCategoryTreeSelect(instance: CategoryTreeSelectInstance | null): void {
  state.editCategoryTreeSelect = instance;
}

// ============================================================================
// Pending Records Deduplication Helpers
// ============================================================================

/**
 * Get and increment pending call count (for debugging)
 */
export function incrementPendingCallCount(): number {
  state.loadPendingCallCount++;
  return state.loadPendingCallCount;
}

/**
 * Set pending lock promise
 */
export function setPendingLock(lock: Promise<void> | null): void {
  state.loadPendingLock = lock;
}

/**
 * Get pending lock promise
 */
export function getPendingLock(): Promise<void> | null {
  return state.loadPendingLock;
}
