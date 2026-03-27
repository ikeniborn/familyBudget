/**
 * Plan Analytics Module
 * ECharts integration, analytics data loading, chart rendering for plan.html
 *
 * @module plan/analytics
 * @version 1.0.0
 * @description Manages plan analytics charts, filters, and month navigation
 */

import * as PlanHelpers from './helpers';

// Import ECharts from global window object
declare const echarts: any;

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
  current_month_total: number;
  previous_month_total: number;
}

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

    // Set initial month
    if (offset === 0) {
      currentAnalyticsMonth = yearMonth;
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

  // Reload analytics
  await loadPlanAnalytics();

  // Sync to filters section (imported at runtime to avoid circular dependency)
  if (typeof (window as any).syncAnalyticsToFilters === 'function') {
    await (window as any).syncAnalyticsToFilters();
  }
}

// ============================================================================
// Filter Dropdowns - Helper Functions
// ============================================================================

/**
 * Group articles by type while preserving hierarchical order
 * @param flatNodes - Flattened article nodes
 * @returns Sorted nodes (expense → income → debit → credit)
 */
function groupArticlesByType(flatNodes: PlanHelpers.FlatArticle[]): PlanHelpers.FlatArticle[] {
  const groupedByType: Record<string, PlanHelpers.FlatArticle[]> = {
    expense: [],
    income: [],
    debit: [],
    credit: []
  };

  flatNodes.forEach(node => {
    if (groupedByType[node.type]) {
      groupedByType[node.type].push(node);
    }
  });

  // Flatten back in type order
  return [
    ...groupedByType.expense,
    ...groupedByType.income,
    ...groupedByType.debit,
    ...groupedByType.credit
  ];
}

/**
 * Build option elements for article dropdown
 * @param select - Target select element
 * @param sortedNodes - Sorted article nodes
 */
function buildArticleOptions(select: HTMLSelectElement, sortedNodes: PlanHelpers.FlatArticle[]): void {
  // Color map for article types
  const colorMap: Record<string, string> = {
    expense: 'rgb(239, 68, 68)', // Red
    income: 'rgb(34, 197, 94)', // Green
    debit: 'rgb(59, 130, 246)', // Blue
    credit: 'rgb(251, 146, 60)' // Orange
  };

  sortedNodes.forEach(node => {
    const option = document.createElement('option');
    option.value = String(node.id);

    const indent = '›  '.repeat(node.level);
    const icon = node.isLeaf ? '▸' : '📂';
    option.textContent = `${indent}${icon} ${node.name}`;
    option.dataset.type = node.type;

    // Color coding by article type
    if (colorMap[node.type]) {
      option.style.color = colorMap[node.type];
    }

    // Style parent categories
    if (!node.isLeaf) {
      option.style.fontWeight = 'bold';
      option.style.opacity = '0.7';
    }

    select.appendChild(option);
  });
}

// ============================================================================
// Filter Dropdowns
// ============================================================================

/**
 * Load CFO (financial center) filter options for analytics
 */
export async function loadAnalyticsCFOFilter(): Promise<void> {
  try {
    const centers = await PlanHelpers.loadFinancialCenters();
    const select = document.getElementById('analytics-cfo-filter') as HTMLSelectElement | null;

    if (!select) return;

    centers.forEach(center => {
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
 * Load article filter options for analytics
 * Filters by article type if provided
 *
 * @param articleType - Article type filter ('expense' | 'income' | 'debit' | 'credit')
 */
export async function loadAnalyticsArticleFilter(articleType: string | null = null): Promise<void> {
  try {
    let url = '/api/v1/articles?limit=1000&sort_by=usage_count';
    if (articleType) {
      url += `&type=${articleType}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[PlanAnalytics] Failed to load articles:', response.status);
      return;
    }

    const data = await response.json();
    const articles: PlanHelpers.Article[] = Array.isArray(data) ? data : data.articles || [];

    const select = document.getElementById('analytics-article') as HTMLSelectElement | null;
    if (!select) return;

    // Save current selection
    const currentValue = select.value;

    // Clear and repopulate (safe DOM API instead of innerHTML)
    select.textContent = '';
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Все категории';
    select.appendChild(defaultOption);

    // Build tree, flatten, and group by type
    const tree = PlanHelpers.buildArticleTree(articles);
    const flatNodes = PlanHelpers.flattenArticleTree(tree);
    const sortedNodes = groupArticlesByType(flatNodes);

    // Build and append options
    buildArticleOptions(select, sortedNodes);

    // Restore selection if still valid
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
      select.value = currentValue;
    }
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
  const typeLabels: Record<string, string> = {
    expense: 'Расходы',
    income: 'Доходы',
    debit: 'Списание',
    credit: 'Пополнение'
  };

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
          const value = new Intl.NumberFormat('ru-RU').format(param.value);
          result += `${param.marker} ${param.seriesName}: ${value} ₽<br/>`;
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
      data: types.map(t => typeLabels[t]),
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

  // Sort by current_month_total descending
  const sorted = [...categories].sort((a, b) => b.current_month_total - a.current_month_total);

  const MAX_VISIBLE = 9;
  const topCategories = sorted.slice(0, MAX_VISIBLE);
  const remainingCategories = sorted.slice(MAX_VISIBLE);

  const displayCategories: CategoryComparison[] = [...topCategories];
  if (remainingCategories.length > 0) {
    const otherCurrentTotal = remainingCategories.reduce((sum, c) => sum + c.current_month_total, 0);
    const otherPreviousTotal = remainingCategories.reduce((sum, c) => sum + c.previous_month_total, 0);
    displayCategories.push({
      category_id: -1,
      category_name: 'Прочее',
      category_type: sorted[0].category_type,
      current_month_total: otherCurrentTotal,
      previous_month_total: otherPreviousTotal,
    });
  }

  // Pre-compute "Прочее" tooltip breakdown (remainingCategories is stable)
  const tooltipOthers = remainingCategories.slice(0, MAX_VISIBLE);
  const tooltipRest = remainingCategories.slice(MAX_VISIBLE);
  const tooltipRestTotal = tooltipRest.reduce((sum, c) => sum + c.current_month_total, 0);

  const formatter = function(params: any[]) {
    if (!params || params.length === 0) return '';
    const isOthers = params[0]?.axisValue === 'Прочее';
    let result = `<b>${params[0]?.axisValue}</b><br/>`;
    params.forEach((param: any) => {
      const value = new Intl.NumberFormat('ru-RU').format(param.value);
      result += `${param.marker} ${param.seriesName}: ${value} ₽<br/>`;
    });

    if (isOthers && remainingCategories.length > 0) {
      result += '<div style="margin-top:6px;border-top:1px solid #e2e8f0;padding-top:4px"><small style="color:#64748b">Состав:</small><br/>';
      tooltipOthers.forEach((c: CategoryComparison) => {
        const value = new Intl.NumberFormat('ru-RU').format(c.current_month_total);
        result += `<small>• ${c.category_name}: ${value} ₽</small><br/>`;
      });
      if (tooltipRest.length > 0) {
        const value = new Intl.NumberFormat('ru-RU').format(tooltipRestTotal);
        result += `<small>• Прочее: ${value} ₽</small><br/>`;
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
        data: displayCategories.map(c => c.previous_month_total),
        itemStyle: { color: '#94a3b8', opacity: 0.5 }
      },
      {
        name: data.current_month.month_name,
        type: 'bar',
        data: displayCategories.map(c => c.current_month_total),
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
