/**
 * Plan Analytics Module
 * ECharts integration, analytics data loading, chart rendering for plan.html
 *
 * @module plan/analytics
 * @version 1.0.0
 * @description Manages plan analytics charts, filters, and month navigation
 */

import * as PlanHelpers from './helpers';
import { initAnalyticsArticleChoices } from './analyticsArticleChoices';

// Import ECharts from global window object
declare const echarts: any;

// ============================================================================
// Filter Options Interface & Cache
// ============================================================================

/**
 * Filter options response from /api/v1/analytics/plans/filter-options
 */
export interface PlanFilterOptionsResponse {
  financial_centers: Array<{ id: number; name: string }>;
  article_types: string[];
  articles: Array<{ id: number; name: string; type: string; parent_id: number | null }>;
}

/**
 * Cached filter options from API
 */
let cachedFilterOptions: PlanFilterOptionsResponse | null = null;

/**
 * Human-readable labels for article types
 */
const ARTICLE_TYPE_LABELS: Record<string, string> = {
  expense: 'Расходы',
  income: 'Доходы',
  debit: 'Списание',
  credit: 'Пополнение'
};

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Monthly analytics data from API
 */
export interface MonthlyAnalyticsData {
  current_month: {
    month_name: string;
    total_records: number;
    by_type: {
      expense: number;
      income: number;
      debit: number;
      credit: number;
    };
  };
  previous_month: {
    month_name: string;
    total_records: number;
    by_type: {
      expense: number;
      income: number;
      debit: number;
      credit: number;
    };
  };
  categories_comparison: CategoryComparison[];
}

/**
 * Category comparison data (current vs previous month)
 */
export interface CategoryComparison {
  category_id: number;
  category_name: string;
  category_type: 'expense' | 'income' | 'debit' | 'credit';
  current: number;
  previous: number;
}

// Shared number formatter — reused across all chart tooltip formatters
const numFmt = new Intl.NumberFormat('ru-RU');

// ============================================================================
// State Management
// ============================================================================

/**
 * Current selected analytics month (YYYY-MM format)
 */
let currentAnalyticsMonth: string | null = null;

/**
 * ECharts instance for comparison chart
 */
let analyticsComparisonChart: any = null;

/**
 * ECharts instance for categories chart
 */
let analyticsCategoriesChart: any = null;

/**
 * Cached analytics data
 */
let analyticsData: MonthlyAnalyticsData | null = null;

/**
 * Get current analytics month
 * @returns Current month in YYYY-MM format or null
 */
export function getCurrentAnalyticsMonth(): string | null {
  return currentAnalyticsMonth;
}

/**
 * Set current analytics month
 * @param month - Month in YYYY-MM format
 */
export function setCurrentAnalyticsMonth(month: string): void {
  currentAnalyticsMonth = month;
}

// ============================================================================
// Month Navigation
// ============================================================================

/**
 * Month names in Russian
 */
const MONTH_NAMES = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек'
];

/**
 * Initialize month navigation buttons
 * Creates buttons for current month and next 2 months
 */
export function initAnalyticsMonthButtons(): void {
  const container = document.getElementById('analytics-month-buttons');
  if (!container) return;

  const today = new Date();

  // Create buttons for current month and next 2 months
  for (let offset = 0; offset < 3; offset++) {
    const date = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

    const btn = document.createElement('button');
    btn.className = offset === 0 ? 'join-item btn btn-primary' : 'join-item btn btn-outline';
    btn.style.height = '3rem';
    btn.textContent = label;
    btn.dataset.month = yearMonth;
    btn.onclick = () => selectAnalyticsMonth(yearMonth, btn);

    container.appendChild(btn);

    if (offset === 0) {
      setCurrentAnalyticsMonth(yearMonth);
    }
  }
}

/**
 * Select analytics month and reload charts
 * Called from month button onclick handler
 *
 * @param month - Month in YYYY-MM format
 * @param clickedBtn - Button element that was clicked
 */
