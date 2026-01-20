/**
 * Facts Manager - Main Controller
 *
 * Coordinates all facts operations (load, CRUD, UI updates).
 *
 * Post-TypeScript Migration: Client-side rendering with XSS protection
 */

import { loadFactsWithCount } from '../integration/factsAPI';
import { setTotalFacts, getCurrentPage, getPageSize, setCurrentPage } from '../core/stateManager';
import { buildFilterQuery } from './filterOperations';
import type { CreateFactData, UpdateFactData, FactRow } from '../types/models';
import { escapeHtml, sanitizeErrorMessage } from '../utilities/htmlSanitizer';
import { factsControllerLogger as logger } from '../utilities/logger';

// ============================================================================
// Main Load Function
// ============================================================================

/**
 * Load facts with current filters and pagination
 * Post-TypeScript Migration: Client-side rendering (removed HTMX partials)
 */
export async function loadFacts(): Promise<void> {
    try {
        logger.log('Loading facts...');

        // Get facts data from API
        const { facts, total } = await loadFactsWithCount();

        logger.log(`Loaded ${facts.length} facts (total: ${total})`);

        // Update state
        setTotalFacts(total);

        const currentPage = getCurrentPage();
        const pageSize = getPageSize();

        // Calculate page range
        const pageStart = currentPage * pageSize + 1;
        const pageEnd = Math.min(pageStart + facts.length - 1, total);

        // Render UI components
        updateStats(total, pageStart, pageEnd);
        renderFactsTable(facts);
        updatePagination(currentPage, total, pageSize);

        logger.log('Facts loaded and rendered successfully');
    } catch (error) {
        logger.error('Error loading facts:', error);

        // Sanitize error message to prevent XSS
        const safeErrorMessage = sanitizeErrorMessage(error);

        const container = document.getElementById('facts-table-container');
        if (container) {
            // Create error element safely using DOM methods
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-error';

            const errorSpan = document.createElement('span');
            errorSpan.textContent = `❌ Ошибка загрузки: ${safeErrorMessage}`;

            errorDiv.appendChild(errorSpan);
            container.innerHTML = '';
            container.appendChild(errorDiv);
        }
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
        logger.error(' Error deleting fact:', error);
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

    // Form uses 'id' field, not 'fact_id' (from edit modal)
    const factId = parseInt(formData.get('id') as string || formData.get('fact_id') as string);

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
        logger.error(' Error updating fact:', error);
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
        logger.error(' Error creating fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка создания: ${errorMessage}`, 'error');
    }
}

// ============================================================================
// Modal Operations
// ============================================================================

/**
 * Show edit modal for fact
 * Phase 2 fix: Load fact from API instead of cache
 */
export async function showEditModal(factId: number): Promise<void> {
    try {
        // Import dynamically to avoid circular dependency
        const { getFact } = await import('../integration/factsAPI');
        const { getBudgetShared } = await import('../types/dependencies');

        // Load fact from server
        const fact = await getFact(factId);

        if (!fact) {
            showToast('Факт не найден', 'error');
            return;
        }

        // Populate edit modal
        populateEditModal(fact, getBudgetShared());

        // Show modal
        const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
        if (modal?.showModal) {
            modal.showModal();
        }
    } catch (error) {
        logger.error(' Error showing edit modal:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка: ${errorMessage}`, 'error');
    }
}

/**
 * Populate edit modal with fact data
 * @internal
 */
function populateEditModal(fact: any, BudgetShared: any): void {
    // Hidden ID field
    const idInput = document.getElementById('edit-id') as HTMLInputElement;
    if (idInput) {
        idInput.value = String(fact.id);
    }

    // Дата (YYYY-MM-DD → DD.MM.YYYY)
    const dateInput = document.getElementById('edit-date') as HTMLInputElement;
    if (dateInput && fact.fact_date) {
        dateInput.value = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
    }

    // Счет
    const fcSelect = document.getElementById('edit-financial-center') as HTMLSelectElement;
    if (fcSelect && fact.financial_center_id) {
        fcSelect.value = String(fact.financial_center_id);
    }

    // Тип категории - badge
    const categoryTypeLabel = document.getElementById('edit-category-type-label');
    if (categoryTypeLabel && fact.article) {
        const typeMap: Record<string, { text: string; badgeClass: string }> = {
            'expense': { text: 'Расход', badgeClass: 'badge-error' },
            'income': { text: 'Доход', badgeClass: 'badge-success' },
            'debit': { text: 'Списание', badgeClass: 'badge-info' },
            'credit': { text: 'Пополнение', badgeClass: 'badge-warning' }
        };
        const typeInfo = typeMap[fact.article.record_type] || { text: 'Неизвестно', badgeClass: 'badge-neutral' };
        categoryTypeLabel.textContent = typeInfo.text;
        categoryTypeLabel.className = `badge badge-sm ${typeInfo.badgeClass}`;
    }

    // Категория
    const articleSelect = document.getElementById('edit-article') as HTMLSelectElement;
    if (articleSelect && fact.article_id) {
        articleSelect.value = String(fact.article_id);
    }

    // Место затрат
    const ccSelect = document.getElementById('edit-cost-center') as HTMLSelectElement;
    if (ccSelect) {
        ccSelect.value = fact.cost_center_id ? String(fact.cost_center_id) : '';
    }

    // Сумма
    const amountInput = document.getElementById('edit-amount') as HTMLInputElement;
    if (amountInput && fact.amount !== undefined) {
        amountInput.value = String(fact.amount);
    }

    // Описание
    const descriptionInput = document.getElementById('edit-description') as HTMLTextAreaElement;
    if (descriptionInput) {
        descriptionInput.value = fact.description || '';
    }
}

/**
 * Close edit modal
 */
export function closeEditModal(): void {
    const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
    if (modal?.close) {
        modal.close();
    }
}

/**
 * Delete fact from edit modal
 */
export async function deleteFromEditModal(): Promise<void> {
    // Get fact ID from modal form (form id is 'edit-form', field is 'id')
    const form = document.getElementById('edit-form') as HTMLFormElement;
    if (!form) {
        showToast('Форма не найдена', 'error');
        return;
    }

    const formData = new FormData(form);
    const factId = parseInt(formData.get('id') as string);

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
        logger.error(' Error batch deleting:', error);
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
        logger.error(' Error exporting:', error);
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

// ============================================================================
// Client-Side Rendering Functions (Post-TypeScript Migration)
// ============================================================================

/**
 * Update stats section with total and page info
 */
export function updateStats(totalFacts: number, pageStart: number, pageEnd: number): void {
    const statTotal = document.getElementById('stat-total');
    const statPageInfo = document.getElementById('stat-page-info');

    if (statTotal) {
        statTotal.textContent = String(totalFacts);
    }

    if (statPageInfo) {
        statPageInfo.textContent = totalFacts === 0
            ? '0-0 из 0'
            : `${pageStart}-${pageEnd} из ${totalFacts}`;
    }
}

/**
 * Render facts table from data
 */
export function renderFactsTable(facts: FactRow[]): void {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        logger.warn('facts-table-container not found');
        return;
    }

    if (facts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-base-content/70">Нет фактов для отображения</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th><input type="checkbox" class="checkbox checkbox-sm" onclick="window.FactsManager?.toggleSelectAll?.(this)"></th>
                        <th>Дата</th>
                        <th>Категория</th>
                        <th>Сумма</th>
                        <th>Счет</th>
                        <th>МЗ</th>
                        <th>Комментарий</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;

    facts.forEach(fact => {
        html += renderFactRow(fact);
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

/**
 * Render single fact row with XSS protection
 */
export function renderFactRow(fact: FactRow): string {
    const BudgetShared = (window as any).BudgetShared;

    // Format date safely (DateFormatter output is trusted)
    const dateFormatted = BudgetShared?.DateFormatter?.formatForDisplay(fact.fact_date) || fact.fact_date;

    // Format amount (numeric values are safe)
    const amount = fact.fact_sum ?? fact.amount ?? 0;
    const amountFormatted = Number(amount).toFixed(2);

    // Escape all user-generated content to prevent XSS
    const articleName = escapeHtml(truncateText(fact.article_name ?? '', 30));
    const financialCenterName = escapeHtml(truncateText(fact.financial_center_name ?? '', 20));
    const costCenterName = fact.cost_center_name
        ? escapeHtml(truncateText(fact.cost_center_name, 20))
        : '—';

    const commentText = fact.fact_comment ?? fact.description ?? null;
    const comment = commentText
        ? escapeHtml(truncateText(commentText, 40))
        : '—';

    return `
        <tr>
            <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" data-fact-id="${fact.id}"></td>
            <td>${escapeHtml(dateFormatted)}</td>
            <td>${articleName}</td>
            <td class="font-medium">${amountFormatted}</td>
            <td>${financialCenterName}</td>
            <td>${costCenterName}</td>
            <td>${comment}</td>
            <td>
                <div class="flex gap-2">
                    <button class="btn btn-xs btn-ghost" onclick="window.FactsManager?.showEditModal?.(${fact.id})">✏️</button>
                    <button class="btn btn-xs btn-ghost text-error" onclick="window.FactsManager?.deleteFact?.(${fact.id})">🗑️</button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number = 30): string {
    if (!text || text === '—') return text || '—';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Update pagination controls
 */
export function updatePagination(currentPage: number, totalFacts: number, pageSize: number): void {
    const controls = document.getElementById('pagination-controls');
    const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
    const pageInfo = document.getElementById('page-info');

    if (!controls || !prevBtn || !nextBtn || !pageInfo) {
        logger.warn(' Pagination elements not found');
        return;
    }

    const totalPages = Math.ceil(totalFacts / pageSize);
    const pageNumber = currentPage + 1;

    if (totalPages <= 1) {
        controls.style.display = 'none';
        return;
    }

    controls.style.display = 'flex';
    pageInfo.textContent = `Страница ${pageNumber} из ${totalPages}`;
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage >= totalPages - 1;
}
