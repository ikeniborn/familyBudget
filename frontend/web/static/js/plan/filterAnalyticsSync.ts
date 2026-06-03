/**
 * Filter-Analytics Synchronization Module
 * Bidirectional synchronization between Filters Section and Analytics Section
 *
 * @module plan/filterAnalyticsSync
 * @version 1.0.0
 * @description Syncs filter state ↔ analytics state with debouncing and mutex protection
 */

import * as PlanFilters from './filters';
import * as PlanAnalytics from './analytics';
import * as PlanFactsTable from './factsTable';
import { planFilterArticleWidget } from './features/filterArticle/init';

// Import BudgetShared from global
declare const BudgetShared: {
  DateFormatter: {
    formatForDisplay: (isoDate: string) => string;
    formatForAPI: (displayDate: string) => string;
  };
};

// ============================================================================
// Synchronization State
// ============================================================================

/**
 * Mutex flag to prevent infinite update loops during filter synchronization
 * Set to true when sync is in progress, prevents cascading updates
 */
let isSyncInProgress = false;

/**
 * Debounce timer for syncFiltersToAnalytics
 * Delays execution until user stops changing filters (300ms delay)
 */
let syncDebounceTimer: number | null = null;

// ============================================================================
// Date/Month Conversion Helpers
// ============================================================================

/**
 * Convert YYYY-MM month to full month date range
 *
 * @param yearMonth - Month in YYYY-MM format (e.g., "2025-12")
 * @returns Date range object with 'from' and 'to' properties in YYYY-MM-DD format
 *
 * @example
 * monthToDateRange("2025-12")
 * // => {from: "2025-12-01", to: "2025-12-31"}
 *
 * monthToDateRange("2024-02")
 * // => {from: "2024-02-01", to: "2024-02-29"} (leap year)
 */
export function monthToDateRange(yearMonth: string): { from: string; to: string } {
  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    console.warn('[monthToDateRange] Invalid yearMonth format:', yearMonth);
    return { from: PlanFilters.DEFAULT_DATE_FROM, to: PlanFilters.DEFAULT_DATE_TO };
  }

  const [year, month] = yearMonth.split('-').map(Number);

  // First day of month
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

  // Last day of month (handle February, 30-day, 31-day months)
  const lastDayDate = new Date(year, month, 0); // Day 0 = last day of previous month
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

  return { from: firstDay, to: lastDay };
}

/**
 * Convert date range to YYYY-MM month if range matches full month
 * Returns null if range doesn't match a complete calendar month
 *
 * @param dateFrom - Start date in YYYY-MM-DD format
 * @param dateTo - End date in YYYY-MM-DD format
 * @returns Month in YYYY-MM format or null
 *
 * @example
 * dateRangeToMonth("2025-12-01", "2025-12-31") // => "2025-12"
 * dateRangeToMonth("2025-12-05", "2025-12-31") // => null (partial month)
 * dateRangeToMonth("2025-12-01", "2026-01-15") // => null (multi-month)
 */
export function dateRangeToMonth(dateFrom: string | null, dateTo: string | null): string | null {
  if (!dateFrom || !dateTo) return null;

  // Extract year-month-day from both dates
  const fromParts = dateFrom.split('-'); // [YYYY, MM, DD]
  const toParts = dateTo.split('-');

  if (fromParts.length !== 3 || toParts.length !== 3) return null;

  const [fromYear, fromMonth, fromDay] = fromParts;
  const [toYear, toMonth, toDay] = toParts;

  // Check if same year-month
  if (fromYear !== toYear || fromMonth !== toMonth) return null;

  // Check if starts on 1st
  if (fromDay !== '01') return null;

  // Check if ends on last day of month
  const year = parseInt(fromYear);
  const month = parseInt(fromMonth);
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  if (parseInt(toDay) !== lastDayOfMonth) return null;

  return `${fromYear}-${fromMonth}`;
}

// ============================================================================
// Debounced Sync
// ============================================================================

/**
 * Debounced wrapper for syncFiltersToAnalytics
 * Prevents cascading filter reloads by delaying execution until user stops changing filters
 *
 * @param options - Synchronization options
 * @param delay - Debounce delay in milliseconds (default: 300ms)
 */