export async function selectAnalyticsMonth(month: string, clickedBtn: HTMLButtonElement): Promise<void> {
  currentAnalyticsMonth = month;

  // Update button styles
  const buttons = document.querySelectorAll<HTMLButtonElement>('#analytics-month-buttons button');
  buttons.forEach(btn => {
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-outline');
  });
  clickedBtn.classList.remove('btn-outline');
  clickedBtn.classList.add('btn-primary');

  // Reload filter options for this month (cascade: FC, article types)
  const filterOptions = await loadAnalyticsFilterOptions({ planning_month: month });
  if (filterOptions) {
    await loadAnalyticsCFOFilter(filterOptions.financial_centers);
    populateArticleTypeFilter(filterOptions.article_types);
    // Reload articles: use selected type if any, else use plan-filtered articles
    const typeSelect = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
    if (typeSelect?.value) {
      await loadAnalyticsArticleFilter(typeSelect.value);
    } else {
      await loadAnalyticsArticleFilter(null, filterOptions.articles);
    }
  }

  // Reload analytics
  await loadPlanAnalytics();

  // Sync only date range to facts table — article/type/FC filters must NOT carry over
  // when switching months (they are synced separately via onAnalytics*Change handlers)
  if (typeof window.PlanApp?.syncAnalyticsToFilters === 'function') {
    await window.PlanApp.syncAnalyticsToFilters({ skipFiltersSync: true });
  }
}

// ============================================================================
// Filter Options - Dynamic from API
// ============================================================================

/**
 * Load and cache filter options from /api/v1/analytics/plans/filter-options
 * Returns cached result on subsequent calls
 *
 * @returns PlanFilterOptionsResponse or null on error
 */
export async function loadAnalyticsFilterOptions(
  params?: { planning_month?: string; financial_center_id?: string | number }
): Promise<PlanFilterOptionsResponse | null> {
  // Use cache only when no params (initial/global load)
  if (!params && cachedFilterOptions) {
    return cachedFilterOptions;
  }

  try {
    let url = '/api/v1/analytics/plans/filter-options';
    if (params) {
      const qp = new URLSearchParams();
      if (params.planning_month) qp.set('planning_month', params.planning_month);
      if (params.financial_center_id) qp.set('financial_center_id', String(params.financial_center_id));
      if (qp.toString()) url += '?' + qp.toString();
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result: PlanFilterOptionsResponse = await response.json();
    // Cache only the global (no-param) result
    if (!params) {
      cachedFilterOptions = result;
    }
    return result;
  } catch (error) {
    console.error('[PlanAnalytics] Error loading filter options:', error);
    return null;
  }
}

/**
 * Populate article type select with dynamic values from filter options
 * @param types - Array of article type strings from API
 */
export function populateArticleTypeFilter(types: string[]): void {
  const select = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
  if (!select) return;

  // Remove all options except the first "Все типы" default
  while (select.options.length > 1) {
    select.remove(1);
  }

  types.forEach(type => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = ARTICLE_TYPE_LABELS[type] || type;
    select.appendChild(option);
  });
}

/**
 * Populate all analytics filter dropdowns using cached filter options
 * Calls loadAnalyticsFilterOptions() internally; falls back to legacy endpoints on error
 */
export async function populateAllAnalyticsFilters(): Promise<void> {
  const filterOptions = await loadAnalyticsFilterOptions();

  if (filterOptions && filterOptions.article_types.length > 0) {
    populateArticleTypeFilter(filterOptions.article_types);
  }

  await Promise.all([
    loadAnalyticsCFOFilter(filterOptions ? filterOptions.financial_centers : null),
    loadAnalyticsArticleFilter(null, filterOptions ? filterOptions.articles : null)
  ]);
}

// ============================================================================
// Filter Dropdowns
// ============================================================================

