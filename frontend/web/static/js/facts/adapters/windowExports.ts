/**
 * Facts Manager - Window Exports Adapter
 *
 * Export functions to window for onclick compatibility.
 * Maps internal module functions to global window scope.
 *
 * Phase 1.6: Window Exports Adapter
 */

import { applyFiltersAction, resetFiltersAction, collapseFilters } from '../operations/filterOperations';
import { previousPage as prevPage, nextPage as nxtPage } from '../operations/paginationOperations';
import { toggleSelectAll as toggleAll, updateBatchDeleteButtonUI } from '../operations/selectionOperations';
import {
    deleteFact as deleteFactAction,
    batchDelete as batchDeleteAction,
    showEditModal as showEditModalAction,
    closeEditModal as closeEditModalAction,
    updateFact as updateFactAction,
    deleteFromEditModal as deleteFromEditModalAction,
    createFact as createFactAction,
    exportFilteredFacts as exportFilteredFactsAction,
    applyFiltersAndReload,
    resetFiltersAndReload,
    goToPreviousPage,
    goToNextPage
} from '../operations/factsController';

// Placeholder functions - will be implemented in full integration
declare global {
    interface Window {
        // Export все функции используемые в onclick handlers
        applyFilters: () => void;
        resetFilters: () => void;
        collapseFilters: () => void;
        previousPage: () => void;
        nextPage: () => void;
        toggleSelectAll: (checkbox: HTMLInputElement) => void;
        updateBatchDeleteButton: () => void;

        // Placeholders for full implementation
        batchDelete: () => Promise<void>;
        showEditModal: (factId: number) => Promise<void>;
        closeEditModal: () => void;
        updateFact: (event: Event) => Promise<void>;
        deleteFact: (factId: number) => Promise<void>;
        deleteFromEditModal: () => Promise<void>;
        exportFilteredFacts: (format: 'csv') => void;
        openCreateModal: () => void;
        openAddTransactionModal: () => void;
        openFactTransferModal: () => void;
        saveTransaction: (button: HTMLButtonElement) => void;
        saveTransfer: (button: HTMLButtonElement) => void;
        createFact: (event: Event) => Promise<void>;
        createTransfer: (event: Event) => Promise<void>;
        setTransactionDate: (offsetDays: number) => void;
        loadFactHints: (category?: any) => Promise<void>;
        filterEditCostCenters: (financialCenterId: string) => Promise<void>;
    }
}

/**
 * Setup window exports for onclick compatibility
 * CRITICAL: Must be called before rendering any HTML with onclick handlers
 */
export function setupWindowExports(): void {
    // Filter operations
    window.applyFilters = applyFilters;
    window.resetFilters = resetFilters;
    window.collapseFilters = collapseFilters;

    // Pagination operations
    window.previousPage = previousPage;
    window.nextPage = nextPage;

    // Selection operations
    window.toggleSelectAll = toggleSelectAll;
    window.updateBatchDeleteButton = updateBatchDeleteButton;

    // CRUD operations
    window.batchDelete = batchDelete;
    window.showEditModal = showEditModal;
    window.closeEditModal = closeEditModal;
    window.updateFact = updateFact;
    window.deleteFact = deleteFact;
    window.deleteFromEditModal = deleteFromEditModal;
    window.exportFilteredFacts = exportFilteredFacts;
    window.createFact = createFact;

    // Placeholders for functions not yet implemented
    // These will be replaced with actual implementations later
    window.openCreateModal = () => {
        console.warn('[FactsManager] openCreateModal not yet implemented');
    };
    window.openAddTransactionModal = () => {
        console.warn('[FactsManager] openAddTransactionModal not yet implemented');
    };
    window.openFactTransferModal = () => {
        console.warn('[FactsManager] openFactTransferModal not yet implemented');
    };
    window.saveTransaction = (_button: HTMLButtonElement) => {
        console.warn('[FactsManager] saveTransaction not yet implemented');
    };
    window.saveTransfer = (_button: HTMLButtonElement) => {
        console.warn('[FactsManager] saveTransfer not yet implemented');
    };
    window.createTransfer = async (_event: Event) => {
        console.warn('[FactsManager] createTransfer not yet implemented');
    };
    window.setTransactionDate = (offsetDays: number) => {
        console.warn('[FactsManager] setTransactionDate not yet implemented:', offsetDays);
    };
    window.loadFactHints = async (category?: any) => {
        console.warn('[FactsManager] loadFactHints not yet implemented:', category);
    };
    window.filterEditCostCenters = async (financialCenterId: string) => {
        console.warn('[FactsManager] filterEditCostCenters not yet implemented:', financialCenterId);
    };
}

// ============================================================================
// Wrapper Functions
// ============================================================================

/**
 * Wrapper for applyFilters
 */
function applyFilters(): void {
    applyFiltersAction();
    // Trigger reload
    applyFiltersAndReload();
}

/**
 * Wrapper for resetFilters
 */
function resetFilters(): void {
    resetFiltersAction();
    // Trigger reload
    resetFiltersAndReload();
}

/**
 * Wrapper for previousPage
 */
function previousPage(): void {
    if (prevPage()) {
        // Trigger reload
        goToPreviousPage();
    }
}

/**
 * Wrapper for nextPage
 */
function nextPage(): void {
    if (nxtPage()) {
        // Trigger reload
        goToNextPage();
    }
}

/**
 * Wrapper for toggleSelectAll
 */
function toggleSelectAll(checkbox: HTMLInputElement): void {
    toggleAll(checkbox);
}

/**
 * Wrapper for updateBatchDeleteButton
 */
function updateBatchDeleteButton(): void {
    updateBatchDeleteButtonUI();
}

// ============================================================================
// CRUD Operations Wrappers
// ============================================================================

/**
 * Wrapper for batchDelete
 */
async function batchDelete(): Promise<void> {
    await batchDeleteAction();
}

/**
 * Wrapper for showEditModal
 */
async function showEditModal(factId: number): Promise<void> {
    await showEditModalAction(factId);
}

/**
 * Wrapper for closeEditModal
 */
function closeEditModal(): void {
    closeEditModalAction();
}

/**
 * Wrapper for updateFact
 */
async function updateFact(event: Event): Promise<void> {
    await updateFactAction(event);
}

/**
 * Wrapper for deleteFact
 */
async function deleteFact(factId: number): Promise<void> {
    await deleteFactAction(factId);
}

/**
 * Wrapper for deleteFromEditModal
 */
async function deleteFromEditModal(): Promise<void> {
    await deleteFromEditModalAction();
}

/**
 * Wrapper for exportFilteredFacts
 */
function exportFilteredFacts(format: 'csv'): void {
    exportFilteredFactsAction(format);
}

/**
 * Wrapper for createFact
 */
async function createFact(event: Event): Promise<void> {
    await createFactAction(event);
}
