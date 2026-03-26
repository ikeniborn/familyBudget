/**
 * Facts Manager - State Operations
 *
 * Getter/setter functions for accessing and modifying state.
 *
 * Phase 1.2: Extract State Management
 * Extracted from: frontend/web/templates/facts.html
 */

import type {
    FilterState,
    PaginationState,
    BudgetFact,
    Article,
    FinancialCenter,
    CostCenter,
    User
} from '../types/models';
import { getState, updateState } from './FactsState';

// ============================================================================
// Filter Operations
// ============================================================================

/**
 * Get current filters
 */
export function getFilters(): FilterState {
    return { ...getState().filters };
}

/**
 * Update filters (partial update)
 */
export function updateFilters(partial: Partial<FilterState>): void {
    const currentFilters = getState().filters;
    updateState({
        filters: { ...currentFilters, ...partial }
    });
}

/**
 * Reset filters to default values (preserving default date range)
 */
export function resetFilters(): void {
    const defaultDateRange = getDefaultDateRange();
    updateState({
        filters: {
            user_id: null,
            article_id: null,
            article_type: null,
            date_from: defaultDateRange.date_from,
            date_to: defaultDateRange.date_to,
            financial_center_id: null,
            cost_center_id: null,
            search: null
        }
    });
}

/**
 * Get default date range (current month)
 */
function getDefaultDateRange(): { date_from: string; date_to: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date_from = `${year}-${month}-01`;

    // Use BudgetShared.DateFormatter.todayISO() if available
    const date_to = (window as any).BudgetShared?.DateFormatter?.todayISO?.() ||
        new Date().toISOString().split('T')[0];

    return { date_from, date_to };
}

// ============================================================================
// Pagination Operations
// ============================================================================

/**
 * Get current pagination state
 */
export function getPagination(): PaginationState {
    return { ...getState().pagination };
}

/**
 * Get current page
 */
export function getCurrentPage(): number {
    return getState().pagination.currentPage;
}

/**
 * Set current page
 */
export function setCurrentPage(page: number): void {
    const currentPagination = getState().pagination;
    updateState({
        pagination: { ...currentPagination, currentPage: page }
    });
}

/**
 * Get page size
 */
export function getPageSize(): number {
    return getState().pagination.pageSize;
}

/**
 * Set page size
 */
export function setPageSize(size: number): void {
    const currentPagination = getState().pagination;
    updateState({
        pagination: { ...currentPagination, pageSize: size, currentPage: 0 }
    });
}

/**
 * Get total facts count
 */
export function getTotalFacts(): number {
    return getState().pagination.totalFacts;
}

/**
 * Set total facts count
 */
export function setTotalFacts(total: number): void {
    const currentPagination = getState().pagination;
    updateState({
        pagination: { ...currentPagination, totalFacts: total }
    });
}

/**
 * Update pagination (partial update)
 */
export function updatePagination(partial: Partial<PaginationState>): void {
    const currentPagination = getState().pagination;
    updateState({
        pagination: { ...currentPagination, ...partial }
    });
}

// ============================================================================
// Selection Operations
// ============================================================================

/**
 * Get selected fact IDs
 */
export function getSelectedIds(): Set<number> {
    return new Set(getState().selection.selectedFactIds);
}

/**
 * Toggle fact selection
 */
export function toggleSelection(factId: number): void {
    const selectedIds = new Set(getState().selection.selectedFactIds);
    if (selectedIds.has(factId)) {
        selectedIds.delete(factId);
    } else {
        selectedIds.add(factId);
    }
    const currentSelection = getState().selection;
    updateState({
        selection: { ...currentSelection, selectedFactIds: selectedIds }
    });
}

/**
 * Select all facts
 */
export function selectAll(factIds: number[]): void {
    const currentSelection = getState().selection;
    updateState({
        selection: { ...currentSelection, selectedFactIds: new Set(factIds) }
    });
}

/**
 * Clear selection
 */
export function clearSelection(): void {
    const currentSelection = getState().selection;
    updateState({
        selection: { ...currentSelection, selectedFactIds: new Set() }
    });
}

/**
 * Get deleting fact IDs (race condition prevention)
 */
export function getDeletingIds(): Set<number> {
    return new Set(getState().selection.deletingFactIds);
}

/**
 * Add fact to deleting set
 */
export function addDeletingId(factId: number): void {
    const deletingIds = new Set(getState().selection.deletingFactIds);
    deletingIds.add(factId);
    const currentSelection = getState().selection;
    updateState({
        selection: { ...currentSelection, deletingFactIds: deletingIds }
    });
}

/**
 * Remove fact from deleting set
 */
