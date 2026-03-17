/**
 * Plan Facts Table Module
 * Table rendering, pagination, and selection management for plan.html
 *
 * @module plan/factsTable
 * @version 1.0.0
 * @description Manages facts table display, pagination, and selection state
 */

import * as PlanHelpers from './helpers';
import * as PlanFilters from './filters';
import { escapeHtml } from '../shared/htmlSanitizer';
import { TableFormatters } from '../shared/tableUtils';

// Import BudgetShared from global window object
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
  };
};

// Import AdminFactsCommon from global
declare const AdminFactsCommon: {
  syncFiltersUI: (filters: PlanFilters.PlanFilters) => void;
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================
// Re-export shared types from helpers for backward compatibility
export type BudgetFact = PlanHelpers.BudgetFact;
export type Reminder = PlanHelpers.Reminder;

// ============================================================================
// State Management
// ============================================================================

/**
 * Current pagination page (0-indexed)
 */
let currentPage = 0;

/**
 * Number of records per page
 */
const pageSize = 50;

/**
 * Total number of facts matching current filters
 */
let totalFacts = 0;

/**
 * Array of facts for current page
 */
let factsData: BudgetFact[] = [];

/**
 * Set of selected fact IDs for batch operations
 */
let selectedFactIds: Set<number> = new Set();

/**
 * Map of fact ID → reminder for reminder status display
 */
const remindersMap: Map<number, Reminder> = new Map();

/**
 * Get current page number
 * @returns Current page (0-indexed)
 */
export function getCurrentPage(): number {
  return currentPage;
}

/**
 * Set current page number
 * @param page - Page number (0-indexed)
 */
export function setCurrentPage(page: number): void {
  currentPage = page;
}

/**
 * Get facts data for current page
 * @returns Array of facts
 */
export function getFactsData(): BudgetFact[] {
  return factsData;
}

/**
 * Get selected fact IDs
 * @returns Readonly set of selected IDs
 */
export function getSelectedFactIds(): ReadonlySet<number> {
  return new Set(selectedFactIds);
}

/**
 * Clear selection
 */
export function clearSelection(): void {
  selectedFactIds.clear();
  updateBatchDeleteButton();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Set HTML content safely using DOM API (no XSS risk)
 * @param element - Target element
 * @param htmlString - HTML string to set
 */
function setInnerHTML(element: HTMLElement, htmlString: string): void {
  element.textContent = '';
  const template = document.createElement('template');
  template.innerHTML = htmlString.trim();
  element.appendChild(template.content);
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load reminders for facts on current page
 * Optimized with date range filter (current month ± 1 month buffer)
 *
 * @param factIds - Array of fact IDs to load reminders for
 */
async function loadRemindersForFacts(factIds: number[]): Promise<void> {
  remindersMap.clear();
  if (!factIds || factIds.length === 0) return;

  try {
    // Date range filter: current month ± 1 month buffer
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .split('T')[0];
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      .toISOString()
      .split('T')[0];

    const params = new URLSearchParams({
      date_from: startDate,
      date_to: endDate,
      limit: '50'
    });

    const response = await fetch(`/api/v1/reminders/?${params}`, {
      credentials: 'include'
    });

    if (!response.ok) {
      console.warn('[PlanFactsTable] Failed to load reminders:', response.status);
      return;
    }

    const data = await response.json();
    const factIdSet = new Set(factIds);

    // Populate remindersMap with reminders matching current page facts
    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((reminder: Reminder) => {
        if (reminder && reminder.fact_id && factIdSet.has(reminder.fact_id)) {
          remindersMap.set(reminder.fact_id, reminder);
        }
      });
    }
  } catch (error) {
    console.error('[PlanFactsTable] Error loading reminders:', error);
  }
}

/**
 * Load facts from API with current filters and pagination
 * Main data loading function called on page load and filter changes
 */
export async function loadFacts(): Promise<void> {
  const container = document.getElementById('facts-table-container');
  if (!container) {
    console.warn('[PlanFactsTable] Container not found');
    return;
  }

  // Show loading spinner (safe DOM API)
  setInnerHTML(
    container,
    '<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>'
  );

  try {
    // Build query params
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(currentPage * pageSize),
      record_type: 'plan' // Filter by plan records only
    });

    // Add filter parameters
    const filters = PlanFilters.getFilters();
    if (filters.user_id) params.append('user_id', String(filters.user_id));
    if (filters.article_id) params.append('article_id', String(filters.article_id));
    if (filters.article_type) params.append('article_type', filters.article_type);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.financial_center_id)
      params.append('financial_center_id', String(filters.financial_center_id));
    if (filters.cost_center_id) params.append('cost_center_id', String(filters.cost_center_id));
    if (filters.search) params.append('search', filters.search);
    if (filters.has_recurring_plan) params.append('has_recurring_plan', 'true');
    if (filters.has_reminder) params.append('has_reminder', 'true');

    // Debug: Log applied filters
    if (window.DEBUG_MODE && typeof debugLog !== 'undefined') {
      debugLog('[PlanFactsTable] Loading facts with filters:', {
        filters,
        queryParams: params.toString(),
        page: currentPage,
        pageSize
      });
    }

    // Load facts and count in parallel
    const [factsResponse, countResponse] = await Promise.all([
      fetch(`/api/v1/facts?${params}`),
      fetch(`/api/v1/facts/count?${params}`)
    ]);

    if (!factsResponse.ok || !countResponse.ok) {
      throw new Error('Failed to load facts');
    }

    const factsResponseData = await factsResponse.json();
    factsData = factsResponseData.facts || [];
    const countData = await countResponse.json();
    totalFacts = countData.total;

    // Load reminders for all facts
    await loadRemindersForFacts(factsData.map(f => f.id));

    // Render and update UI
    renderFactsTable(factsData);
    updateStats();
    updatePagination();

    // Sync UI with filter state
    if (typeof AdminFactsCommon !== 'undefined') {
      AdminFactsCommon.syncFiltersUI(filters);
    }

    // Load recurring plan stats asynchronously (fire-and-forget)
    if (typeof (window as any).loadStats === 'function') {
      (window as any).loadStats();
    }
  } catch (error) {
    console.error('[PlanFactsTable] Error loading facts:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Show error message (safe DOM API)
    container.textContent = '';
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    const span = document.createElement('span');
    span.textContent = `❌ Ошибка загрузки: ${errorMessage}`;
    alert.appendChild(span);
    container.appendChild(alert);
  }
}