/**
 * Load CFO (financial center) filter options for analytics
 * Uses filter-options data if provided; falls back to PlanHelpers.loadFinancialCenters()
 *
 * @param centers - Pre-fetched financial centers or null for fallback
 */
export async function loadAnalyticsCFOFilter(
  centers: Array<{ id: number; name: string }> | null = null
): Promise<void> {
  try {
    const centerList = centers !== null ? centers : await PlanHelpers.loadFinancialCenters();

    const select = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;
    if (!select) return;

    // Clear existing options except "Все счета" default
    while (select.options.length > 1) {
      select.remove(1);
    }

    centerList.forEach(center => {
      const option = document.createElement('option');
      option.value = String(center.id);
      option.textContent = center.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('[PlanAnalytics] Error loading CFO filter:', error);
  }
}

/**
 * Load article filter options for analytics.
 * When articleType is specified: fetches full hierarchy from /api/v1/articles?type=...
 * When no type: uses allArticles (plan-used subset) or full API as fallback.
 *
 * @param articleType - Article type filter ('expense' | 'income' | 'debit' | 'credit') or null
 * @param allArticles - Pre-fetched articles from filter-options (used only when articleType is null)
 */
export async function loadAnalyticsArticleFilter(
  articleType: string | null = null,
  allArticles: Array<{ id: number; name: string; type: string; parent_id: number | null }> | null = null
): Promise<void> {
  try {
    let articles: PlanHelpers.Article[];

    if (articleType !== null) {
      const cached = await loadAnalyticsFilterOptions();
      const filtered = (cached?.articles ?? []).filter(
        (a: { type: string }) => a.type === articleType
      );
      articles = filtered as PlanHelpers.Article[];
    } else if (allArticles !== null) {
      articles = allArticles as PlanHelpers.Article[];
    } else {
      const cached = await loadAnalyticsFilterOptions();
      articles = (cached?.articles ?? []) as PlanHelpers.Article[];
    }

    initAnalyticsArticleChoices(articles, articleType);
  } catch (error) {
    console.error('[PlanAnalytics] Error loading article filter:', error);
  }
}

// ============================================================================
// Analytics Data Loading
// ============================================================================

/**
 * Load plan analytics data (full picture, only filtered by month and CFO)
 * Updates comparison chart and categories chart
 */
export async function loadPlanAnalytics(): Promise<void> {
  if (!currentAnalyticsMonth) {
    console.warn('[PlanAnalytics] No analytics month selected');
    return;
  }

  try {
    // Build URL with filters (only month and CFO affect full analytics)
    let url = `/api/v1/analytics/plans/monthly-comparison?planning_month=${currentAnalyticsMonth}`;

    const cfoFilter = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;
    if (cfoFilter && cfoFilter.value) {
      url += `&financial_center_id=${cfoFilter.value}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    analyticsData = await response.json();

    // Update summary cards
    if (analyticsData) {
      updateAnalyticsSummary(analyticsData);
    }

    // Check if we have any data
    const hasData = analyticsData
      ? analyticsData.current_month.total_records > 0 || analyticsData.previous_month.total_records > 0
      : false;

    const emptyState = document.getElementById('analytics-empty-state');
    const chartsGrid = document.getElementById('analytics-charts-grid');

    if (!hasData) {
      emptyState?.classList.remove('hidden');
      chartsGrid?.classList.add('hidden');
    } else {
      emptyState?.classList.add('hidden');
      chartsGrid?.classList.remove('hidden');

      // Initialize and update charts
      if (analyticsData) {
        initComparisonChart();
        updateComparisonChart(analyticsData);

        initCategoriesChart();
        updateCategoriesChart(analyticsData);
      }
    }
  } catch (error) {
    console.error('[PlanAnalytics] Error loading plan analytics:', error);
    PlanHelpers.showToast('Ошибка загрузки аналитики: ' + (error as Error).message, 'error');
  }
}

/**
 * Load data for categories chart only (with article type/category filters)
 * Updates only categories chart without reloading comparison chart
 */
export async function loadCategoriesChartData(): Promise<void> {
  if (!currentAnalyticsMonth) {
    console.warn('[PlanAnalytics] No analytics month selected');
    return;
  }

  try {
    let url = `/api/v1/analytics/plans/monthly-comparison?planning_month=${currentAnalyticsMonth}`;

    const cfoFilter = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;
    if (cfoFilter && cfoFilter.value) {
      url += `&financial_center_id=${cfoFilter.value}`;
    }

    // Apply article type and category filters for categories chart
    const typeFilter = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
    if (typeFilter && typeFilter.value) {
      url += `&article_type=${typeFilter.value}`;
    }

    const articleFilter = document.getElementById('analytics-article') as HTMLSelectElement | null;
    if (articleFilter && articleFilter.value) {
      url += `&article_id=${articleFilter.value}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Update only categories chart
    if (!analyticsCategoriesChart) {
      initCategoriesChart();
    }
    updateCategoriesChart(data);
  } catch (error) {
    console.error('[PlanAnalytics] Error loading categories chart data:', error);
  }
}

// ============================================================================
// Summary Cards
// ============================================================================

/**
 * Update summary cards (by type)
 * @param data - Analytics data from API
 */
function updateAnalyticsSummary(data: MonthlyAnalyticsData): void {
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const byType = data.current_month.by_type || {};
  const expenseElem = document.getElementById('analytics-expense');
  const incomeElem = document.getElementById('analytics-income');
  const debitElem = document.getElementById('analytics-debit');
  const creditElem = document.getElementById('analytics-credit');

  if (expenseElem) expenseElem.textContent = formatAmount(byType.expense || 0);
  if (incomeElem) incomeElem.textContent = formatAmount(byType.income || 0);
  if (debitElem) debitElem.textContent = formatAmount(byType.debit || 0);
  if (creditElem) creditElem.textContent = formatAmount(byType.credit || 0);
}

// ============================================================================
// Charts Initialization
// ============================================================================

/**
 * Initialize comparison bar chart
 */
function initComparisonChart(): void {
  const chartDom = document.getElementById('chart-plan-comparison');
  if (!chartDom) return;

  if (analyticsComparisonChart) {
    analyticsComparisonChart.dispose();
  }

  analyticsComparisonChart = echarts.init(chartDom);
}

/**
 * Initialize categories bar chart
 */
function initCategoriesChart(): void {
  const chartDom = document.getElementById('chart-plan-categories');
  if (!chartDom) return;

  if (analyticsCategoriesChart) {
    analyticsCategoriesChart.dispose();
  }

  analyticsCategoriesChart = echarts.init(chartDom);
}

// ============================================================================
// Charts Update - Helper Functions
// ============================================================================

/**
 * Build ECharts configuration for comparison chart
 * @param data - Analytics data from API
 * @returns ECharts option object
 */
function buildComparisonChartConfig(data: MonthlyAnalyticsData): any {
  const typeColors: Record<string, string> = {
    expense: '#ef4444',
    income: '#22c55e',
    debit: '#f59e0b',
    credit: '#3b82f6'
  };

  const types = ['expense', 'income', 'debit', 'credit'];
  const currentByType = data.current_month.by_type || {};
  const previousByType = data.previous_month.by_type || {};

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function (params: any[]) {
        let result = params[0].axisValue + '<br/>';
        params.forEach(param => {
          result += `${param.marker} ${param.seriesName}: ${numFmt.format(param.value)} ₽<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: [data.previous_month.month_name, data.current_month.month_name],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '20%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: types.map(t => ARTICLE_TYPE_LABELS[t]),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { color: '#374151' }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#374151',
        formatter: function (value: number) {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
          if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
          return value;
        }
      },
      splitLine: {
        show: true,
        lineStyle: { color: '#e5e7eb', type: 'dashed' }
      },
      axisLine: { show: true, lineStyle: { color: '#e5e7eb' } }
    },
    series: [
      {
        name: data.previous_month.month_name,
        type: 'bar',
        data: types.map(t => ({
          value: previousByType[t as keyof typeof previousByType] || 0,
          itemStyle: { color: typeColors[t], opacity: 0.25 }
        })),
        barWidth: '30%'
      },
      {
        name: data.current_month.month_name,
        type: 'bar',
        data: types.map(t => ({
          value: currentByType[t as keyof typeof currentByType] || 0,
          itemStyle: { color: typeColors[t] }
        })),
        barWidth: '30%'
      }
    ]
  };
}

// ============================================================================
// Charts Update
// ============================================================================

/**
 * Update comparison chart - Types on X-axis, months as series
 * @param data - Analytics data from API
 */
function updateComparisonChart(data: MonthlyAnalyticsData): void {
  if (!analyticsComparisonChart) return;
  const option = buildComparisonChartConfig(data);
  analyticsComparisonChart.setOption(option);
}

/**
 * Build ECharts configuration for categories comparison chart
 * @param data - Analytics data from API
 * @returns ECharts option object
 */
function buildCategoriesChartConfig(data: MonthlyAnalyticsData): any {
  const categories = data.categories_comparison || [];

  // Empty state
  if (categories.length === 0) {
    return {
      title: {
        text: 'Нет данных',
        subtext: 'Планы по категориям не найдены',
        left: 'center',
        top: 'center',
        textStyle: { fontSize: 14, color: '#999' }
      },
      xAxis: { show: false },
      yAxis: { show: false },
      series: []
    };
  }

  const CHART_MAX_CATEGORIES = 9;
  const TOOLTIP_MAX_DETAIL = 9;
  const OTHER_CATEGORY_NAME = 'Прочее';

  const sorted = [...categories].sort((a, b) => b.current - a.current);
  const remainingCategories = sorted.slice(CHART_MAX_CATEGORIES);

  const displayCategories: CategoryComparison[] = sorted.slice(0, CHART_MAX_CATEGORIES);
  if (remainingCategories.length > 0) {
    const { current: otherCurrentTotal, previous: otherPreviousTotal } = remainingCategories.reduce(
      (acc, c) => ({ current: acc.current + c.current, previous: acc.previous + c.previous }),
      { current: 0, previous: 0 }
    );
    displayCategories.push({
      category_id: -1,
      category_name: OTHER_CATEGORY_NAME,
      category_type: sorted[0].category_type,
      current: otherCurrentTotal,
      previous: otherPreviousTotal,
    });
  }

  const tooltipOthers = remainingCategories.slice(0, TOOLTIP_MAX_DETAIL);
  const tooltipRest = remainingCategories.slice(TOOLTIP_MAX_DETAIL);
  const tooltipRestTotal = tooltipRest.reduce((sum, c) => sum + c.current, 0);

  const formatter = function(params: any[]) {
    if (!params || params.length === 0) return '';
    const isOthers = params[0]?.axisValue === OTHER_CATEGORY_NAME;
    let result = `<b>${params[0]?.axisValue}</b><br/>`;
    params.forEach((param: any) => {
      result += `${param.marker} ${param.seriesName}: ${numFmt.format(param.value)} ₽<br/>`;
    });

    if (isOthers) {
      result += '<div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:4px"><small style="color:#64748b">Состав:</small><br/>';
      tooltipOthers.forEach((c: CategoryComparison) => {
        result += `<small>• ${c.category_name}: ${numFmt.format(c.current)} ₽</small><br/>`;
      });
      if (tooltipRest.length > 0) {
        result += `<small>• ${OTHER_CATEGORY_NAME}: ${numFmt.format(tooltipRestTotal)} ₽</small><br/>`;
      }
      result += '</div>';
    }
    return result;
  };

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter
    },
    legend: {
      data: [data.previous_month.month_name, data.current_month.month_name],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: displayCategories.map(c => c.category_name),
      axisLabel: {
        rotate: 30,
        interval: 0,
        fontSize: 10,
        formatter: function (value: string) {
          return value.length > 12 ? value.substring(0, 12) + '...' : value;
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: function (value: number) {
          if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
          if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
          return value;
        }
      }
    },
    series: [
      {
        name: data.previous_month.month_name,
        type: 'bar',
        data: displayCategories.map(c => c.previous),
        itemStyle: { color: '#94a3b8', opacity: 0.5 }
      },
      {
        name: data.current_month.month_name,
        type: 'bar',
        data: displayCategories.map(c => c.current),
        itemStyle: { color: '#3b82f6' }
      }
    ]
  };
}

/**
 * Update categories bar chart - current vs previous month
 * @param data - Analytics data from API
 */
function updateCategoriesChart(data: MonthlyAnalyticsData): void {
  if (!analyticsCategoriesChart) return;

  const option = buildCategoriesChartConfig(data);
  const categories = data.categories_comparison || [];
  analyticsCategoriesChart.setOption(option, categories.length === 0);
}

// ============================================================================
// Analytics Filter Handlers (called from analytics_section.html onchange)
// ============================================================================

/**
 * Sync analytics state to filters without updating date range.
 * Avoids circular dependency by routing through window.PlanApp.
 */
async function syncToFiltersNoDateUpdate(): Promise<void> {
  if (typeof window.PlanApp?.syncAnalyticsToFilters === 'function') {
    await window.PlanApp.syncAnalyticsToFilters({ updateDateRange: false });
  }
}

export async function onAnalyticsCFOChange(): Promise<void> {
  const cfoCurrent = (document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null)?.value || undefined;
  const params: { planning_month?: string; financial_center_id?: string } = {};
  if (currentAnalyticsMonth) params.planning_month = currentAnalyticsMonth;
  if (cfoCurrent) params.financial_center_id = cfoCurrent;

  // Reload article types and articles for current month + selected FC
  const filterOptions = await loadAnalyticsFilterOptions(Object.keys(params).length ? params : undefined);
  if (filterOptions) {
    populateArticleTypeFilter(filterOptions.article_types);
    const typeSelect = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
    if (typeSelect?.value) {
      await loadAnalyticsArticleFilter(typeSelect.value);
    } else {
      await loadAnalyticsArticleFilter(null, filterOptions.articles);
    }
  }

  await loadPlanAnalytics();
  await syncToFiltersNoDateUpdate();
}

export async function onAnalyticsArticleTypeChange(): Promise<void> {
  const typeSelect = document.getElementById('analytics-article-type') as HTMLSelectElement | null;
  const typeValue = typeSelect?.value || null;
  if (typeValue) {
    // Type selected → fetch full hierarchy from API for proper tree display
    await loadAnalyticsArticleFilter(typeValue);
  } else {
    // Type cleared → show plan-filtered articles for current month + FC
    const cfoCurrent = (document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null)?.value || undefined;
    const params: { planning_month?: string; financial_center_id?: string } = {};
    if (currentAnalyticsMonth) params.planning_month = currentAnalyticsMonth;
    if (cfoCurrent) params.financial_center_id = cfoCurrent;
    const filterOptions = await loadAnalyticsFilterOptions(Object.keys(params).length ? params : undefined);
    await loadAnalyticsArticleFilter(null, filterOptions?.articles || null);
  }
  await loadCategoriesChartData();
  await syncToFiltersNoDateUpdate();
}

export async function onAnalyticsArticleChange(): Promise<void> {
  await loadCategoriesChartData();
  await syncToFiltersNoDateUpdate();
}

export function collapseAnalytics(): void {
  const toggle = document.getElementById('analytics-toggle') as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
}