export function debouncedSyncFiltersToAnalytics(
  options: SyncOptions = {},
  delay: number = 300
): void {
  // Cancel pending sync
  if (syncDebounceTimer !== null) {
    clearTimeout(syncDebounceTimer);
  }

  // Schedule new sync
  syncDebounceTimer = window.setTimeout(() => {
    syncDebounceTimer = null;
    syncFiltersToAnalytics(options);
  }, delay);
}

// ============================================================================
// Synchronization Options Interface
// ============================================================================

/**
 * Options for synchronization functions
 */
export interface SyncOptions {
  /**
   * Skip data reload (default: false)
   */
  skipReload?: boolean;
  /**
   * Update analytics month from date range (default: true, for filters → analytics sync)
   */
  updateMonth?: boolean;
  /**
   * Update date range from month (default: true, for analytics → filters sync)
   */
  updateDateRange?: boolean;
  /**
   * Skip syncing article/type/FC filters to facts table (default: false).
   * Use when only the date range should change, e.g. when switching analytics month.
   */
  skipFiltersSync?: boolean;
}

// ============================================================================
// Filters → Analytics Synchronization
// ============================================================================

/**
 * Synchronize Filters Section → Analytics Section
 * Updates analytics UI elements and reloads charts if values changed
 *
 * @param options - Synchronization options
 * @param options.skipReload - Skip chart reload (default: false)
 * @param options.updateMonth - Update analytics month from date range (default: true)
 */
export async function syncFiltersToAnalytics(options: SyncOptions = {}): Promise<void> {
  const { skipReload = false, updateMonth = true } = options;

  // Prevent infinite loops
  if (isSyncInProgress) {
    return;
  }

  isSyncInProgress = true;
  let needsReload = false;

  try {
    const filters = PlanFilters.getFilters();

    // 1. Sync month from date range
    if (updateMonth) {
      const monthFromRange = dateRangeToMonth(filters.date_from, filters.date_to);
      const currentAnalyticsMonth = PlanAnalytics.getCurrentAnalyticsMonth();

      if (monthFromRange && monthFromRange !== currentAnalyticsMonth) {
        // Update month selection
        PlanAnalytics.setCurrentAnalyticsMonth(monthFromRange);

        // Update button styles
        const buttons = document.querySelectorAll<HTMLButtonElement>('#analytics-month-buttons button');
        buttons.forEach(btn => {
          const isSelected = btn.dataset.month === monthFromRange;
          btn.classList.toggle('btn-primary', isSelected);
          btn.classList.toggle('btn-outline', !isSelected);
        });

        needsReload = true;
      } else if (!monthFromRange && currentAnalyticsMonth) {
        // Partial month or multi-month range — clear all button selections
        const buttons = document.querySelectorAll<HTMLButtonElement>('#analytics-month-buttons button');
        buttons.forEach(btn => {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-outline');
        });
      }
    }

    // 2. Sync article type
    const filterArticleType = document.getElementById('filter-article-type') as HTMLSelectElement | null;
    const analyticsArticleType = document.getElementById('analytics-article-type') as HTMLSelectElement | null;

    if (filterArticleType && analyticsArticleType) {
      const newValue = filterArticleType.value || '';
      if (analyticsArticleType.value !== newValue) {
        analyticsArticleType.value = newValue;
        const cached = await PlanAnalytics.loadAnalyticsFilterOptions();
        await PlanAnalytics.loadAnalyticsArticleFilter(newValue || null, cached ? cached.articles : null);
        needsReload = true;
      }
    }

    // 3. Sync article (category)
    const filterArticle = document.getElementById('filter-article') as HTMLSelectElement | null;
    const analyticsArticle = document.getElementById('analytics-article') as HTMLSelectElement | null;

    if (filterArticle && analyticsArticle) {
      const newValue = filterArticle.value || '';
      // Check if option exists in analytics dropdown
      const optionExists = analyticsArticle.querySelector(`option[value="${newValue}"]`);
      if (optionExists && analyticsArticle.value !== newValue) {
        analyticsArticle.value = newValue;
        needsReload = true;
      }
    }

    // 4. Sync financial center
    const filterFC = document.getElementById('filter-financial-center') as HTMLSelectElement | null;
    const analyticsCFO = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;

    if (filterFC && analyticsCFO) {
      const newValue = filterFC.value || '';
      if (analyticsCFO.value !== newValue) {
        analyticsCFO.value = newValue;
        needsReload = true;
      }
    }

    // 5. Reload charts if any value changed
    if (needsReload && !skipReload) {
      await PlanAnalytics.loadPlanAnalytics();
    }
  } catch (error) {
    console.error('[syncFiltersToAnalytics] Error during sync:', error);
  } finally {
    isSyncInProgress = false;
  }
}

