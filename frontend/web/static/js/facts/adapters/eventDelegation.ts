/**
 * Facts Manager - Event Delegation
 *
 * Centralized event delegation for click handlers.
 * Replaces onclick attributes with data-action pattern.
 *
 * Phase 4: Cleanup & Optimization
 */

import { applyFiltersAction, resetFiltersAction, collapseFilters } from '../operations/filterOperations';
import { batchDelete, exportFilteredFacts, applyFiltersAndReload, resetFiltersAndReload, goToPreviousPage, goToNextPage } from '../operations/factsController';
import { previousPage, nextPage } from '../operations/paginationOperations';

/**
 * Setup event delegation for all clickable elements
 * Called during Facts Manager initialization
 */
export function setupEventDelegation(): void {
    // Delegate all clicks to document
    document.addEventListener('click', handleClick);
}

/**
 * Handle all click events via delegation
 * @param event - Click event
 */
function handleClick(event: Event): void {
    const target = event.target as HTMLElement;

    // Find closest element with data-action
    const actionElement = target.closest('[data-action]') as HTMLElement;
    if (!actionElement) {
        return;
    }

    const action = actionElement.dataset.action;
    if (!action) {
        return;
    }

    // Route to appropriate handler
    switch (action) {
        case 'apply-filters':
            applyFiltersAction();
            applyFiltersAndReload();
            break;

        case 'reset-filters':
            // Prevent collapse toggle and default checkbox behavior
            event.stopPropagation();
            event.preventDefault();
            resetFiltersAction();
            resetFiltersAndReload();
            break;

        case 'collapse-filters':
            collapseFilters();
            break;

        case 'export-csv':
            exportFilteredFacts('csv');
            break;

        case 'batch-delete':
            batchDelete();
            break;

        case 'previous-page':
            if (previousPage()) {
                goToPreviousPage();
            }
            break;

        case 'next-page':
            if (nextPage()) {
                goToNextPage();
            }
            break;

        default:
            // Unknown action, ignore
            break;
    }
}

/**
 * Cleanup event delegation
 * Called during cleanup (if needed)
 */
export function cleanupEventDelegation(): void {
    document.removeEventListener('click', handleClick);
}
