/**
 * Facts Manager - Filter Operations
 *
 * Filter building, validation, and UI synchronization.
 *
 * Phase 1.3: Extract Filter Operations
 * Extracted from: frontend/web/templates/facts.html (lines 415-474, 1236-1301)
 */

import type { FilterValidationResult } from '../types/models';
import { getFilters, updateFilters, resetFilters as resetFiltersState, setCurrentPage } from '../core/stateManager';
import { getBudgetShared } from '../types/dependencies';
import { factsFilterArticleWidget } from '../features/filterArticle/init';

// ============================================================================
// Filter Building
// ============================================================================

/**
 * Build URLSearchParams from current filter state
 * Always includes record_type='fact'
 */
export function buildFilterQuery(): URLSearchParams {
    const filters = getFilters();
    const params = new URLSearchParams();

    // Always filter by record_type='fact'
    params.append('record_type', 'fact');

    // Add filters
    if (filters.user_id) params.append('user_id', String(filters.user_id));
    if (filters.article_id) params.append('article_id', String(filters.article_id));
    if (filters.article_type) params.append('article_type', filters.article_type);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.financial_center_id) params.append('financial_center_id', String(filters.financial_center_id));
    if (filters.cost_center_id) params.append('cost_center_id', String(filters.cost_center_id));
    if (filters.search) params.append('search', filters.search);

    return params;
}

/**
 * Build query params for count endpoint (without pagination)
 */
export function buildCountQuery(): URLSearchParams {
    const params = buildFilterQuery();
    params.delete('limit');
    params.delete('offset');
    return params;
}

// ============================================================================
// Filter Validation
// ============================================================================

/**
 * Validate filter state
 * Currently validates date range
 */
