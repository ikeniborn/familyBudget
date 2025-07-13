/**
 * Charts library - Family Budget application
 * 
 * This module provides a comprehensive charting solution built on Recharts
 * with custom theming, export functionality, and responsive containers.
 */

// Core components
export { default as ChartContainer, ChartSkeleton, ChartEmpty } from './core/ChartContainer';
export { 
  default as ResponsiveChartContainer,
  MobileChartContainer,
  DashboardChartContainer,
  ReportChartContainer,
  AdaptiveChartContainer,
} from './core/ResponsiveChartContainer';

// Business chart components
export { default as PlanFactBarChart } from './business/PlanFactBarChart';
export { 
  default as BudgetGauge, 
  BudgetGaugeCompact, 
  BudgetGaugeKPI 
} from './business/BudgetGauge';
export { 
  default as CategoryPieChart, 
  CategoryPieChartCompact 
} from './business/CategoryPieChart';

// Utilities
export { default as ChartTheme, ChartColors, ChartDefaults, ChartFormatters } from './utils/ChartTheme';
export {
  transformToPlanFact,
  transformToCategoryPie,
  transformToTimeSeries,
  transformToWaterfall,
  aggregateByPeriod,
  calculateMovingAverage,
  filterByDateRange,
  calculatePercentageDistribution,
  sortChartData,
  formatChartValue,
  generateColorPalette,
  validateChartData,
} from './utils/dataTransform';
export {
  exportChartAsPNG,
  exportChartAsSVG,
  copyChartToClipboard,
  printChart,
  exportChartDataAsCSV,
} from './utils/chartExport';

// Hooks
export { useChartData } from './hooks/useChartData';
export { useChartFilters } from './hooks/useChartFilters';
export { useChartExport } from './hooks/useChartExport';

// Types
export type {
  ChartDataPoint,
  TimeSeriesDataPoint,
  PlanFactDataPoint,
} from './utils/dataTransform';

export type { UseChartDataReturn, UseChartDataOptions } from './hooks/useChartData';
export type { UseChartFiltersReturn, ChartFilterState } from './hooks/useChartFilters';
export type { UseChartExportReturn, UseChartExportOptions } from './hooks/useChartExport';