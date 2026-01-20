/**
 * Plan Filters Module
 * Filter state management and UI synchronization for plan.html
 *
 * @module plan/filters
 * @version 1.0.0
 * @description Manages filter state, UI updates, and validation for plan facts table
 */

// Import BudgetShared from global window object (loaded via budgetShared.bundle.js)
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
    formatForAPI: (displayDate: string) => string;
    todayISO: () => string;
  };
};

// Import admin-facts-common from global (loaded via admin-facts-common.min.js)
declare const AdminFactsCommon: {
  syncFiltersUI: (filters: PlanFilters) => void;
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Plan filter configuration
 */
export interface PlanFilters {
  user_id: number | null;
  article_id: number | null;
  article_type: string | null;
  date_from: string | null; // YYYY-MM-DD format
  date_to: string | null; // YYYY-MM-DD format
  financial_center_id: number | null;
  cost_center_id: number | null;
  search: string | null;
  has_recurring_plan?: boolean | null;
  has_reminder?: boolean | null;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default date range: start of current month to 3 months ahead
 */
export const DEFAULT_DATE_FROM = (() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`; // First day of current month (YYYY-MM-DD)
})();

export const DEFAULT_DATE_TO = (() => {
  // For plan page: show plans for next 3 months (current + 3)
  const now = new Date();
  const futureDate = new Date(now.getFullYear(), now.getMonth() + 3, 0); // Last day of month +3
  const year = futureDate.getFullYear();
  const month = String(futureDate.getMonth() + 1).padStart(2, '0');
  const day = String(futureDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
})();

// ============================================================================
// State Management
// ============================================================================

/**
 * Internal filter state (initialized with default period)
 */
let filters: PlanFilters = {
  user_id: null,
  article_id: null,
  article_type: null,
  date_from: DEFAULT_DATE_FROM,
  date_to: DEFAULT_DATE_TO,
  financial_center_id: null,
  cost_center_id: null,
  search: null,
  has_recurring_plan: null,
  has_reminder: null
};

/**
 * Get current filter state (readonly copy)
 * @returns Readonly copy of current filters
 */
export function getFilters(): Readonly<PlanFilters> {
  return { ...filters };
}

/**
 * Set filter state (partial update)
 * @param newFilters - Partial filter object to merge
 */
export function setFilters(newFilters: Partial<PlanFilters>): void {
  filters = { ...filters, ...newFilters };
  console.log('[PlanFilters] Filters updated:', filters);

  // Dispatch custom event for listeners
  window.dispatchEvent(new CustomEvent('filtersChanged', { detail: filters }));
}

/**
 * Reset filters to default state (current month period)
 */
export function resetFilterState(): void {
  filters = {
    user_id: null,
    article_id: null,
    article_type: null,
    date_from: DEFAULT_DATE_FROM,
    date_to: DEFAULT_DATE_TO,
    financial_center_id: null,
    cost_center_id: null,
    search: null,
    has_recurring_plan: null,
    has_reminder: null
  };
  console.log('[PlanFilters] Filters reset to default:', filters);

  // Dispatch event
  window.dispatchEvent(new CustomEvent('filtersChanged', { detail: filters }));
}

// ============================================================================
// UI Synchronization
// ============================================================================

/**
 * Read filter values from UI form elements and update internal state
 * Called by applyFilters() before loading facts
 */
export function readFiltersFromUI(): void {
  // Read select values
  const userSelect = document.getElementById('filter-user') as HTMLSelectElement | null;
  const articleSelect = document.getElementById('filter-article') as HTMLSelectElement | null;
  const articleTypeSelect = document.getElementById('filter-article-type') as HTMLSelectElement | null;
  const fcSelect = document.getElementById('filter-financial-center') as HTMLSelectElement | null;
  const ccSelect = document.getElementById('filter-cost-center') as HTMLSelectElement | null;
  const searchInput = document.getElementById('filter-search') as HTMLInputElement | null;

  filters.user_id = userSelect?.value ? Number(userSelect.value) : null;
  filters.article_id = articleSelect?.value ? Number(articleSelect.value) : null;
  filters.article_type = articleTypeSelect?.value || null;
  filters.financial_center_id = fcSelect?.value ? Number(fcSelect.value) : null;
  filters.cost_center_id = ccSelect?.value ? Number(ccSelect.value) : null;
  filters.search = searchInput?.value.trim() || null;

  // Read date range (convert DD.MM.YYYY → YYYY-MM-DD for API)
  const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement | null;
  const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement | null;

  if (dateFromInput?.value) {
    filters.date_from = BudgetShared.DateFormatter.formatForAPI(dateFromInput.value);
  }
  if (dateToInput?.value) {
    filters.date_to = BudgetShared.DateFormatter.formatForAPI(dateToInput.value);
  }

  // Read checkbox filters
  const filterRecurring = document.getElementById('filter-recurring') as HTMLInputElement | null;
  const filterWithReminder = document.getElementById('filter-with-reminder') as HTMLInputElement | null;

  filters.has_recurring_plan = filterRecurring?.checked ? true : null;
  filters.has_reminder = filterWithReminder?.checked ? true : null;

  console.log('[PlanFilters] Filters read from UI:', filters);

  // Dispatch event
  window.dispatchEvent(new CustomEvent('filtersChanged', { detail: filters }));
}

/**
 * Write filter state to UI form elements
 * Called by resetFilters() and syncAnalyticsToFilters()
 */
export function writeFiltersToUI(): void {
  // Write select values
  const userSelect = document.getElementById('filter-user') as HTMLSelectElement | null;
  const articleSelect = document.getElementById('filter-article') as HTMLSelectElement | null;
  const articleTypeSelect = document.getElementById('filter-article-type') as HTMLSelectElement | null;
  const fcSelect = document.getElementById('filter-financial-center') as HTMLSelectElement | null;
  const ccSelect = document.getElementById('filter-cost-center') as HTMLSelectElement | null;
  const searchInput = document.getElementById('filter-search') as HTMLInputElement | null;

  if (userSelect) userSelect.value = filters.user_id ? String(filters.user_id) : '';
  if (articleSelect) articleSelect.value = filters.article_id ? String(filters.article_id) : '';
  if (articleTypeSelect) articleTypeSelect.value = filters.article_type || '';
  if (fcSelect) fcSelect.value = filters.financial_center_id ? String(filters.financial_center_id) : '';
  if (ccSelect) ccSelect.value = filters.cost_center_id ? String(filters.cost_center_id) : '';
  if (searchInput) searchInput.value = filters.search || '';

  // Write date range (convert YYYY-MM-DD → DD.MM.YYYY for display)
  const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement | null;
  const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement | null;

  if (dateFromInput && filters.date_from) {
    dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_from);
  }
  if (dateToInput && filters.date_to) {
    dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(filters.date_to);
  }

  // Write checkbox filters
  const filterRecurring = document.getElementById('filter-recurring') as HTMLInputElement | null;
  const filterWithReminder = document.getElementById('filter-with-reminder') as HTMLInputElement | null;

  if (filterRecurring) filterRecurring.checked = !!filters.has_recurring_plan;
  if (filterWithReminder) filterWithReminder.checked = !!filters.has_reminder;

  console.log('[PlanFilters] Filters written to UI');
}

/**
 * Initialize default period filter in UI (called on page load)
 */
export function initDefaultPeriodFilter(): void {
  const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement | null;
  const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement | null;

  // YYYY-MM-DD → DD.MM.YYYY for display
  if (dateFromInput) {
    dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(DEFAULT_DATE_FROM);
  }
  if (dateToInput) {
    dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(DEFAULT_DATE_TO);
  }

  console.log('[PlanFilters] Default period initialized:', DEFAULT_DATE_FROM, 'to', DEFAULT_DATE_TO);
}

// ============================================================================
// Filter Indicator
// ============================================================================

/**
 * Count number of active filters
 * Period is ALWAYS counted as active (even if default)
 *
 * @returns Number of active filters
 */
export function countActiveFilters(): number {
  let count = 0;

  // Period: ALWAYS counted as active (even if default)
  if (filters.date_from || filters.date_to) {
    count++;
  }

  // Other filters - count if set (not null/empty)
  if (filters.user_id) count++;
  if (filters.article_id) count++;
  if (filters.article_type) count++;
  if (filters.financial_center_id) count++;
  if (filters.cost_center_id) count++;
  if (filters.search) count++;
  if (filters.has_recurring_plan) count++;
  if (filters.has_reminder) count++;

  return count;
}

/**
 * Update filter indicator badge in UI
 * Shows number of active filters, hides if none
 */
export function updateFilterIndicator(): void {
  const indicator = document.getElementById('filter-indicator');
  if (!indicator) return;

  const activeFilters = countActiveFilters();

  if (activeFilters > 0) {
    indicator.textContent = activeFilters === 1 ? '1 активен' : `${activeFilters} активно`;
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

// ============================================================================
// UI Actions
// ============================================================================

/**
 * Collapse filter section (closes accordion)
 */
export function collapseFilters(): void {
  const checkbox = document.getElementById('filters-toggle') as HTMLInputElement | null;
  if (checkbox) {
    checkbox.checked = false;
  }
}

/**
 * Apply filters: read from UI, sync external libs, return for caller to handle data reload
 * NOTE: This function does NOT reload data - caller must handle loadFacts() and syncFiltersToAnalytics()
 *
 * @returns Promise that resolves when UI sync is complete
 */
export async function applyFilters(): Promise<void> {
  // Read current filter values from UI
  readFiltersFromUI();

  // Sync UI with filter state (AdminFactsCommon handles category highlighting)
  if (typeof AdminFactsCommon !== 'undefined') {
    AdminFactsCommon.syncFiltersUI(filters);
  }

  // Update filter indicator
  updateFilterIndicator();

  console.log('[PlanFilters] Filters applied, ready for data reload');
}

/**
 * Reset filters: clear UI, restore default period, return for caller to handle data reload
 * NOTE: This function does NOT reload data - caller must handle loadFacts() and syncFiltersToAnalytics()
 *
 * @returns Promise that resolves when UI reset is complete
 */
export async function resetFilters(): Promise<void> {
  // Reset internal state
  resetFilterState();

  // Write default values to UI
  writeFiltersToUI();

  // Update filter indicator
  updateFilterIndicator();

  console.log('[PlanFilters] Filters reset, ready for data reload');
}