export function validateFilters(): FilterValidationResult {
    const filters = getFilters();
    const errors: string[] = [];

    // Validate date range (optional - both can be null)
    if (filters.date_from && filters.date_to) {
        const dateFrom = new Date(filters.date_from);
        const dateTo = new Date(filters.date_to);

        if (dateFrom > dateTo) {
            errors.push('Дата начала не может быть позже даты окончания');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// Active Filters Counting
// ============================================================================

/**
 * Count active filters
 * Period (date range) is ALWAYS considered active even if default
 */
export function countActiveFilters(): number {
    const filters = getFilters();
    let count = 0;

    // Period: ALWAYS considered active (even if default)
    if (filters.date_from || filters.date_to) {
        count++;
    }

    // Other filters - count if set (not null/empty)
    if (filters.user_id) count++;
    if (filters.article_id) count++;
    if (filters.article_type) count++;
    if (filters.financial_center_id) count++;
    if (filters.cost_center_id) count++;
    if (filters.search) count++;

    return count;
}

// ============================================================================
// UI Synchronization
// ============================================================================

/**
 * Update filter indicator badge
 * Shows count of active filters
 */
export function updateFilterIndicator(): void {
    const indicator = document.getElementById('filter-indicator');
    if (!indicator) return;

    const activeFilters = countActiveFilters();

    if (activeFilters > 0) {
        indicator.textContent = activeFilters === 1 ? '1 активен' : `${activeFilters} активно`;
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

/**
 * Initialize default period filter in UI
 * Called on DOMContentLoaded
 */
export function initDefaultPeriodFilter(): void {
    const BudgetShared = getBudgetShared();
    const filters = getFilters();

    const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement;
    const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement;

    // YYYY-MM-DD → DD.MM.YYYY for display
    if (dateFromInput && filters.date_from) {
        dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_from);
    }
    if (dateToInput && filters.date_to) {
        dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_to);
    }

    // Update indicator - period is always considered active filter
    updateFilterIndicator();
}

/**
 * Read filters from UI inputs
 * Converts dates from DD.MM.YYYY to YYYY-MM-DD
 */
export function readFiltersFromUI(): void {
    const BudgetShared = getBudgetShared();

    const userId = (document.getElementById('filter-user') as HTMLSelectElement)?.value || null;
    const articleId = (document.getElementById('filter-article') as HTMLSelectElement)?.value || null;
    const articleType = (document.getElementById('filter-article-type') as HTMLSelectElement)?.value || null;

    // Convert dates from DD.MM.YYYY to YYYY-MM-DD for API
    const dateFromValue = (document.getElementById('filter-date-from') as HTMLInputElement)?.value;
    const date_from = dateFromValue ? BudgetShared.DateFormatter.formatForAPI(dateFromValue) : null;

    const dateToValue = (document.getElementById('filter-date-to') as HTMLInputElement)?.value;
    const date_to = dateToValue ? BudgetShared.DateFormatter.formatForAPI(dateToValue) : null;

    const financialCenterId = (document.getElementById('filter-financial-center') as HTMLSelectElement)?.value || null;
    const costCenterId = (document.getElementById('filter-cost-center') as HTMLSelectElement)?.value || null;

    // Trigram search by description
    const search = ((document.getElementById('filter-search') as HTMLInputElement)?.value || '').trim() || null;

    updateFilters({
        user_id: userId ? parseInt(userId) : null,
        article_id: articleId ? parseInt(articleId) : null,
        article_type: articleType as 'expense' | 'income' | 'debit' | 'credit' | null,
        date_from,
        date_to,
        financial_center_id: financialCenterId ? parseInt(financialCenterId) : null,
        cost_center_id: costCenterId ? parseInt(costCenterId) : null,
        search
    });
}

/**
 * Write filters to UI inputs
 * Converts dates from YYYY-MM-DD to DD.MM.YYYY
 */
export function writeFiltersToUI(): void {
    const BudgetShared = getBudgetShared();
    const filters = getFilters();

    // Clear all UI elements
    const userSelect = document.getElementById('filter-user') as HTMLSelectElement;
    const articleSelect = document.getElementById('filter-article') as HTMLSelectElement;
    const articleTypeSelect = document.getElementById('filter-article-type') as HTMLSelectElement;
    const fcSelect = document.getElementById('filter-financial-center') as HTMLSelectElement;
    const ccSelect = document.getElementById('filter-cost-center') as HTMLSelectElement;
    const searchInput = document.getElementById('filter-search') as HTMLInputElement;
    const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement;
    const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement;

    if (userSelect) userSelect.value = filters.user_id ? String(filters.user_id) : '';
    if (articleSelect) articleSelect.value = filters.article_id ? String(filters.article_id) : '';
    factsFilterArticleWidget.clearValue();
    if (articleTypeSelect) articleTypeSelect.value = filters.article_type || '';
    if (fcSelect) fcSelect.value = filters.financial_center_id ? String(filters.financial_center_id) : '';
    if (ccSelect) ccSelect.value = filters.cost_center_id ? String(filters.cost_center_id) : '';
    if (searchInput) searchInput.value = filters.search || '';

    // Update dates (YYYY-MM-DD → DD.MM.YYYY)
    if (dateFromInput && filters.date_from) {
        dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_from);
    }
    if (dateToInput && filters.date_to) {
        dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_to);
    }
}

// ============================================================================
// Filter Actions
// ============================================================================

/**
 * Apply filters (read from UI and trigger reload)
 * Resets pagination to first page
 */
export function applyFiltersAction(): void {
    // Read filters from UI
    readFiltersFromUI();

    // Reset to first page
    setCurrentPage(0);

    // Update indicator
    updateFilterIndicator();

    // Note: Reload logic will be triggered by caller (e.g., loadFacts())
}

/**
 * Reset filters to default values
 * Restores default period (current month)
 */
export function resetFiltersAction(): void {
    // Reset state
    resetFiltersState();

    // Write to UI
    writeFiltersToUI();

    // Reset to first page
    setCurrentPage(0);

    // Update indicator
    updateFilterIndicator();

    // Note: Reload logic will be triggered by caller (e.g., loadFacts())
}

/**
 * Collapse filters section
 */
export function collapseFilters(): void {
    const filtersToggle = document.getElementById('filters-toggle') as HTMLInputElement;
    if (filtersToggle) {
        filtersToggle.checked = false;
    }
}
