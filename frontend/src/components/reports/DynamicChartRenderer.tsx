import React, { Suspense, memo, useMemo } from 'react';
import { ChartSkeleton } from '../charts/core/ChartContainer';
import OptimizedChartWrapper from '../charts/performance/OptimizedChartWrapper';
import { ChartType } from './ChartSelector';
import { ReportFilters } from './ReportFilters';

// Lazy load chart components for better performance
const PlanFactBarChart = React.lazy(() => 
  import('../charts/business/PlanFactBarChart').then(module => ({ 
    default: module.default 
  }))
);

const CategoryPieChart = React.lazy(() => 
  import('../charts/business/CategoryPieChart').then(module => ({ 
    default: module.default 
  }))
);

const BudgetGauge = React.lazy(() => 
  import('../charts/business/BudgetGauge').then(module => ({ 
    default: module.default 
  }))
);

const TrendLineChart = React.lazy(() => 
  import('../charts/business/TrendLineChart').then(module => ({ 
    default: module.default 
  }))
);

const VarianceWaterfall = React.lazy(() => 
  import('../charts/business/VarianceWaterfall').then(module => ({ 
    default: module.default 
  }))
);

const ComposedChartView = React.lazy(() => 
  import('../charts/business/ComposedChartView').then(module => ({ 
    default: module.default 
  }))
);

interface ReportData {
  // Plan vs Fact data
  planFactData?: Array<{
    name: string;
    planned_amount: number;
    actual_amount: number;
    category?: string;
    period_name?: string;
    [key: string]: any;
  }>;
  
  // Category distribution data
  categoryData?: Array<{
    category: string;
    amount: number;
    color?: string;
    [key: string]: any;
  }>;
  
  // Budget utilization data
  budgetData?: {
    currentValue: number;
    maxValue: number;
    category?: string;
  };
  
  // Time series data
  timeSeriesData?: Array<{
    date: string | Date;
    value: number;
    series?: string;
    [key: string]: any;
  }>;
  
  // Variance data
  varianceData?: Array<{
    name: string;
    value: number;
    category?: string;
    [key: string]: any;
  }>;
  
  // Composed chart data
  composedData?: Array<Record<string, any>>;
  composedSeries?: Array<{
    dataKey: string;
    name: string;
    type: 'bar' | 'line';
    color: string;
    yAxisId?: 'left' | 'right';
  }>;
}

interface DynamicChartRendererProps {
  chartType: ChartType;
  data: ReportData;
  filters: ReportFilters;
  loading?: boolean;
  error?: string | null;
  onChartClick?: (data: any) => void;
  className?: string;
}

export const DynamicChartRenderer: React.FC<DynamicChartRendererProps> = memo(({
  chartType,
  data,
  filters,
  loading = false,
  error = null,
  onChartClick,
  className = '',
}) => {
  // Generate chart title based on filters and chart type
  const chartTitle = useMemo(() => {
    const baseTitle = {
      plan_fact_bar: 'План vs Факт',
      category_pie: 'Распределение по категориям',
      budget_gauge: 'Использование бюджета',
      trend_line: 'Динамика расходов',
      variance_waterfall: 'Анализ отклонений',
      composed: 'Комбинированный анализ',
    }[chartType];
    
    const reportTypeLabel = {
      plan_fact: 'План-факт анализ',
      budget: 'Бюджетный анализ',
    }[filters.report_type];
    
    return `${baseTitle} - ${reportTypeLabel}`;
  }, [chartType, filters.report_type]);

  // Render appropriate chart component
  const renderChart = () => {
    const commonProps = {
      title: chartTitle,
      loading,
      error,
      className,
      onElementClick: onChartClick,
    };

    switch (chartType) {
      case 'plan_fact_bar':
        if (!data.planFactData || data.planFactData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для отображения плана и факта</p>
            </div>
          );
        }
        return (
          <PlanFactBarChart
            {...commonProps}
            data={data.planFactData}
            showVariance={true}
            showPercentage={true}
            onBarClick={onChartClick}
          />
        );

      case 'category_pie':
        if (!data.categoryData || data.categoryData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для отображения категорий</p>
            </div>
          );
        }
        return (
          <CategoryPieChart
            {...commonProps}
            data={data.categoryData}
            showDonut={true}
            showPercentageLabels={true}
            onSliceClick={onChartClick}
          />
        );

      case 'budget_gauge':
        if (!data.budgetData) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для отображения использования бюджета</p>
            </div>
          );
        }
        return (
          <BudgetGauge
            {...commonProps}
            currentValue={data.budgetData.currentValue}
            maxValue={data.budgetData.maxValue}
            showLabel={true}
            showPercentage={true}
            animated={true}
          />
        );

      case 'trend_line':
        if (!data.timeSeriesData || data.timeSeriesData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для отображения динамики</p>
            </div>
          );
        }
        return (
          <TrendLineChart
            {...commonProps}
            data={data.timeSeriesData}
            showForecast={true}
            showMovingAverage={true}
            dateRangeSelector={true}
            onPointClick={onChartClick}
          />
        );

      case 'variance_waterfall':
        if (!data.varianceData || data.varianceData.length === 0) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для анализа отклонений</p>
            </div>
          );
        }
        return (
          <VarianceWaterfall
            {...commonProps}
            data={data.varianceData}
            showRunningTotal={true}
            showCumulativeLine={true}
            sortable={true}
            onBarClick={onChartClick}
          />
        );

      case 'composed':
        if (!data.composedData || data.composedData.length === 0 || !data.composedSeries) {
          return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Нет данных для комбинированного графика</p>
            </div>
          );
        }
        return (
          <ComposedChartView
            {...commonProps}
            data={data.composedData}
            series={data.composedSeries}
            showBrush={true}
            enableCrossFilter={true}
            onElementClick={onChartClick}
          />
        );

      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <p className="text-gray-500">Неподдерживаемый тип графика</p>
          </div>
        );
    }
  };

  // Determine data for optimization
  const chartData = useMemo(() => {
    switch (chartType) {
      case 'plan_fact_bar': return data.planFactData || [];
      case 'category_pie': return data.categoryData || [];
      case 'trend_line': return data.timeSeriesData || [];
      case 'variance_waterfall': return data.varianceData || [];
      case 'composed': return data.composedData || [];
      default: return [];
    }
  }, [chartType, data]);

  return (
    <div className={`space-y-4 ${className}`}>
      <OptimizedChartWrapper
        data={chartData}
        loading={loading}
        error={error}
        enableVirtualization={chartData.length > 500}
        maxDataPoints={1000}
        debounceMs={200}
      >
        <Suspense fallback={<ChartSkeleton height={400} />}>
          {renderChart()}
        </Suspense>
      </OptimizedChartWrapper>
    </div>
  );
});

DynamicChartRenderer.displayName = 'DynamicChartRenderer';

export default DynamicChartRenderer;