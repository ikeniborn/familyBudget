/**
 * Facts Manager - State Management
 *
 * Centralized state for facts management page.
 *
 * Phase 1.2: Extract State Management
 * Extracted from: frontend/web/templates/facts.html (lines 337-409)
 */

import type {
    FilterState,
    PaginationState,
    SelectionState,
    CategoryTreeSelectState,
    FactHintsState,
    BudgetFact,
    Article,
    FinancialCenter,
    CostCenter,
    User
} from '../types/models';
import { getBudgetShared } from '../types/dependencies';

// ============================================================================
// State Interface
// ============================================================================

/**
 * Complete state for Facts Manager
 */
export interface FactsManagerState {
    // Filter state
    filters: FilterState;

    // Pagination state
    pagination: PaginationState;

    // Selection state
    selection: SelectionState;

    // Category tree select state
    categoryTreeSelect: CategoryTreeSelectState;

    // Fact hints state
    factHints: FactHintsState;

    // Cached data
    cachedFacts: BudgetFact[];
    cachedArticles: Article[];
    cachedFinancialCenters: FinancialCenter[];
    cachedCostCenters: CostCenter[];
    cachedUsers: User[];
}

// ============================================================================
// Initial State Factory
// ============================================================================

/**
 * Get default date range (current month start to today)
 */
function getDefaultDateRange(): { date_from: string; date_to: string } {
    const BudgetShared = getBudgetShared();

    // Current month start (YYYY-MM-DD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date_from = `${year}-${month}-01`;

    // Today (YYYY-MM-DD)
    const date_to = BudgetShared.DateFormatter.todayISO();

    return { date_from, date_to };
}

/**
 * Create initial Facts Manager state
 */
export function createInitialState(): FactsManagerState {
    const defaultDateRange = getDefaultDateRange();

    return {
        // Filter state
        filters: {
            user_id: null,
            article_id: null,
            article_type: null,
            date_from: defaultDateRange.date_from,
            date_to: defaultDateRange.date_to,
            financial_center_id: null,
            cost_center_id: null,
            search: null
        },

        // Pagination state
        pagination: {
            currentPage: 0,
            pageSize: 50,
            totalFacts: 0
        },

        // Selection state
        selection: {
            selectedFactIds: new Set(),
            deletingFactIds: new Set() // Track ongoing deletions to prevent race conditions
        },

        // Category tree select state
        categoryTreeSelect: {
            allCategories: [],
            createCategoryTreeSelect: null,
            editCategoryTreeSelect: null,
            editDateCalendar: null
        },

        // Fact hints state
        factHints: {
            timeout: null,
            controller: null
        },

        // Cached data
        cachedFacts: [],
        cachedArticles: [],
        cachedFinancialCenters: [],
        cachedCostCenters: [],
        cachedUsers: []
    };
}

// ============================================================================
// Singleton State (mimics class instance pattern)
// ============================================================================

let state: FactsManagerState | null = null;

/**
 * Get current state (throws if not initialized)
 */
export const getState = (): FactsManagerState => {
    if (!state) {
        throw new Error('[FactsState] State not initialized. Call initializeState() first.');
    }
    return state;
};

/**
 * Update state with partial updates
 */
export const updateState = (updates: Partial<FactsManagerState>): void => {
    if (!state) {
        throw new Error('[FactsState] State not initialized. Call initializeState() first.');
    }
    state = { ...state, ...updates };
};

/**
 * Reset state to initial values
 */
export const resetState = (): void => {
    state = createInitialState();
};

/**
 * Initialize state (must be called before using getState/updateState)
 */
export const initializeState = (): void => {
    state = createInitialState();
};

/**
 * Check if state is initialized
 */
export const isStateInitialized = (): boolean => {
    return state !== null;
};
