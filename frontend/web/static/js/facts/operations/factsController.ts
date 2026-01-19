/**
 * Facts Manager - Main Controller
 *
 * Coordinates all facts operations (load, CRUD, UI updates).
 *
 * Phase 1 Continuation: Full CRUD Integration
 */

import { loadFactsWithCount } from '../integration/factsAPI';
import { setCachedFacts, setTotalFacts, setCurrentPage } from '../core/stateManager';
import { buildFilterQuery } from './filterOperations';
import { updatePaginationUI } from './paginationOperations';
import { renderFactsTable } from '../rendering/factsTable';
import { updateStats } from '../rendering/statsRenderer';
import type { CreateFactData, UpdateFactData } from '../types/models';

// ============================================================================
// Main Load Function
// ============================================================================

/**
 * Load facts with current filters and pagination
 * Updates state, cache, and UI
 */
export async function loadFacts(): Promise<void> {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        console.warn('[FactsController] Container not found');
        return;
    }

    // Show loading spinner
    container.innerHTML = '<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>';

    try {
        // Load facts and count in parallel
        const { facts, total } = await loadFactsWithCount();

        // Update state
        setCachedFacts(facts);
        setTotalFacts(total);

        // Update UI
        renderFactsTable(facts);
        updateStats();
        updatePaginationUI();

        // Sync filter UI if AdminFactsCommon available
        if (window.AdminFactsCommon) {
            const filters = buildFilterQuery();
            const filterObj: Record<string, string> = {};
            filters.forEach((value, key) => {
                filterObj[key] = value;
            });
            window.AdminFactsCommon.syncFiltersUI(filterObj);
        }
    } catch (error) {
        console.error('[FactsController] Error loading facts:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        container.innerHTML = `<div class="alert alert-error"><span>❌ Ошибка загрузки: ${errorMessage}</span></div>`;
    }
}

/**
 * Reload facts (convenience wrapper)
 */
export async function reloadFacts(): Promise<void> {
    return loadFacts();
}

// ============================================================================
// Filter Actions
// ============================================================================

/**
 * Apply filters and reload
 */
export async function applyFiltersAndReload(): Promise<void> {
    // Reset to first page
    setCurrentPage(0);

    // Reload facts
    await loadFacts();
}

/**
 * Reset filters and reload
 */
export async function resetFiltersAndReload(): Promise<void> {
    // Reset to first page
    setCurrentPage(0);

    // Reload facts
    await loadFacts();
}

// ============================================================================
// Pagination Actions
// ============================================================================

/**
 * Go to previous page
 */
export async function goToPreviousPage(): Promise<void> {
    await loadFacts();
}

/**
 * Go to next page
 */
