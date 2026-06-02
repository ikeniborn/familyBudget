/**
 * Plan Facts Table Module
 * Table rendering, pagination, and selection management for plan.html
 *
 * @module plan/factsTable
 * @version 2.0.0
 * @description Manages facts table display, API-first load-more pagination, and selection state
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
 * Current API offset (increments by PAGE_SIZE on each "load more")
 */
let currentOffset = 0;

/**
 * Number of records fetched per API request
 */
const PAGE_SIZE = 50;

/**
 * Total number of facts matching current filters (from API)
 */
let totalFacts = 0;

/**
 * Number of facts currently loaded/displayed in the table
 */
let loadedCount = 0;

/**
 * Whether more facts can be loaded (loadedCount < totalFacts)
 */
let hasMoreFacts = false;

/**
 * All currently loaded facts (accumulates across load-more calls).
 * Exported for use by crud.ts (shared live binding via Rollup).
 */
let factsData: BudgetFact[] = [];

/**
 * Set of selected fact IDs for batch operations.
 * Exported for use by crud.ts (shared live binding via Rollup).
 */
export let selectedFactIds: Set<number> = new Set();

/**
 * Map of fact ID → reminder for reminder status display.
 * Exported for use by crud.ts (shared live binding via Rollup).
 */
export const remindersMap: Map<number, Reminder> = new Map();

/**
 * Get facts data for all currently loaded facts
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
 * Load reminders for facts
 * Optimized with date range filter (current month ± 1 month buffer)
 *
 * @param factIds - Array of fact IDs to load reminders for
 * @param clearExisting - Whether to clear remindersMap before loading (default: true)
 */
