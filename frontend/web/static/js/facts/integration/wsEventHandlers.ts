/**
 * Facts Manager - WebSocket Event Handlers
 *
 * Registers WebSocket event handlers for real-time updates.
 * Uses incremental row updates for fact_created, fact_updated, fact_deleted
 * to avoid full table reloads on every WebSocket event.
 *
 * Phase 3: WebSocket Integration
 */

import { loadFacts, fetchAndInjectRow } from '../operations/factsController';
import { buildFilterQuery } from '../operations/filterOperations';
import { getCurrentPage, getTotalFacts, setTotalFacts } from '../core/stateManager';
import { updatePaginationUI } from '../operations/paginationOperations';
import type { BudgetFact } from '../types/models';

// ============================================================================
// Debouncing
// ============================================================================

const WS_RELOAD_DEBOUNCE_MS = 500;
let wsReloadTimeout: NodeJS.Timeout | null = null;

/**
 * Debounced reload via loadFacts()
 * Prevents multiple reloads within 500ms window
 * Used as fallback when incremental update fails
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
// Incremental Row Update Helpers
// ============================================================================

/**
 * Fetch HTML for a single fact row from the backend
 *
 * @param factId - Fact ID to fetch
 * @returns HTML string (desktop tr + mobile div) or null on error
 */
async function fetchRowHtml(factId: number): Promise<string | null> {
    try {
        const response = await fetch(`/api/v1/facts/${factId}/row-html`, {
            headers: { 'Accept': 'text/html' }
        });
        if (!response.ok) {
            return null;
        }
        return await response.text();
    } catch {
        return null;
    }
}

/**
 * Parse HTML fragment into desktop <tr> and mobile <div> elements.
 * Handles the <template data-plan-row="...">desktop|||mobile</template> wrapping
 * returned by the /row-html endpoint (template content lives in a DocumentFragment,
 * not queryable from the main document tree).
 *
 * @param html - Raw HTML string from /row-html endpoint
 * @returns Object with tr and mobileCard elements, or null if parsing fails
 */
export function parseRowHtml(html: string): { tr: HTMLTableRowElement; mobileCard: HTMLDivElement } | null {
    const parser = new DOMParser();

    const templateDoc = parser.parseFromString(html, 'text/html');
    const templateEl = templateDoc.querySelector('template[data-plan-row]');

    let tr: HTMLTableRowElement | null = null;
    let mobileCard: HTMLDivElement | null = null;

    if (templateEl) {
        const parts = templateEl.innerHTML.split('|||');
        const desktopDoc = parser.parseFromString(`<table><tbody>${parts[0] || ''}</tbody></table>`, 'text/html');
        const mobileDoc = parser.parseFromString(parts[1] || '', 'text/html');
        tr = desktopDoc.querySelector('tr[data-id]') as HTMLTableRowElement | null;
        mobileCard = mobileDoc.querySelector('div[data-id]') as HTMLDivElement | null;
    } else {
        // Fallback: direct parsing (legacy or changed endpoint format)
        const doc = parser.parseFromString(`<table><tbody>${html}</tbody></table>`, 'text/html');
        tr = doc.querySelector('tr[data-id]') as HTMLTableRowElement | null;
        mobileCard = doc.querySelector('div[data-id]') as HTMLDivElement | null;
    }

    if (!tr || !mobileCard) {
        return null;
    }

    return { tr, mobileCard };
}

/**
 * Prepend a new row to the facts table (desktop tbody + mobile list)
 * Only runs when on page 1.
 *
 * @param tr - Desktop table row element
 * @param mobileCard - Mobile card div element
 */
function prependRowToTable(tr: HTMLTableRowElement, mobileCard: HTMLDivElement): void {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        return;
    }

    const tbody = container.querySelector('.facts-desktop-table tbody');
    if (tbody && tbody.firstChild) {
        tbody.insertBefore(tr, tbody.firstChild);
    } else if (tbody) {
        tbody.appendChild(tr);
    }

    const mobileList = container.querySelector('.facts-mobile-list');
    if (mobileList && mobileList.firstChild) {
        mobileList.insertBefore(mobileCard, mobileList.firstChild);
    } else if (mobileList) {
        mobileList.appendChild(mobileCard);
    }
}

/**
 * Replace an existing row in the facts table with updated HTML
 *
 * @param factId - ID of the fact to replace
 * @param tr - New desktop row element
 * @param mobileCard - New mobile card element
 * @returns true if row was found and replaced
 */