export async function goToNextPage(): Promise<void> {
    await loadFacts();
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Delete single fact with confirmation
 */
export async function deleteFact(factId: number): Promise<void> {
    const confirmed = await showConfirmDialog(
        'Вы уверены, что хотите удалить этот факт?',
        'Подтверждение удаления'
    );

    if (!confirmed) {
        return;
    }

    try {
        // Import dynamically to avoid circular dependency
        const { deleteFact: deleteFn } = await import('../integration/factsAPI');

        await deleteFn(factId);

        showToast('Факт успешно удален', 'success');

        // Reload facts
        await loadFacts();
    } catch (error) {
        console.error('[FactsController] Error deleting fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка удаления: ${errorMessage}`, 'error');
    }
}

/**
 * Update fact from form submission
 */
export async function updateFact(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const factId = parseInt(formData.get('fact_id') as string);

    if (isNaN(factId) || factId <= 0) {
        showToast('Некорректный ID факта', 'error');
        return;
    }

    try {
        // Import dynamically to avoid circular dependency
        const { updateFact: updateFn } = await import('../integration/factsAPI');
        const { getBudgetShared } = await import('../types/dependencies');

        const BudgetShared = getBudgetShared();

        // Parse and validate form data
        const articleId = parseInt(formData.get('article_id') as string);
        const financialCenterId = parseInt(formData.get('financial_center_id') as string);
        const amount = parseFloat(formData.get('amount') as string);

        if (isNaN(articleId) || isNaN(financialCenterId) || isNaN(amount)) {
            showToast('Некорректные данные формы', 'error');
            return;
        }

        // Prepare update data
        const updateData: UpdateFactData = {
            fact_date: BudgetShared.DateFormatter.formatForAPI(formData.get('fact_date') as string),
            article_id: articleId,
            financial_center_id: financialCenterId,
            amount: amount,
            description: formData.get('description') as string || null
        };

        // Cost center (optional)
        const costCenterId = formData.get('cost_center_id') as string;
        if (costCenterId) {
            const parsedCostCenterId = parseInt(costCenterId);
            if (!isNaN(parsedCostCenterId)) {
                updateData.cost_center_id = parsedCostCenterId;
            }
        }

        await updateFn(factId, updateData);

        showToast('Факт успешно обновлен', 'success');

        // Close modal
        closeEditModal();

        // Reload facts
        await loadFacts();
    } catch (error) {
        console.error('[FactsController] Error updating fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка обновления: ${errorMessage}`, 'error');
    }
}

/**
 * Create new fact from form submission
 */
export async function createFact(event: Event): Promise<void> {
    event.preventDefault();

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
        // Import dynamically to avoid circular dependency
        const { createFact: createFn } = await import('../integration/factsAPI');
        const { getBudgetShared } = await import('../types/dependencies');

        const BudgetShared = getBudgetShared();

        // Parse and validate form data
        const articleId = parseInt(formData.get('article_id') as string);
        const financialCenterId = parseInt(formData.get('financial_center_id') as string);
        const amount = parseFloat(formData.get('amount') as string);
        const factType = formData.get('fact_type') as string;

        if (isNaN(articleId) || isNaN(financialCenterId) || isNaN(amount)) {
            showToast('Некорректные данные формы', 'error');
            return;
        }

        if (!factType || !['expense', 'income', 'debit', 'credit'].includes(factType)) {
            showToast('Некорректный тип факта', 'error');
            return;
        }

        // Prepare create data
        const createData: CreateFactData = {
            record_type: 'fact',
            fact_type: factType as 'expense' | 'income' | 'debit' | 'credit',
            fact_date: BudgetShared.DateFormatter.formatForAPI(formData.get('fact_date') as string),
            article_id: articleId,
            financial_center_id: financialCenterId,
            amount: amount,
            description: formData.get('description') as string || null
        };

        // Cost center (optional)
        const costCenterId = formData.get('cost_center_id') as string;
        if (costCenterId) {
            const parsedCostCenterId = parseInt(costCenterId);
            if (!isNaN(parsedCostCenterId)) {
                createData.cost_center_id = parsedCostCenterId;
            }
        }

        await createFn(createData);

        showToast('Факт успешно создан', 'success');

        // Close modal (if AdminFactsCommon available)
        if (window.AdminFactsCommon?.closeCreateModal) {
            window.AdminFactsCommon.closeCreateModal();
        }

        // Reload facts
        await loadFacts();
    } catch (error) {
        console.error('[FactsController] Error creating fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка создания: ${errorMessage}`, 'error');
    }
}

// ============================================================================
// Modal Operations
// ============================================================================

/**
 * Show edit modal for fact
 */
export async function showEditModal(factId: number): Promise<void> {
    try {
        // Import dynamically to avoid circular dependency
        const { getCachedFacts } = await import('../core/stateManager');

        // Find fact in cache
        const facts = getCachedFacts();
        const fact = facts.find(f => f.id === factId);

        if (!fact) {
            showToast('Факт не найден', 'error');
            return;
        }

        // Delegate to AdminFactsCommon if available
        if (window.AdminFactsCommon?.populateEditModal) {
            window.AdminFactsCommon.populateEditModal(fact);

            // Show modal
            const modal = document.getElementById('edit-fact-modal') as HTMLDialogElement | null;
            if (modal?.showModal) {
                modal.showModal();
            }
        } else {
            showToast('Модальное окно не доступно', 'warning');
        }
    } catch (error) {
        console.error('[FactsController] Error showing edit modal:', error);
        showToast('Ошибка открытия модального окна', 'error');
    }
}

/**
 * Close edit modal
 */
export function closeEditModal(): void {
    const modal = document.getElementById('edit-fact-modal') as HTMLDialogElement | null;
    if (modal?.close) {
        modal.close();
    }
}

/**
 * Delete fact from edit modal
 */
export async function deleteFromEditModal(): Promise<void> {
    // Get fact ID from modal form
    const form = document.getElementById('edit-fact-form') as HTMLFormElement;
    if (!form) {
        showToast('Форма не найдена', 'error');
        return;
    }

    const formData = new FormData(form);
    const factId = parseInt(formData.get('fact_id') as string);

    if (isNaN(factId) || factId <= 0) {
        showToast('Некорректный ID факта', 'error');
        return;
    }

    // Close modal first
    closeEditModal();

    // Delete fact
    await deleteFact(factId);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Batch delete selected facts
 */
export async function batchDelete(): Promise<void> {
    // Import dynamically to avoid circular dependency
    const { getSelectedIds } = await import('../core/stateManager');

    const selectedIds = getSelectedIds();

    if (selectedIds.size === 0) {
        showToast('Выберите факты для удаления', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog(
        `Вы уверены, что хотите удалить ${selectedIds.size} фактов?`,
        'Подтверждение удаления'
    );

    if (!confirmed) {
        return;
    }

    try {
        // Import dynamically to avoid circular dependency
        const { batchDeleteFacts } = await import('../integration/factsAPI');

        const result = await batchDeleteFacts(Array.from(selectedIds));

        showToast(
            `Успешно удалено: ${result.deleted_count} фактов`,
            'success'
        );

        // Reload facts
        await loadFacts();
    } catch (error) {
        console.error('[FactsController] Error batch deleting:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка массового удаления: ${errorMessage}`, 'error');
    }
}

// ============================================================================
// Export Operations
// ============================================================================

/**
 * Export filtered facts to CSV
 */
export function exportFilteredFacts(format: 'csv'): void {
    if (format !== 'csv') {
        showToast('Только CSV формат поддерживается', 'warning');
        return;
    }

    try {
        const filters = buildFilterQuery();
        const exportUrl = `/api/v1/facts/export?${filters.toString()}&format=csv`;

        // Download file
        const link = document.createElement('a');
        link.href = exportUrl;
        link.download = `facts_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        showToast('Экспорт начался', 'info');
    } catch (error) {
        console.error('[FactsController] Error exporting:', error);
        showToast('Ошибка экспорта', 'error');
    }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Show toast notification
 */
export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): void {
    if (typeof (window as any).showToast === 'function') {
        (window as any).showToast(message, type);
    }
    // Fallback: silent (toast function should be available in facts.html)
}

/**
 * Show confirm dialog
 */
export async function showConfirmDialog(message: string, title?: string): Promise<boolean> {
    if (typeof (window as any).showConfirmDialog === 'function') {
        return await (window as any).showConfirmDialog(message, title);
    } else {
        // Fallback to native confirm
        return confirm(message);
    }
}
