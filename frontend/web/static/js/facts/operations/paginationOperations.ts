/**
 * Facts Manager - Pagination Operations
 *
 * Pagination logic and UI updates.
 *
 * Phase 1.3: Extract Pagination Operations
 * Extracted from: frontend/web/templates/facts.html (lines 1551-1583)
 */

import { getCurrentPage, setCurrentPage, getPageSize, getTotalFacts } from '../core/stateManager';

// ============================================================================
// Pagination Calculations
// ============================================================================

/**
 * Calculate total pages
 */
export function getTotalPages(): number {
    const totalFacts = getTotalFacts();
    const pageSize = getPageSize();
    return Math.ceil(totalFacts / pageSize);
}

/**
 * Check if previous page available
 */
export function hasPreviousPage(): boolean {
    return getCurrentPage() > 0;
}

/**
 * Check if next page available
 */
export function hasNextPage(): boolean {
    const currentPage = getCurrentPage();
    const pageSize = getPageSize();
    const totalFacts = getTotalFacts();
    return (currentPage + 1) * pageSize < totalFacts;
}

/**
 * Get offset for current page
 */
export function getOffset(): number {
    return getCurrentPage() * getPageSize();
}

/**
 * Get limit (page size)
 */
export function getLimit(): number {
    return getPageSize();
}

// ============================================================================
// Pagination Actions
// ============================================================================

/**
 * Go to previous page
 * Returns true if page changed, false otherwise
 */
export function previousPage(): boolean {
    if (hasPreviousPage()) {
        setCurrentPage(getCurrentPage() - 1);
        return true;
    }
    return false;
}

/**
 * Go to next page
 * Returns true if page changed, false otherwise
 */
export function nextPage(): boolean {
    if (hasNextPage()) {
        setCurrentPage(getCurrentPage() + 1);
        return true;
    }
    return false;
}

/**
 * Go to first page
 */
export function firstPage(): void {
    setCurrentPage(0);
}

/**
 * Go to last page
 */
export function lastPage(): void {
    const totalPages = getTotalPages();
    setCurrentPage(Math.max(0, totalPages - 1));
}

/**
 * Go to specific page (0-indexed)
 */
export function goToPage(page: number): void {
    const totalPages = getTotalPages();
    const validPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(validPage);
}

// ============================================================================
// UI Updates
// ============================================================================

/**
 * Update pagination UI controls
 */
export function updatePaginationUI(): void {
    const controls = document.getElementById('pagination-controls');
    const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
    const pageInfo = document.getElementById('page-info');

    if (!controls || !prevBtn || !nextBtn || !pageInfo) {
        console.warn('[PaginationOps] Pagination UI elements not found');
        return;
    }

    const totalFacts = getTotalFacts();
    const pageSize = getPageSize();
    const currentPage = getCurrentPage();

    // Show/hide pagination controls
    if (totalFacts > pageSize) {
        controls.style.display = 'flex';

        // Update button states
        prevBtn.disabled = !hasPreviousPage();
        nextBtn.disabled = !hasNextPage();

        // Update page info text
        const totalPages = getTotalPages();
        pageInfo.textContent = `Страница ${currentPage + 1} из ${totalPages}`;
    } else {
        controls.style.display = 'none';
    }
}

/**
 * Get current page range (for stats display)
 */
export function getCurrentPageRange(): { start: number; end: number; total: number } {
    const currentPage = getCurrentPage();
    const pageSize = getPageSize();
    const totalFacts = getTotalFacts();

    const start = currentPage * pageSize + 1;
    const end = Math.min((currentPage + 1) * pageSize, totalFacts);

    return { start, end, total: totalFacts };
}