// ============================================================================
// Table Rendering
// ============================================================================

// truncateText function removed - use TableFormatters.truncateText() instead

/**
 * Render facts table (desktop + mobile views)
 * Clears selection and updates UI
 *
 * @param facts - Array of facts to render
 */
function renderFactsTable(facts: BudgetFact[]): void {
  const container = document.getElementById('facts-table-container');
  if (!container) return;

  selectedFactIds.clear();
  updateBatchDeleteButton();

  if (facts.length === 0) {
    // Show empty state (safe DOM API)
    container.textContent = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'text-center py-8 text-base-content/60';
    emptyDiv.textContent = '📅 Плановые записи не найдены. Измените фильтры или добавьте новые плановые записи.';
    container.appendChild(emptyDiv);
    return;
  }

  // Desktop table HTML
  let tableHtml = `
    <div class="facts-desktop-table overflow-x-auto">
      <table class="table table-zebra table-sm">
        <thead>
          <tr>
            <th><input type="checkbox" class="checkbox checkbox-sm" id="select-all" onchange="window.PlanApp.FactsTable.toggleSelectAll(this)"></th>
            <th>ID</th>
            <th>📅 Дата</th>
            <th>🏦 Счет</th>
            <th>💼 МЗ</th>
            <th>📁 Категория</th>
            <th>💵 Сумма</th>
            <th>📝 Комментарий</th>
            <th>👤 Пользователь</th>
            <th>🕐 Обновлено</th>
            <th class="text-center" title="Напоминание">🔔</th>
            <th class="text-center" title="Регламентный платеж">🔄</th>
            <th class="text-center" title="Создано offline">☁️</th>
            <th>⚙️ Действия</th>
          </tr>
        </thead>
        <tbody>
  `;

  // Mobile list HTML (Two-Line List format)
  let mobileHtml = `<div class="facts-mobile-list divide-y divide-base-200">`;

  facts.forEach(fact => {
    // Get color class for article type
    const articleColorClass = TableFormatters.getArticleColorClass(fact.article_type, 'text');

    // TableFormatters.truncateText() includes XSS protection
    const description = escapeHtml(fact.description || '—');  // Full text for title attribute
    const descriptionTruncated = TableFormatters.truncateText(fact.description || '—', 30);  // Truncated for display
    const financialCenter = escapeHtml(fact.financial_center_name || '—');
    const costCenter = escapeHtml(fact.cost_center_name || '—');
    const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
    const shortDate = formattedDate.slice(0, 5); // DD.MM
    const articleName = escapeHtml(fact.article_name || '—');
    const userName = escapeHtml(fact.user_name || '—');

    // Desktop table row
    tableHtml += `
      <tr data-plan-id="${fact.id}">
        <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="${fact.id}" onchange="window.PlanApp.FactsTable.updateBatchDeleteButton()"></td>
        <td><code class="badge badge-ghost">${fact.id}</code></td>
        <td>${formattedDate}</td>
        <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
        <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
        <td><span class="${articleColorClass}">${articleName}</span></td>
        <td class="${articleColorClass} font-bold">${TableFormatters.formatAmount(fact.amount, fact.article_type)}</td>
        <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
        <td>${userName}</td>
        <td class="text-xs text-base-content/60">${TableFormatters.formatUpdatedAt(fact.updated_at)}</td>
        <td class="text-center">${remindersMap.has(fact.id) ? '<span class="text-info" title="Напоминание установлено">🔔</span>' : ''}</td>
        <td class="text-center">${fact.recurring_plan_id ? '<span class="text-secondary" title="Регламентный платеж">🔄</span>' : ''}</td>
        <td class="text-center" title="${fact.is_offline_sync ? 'Создано offline' : ''}">${fact.is_offline_sync ? '☁️' : ''}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-xs btn-primary gap-1" onclick="showEditModal(${fact.id})">✏️</button>
            <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="${fact.id}" onclick="event.stopPropagation(); deleteFact(${fact.id})" title="Удалить">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;

    // Mobile list item
    const mobileAmountClass = TableFormatters.getArticleColorClass(fact.article_type, 'amount');
    const mobileAmount = TableFormatters.formatAmount(fact.amount, fact.article_type);
    const reminderIcon = remindersMap.has(fact.id)
      ? '<span class="text-info text-xs" title="Напоминание">🔔</span>'
      : '';
    const offlineIcon = fact.is_offline_sync
      ? '<span class="text-xs" title="Создано offline">☁️</span>'
      : '';
    const recurringIcon = fact.recurring_plan_id
      ? '<span class="text-secondary text-xs" title="Регламентный">🔄</span>'
      : '';

    mobileHtml += `
      <div class="transaction-item py-2" data-plan-id="${fact.id}" onclick="showEditModal(${fact.id})">
        <!-- Line 1: Badge + Category + Amount -->
        <div class="flex items-center gap-2">
          <span class="badge badge-info badge-xs shrink-0">План</span>
          <span class="flex-1 font-medium truncate">${articleName}</span>
          <span class="${mobileAmountClass} font-bold whitespace-nowrap">${mobileAmount}</span>
          ${recurringIcon}
          ${reminderIcon}
          ${offlineIcon}
        </div>
        <!-- Line 2: Date • Account • Description -->
        <div class="text-xs text-base-content/60 mt-1 truncate">
          ${shortDate} • ${financialCenter} • ${description}
        </div>
      </div>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  mobileHtml += `</div>`;

  // Combine both views (safe DOM API using template)
  setInnerHTML(container, tableHtml + mobileHtml);
}

// ============================================================================
// Selection Management
// ============================================================================

/**
 * Toggle all checkboxes in table
 * Called from select-all checkbox onchange handler
 *
 * @param checkbox - Select-all checkbox element
 */
export function toggleSelectAll(checkbox: HTMLInputElement): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>('.fact-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checkbox.checked;
    if (checkbox.checked) {
      selectedFactIds.add(parseInt(cb.value));
    } else {
      selectedFactIds.delete(parseInt(cb.value));
    }
  });
  updateBatchDeleteButton();
}

