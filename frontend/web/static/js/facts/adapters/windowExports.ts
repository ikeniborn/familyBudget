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
import { setFactDate as setFactDateAction, setFactTransferDate as setFactTransferDateAction } from '../index';

// Window interface declarations are in:
// - facts/types/globals.d.ts (facts-specific functions)
// - dashboard/types/globals.d.ts (shared functions like closeEditModal, deleteFact, etc.)

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

    // Modal operations
    window.openCreateModal = openCreateModal;
    window.openAddTransactionModal = openAddTransactionModal;
    window.openFactTransferModal = openFactTransferModal;

    // FAB toolbar compatibility (v10.1.11)
    window.openModalFact = openAddTransactionModal;

    // Transaction operations (delegated to external modules when available)
    window.saveTransaction = saveTransaction;
    window.saveTransfer = saveTransfer;
    window.createTransfer = createTransfer;

    // Date and hints operations
    window.setTransactionDate = setTransactionDate;
    window.setFactDate = setFactDateAction; // For modal_fact date buttons
    window.setFactTransferDate = setFactTransferDateAction; // For modal_fact transfer tab date buttons
    window.loadFactHints = loadFactHintsWrapper;
    window.filterEditCostCenters = filterEditCostCenters;
}

// ============================================================================
// Modal Operations
// ============================================================================

/**
 * Open create transaction modal
 */
async function openCreateModal(): Promise<void> {
    return openAddTransactionModal();
}

/**
 * Open add transaction modal
 */
async function openAddTransactionModal(): Promise<void> {
    // Delegate to Dashboard module if available (has skeleton loader)
    if (window.Dashboard?.openAddTransactionModal) {
        return window.Dashboard.openAddTransactionModal();
    }

    // Fallback: Open v10.x tabbed modal (modal_fact)
    // Try modern modal first (v10.x+)
    let modal = document.getElementById('modal_fact') as HTMLDialogElement | null;

    // Fallback to legacy modal (v9.x)
    if (!modal) {
        modal = document.getElementById('modal_add_transaction') as HTMLDialogElement | null;
    }

    if (modal?.showModal) {
        // Set default date to today
        setTransactionDate(0);
        modal.showModal();
    } else {
        console.warn('[FactsManager] Transaction modal not found (tried modal_fact and modal_add_transaction)');
    }
}

/**
 * Open transfer modal
 */
async function openFactTransferModal(): Promise<void> {
    // Delegate to openFactTransferModal if available (has skeleton loader)
    if (window.openFactTransferModal && window.openFactTransferModal !== openFactTransferModal) {
        return window.openFactTransferModal();
    }

    // Fallback: simple modal open without skeleton
    const modal = document.getElementById('modal_add_transfer') as HTMLDialogElement | null;
    if (modal?.showModal) {
        modal.showModal();
    } else {
        console.warn('[FactsManager] Transfer modal not found');
    }
}

// ============================================================================
// Transaction Save Operations
// ============================================================================

/**
 * Save transaction from modal
 */
function saveTransaction(button: HTMLElement): void {
    const formId = button.dataset.formId;
    const modalId = button.dataset.modalId;

    if (!formId) {
        console.error('[FactsManager] Missing form ID');
        return;
    }

    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) {
        console.error('[FactsManager] Form not found:', formId);
        return;
    }

    // Create submit event and dispatch
    const event = new Event('submit', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: form, writable: false });

    // Use createFact handler
    createFactAction(event).then(() => {
        // Close modal on success
        if (modalId) {
            const modal = document.getElementById(modalId) as HTMLDialogElement | null;
            modal?.close();
        }
    }).catch((error) => {
        console.error('[FactsManager] Error saving transaction:', error);
    });
}

/**
 * Save transfer from modal
 */
function saveTransfer(_button: HTMLElement): void {
    // Transfer saving is handled by transfers.min.js
    // No-op: actual implementation in transfers.min.js
}

/**
 * Create transfer (async wrapper)
 */
async function createTransfer(_event: Event): Promise<void> {
    // Transfer creation is handled by transfers.min.js
    // No-op: actual implementation in transfers.min.js
}

// ============================================================================
// Date Operations
// ============================================================================

/**
 * Set transaction date with offset from today
 * @param offsetDays - Number of days from today (0 = today, -1 = yesterday, etc.)
 */