export function removeDeletingId(factId: number): void {
    const deletingIds = new Set(getState().selection.deletingFactIds);
    deletingIds.delete(factId);
    const currentSelection = getState().selection;
    updateState({
        selection: { ...currentSelection, deletingFactIds: deletingIds }
    });
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached facts
 */
export function getCachedFacts(): BudgetFact[] {
    return [...getState().cachedFacts];
}

/**
 * Set cached facts
 */
export function setCachedFacts(facts: BudgetFact[]): void {
    updateState({ cachedFacts: [...facts] });
}

/**
 * Get cached articles
 */
export function getCachedArticles(): Article[] {
    return [...getState().cachedArticles];
}

/**
 * Set cached articles
 */
export function setCachedArticles(articles: Article[]): void {
    updateState({ cachedArticles: [...articles] });
}

/**
 * Get cached financial centers
 */
export function getCachedFinancialCenters(): FinancialCenter[] {
    return [...getState().cachedFinancialCenters];
}

/**
 * Set cached financial centers
 */
export function setCachedFinancialCenters(centers: FinancialCenter[]): void {
    updateState({ cachedFinancialCenters: [...centers] });
}

/**
 * Get cached cost centers
 */
export function getCachedCostCenters(): CostCenter[] {
    return [...getState().cachedCostCenters];
}

/**
 * Set cached cost centers
 */
export function setCachedCostCenters(centers: CostCenter[]): void {
    updateState({ cachedCostCenters: [...centers] });
}

/**
 * Get cached users
 */
export function getCachedUsers(): User[] {
    return [...getState().cachedUsers];
}

/**
 * Set cached users
 */
export function setCachedUsers(users: User[]): void {
    updateState({ cachedUsers: [...users] });
}

// ============================================================================
// Category Tree Select Operations
// ============================================================================

/**
 * Get all categories
 */
export function getAllCategories(): Article[] {
    return [...getState().categoryTreeSelect.allCategories];
}

/**
 * Set all categories
 */
export function setAllCategories(categories: Article[]): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, allCategories: [...categories] }
    });
}

/**
 * Get create category tree select instance
 */
export function getCreateCategoryTreeSelect(): any | null {
    return getState().categoryTreeSelect.createCategoryTreeSelect;
}

/**
 * Set create category tree select instance
 */
export function setCreateCategoryTreeSelect(instance: any | null): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, createCategoryTreeSelect: instance }
    });
}

/**
 * Get edit category tree select instance
 */
export function getEditCategoryTreeSelect(): any | null {
    return getState().categoryTreeSelect.editCategoryTreeSelect;
}

/**
 * Set edit category tree select instance
 */
export function setEditCategoryTreeSelect(instance: any | null): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, editCategoryTreeSelect: instance }
    });
}

/**
 * Get edit date calendar instance
 */
export function getEditDateCalendar(): any | null {
    return getState().categoryTreeSelect.editDateCalendar;
}

/**
 * Set edit date calendar instance
 */
export function setEditDateCalendar(instance: any | null): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, editDateCalendar: instance }
    });
}

/**
 * Get transfer FROM category tree instance
 */
export function getCreateTransferFromTree(): any | null {
    return getState().categoryTreeSelect.createTransferFromTree;
}

/**
 * Set transfer FROM category tree instance
 */
export function setCreateTransferFromTree(instance: any | null): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, createTransferFromTree: instance }
    });
}

/**
 * Get transfer TO category tree instance
 */
export function getCreateTransferToTree(): any | null {
    return getState().categoryTreeSelect.createTransferToTree;
}

/**
 * Set transfer TO category tree instance
 */
export function setCreateTransferToTree(instance: any | null): void {
    const currentCTS = getState().categoryTreeSelect;
    updateState({
        categoryTreeSelect: { ...currentCTS, createTransferToTree: instance }
    });
}

// ============================================================================
// Fact Hints Operations
// ============================================================================

/**
 * Get fact hints timeout
 */
export function getFactHintsTimeout(): NodeJS.Timeout | null {
    return getState().factHints.timeout;
}

/**
 * Set fact hints timeout
 */
export function setFactHintsTimeout(timeout: NodeJS.Timeout | null): void {
    const currentHints = getState().factHints;
    updateState({
        factHints: { ...currentHints, timeout }
    });
}

/**
 * Get fact hints controller
 */
export function getFactHintsController(): AbortController | null {
    return getState().factHints.controller;
}

/**
 * Set fact hints controller
 */
export function setFactHintsController(controller: AbortController | null): void {
    const currentHints = getState().factHints;
    updateState({
        factHints: { ...currentHints, controller }
    });
}