/**
 * Update batch delete button state based on selection
 * Called from checkbox onchange handlers
 */
export function updateBatchDeleteButton(): void {
  const checkboxes = document.querySelectorAll<HTMLInputElement>('.fact-checkbox:checked');
  selectedFactIds = new Set(Array.from(checkboxes).map(cb => parseInt(cb.value)));

  const btn = document.getElementById('batch-delete-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = selectedFactIds.size === 0;
    btn.textContent =
      selectedFactIds.size > 0
        ? `🗑️ Удалить выбранные (${selectedFactIds.size})`
        : '🗑️ Удалить выбранные';
  }
}

// ============================================================================
// Stats & Pagination
// ============================================================================

/**
 * Update statistics display (total count, page range)
 */
function updateStats(): void {
  const totalElem = document.getElementById('stat-total');
  const pageInfoElem = document.getElementById('stat-page-info');

  if (totalElem) {
    totalElem.textContent = String(totalFacts);
  }

  if (pageInfoElem) {
    const startIdx = currentPage * pageSize + 1;
    const endIdx = Math.min((currentPage + 1) * pageSize, totalFacts);
    pageInfoElem.textContent =
      totalFacts > 0 ? `${startIdx}-${endIdx} из ${totalFacts}` : '0-0 из 0';
  }
}

/**
 * Update pagination controls state
 * Shows/hides controls based on total records
 */
function updatePagination(): void {
  const controls = document.getElementById('pagination-controls');
  const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement | null;
  const pageInfo = document.getElementById('page-info');

  if (!controls) return;

  if (totalFacts > pageSize) {
    controls.style.display = 'flex';

    if (prevBtn) prevBtn.disabled = currentPage === 0;
    if (nextBtn) nextBtn.disabled = (currentPage + 1) * pageSize >= totalFacts;

    if (pageInfo) {
      const totalPages = Math.ceil(totalFacts / pageSize);
      pageInfo.textContent = `Страница ${currentPage + 1} из ${totalPages}`;
    }
  } else {
    controls.style.display = 'none';
  }
}

/**
 * Navigate to previous page
 * Called from pagination button onclick handler
 */
export function previousPage(): void {
  if (currentPage > 0) {
    currentPage--;
    loadFacts();
  }
}

/**
 * Navigate to next page
 * Called from pagination button onclick handler
 */
export function nextPage(): void {
  if ((currentPage + 1) * pageSize < totalFacts) {
    currentPage++;
    loadFacts();
  }
}