function setTransactionDate(offsetDays: number): void {
    const BudgetShared = (window as any).BudgetShared;
    if (!BudgetShared?.DateFormatter) {
        console.error('[FactsManager] BudgetShared.DateFormatter not available');
        return;
    }

    const date = new Date();
    date.setDate(date.getDate() + offsetDays);

    // Format as DD.MM.YYYY for display
    const formattedDate = BudgetShared.DateFormatter.formatForDisplay(
        date.toISOString().split('T')[0]
    );

    // Find date input in transaction modal
    const dateInput = document.querySelector('#modal_add_transaction input[name="fact_date"]') as HTMLInputElement;
    if (dateInput) {
        dateInput.value = formattedDate;
        // Trigger change event for any listeners
        dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// ============================================================================
// Fact Hints Operations
// ============================================================================

/**
 * Load fact hints for category selection
 * Shows plan/fact amounts for the month
 */
async function loadFactHintsWrapper(_category?: any): Promise<void> {
    const hintsContainer = document.getElementById('fact-hints-container');
    if (!hintsContainer) return;

    try {
        // Get form values
        const form = document.getElementById('form_modal_add_transaction') as HTMLFormElement;
        if (!form) return;

        const formData = new FormData(form);
        const articleId = formData.get('article_id') as string;
        const factDate = formData.get('fact_date') as string;
        const recordType = formData.get('record_type') as string;
        const financialCenterId = formData.get('financial_center_id') as string;

        if (!articleId || !factDate || !recordType) {
            // Not enough data, show placeholders
            updateHintButtons();
            return;
        }

        const BudgetShared = (window as any).BudgetShared;
        if (!BudgetShared?.DateFormatter) return;

        // Import API function
        const { loadFactHints, formatHintAmount, getShortMonthName } = await import('../integration/analyticsAPI');

        const hints = await loadFactHints({
            fact_date: BudgetShared.DateFormatter.formatForAPI(factDate),
            article_type: recordType as 'expense' | 'income' | 'debit' | 'credit',
            article_id: parseInt(articleId),
            financial_center_id: financialCenterId ? parseInt(financialCenterId) : undefined
        });

        // Update hint buttons
        const planBtn = document.getElementById('hint-period-plan') as HTMLButtonElement | null;
        const factBtn = document.getElementById('hint-period-fact') as HTMLButtonElement | null;

        if (planBtn) {
            const monthName = getShortMonthName(hints.period);
            planBtn.textContent = `План ${monthName}: ${formatHintAmount(hints.period_plan_sum)}`;
            planBtn.disabled = !hints.period_plan_sum;
            planBtn.classList.toggle('btn-disabled', !hints.period_plan_sum);
        }

        if (factBtn) {
            const monthName = getShortMonthName(hints.period);
            factBtn.textContent = `Факт ${monthName}: ${formatHintAmount(hints.period_fact_sum)}`;
            factBtn.disabled = !hints.period_fact_sum;
            factBtn.classList.toggle('btn-disabled', !hints.period_fact_sum);
        }
    } catch (error) {
        console.error('[FactsManager] Error loading fact hints:', error);
        updateHintButtons();
    }
}

/**
 * Update hint buttons with placeholder state
 */
function updateHintButtons(): void {
    const planBtn = document.getElementById('hint-period-plan') as HTMLButtonElement | null;
    const factBtn = document.getElementById('hint-period-fact') as HTMLButtonElement | null;

    if (planBtn) {
        planBtn.textContent = 'План мес: --';
        planBtn.disabled = true;
        planBtn.classList.add('btn-disabled');
    }

    if (factBtn) {
        factBtn.textContent = 'Факт мес: --';
        factBtn.disabled = true;
        factBtn.classList.add('btn-disabled');
    }
}

// ============================================================================
// Cost Center Filtering
// ============================================================================

/**
 * Filter cost centers in edit modal by financial center
 */
async function filterEditCostCenters(financialCenterId: string): Promise<void> {
    const ccSelect = document.getElementById('edit-cost-center') as HTMLSelectElement;
    if (!ccSelect) return;

    try {
        const { getCachedCostCenters } = await import('../core/stateManager');
        const costCenters = getCachedCostCenters();

        // Clear options
        ccSelect.innerHTML = '<option value="">-- Не указано --</option>';

        // Filter by financial center if specified
        const filteredCostCenters = financialCenterId
            ? costCenters.filter(cc => cc.financial_center_id === parseInt(financialCenterId))
            : costCenters;

        // Add filtered options
        filteredCostCenters.forEach(cc => {
            const option = document.createElement('option');
            option.value = String(cc.id);
            option.textContent = cc.name;
            ccSelect.appendChild(option);
        });
    } catch (error) {
        console.error('[FactsManager] Error filtering cost centers:', error);
    }
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