function replaceRowInTable(
    factId: number,
    tr: HTMLTableRowElement,
    mobileCard: HTMLDivElement
): boolean {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        return false;
    }

    let replaced = false;

    const existingTr = container.querySelector(`tr[data-id="${factId}"]`);
    if (existingTr) {
        existingTr.replaceWith(tr);
        replaced = true;
    }

    const existingCard = container.querySelector(`div[data-id="${factId}"]`);
    if (existingCard) {
        existingCard.replaceWith(mobileCard);
        replaced = true;
    }

    return replaced;
}

/**
 * Animate fade-out and remove a row from the facts table
 *
 * @param factId - ID of the fact to remove
 */
function animateAndRemoveRow(factId: number): void {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        return;
    }

    const elements = container.querySelectorAll<HTMLElement>(
        `tr[data-id="${factId}"], div[data-id="${factId}"]`
    );

    elements.forEach(el => {
        el.style.transition = 'opacity 0.3s ease';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
    });
}

/**
 * Adjust the displayed total facts counter by delta (+1 or -1).
 * Used after incremental add/delete to keep the counter in sync
 * without a full table reload.
 */
function adjustStatTotal(delta: number): void {
    const newTotal = Math.max(0, getTotalFacts() + delta);
    setTotalFacts(newTotal);
    const el = document.getElementById('stat-total');
    if (el) el.textContent = String(newTotal);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle fact_created WebSocket event
 * Fetches row HTML and prepends to table (page 1 only).
 * Falls back to debounced full reload on error.
 */
async function handleFactCreated(data: Partial<BudgetFact>): Promise<void> {
    if (!matchesCurrentFilters(data)) {
        return;
    }

    if (!data.id) {
        debouncedReloadFacts();
        return;
    }

    // Only prepend on page 1 — other pages don't show the newest record
    if (getCurrentPage() !== 0) {
        return;
    }

    const html = await fetchRowHtml(data.id);
    if (!html) {
        debouncedReloadFacts();
        return;
    }

    const parsed = parseRowHtml(html);
    if (!parsed) {
        debouncedReloadFacts();
        return;
    }

    prependRowToTable(parsed.tr, parsed.mobileCard);
    adjustStatTotal(+1);
    updatePaginationUI();
}

/**
 * Handle fact_updated WebSocket event
 * Finds the existing row in DOM and replaces it with fresh HTML.
 * If row not in current view, skips silently.
 */
async function handleFactUpdated(data: Partial<BudgetFact>): Promise<void> {
    if (!data.id) {
        return;
    }

    const container = document.getElementById('facts-table-container');
    if (!container) {
        return;
    }

    // Only update if the row is currently visible in the DOM
    const existingTr = container.querySelector(`tr[data-id="${data.id}"]`);
    if (!existingTr) {
        return;
    }

    const html = await fetchRowHtml(data.id);
    if (!html) {
        return;
    }

    const parsed = parseRowHtml(html);
    if (!parsed) {
        return;
    }

    replaceRowInTable(data.id, parsed.tr, parsed.mobileCard);
}

/**
 * Handle fact_deleted WebSocket event
 * Animates and removes the row from DOM.
 * No API call required.
 */
function handleFactDeleted(data: { id: number }): void {
    if (!data.id) {
        return;
    }
    animateAndRemoveRow(data.id);
    adjustStatTotal(-1);
    updatePaginationUI();
}

/**
 * Handle batch_delete_completed WebSocket event
 * Reloads table after bulk deletion
 */
function handleBatchDeleteCompleted(_data: { deleted_count: number; failed_count: number }): void {
    debouncedReloadFacts();
}

/**
 * Handle transfer_created WebSocket event
 * Incrementally inserts two fact rows (expense + income).
 * Falls back to full reload if incremental fails or user is not on page 0.
 */
async function handleTransferCreated(data: { expense_fact_id?: number; income_fact_id?: number }): Promise<void> {
    if (getCurrentPage() !== 0) {
        debouncedReloadFacts();
        return;
    }
    const ids = [data.expense_fact_id, data.income_fact_id].filter(Boolean) as number[];
    const results = await Promise.all(ids.map(id => fetchAndInjectRow(id, 'create')));
    const injectedCount = results.filter(Boolean).length;
    if (injectedCount === 0) {
        debouncedReloadFacts();
    } else {
        adjustStatTotal(injectedCount);
    }
}

/**
 * Handle article_updated WebSocket event
 * Reload dropdowns (handled by AdminFactsCommon if available)
 */
function handleArticleUpdated(_data: any): void {
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
