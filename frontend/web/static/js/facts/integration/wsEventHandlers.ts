/**
 * Facts Manager - WebSocket Event Handlers
 *
 * Registers WebSocket event handlers for real-time updates.
 *
 * Phase 3: WebSocket Integration
 */

import { loadFacts } from '../operations/factsController';
import { buildFilterQuery } from '../operations/filterOperations';
import type { BudgetFact } from '../types/models';

// ============================================================================
// Debouncing
// ============================================================================

const WS_RELOAD_DEBOUNCE_MS = 500;
let wsReloadTimeout: NodeJS.Timeout | null = null;

/**
 * Debounced reload via loadFacts()
 * Prevents multiple reloads within 500ms window
 */
function debouncedReloadFacts(): void {
    if (wsReloadTimeout) {
        clearTimeout(wsReloadTimeout);
    }

    wsReloadTimeout = setTimeout(() => {
        loadFacts();
    }, WS_RELOAD_DEBOUNCE_MS);
}

// ============================================================================
// Filter Matching
// ============================================================================

/**
 * Check if fact matches current filters
 * Used to decide if table needs reload
 *
 * @param fact - Fact data from WebSocket event
 * @returns true if fact matches current filters
 */
function matchesCurrentFilters(fact: Partial<BudgetFact>): boolean {
    const filters = buildFilterQuery();

    // Check record_type filter
    const recordType = filters.get('record_type');
    if (recordType && fact.record_type !== recordType) {
        return false;
    }

    // Check article_id filter
    const articleId = filters.get('article_id');
    if (articleId && fact.article_id !== parseInt(articleId)) {
        return false;
    }

    // Check financial_center_id filter
    const financialCenterId = filters.get('financial_center_id');
    if (financialCenterId && fact.financial_center_id !== parseInt(financialCenterId)) {
        return false;
    }

    // Check cost_center_id filter
    const costCenterId = filters.get('cost_center_id');
    if (costCenterId && fact.cost_center_id !== parseInt(costCenterId)) {
        return false;
    }

    // Check user_id filter
    const userId = filters.get('user_id');
    if (userId && fact.user_id !== parseInt(userId)) {
        return false;
    }

    // Check date range filters
    const dateFrom = filters.get('date_from');
    const dateTo = filters.get('date_to');
    if (fact.fact_date) {
        const factDate = new Date(fact.fact_date);
        if (dateFrom && factDate < new Date(dateFrom)) {
            return false;
        }
        if (dateTo && factDate > new Date(dateTo)) {
            return false;
        }
    }

    // Check search filter (description)
    const search = filters.get('search');
    if (search && fact.description) {
        if (!fact.description.toLowerCase().includes(search.toLowerCase())) {
            return false;
        }
    }

    return true;
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle fact_created WebSocket event
 * Reloads table if fact matches current filters
 */
function handleFactCreated(data: Partial<BudgetFact>): void {
    // Only reload if fact matches current filters
    if (matchesCurrentFilters(data)) {
        debouncedReloadFacts();
    }
}

/**
 * Handle fact_updated WebSocket event
 * Always reloads table (fact might have moved in/out of filter)
 */
function handleFactUpdated(_data: Partial<BudgetFact>): void {
    // Reload unconditionally (fact might have moved in/out of filters)
    debouncedReloadFacts();
}

/**
 * Handle fact_deleted WebSocket event
 * Reloads table to remove deleted fact
 */
function handleFactDeleted(_data: { id: number }): void {
    // Reload to remove deleted fact
    debouncedReloadFacts();
}

/**
 * Handle batch_delete_completed WebSocket event
 * Reloads table after bulk deletion
 */
function handleBatchDeleteCompleted(_data: { deleted_count: number; failed_count: number }): void {
    // Reload table after batch deletion
    debouncedReloadFacts();
}

/**
 * Handle transfer_created WebSocket event
 * Transfers create two facts, reload table
 */
function handleTransferCreated(_data: any): void {
    // Transfers create facts, reload table
    debouncedReloadFacts();
}

/**
 * Handle article_updated WebSocket event
 * Reload dropdowns (handled by AdminFactsCommon if available)
 */
function handleArticleUpdated(_data: any): void {
    // Reload table to reflect updated article names
    debouncedReloadFacts();
}

/**
 * Handle financial_center_updated WebSocket event
 * Reload dropdowns (handled by AdminFactsCommon if available)
 */
function handleFinancialCenterUpdated(_data: any): void {
    // Reload table to reflect updated FC names
    debouncedReloadFacts();
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register WebSocket event handlers
 * Called during Facts Manager initialization
 */
export function registerWSHandlers(): void {
    if (typeof window === 'undefined' || !window.budgetWSManager) {
        // WebSocket not available (offline mode or not initialized yet)
        return;
    }

    // Fact CRUD events
    window.budgetWSManager.on('fact_created', handleFactCreated);
    window.budgetWSManager.on('fact_updated', handleFactUpdated);
    window.budgetWSManager.on('fact_deleted', handleFactDeleted);

    // Batch operations
    window.budgetWSManager.on('batch_delete_completed', handleBatchDeleteCompleted);

    // Transfer events (transfers create facts)
    window.budgetWSManager.on('transfer_created', handleTransferCreated);

    // Dropdown data updates
    window.budgetWSManager.on('article_updated', handleArticleUpdated);
    window.budgetWSManager.on('financial_center_updated', handleFinancialCenterUpdated);
}

/**
 * Unregister WebSocket event handlers
 * Called during cleanup (if needed)
 */
export function unregisterWSHandlers(): void {
    if (typeof window === 'undefined' || !window.budgetWSManager) {
        return;
    }

    window.budgetWSManager.off('fact_created', handleFactCreated);
    window.budgetWSManager.off('fact_updated', handleFactUpdated);
    window.budgetWSManager.off('fact_deleted', handleFactDeleted);
    window.budgetWSManager.off('batch_delete_completed', handleBatchDeleteCompleted);
    window.budgetWSManager.off('transfer_created', handleTransferCreated);
    window.budgetWSManager.off('article_updated', handleArticleUpdated);
    window.budgetWSManager.off('financial_center_updated', handleFinancialCenterUpdated);
}