async function loadRemindersForFacts(factIds: number[], clearExisting = true): Promise<void> {
  if (clearExisting) remindersMap.clear();
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
 * Convert API fact (with already-populated names) → UI fact
 */
function toUIFactFromAPI(apiFact: any): PlanHelpers.BudgetFact {
  return {
    id: apiFact.id || 0,
    fact_date: apiFact.fact_date,
    financial_center_id: apiFact.financial_center_id || 0,
    financial_center_name: apiFact.financial_center_name || '',
    cost_center_id: apiFact.cost_center_id || null,
    cost_center_name: apiFact.cost_center_name || null,
    article_id: apiFact.article_id,
    article_name: apiFact.article_name || '',
    article_type: apiFact.article_type || 'expense',
    amount: Number(apiFact.amount),
    description: apiFact.description,
    user_id: apiFact.user_id,
    user_name: apiFact.user_name || '',
    record_type: apiFact.record_type,
    recurring_plan_id: apiFact.recurring_plan_id ?? null,
    has_reminder: apiFact.has_reminder ?? false,
    is_offline_sync: apiFact.is_offline_sync ?? false,
    created_at: apiFact.created_at,
    updated_at: apiFact.updated_at
  };
}

/**
 * Build API URL for fetching plan facts with current filters and pagination offset.
 */
function buildFactsApiUrl(offset: number): string {
  const f = PlanFilters.getFilters();
  const params = new URLSearchParams({
    record_type: 'plan',
    limit: String(PAGE_SIZE),
    offset: String(offset)
  });
  if (f.user_id) params.set('user_id', String(f.user_id));
  if (f.article_id) params.set('article_id', String(f.article_id));
  if (f.article_type) params.set('article_type', f.article_type);
  if (f.date_from) params.set('date_from', f.date_from);
  if (f.date_to) params.set('date_to', f.date_to);
  if (f.financial_center_id) params.set('financial_center_id', String(f.financial_center_id));
  if (f.cost_center_id) params.set('cost_center_id', String(f.cost_center_id));
  if (f.search) params.set('search', f.search);
  if (f.has_recurring_plan) params.set('has_recurring_plan', 'true');
  if (f.has_reminder) params.set('has_reminder', 'true');
  return `/api/v1/facts?${params}`;
}

/**
 * Load facts from the API (first page). Resets state and re-renders the table.
 */
export async function loadFacts(): Promise<void> {
  const container = document.getElementById('facts-table-container');
  if (!container) {
    console.warn('[PlanFactsTable] Container not found');
    return;
  }

  currentOffset = 0;
  loadedCount = 0;
  hasMoreFacts = false;
  factsData = [];

  // Show loading spinner (safe DOM API)
  setInnerHTML(
    container,
    '<div class="flex items-center justify-center py-8"><span class="loading loading-spinner loading-lg text-primary"></span></div>'
  );
  updateLoadMoreButton();

  try {
    const resp = await fetch(buildFactsApiUrl(0), { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const items: PlanHelpers.BudgetFact[] = (data.items ?? []).map(toUIFactFromAPI);
    totalFacts = data.total ?? 0;
    loadedCount = items.length;
    hasMoreFacts = PAGE_SIZE < totalFacts;
    factsData = items;

    remindersMap.clear();
    await loadRemindersForFacts(items.map(f => f.id), false);

    renderFactsTable(items);
    updateStats();
    updateLoadMoreButton();

    const uiFilters = PlanFilters.getFilters();
    if (typeof AdminFactsCommon !== 'undefined') {
      AdminFactsCommon.syncFiltersUI(uiFilters);
    }

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

/**
 * Load the next page of facts and append them to the table.
 * Called from the "Загрузить ещё" button.
 */
export async function loadMoreFacts(): Promise<void> {
  if (!hasMoreFacts) return;

  const btn = document.getElementById('load-more-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
  }

  try {
    currentOffset += PAGE_SIZE;
    const resp = await fetch(buildFactsApiUrl(currentOffset), { credentials: 'include' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const items: PlanHelpers.BudgetFact[] = (data.items ?? []).map(toUIFactFromAPI);
    loadedCount += items.length;
    hasMoreFacts = (currentOffset + PAGE_SIZE) < totalFacts;
    factsData = factsData.concat(items);

    await loadRemindersForFacts(items.map(f => f.id), false);

    appendFactsToTable(items);
    updateStats();
    updateLoadMoreButton();
  } catch (error) {
    console.error('[PlanFactsTable] Error loading more facts:', error);
    currentOffset -= PAGE_SIZE;
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
    }
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
        <td class="text-base-content/50 text-xs">${fact.id}</td>
        <td>${formattedDate}</td>
        <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
        <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
        <td>${articleName}</td>
        <td class="${articleColorClass} font-bold">${TableFormatters.formatAmount(fact.amount, fact.article_type)}</td>
        <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
        <td>${userName}</td>
        <td class="text-xs text-base-content/60">${TableFormatters.formatUpdatedAt(fact.updated_at)}</td>
        <td class="text-center">${fact.has_reminder ? '<span class="text-info" title="Напоминание установлено">🔔</span>' : ''}</td>
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
    const reminderIcon = fact.has_reminder
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

/**
 * Append additional facts to the existing table (used by load-more).
 * Reuses the same row HTML structure as renderFactsTable().
 *
 * @param facts - New facts to append
 */
function appendFactsToTable(facts: BudgetFact[]): void {
  if (facts.length === 0) return;

  const desktopTbody = document.querySelector<HTMLElement>('.facts-desktop-table tbody');
  const mobileList = document.querySelector<HTMLElement>('.facts-mobile-list');

  if (!desktopTbody && !mobileList) return;

  facts.forEach(fact => {
    const articleColorClass = TableFormatters.getArticleColorClass(fact.article_type, 'text');
    const description = escapeHtml(fact.description || '—');
    const descriptionTruncated = TableFormatters.truncateText(fact.description || '—', 30);
    const financialCenter = escapeHtml(fact.financial_center_name || '—');
    const costCenter = escapeHtml(fact.cost_center_name || '—');
    const formattedDate = BudgetShared.DateFormatter.formatForDisplay(fact.fact_date);
    const shortDate = formattedDate.slice(0, 5);
    const articleName = escapeHtml(fact.article_name || '—');
    const userName = escapeHtml(fact.user_name || '—');

    if (desktopTbody) {
      const trHtml = `
        <tr data-plan-id="${fact.id}">
          <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="${fact.id}" onchange="window.PlanApp.FactsTable.updateBatchDeleteButton()"></td>
          <td class="text-base-content/50 text-xs">${fact.id}</td>
          <td>${formattedDate}</td>
          <td class="max-w-xs truncate" title="${financialCenter}">${financialCenter}</td>
          <td class="max-w-xs truncate" title="${costCenter}">${costCenter}</td>
          <td>${articleName}</td>
          <td class="${articleColorClass} font-bold">${TableFormatters.formatAmount(fact.amount, fact.article_type)}</td>
          <td class="max-w-xs truncate" title="${description}">${descriptionTruncated}</td>
          <td>${userName}</td>
          <td class="text-xs text-base-content/60">${TableFormatters.formatUpdatedAt(fact.updated_at)}</td>
          <td class="text-center">${fact.has_reminder ? '<span class="text-info" title="Напоминание установлено">🔔</span>' : ''}</td>
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
      const tpl = document.createElement('template');
      tpl.innerHTML = trHtml.trim();
      desktopTbody.appendChild(tpl.content);
    }

    if (mobileList) {
      const mobileAmountClass = TableFormatters.getArticleColorClass(fact.article_type, 'amount');
      const mobileAmount = TableFormatters.formatAmount(fact.amount, fact.article_type);
      const reminderIcon = fact.has_reminder
        ? '<span class="text-info text-xs" title="Напоминание">🔔</span>'
        : '';
      const offlineIcon = fact.is_offline_sync
        ? '<span class="text-xs" title="Создано offline">☁️</span>'
        : '';
      const recurringIcon = fact.recurring_plan_id
        ? '<span class="text-secondary text-xs" title="Регламентный">🔄</span>'
        : '';

      const divHtml = `
        <div class="transaction-item py-2" data-plan-id="${fact.id}" onclick="showEditModal(${fact.id})">
          <div class="flex items-center gap-2">
            <span class="badge badge-info badge-xs shrink-0">План</span>
            <span class="flex-1 font-medium truncate">${articleName}</span>
            <span class="${mobileAmountClass} font-bold whitespace-nowrap">${mobileAmount}</span>
            ${recurringIcon}
            ${reminderIcon}
            ${offlineIcon}
          </div>
          <div class="text-xs text-base-content/60 mt-1 truncate">
            ${shortDate} • ${financialCenter} • ${description}
          </div>
        </div>
      `;
      const tpl = document.createElement('template');
      tpl.innerHTML = divHtml.trim();
      mobileList.appendChild(tpl.content);
    }
  });
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
// Stats & Load More
// ============================================================================

/**
 * Update statistics display (total count, loaded count)
 */
function updateStats(): void {
  const totalElem = document.getElementById('stat-total');
  const pageInfoElem = document.getElementById('stat-page-info');

  if (totalElem) totalElem.textContent = String(totalFacts);

  if (pageInfoElem) {
    pageInfoElem.textContent = loadedCount < totalFacts
      ? `показано ${loadedCount} из ${totalFacts}`
      : String(totalFacts);
  }
}

/**
 * Show or hide the "Загрузить ещё" button based on hasMoreFacts state
 */
function updateLoadMoreButton(): void {
  const container = document.getElementById('load-more-container');
  const counter = document.getElementById('load-more-counter');

  if (!container) return;

  if (hasMoreFacts) {
    container.classList.remove('hidden');
    if (counter) counter.textContent = `(показано ${loadedCount} из ${totalFacts})`;
  } else {
    container.classList.add('hidden');
  }
}

// ============================================================================
// Incremental Row Updates
// ============================================================================

/**
 * Parse an HTML string into a DOM element using a template element.
 */
function parseHtml(html: string): Element | null {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild ?? null;
}

/**
 * Check if we are on page 1 (0-indexed) with no user-defined extra filters.
 * "Extra filters" means any filter beyond the default date range.
 */
function isPage1NoExtraFilters(): boolean {
  if (currentOffset !== 0) {
    return false;
  }
  const f = PlanFilters.getFilters();
  if (
    f.user_id ||
    f.article_id ||
    f.article_type ||
    f.financial_center_id ||
    f.cost_center_id ||
    f.search ||
    f.has_recurring_plan ||
    f.has_reminder
  ) {
    return false;
  }
  return true;
}

/**
 * Fetch row HTML from backend for a single plan record.
 * Returns parsed { desktopRow, mobileRow } or null on failure.
 */
async function fetchPlanRowHtml(
  planId: number
): Promise<{ desktopRow: string; mobileRow: string } | null> {
  try {
    const resp = await fetch(`/api/v1/facts/${planId}/row-html?record_type=plan`, {
      credentials: 'include'
    });
    if (!resp.ok) {
      return null;
    }
    const html = await resp.text();
    // Backend returns: <template data-plan-row="ID">desktop_tr|||mobile_div</template>
    const match = html.match(/<template[^>]*>([\s\S]*?)\|\|\|([\s\S]*?)<\/template>/);
    if (!match) {
      return null;
    }
    return { desktopRow: match[1].trim(), mobileRow: match[2].trim() };
  } catch {
    return null;
  }
}

/**
 * Fetch a plan row from the backend and inject it into the table.
 * - operation 'create': prepend to beginning of table
 * - operation 'update': find existing row by data-plan-id and replace it
 *
 * Returns true if the injection succeeded, false if a full loadFacts() is needed.
 */
export async function fetchAndInjectPlanRow(
  planId: number,
  operation: 'create' | 'update'
): Promise<boolean> {
  if (!isPage1NoExtraFilters()) {
    return false;
  }

  const rows = await fetchPlanRowHtml(planId);
  if (!rows) {
    return false;
  }

  const { desktopRow, mobileRow } = rows;
  const desktopTbody = document.querySelector<HTMLElement>('.facts-desktop-table tbody');
  const mobileList = document.querySelector<HTMLElement>('.facts-mobile-list');

  if (operation === 'create') {
    if (desktopTbody) {
      const trEl = parseHtml(desktopRow);
      if (trEl) desktopTbody.prepend(trEl);

      // Trim excess rows beyond PAGE_SIZE
      const allRows = desktopTbody.querySelectorAll('tr');
      for (let i = allRows.length - 1; i >= PAGE_SIZE; i--) {
        allRows[i].remove();
      }
    }
    if (mobileList) {
      const divEl = parseHtml(mobileRow);
      if (divEl) mobileList.prepend(divEl);

      // Trim excess items beyond PAGE_SIZE
      const allItems = mobileList.querySelectorAll('.transaction-item');
      for (let i = allItems.length - 1; i >= PAGE_SIZE; i--) {
        allItems[i].remove();
      }
    }
    totalFacts++;
    loadedCount = Math.min(loadedCount + 1, PAGE_SIZE);
    updateStats();
    updateLoadMoreButton();
    return true;
  }

  if (operation === 'update') {
    const existingTr = document.querySelector<HTMLElement>(`tr[data-plan-id="${planId}"]`);
    if (existingTr) {
      const trEl = parseHtml(desktopRow);
      if (trEl) existingTr.replaceWith(trEl);
    }
    const existingDiv = document.querySelector<HTMLElement>(`div[data-plan-id="${planId}"]`);
    if (existingDiv) {
      const divEl = parseHtml(mobileRow);
      if (divEl) existingDiv.replaceWith(divEl);
    }
    return true;
  }

  return false;
}

/**
 * Remove a plan row from the table with a fade animation.
 * Used for single-fact deletes to avoid a full table reload.
 */
export function removePlanRow(planId: number): void {
  const fadeAndRemove = (el: HTMLElement): void => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  };

  const trEl = document.querySelector<HTMLElement>(`tr[data-plan-id="${planId}"]`);
  const divEl = document.querySelector<HTMLElement>(`div[data-plan-id="${planId}"]`);

  // Always decrement the counter: the record was deleted from DB regardless of
  // whether it is visible on the current page (matches facts-page pattern).
  totalFacts = Math.max(0, totalFacts - 1);
  loadedCount = Math.max(0, loadedCount - 1);
  updateStats();
  updateLoadMoreButton();

  if (trEl) fadeAndRemove(trEl);
  if (divEl) fadeAndRemove(divEl);
}