// ============================================================================
// Analytics → Filters Synchronization
// ============================================================================

/**
 * Synchronize Analytics Section → Filters Section
 * Updates filter UI elements and reloads facts table if values changed
 *
 * @param options - Synchronization options
 * @param options.skipReload - Skip facts reload (default: false)
 * @param options.updateDateRange - Update date range from month (default: true)
 */
export async function syncAnalyticsToFilters(options: SyncOptions = {}): Promise<void> {
  const { skipReload = false, updateDateRange = true, skipFiltersSync = false } = options;

  // Prevent infinite loops
  if (isSyncInProgress) {
    return;
  }

  isSyncInProgress = true;
  let needsReload = false;

  try {
    const currentAnalyticsMonth = PlanAnalytics.getCurrentAnalyticsMonth();

    // 1. Sync date range from month
    if (updateDateRange && currentAnalyticsMonth) {
      const { from, to } = monthToDateRange(currentAnalyticsMonth);
      const filters = PlanFilters.getFilters();

      if (filters.date_from !== from || filters.date_to !== to) {
        // Update filters object
        PlanFilters.setFilters({ date_from: from, date_to: to });

        // Update UI inputs (DD.MM.YYYY format)
        const dateFromInput = document.getElementById('filter-date-from') as HTMLInputElement | null;
        const dateToInput = document.getElementById('filter-date-to') as HTMLInputElement | null;

        if (dateFromInput) {
          dateFromInput.value = BudgetShared.DateFormatter.formatForDisplay(from);
        }
        if (dateToInput) {
          dateToInput.value = BudgetShared.DateFormatter.formatForDisplay(to);
        }

        needsReload = true;
      }
    }

    if (!skipFiltersSync) {
      // 2. Sync article type
      const analyticsArticleType = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
      const filterArticleType = document.getElementById('filter-article-type') as HTMLSelectElement | null;
      const filterArticle = document.getElementById('filter-article') as HTMLSelectElement | null;

      if (analyticsArticleType && filterArticleType) {
        const newValue = analyticsArticleType.value || '';
        if (filterArticleType.value !== newValue) {
          filterArticleType.value = newValue;

          // Update filters object immediately
          PlanFilters.setFilters({ article_type: newValue || null });

          // Reset article filter (category list changed)
          if (filterArticle) {
            filterArticle.value = '';
            PlanFilters.setFilters({ article_id: null });
            planFilterArticleWidget.clearValue();
          }

          needsReload = true;
        }
      }

      // 3. Sync article (category)
      const analyticsArticle = document.getElementById('analytics-article') as HTMLSelectElement | null;

      if (analyticsArticle && filterArticle) {
        const newValue = analyticsArticle.value || '';
        // Check if option exists in filter dropdown
        const optionExists = filterArticle.querySelector(`option[value="${newValue}"]`);
        if (optionExists && filterArticle.value !== newValue) {
          filterArticle.value = newValue;
          PlanFilters.setFilters({ article_id: parseInt(newValue) || null });
          planFilterArticleWidget.setValue(newValue || null);
          needsReload = true;
        }
      }

      // 4. Sync financial center
      const analyticsCFO = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;
      const filterFC = document.getElementById('filter-financial-center') as HTMLSelectElement | null;

      if (analyticsCFO && filterFC) {
        const newValue = analyticsCFO.value || '';
        if (filterFC.value !== newValue) {
          filterFC.value = newValue;
          PlanFilters.setFilters({ financial_center_id: parseInt(newValue) || null });
          needsReload = true;
        }
      }
    }

    // 5. Reload facts table if any value changed
    if (needsReload && !skipReload) {
      await PlanFactsTable.loadFacts();
      PlanFilters.updateFilterIndicator();
    }
  } catch (error) {
    console.error('[syncAnalyticsToFilters] Error during sync:', error);
  } finally {
    isSyncInProgress = false;
  }
}
