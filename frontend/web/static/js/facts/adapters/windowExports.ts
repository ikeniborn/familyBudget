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

    // Placeholders for full implementation
    // These will be replaced with actual implementations in full integration
    window.batchDelete = async () => {
        console.warn('[FactsManager] batchDelete not yet implemented');
    };
    window.showEditModal = async (factId: number) => {
        console.warn('[FactsManager] showEditModal not yet implemented:', factId);
    };
    window.closeEditModal = () => {
        console.warn('[FactsManager] closeEditModal not yet implemented');
    };
    window.updateFact = async (_event: Event) => {
        console.warn('[FactsManager] updateFact not yet implemented');
    };
    window.deleteFact = async (factId: number) => {
        console.warn('[FactsManager] deleteFact not yet implemented:', factId);
    };
    window.deleteFromEditModal = async () => {
        console.warn('[FactsManager] deleteFromEditModal not yet implemented');
    };
    window.exportFilteredFacts = (format: 'csv') => {
        console.warn('[FactsManager] exportFilteredFacts not yet implemented:', format);
    };
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
    window.createFact = async (_event: Event) => {
        console.warn('[FactsManager] createFact not yet implemented');
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
    // Trigger reload (will be implemented in full integration)
    console.warn('[FactsManager] applyFilters: reload not yet implemented');
}

/**
 * Wrapper for resetFilters
 */
function resetFilters(): void {
    resetFiltersAction();
    // Trigger reload (will be implemented in full integration)
    console.warn('[FactsManager] resetFilters: reload not yet implemented');
}

/**
 * Wrapper for previousPage
 */
function previousPage(): void {
    if (prevPage()) {
        // Trigger reload (will be implemented in full integration)
        console.warn('[FactsManager] previousPage: reload not yet implemented');
    }
}

/**
 * Wrapper for nextPage
 */
function nextPage(): void {
    if (nxtPage()) {
        // Trigger reload (will be implemented in full integration)
        console.warn('[FactsManager] nextPage: reload not yet implemented');
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
