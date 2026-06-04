/**
 * Facts Manager - Main Controller
 *
 * Coordinates all facts operations (load, CRUD, UI updates).
 *
 * Post-TypeScript Migration: Client-side rendering with XSS protection
 */

import { loadFactsWithCount } from '../integration/factsAPI';
import { setTotalFacts, getTotalFacts, getCurrentPage, getPageSize, setCurrentPage, getFilters } from '../core/stateManager';
import { buildFilterQuery } from './filterOperations';
import { parseRowHtml } from '../integration/wsEventHandlers';
import type { CreateFactData, UpdateFactData, FactRow } from '../types/models';
import { escapeHtml, sanitizeErrorMessage } from '../../shared/htmlSanitizer';
import { TableFormatters } from '../../shared/tableUtils';
import { factsControllerLogger as logger } from '../utilities/logger';
import { setButtonLoading } from '../../dashboard/shared/utils/buttonState';
import { initEditCategoryTree, destroyEditCategoryTree } from '../features/modalFact/categoryWidget';

// ============================================================================
// Main Load Function
// ============================================================================

/**
 * Load facts with current filters and pagination
 * Post-TypeScript Migration: Client-side rendering (removed HTMX partials)
 */
export async function loadFacts(options?: { forceAPI?: boolean }): Promise<void> {
    try {
        logger.log('Loading facts...', options?.forceAPI ? '(forceAPI)' : '');

        // Get facts data (forceAPI option retained for caller compatibility; no longer needed without Dexie)
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
// Incremental Table Update Helpers
// ============================================================================

/**
 * Check if current state allows incremental row injection.
 * Returns true only on page 1 with no extra filters (only date range is OK).
 */
function canInjectRow(): boolean {
    if (getCurrentPage() !== 0) {
        return false;
    }
    const filters = getFilters();
    if (filters.user_id) return false;
    if (filters.article_id) return false;
    if (filters.article_type) return false;
    if (filters.financial_center_id) return false;
    if (filters.cost_center_id) return false;
    if (filters.search) return false;
    return true;
}

/**
 * Deduplicated fetch for /row-html.
 * Collapses concurrent requests for the same factId into one in-flight promise,
 * and returns a recently fetched response for ROW_HTML_TTL_MS to avoid a second
 * network round-trip when both the optimistic UI path and the WS handler ask
 * for the same row within the same event cycle.
 */
const ROW_HTML_TTL_MS = 1000;
const rowHtmlCache = new Map<number, { ts: number; html: string }>();
const rowHtmlInFlight = new Map<number, Promise<string | null>>();

export async function fetchRowHtmlDeduped(factId: number): Promise<string | null> {
    const now = Date.now();
    const cached = rowHtmlCache.get(factId);
    if (cached && now - cached.ts < ROW_HTML_TTL_MS) {
        return cached.html;
    }
    const existing = rowHtmlInFlight.get(factId);
    if (existing) return existing;

    const promise = (async () => {
        try {
            const response = await fetch(`/api/v1/facts/${factId}/row-html`, {
                credentials: 'include'
            });
            if (!response.ok) {
                logger.warn(`fetchRowHtmlDeduped: HTTP ${response.status} for fact ${factId}`);
                return null;
            }
            const html = await response.text();
            rowHtmlCache.set(factId, { ts: Date.now(), html });
            return html;
        } catch (error) {
            logger.warn('fetchRowHtmlDeduped failed:', error);
            return null;
        } finally {
            rowHtmlInFlight.delete(factId);
        }
    })();
    rowHtmlInFlight.set(factId, promise);
    return promise;
}

/**
 * Fetch HTML for a single row from the backend and inject it into the table.
 * For 'create': prepend to tbody.
 * For 'update': replace existing tr[data-id] and div[data-id].
 * Returns true on success, false if fallback (full reload) is needed.
 */
export async function fetchAndInjectRow(factId: number, operation: 'create' | 'update'): Promise<boolean> {
    if (!canInjectRow()) {
        return false;
    }

    try {
        const html = await fetchRowHtmlDeduped(factId);
        if (html === null) {
            return false;
        }

        const parsed = parseRowHtml(html);

        if (operation === 'create') {
            if (!parsed) return false;
            const tbody = document.querySelector('.facts-desktop-table tbody');
            if (tbody) {
                tbody.insertBefore(parsed.tr, tbody.firstChild);
            }
            const mobileList = document.querySelector('.facts-mobile-list');
            if (mobileList) {
                mobileList.insertBefore(parsed.mobileCard, mobileList.firstChild);
            }
            // Return true only if we actually injected into a container
            const injected = !!(tbody || mobileList);
            if (injected) {
                const newTotal = getTotalFacts() + 1;
                setTotalFacts(newTotal);
                const rowCount = tbody ? tbody.querySelectorAll('tr').length : 0;
                const pageStart = 1; // canInjectRow() guarantees page 0
                const pageEnd = Math.min(rowCount, newTotal);
                updateStats(newTotal, pageStart, pageEnd);
            }
            return injected;
        }

        if (operation === 'update') {
            if (!parsed) return false;
            const existingTr = document.querySelector(`tr[data-id="${factId}"]`);
            if (existingTr) {
                existingTr.replaceWith(parsed.tr);
            }
            const existingMobile = document.querySelector(`div.transaction-item[data-id="${factId}"]`);
            if (existingMobile) {
                existingMobile.replaceWith(parsed.mobileCard);
            }
            return !!(existingTr || existingMobile);
        }

        return false;
    } catch (error) {
        logger.warn('fetchAndInjectRow failed:', error);
        return false;
    }
}

/**
 * Remove a fact row from the table with a fade-out animation.
 * Returns true if the row was found and removed, false otherwise.
 */
function removeRowFromTable(factId: number): boolean {
    const desktopRow = document.querySelector(`tr[data-id="${factId}"]`);
    const mobileRow = document.querySelector(`div.transaction-item[data-id="${factId}"]`);

    if (!desktopRow && !mobileRow) {
        return false;
    }

    desktopRow?.classList.add('opacity-0', 'transition-opacity', 'duration-200');
    mobileRow?.classList.add('opacity-0', 'transition-opacity', 'duration-200');

    setTimeout(() => {
        desktopRow?.remove();
        mobileRow?.remove();
    }, 200);

    const newTotal = Math.max(0, getTotalFacts() - 1);
    setTotalFacts(newTotal);
    const statEl = document.getElementById('stat-total');
    if (statEl) statEl.textContent = String(newTotal);

    return true;
}

// ============================================================================
// CRUD Operations
// ============================================================================

const deletingFactIds = new Set<number>();

// Track facts whose stat counter was already decremented optimistically.
// wsEventHandlers.handleFactDeleted checks this to avoid double-decrement.
const statDecrementedIds = new Set<number>();

export function consumeStatDecrement(factId: number): boolean {
    if (statDecrementedIds.has(factId)) {
        statDecrementedIds.delete(factId);
        return true;
    }
    return false;
}

/**
 * Delete single fact with confirmation
 */
export async function deleteFact(factId: number): Promise<void> {
    if (deletingFactIds.has(factId)) {
        logger.warn('[FACTS] Delete already in progress for fact:', factId);
        return;
    }
    deletingFactIds.add(factId);

    let guardAdded = false;
    try {
        const confirmed = await showConfirmDialog(
            'Вы уверены, что хотите удалить этот факт?',
            'Подтверждение удаления'
        );

        if (!confirmed) {
            return;
        }

        // Mark before the await: WS fact_deleted can arrive while deleteFn is in flight.
        statDecrementedIds.add(factId);
        guardAdded = true;

        // Import dynamically to avoid circular dependency
        const { deleteFact: deleteFn } = await import('../integration/factsAPI');
        await deleteFn(factId);

        // Auto-expire so a stale guard never blocks a future legitimate decrement.
        setTimeout(() => statDecrementedIds.delete(factId), 3000);

        showToast('Факт успешно удален', 'success');

        // Incremental update: remove row without full reload
        const removed = removeRowFromTable(factId);
        if (!removed) {
            await loadFacts({ forceAPI: true });
        }
    } catch (error) {
        if (guardAdded) {
            statDecrementedIds.delete(factId);
        }
        logger.error(' Error deleting fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка удаления: ${errorMessage}`, 'error');
    } finally {
        deletingFactIds.delete(factId);
    }
}

/**
 * Validate form data and build UpdateFactData payload.
 * Returns null and shows a toast if validation fails.
 */
function validateAndBuildUpdateData(formData: FormData, BudgetShared: any): UpdateFactData | null {
    const articleId = parseInt(formData.get('article_id') as string);
    const financialCenterId = parseInt(formData.get('financial_center_id') as string);
    const amount = Number.parseInt(formData.get('amount') as string, 10);

    if (isNaN(articleId) || isNaN(financialCenterId) || !Number.isInteger(amount) || amount <= 0) {
        showToast('Некорректные данные формы (amount должен быть целым > 0)', 'error');
        return null;
    }

    const updateData: UpdateFactData = {
        fact_date: BudgetShared.DateFormatter.formatForAPI(formData.get('fact_date') as string),
        article_id: articleId,
        financial_center_id: financialCenterId,
        amount: amount,
        description: formData.get('description') as string || null
    };

    const costCenterId = formData.get('cost_center_id') as string;
    if (costCenterId) {
        const parsedCostCenterId = parseInt(costCenterId);
        if (!isNaN(parsedCostCenterId)) {
            updateData.cost_center_id = parsedCostCenterId;
        }
    }

    return updateData;
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

    const submitBtn = form.querySelector('[type="submit"]') as HTMLButtonElement | null;
    setButtonLoading(submitBtn, true);

    try {
        // Import dynamically to avoid circular dependency
        const { updateFact: updateFn } = await import('../integration/factsAPI');
        const { getBudgetShared } = await import('../types/dependencies');

        const updateData = validateAndBuildUpdateData(formData, getBudgetShared());
        if (!updateData) return;

        await updateFn(factId, updateData);

        // Close modal first so toast goes to global #toast-container, not inside dialog
        closeEditModal();

        showToast('Факт успешно обновлен', 'success');

        // Incremental update: replace row without full reload
        const injected = await fetchAndInjectRow(factId, 'update');
        if (!injected) {
            await loadFacts({ forceAPI: true });
        }
    } catch (error) {
        logger.error(' Error updating fact:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка обновления: ${errorMessage}`, 'error');
    } finally {
        setButtonLoading(submitBtn, false);
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
        const amount = Number.parseInt(formData.get('amount') as string, 10);
        const factType = formData.get('fact_type') as string;

        if (isNaN(articleId) || isNaN(financialCenterId) || !Number.isInteger(amount) || amount <= 0) {
            showToast('Некорректные данные формы (amount должен быть целым > 0)', 'error');
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

        const created = await createFn(createData);

        // Close modal (if AdminFactsCommon available)
        if (window.AdminFactsCommon?.closeCreateModal) {
            window.AdminFactsCommon.closeCreateModal();
        }

        // Incremental update: prepend new row without full reload
        const newFactId = created?.id;
        let injected = false;
        if (newFactId && newFactId > 0) {
            injected = await fetchAndInjectRow(newFactId, 'create');
        }
        if (!injected) {
            await loadFacts({ forceAPI: true });
        }
    } catch (error) {
        logger.error(' Error creating fact:', error);
        throw error; // Propagate to caller (saveFactModalFacts) for unified toast handling
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
    const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
    const skeleton = document.getElementById('edit-loading-skeleton');
    const formFields = document.getElementById('edit-form-fields');

    if (!modal?.showModal) {
        logger.error('Edit modal not found');
        return;
    }

    // Show modal immediately with skeleton
    if (skeleton) skeleton.classList.remove('hidden');
    if (formFields) formFields.classList.add('hidden');
    modal.showModal();

    try {
        // Import dynamically to avoid circular dependency
        const { getFact } = await import('../integration/factsAPI');
        const { getBudgetShared } = await import('../types/dependencies');

        // Load fact from server
        const fact = await getFact(factId);

        if (!fact) {
            showToast('Факт не найден', 'error');
            modal.close();
            return;
        }

        // Populate edit modal
        populateEditModal(fact, getBudgetShared());

        // Initialize category search tree for edit modal
        initEditCategoryTree(fact.article_type ?? 'expense', fact.article_id ?? null);

        // Hide skeleton, show form
        if (skeleton) skeleton.classList.add('hidden');
        if (formFields) formFields.classList.remove('hidden');
    } catch (error) {
        logger.error(' Error showing edit modal:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showToast(`Ошибка: ${errorMessage}`, 'error');
        modal.close();
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
    if (categoryTypeLabel && fact.article_type) {
        const typeMap: Record<string, { text: string; badgeClass: string }> = {
            'expense': { text: 'Расход', badgeClass: 'badge-error' },
            'income': { text: 'Доход', badgeClass: 'badge-success' },
            'debit': { text: 'Списание', badgeClass: 'badge-info' },
            'credit': { text: 'Пополнение', badgeClass: 'badge-warning' }
        };
        const typeInfo = typeMap[fact.article_type] || { text: 'Неизвестно', badgeClass: 'badge-neutral' };
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
        amountInput.value = String(Math.round(fact.amount));
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
    destroyEditCategoryTree();
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

        // Reload facts from API (bypass Dexie cache)
        await loadFacts({ forceAPI: true });
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
        const exportParams = new URLSearchParams();
        const dateFrom = filters.get('date_from');
        const dateTo = filters.get('date_to');
        if (dateFrom) exportParams.append('start_date', dateFrom);
        if (dateTo) exportParams.append('end_date', dateTo);

        const qs = exportParams.toString();
        const exportUrl = `/api/v1/export/facts/csv${qs ? '?' + qs : ''}`;

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
 * Render facts table from data (desktop + mobile views)
 */
export function renderFactsTable(facts: FactRow[]): void {
    const container = document.getElementById('facts-table-container');
    if (!container) {
        logger.warn('facts-table-container not found');
        return;
    }

    if (facts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-base-content/60">
                <p>📊 Факты не найдены. Измените фильтры или добавьте новые факты.</p>
            </div>
        `;
        return;
    }

    // Desktop table HTML
    let tableHtml = `
        <div class="facts-desktop-table overflow-x-auto">
            <table class="table table-zebra table-sm">
                <thead>
                    <tr>
                        <th><input type="checkbox" class="checkbox checkbox-sm" onclick="window.FactsManager?.toggleSelectAll?.(this)"></th>
                        <th>ID</th>
                        <th>📅 Дата</th>
                        <th>🏦 Счет</th>
                        <th>💼 МЗ</th>
                        <th>📁 Категория</th>
                        <th>💵 Сумма</th>
                        <th>📝 Комментарий</th>
                        <th>👤 Пользователь</th>
                        <th>🔄 Обновлено</th>
                        <th>⚙️ Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Mobile list HTML (Two-Line List format)
    let mobileHtml = `<div class="facts-mobile-list divide-y divide-base-200">`;

    facts.forEach(fact => {
        tableHtml += renderFactRow(fact);
        mobileHtml += renderFactMobileCard(fact);
    });

    tableHtml += `
                </tbody>
            </table>
        </div>
    `;

    mobileHtml += `</div>`;

    // Combine both views
    container.innerHTML = tableHtml + mobileHtml;
}

/**
 * Render single fact row with XSS protection
 */
export function renderFactRow(fact: FactRow): string {
    const BudgetShared = (window as any).BudgetShared;

    // Convert fact.fact_date to string if needed (Dexie may return Date objects)
    // Type assertion needed because Dexie runtime types may differ from interface
    const dateValue: unknown = fact.fact_date;
    const dateString = typeof dateValue === 'string'
        ? dateValue
        : (dateValue instanceof Date
            ? dateValue.toISOString().split('T')[0]
            : String(dateValue));

    const dateFormatted = BudgetShared?.DateFormatter?.formatForDisplay(dateString) || dateString;
    const amount = fact.fact_sum ?? fact.amount ?? 0;
    const commentText = fact.fact_comment ?? fact.description ?? null;
    const updatedAtFormatted = TableFormatters.formatUpdatedAt(fact.updated_at as string | null);

    return buildFactRowHtml(fact, {
        dateFormatted,
        commentText,
        updatedAtFormatted,
        amountFormatted: TableFormatters.formatAmount(amount, fact.article_type ?? 'expense'),
        articleColorClass: TableFormatters.getArticleColorClass(fact.article_type ?? 'expense', 'text'),
        articleName: TableFormatters.truncateText(fact.article_name ?? '', 30),
        financialCenterName: TableFormatters.truncateText(fact.financial_center_name ?? '', 20),
        costCenterName: fact.cost_center_name
            ? TableFormatters.truncateText(fact.cost_center_name, 20)
            : '—',
        comment: commentText ? TableFormatters.truncateText(commentText, 40) : '—',
    });
}

interface FactRowParts {
    dateFormatted: string;
    commentText: string | null;
    updatedAtFormatted: string;
    amountFormatted: string;
    articleColorClass: string;
    articleName: string;
    financialCenterName: string;
    costCenterName: string;
    comment: string;
}

function buildFactRowHtml(fact: FactRow, p: FactRowParts): string {
    return `
        <tr data-id="${fact.id}">
            <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" data-fact-id="${fact.id}"></td>
            <td class="text-base-content/50 text-xs">${fact.id}</td>
            <td>${escapeHtml(p.dateFormatted)}</td>
            <td class="max-w-xs truncate" title="${escapeHtml(fact.financial_center_name ?? '')}">${p.financialCenterName}</td>
            <td class="max-w-xs truncate" title="${escapeHtml(fact.cost_center_name ?? '')}">${p.costCenterName}</td>
            <td>${p.articleName}</td>
            <td class="${p.articleColorClass} font-bold">${p.amountFormatted}</td>
            <td class="max-w-xs truncate" title="${escapeHtml(p.commentText ?? '')}">${p.comment}</td>
            <td class="text-xs whitespace-nowrap">${escapeHtml(fact.user_name ?? '—')}</td>
            <td class="text-xs text-base-content/50 whitespace-nowrap">${escapeHtml(p.updatedAtFormatted)}</td>
            <td>
                <div class="flex gap-1">
                    <button class="btn btn-xs btn-primary gap-1" onclick="window.FactsManager?.showEditModal?.(${fact.id})">✏️</button>
                    <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="event.stopPropagation(); window.FactsManager?.deleteFact?.(${fact.id})" title="Удалить">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Render single fact mobile card (Two-Line List format)
 * @param fact - Fact data
 * @returns HTML string for mobile card
 */
export function renderFactMobileCard(fact: FactRow): string {
    const BudgetShared = (window as any).BudgetShared;

    // Convert fact.fact_date to string if needed (Dexie may return Date objects)
    const dateValue: unknown = fact.fact_date;
    const dateString = typeof dateValue === 'string'
        ? dateValue
        : (dateValue instanceof Date
            ? dateValue.toISOString().split('T')[0]
            : String(dateValue));

    // Format date and get short version (DD.MM)
    const dateFormatted = BudgetShared?.DateFormatter?.formatForDisplay(dateString) || dateString;
    const shortDate = (dateFormatted || '').slice(0, 5); // DD.MM

    // Format amount with color
    const amount = fact.fact_sum ?? fact.amount ?? 0;
    const amountFormatted = TableFormatters.formatAmount(amount, fact.article_type ?? 'expense');

    // Determine color class based on article_type or amount sign
    const amountClass = TableFormatters.getArticleColorClass(fact.article_type ?? 'expense', 'amount');

    // Escape user content
    const articleName = escapeHtml(fact.article_name ?? '—');
    const financialCenter = escapeHtml(fact.financial_center_name ?? '—');
    const commentText = fact.fact_comment ?? fact.description ?? '';
    const description = commentText ? TableFormatters.truncateText(commentText, 30) : '—';  // Already escaped

    return `
        <div class="transaction-item py-2" data-id="${fact.id}" onclick="window.FactsManager?.showEditModal?.(${fact.id})">
            <!-- Line 1: Badge + Category + Amount -->
            <div class="flex items-center gap-2">
                <span class="badge badge-primary badge-xs shrink-0">Факт</span>
                <span class="flex-1 font-medium truncate">${articleName}</span>
                <span class="${amountClass} font-bold whitespace-nowrap">${amountFormatted}</span>
            </div>
            <!-- Line 2: Date • Account • Description -->
            <div class="text-xs text-base-content/60 mt-1 truncate">
                ${shortDate} • ${financialCenter} • ${description}
            </div>
        </div>
    `;
}

// truncateText function removed - use TableFormatters.truncateText() instead

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
