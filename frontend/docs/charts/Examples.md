# Chart Usage Examples

This guide provides practical examples of implementing charts in the Family Budget application.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Real-World Scenarios](#real-world-scenarios)
- [Integration Patterns](#integration-patterns)
- [Advanced Examples](#advanced-examples)
- [Best Practices](#best-practices)

## Basic Usage

### Simple Bar Chart

```tsx
import React from 'react';
import { PlanFactBarChart } from '@/components/charts';

const SimpleBudgetChart = () => {
  const data = [
    { name: 'Январь', planned_amount: 100000, actual_amount: 95000 },
    { name: 'Февраль', planned_amount: 120000, actual_amount: 110000 },
    { name: 'Март', planned_amount: 90000, actual_amount: 105000 },
  ];

  return (
    <PlanFactBarChart
      title="План vs Факт по месяцам"
      data={data}
      showVariance={true}
    />
  );
};
```

### Pie Chart for Categories

```tsx
import React from 'react';
import { CategoryPieChart } from '@/components/charts';

const ExpenseDistribution = () => {
  const data = [
    { category: 'Операционные расходы', amount: 250000, color: '#3B82F6' },
    { category: 'Маркетинг', amount: 180000, color: '#10B981' },
    { category: 'IT расходы', amount: 120000, color: '#F59E0B' },
    { category: 'Прочие', amount: 80000, color: '#EF4444' },
  ];

  return (
    <CategoryPieChart
      title="Распределение расходов по категориям"
      data={data}
      showDonut={true}
      showPercentageLabels={true}
    />
  );
};
```

### Budget Gauge

```tsx
import React from 'react';
import { BudgetGauge } from '@/components/charts';

const BudgetUtilization = () => {
  return (
    <BudgetGauge
      title="Использование бюджета"
      currentValue={750000}
      maxValue={1000000}
      showPercentage={true}
      animated={true}
    />
  );
};
```

## Real-World Scenarios

### Monthly Financial Dashboard

```tsx
import React, { useState, useEffect } from 'react';
import { 
  PlanFactBarChart, 
  CategoryPieChart, 
  BudgetGauge,
  TrendLineChart 
} from '@/components/charts';
import { useChartData } from '@/hooks/useChartData';

const FinancialDashboard = () => {
  const { data: monthlyData, loading: monthlyLoading } = useChartData({
    endpoint: '/api/reports/monthly',
    filters: { year: 2025 },
  });

  const { data: categoryData, loading: categoryLoading } = useChartData({
    endpoint: '/api/reports/categories',
    filters: { period: 'current_year' },
  });

  const { data: trendData } = useChartData({
    endpoint: '/api/reports/trends',
    filters: { months: 12 },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Plan vs Fact */}
      <div className="lg:col-span-2">
        <PlanFactBarChart
          title="Месячный план vs факт"
          data={monthlyData?.planFact || []}
          loading={monthlyLoading}
          showVariance={true}
          showPercentage={true}
          onBarClick={(data) => {
            console.log('Выбран период:', data.name);
            // Navigate to detailed view
          }}
        />
      </div>

      {/* Category Distribution */}
      <CategoryPieChart
        title="Распределение по категориям"
        data={categoryData?.categories || []}
        loading={categoryLoading}
        showDonut={true}
        showPercentageLabels={true}
        onSliceClick={(data) => {
          console.log('Выбрана категория:', data.category);
        }}
      />

      {/* Budget Utilization */}
      <BudgetGauge
        title="Освоение бюджета"
        currentValue={categoryData?.totalActual || 0}
        maxValue={categoryData?.totalPlanned || 1}
        showLabel={true}
        showPercentage={true}
        animated={true}
      />

      {/* Trend Analysis */}
      <div className="lg:col-span-2">
        <TrendLineChart
          title="Динамика доходов и расходов"
          data={trendData?.timeSeries || []}
          showForecast={true}
          showMovingAverage={true}
          dateRangeSelector={true}
        />
      </div>
    </div>
  );
};
```

### Interactive Report Builder

```tsx
import React, { useState } from 'react';
import { 
  ReportFilters, 
  ChartSelector, 
  DynamicChartRenderer 
} from '@/components/reports';
import { useChartFilters, useChartData } from '@/hooks';

const InteractiveReportBuilder = () => {
  const [chartType, setChartType] = useState('plan_fact_bar');
  const { filters, setFilter, applyFilters } = useChartFilters({
    reportType: 'plan_fact',
    period: 'current_year',
  });

  const { data: rawData, loading, error } = useChartData({
    endpoint: '/api/reports/data',
    filters,
  });

  const processedData = applyFilters(rawData);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReportFilters
          onApplyFilters={(newFilters) => {
            Object.entries(newFilters).forEach(([key, value]) => {
              setFilter(key, value);
            });
          }}
        />
        
        <ChartSelector
          selectedType={chartType}
          onTypeChange={setChartType}
          reportType={filters.reportType}
        />
      </div>

      {/* Chart Display */}
      <DynamicChartRenderer
        chartType={chartType}
        data={processedData}
        filters={filters}
        loading={loading}
        error={error}
        onChartClick={(data) => {
          console.log('Chart interaction:', data);
        }}
      />
    </div>
  );
};
```

### Export-Ready Charts

```tsx
import React, { useRef } from 'react';
import { PlanFactBarChart } from '@/components/charts';
import { useChartExport } from '@/hooks/useChartExport';

const ExportableChart = ({ data }) => {
  const chartRef = useRef(null);
  const { 
    exportAsPNG, 
    exportAsSVG, 
    exportAsCSV, 
    copyToClipboard,
    print,
    isExporting 
  } = useChartExport();

  const handleExport = async (format) => {
    try {
      switch (format) {
        case 'png':
          await exportAsPNG(chartRef.current, 'budget-chart');
          break;
        case 'svg':
          await exportAsSVG(chartRef.current, 'budget-chart');
          break;
        case 'csv':
          await exportAsCSV(data, 'budget-data');
          break;
        case 'clipboard':
          await copyToClipboard(chartRef.current);
          break;
        case 'print':
          await print(chartRef.current, 'Отчет по бюджету');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Controls */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleExport('png')}
          disabled={isExporting}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg"
        >
          Экспорт PNG
        </button>
        <button
          onClick={() => handleExport('svg')}
          disabled={isExporting}
          className="px-3 py-2 bg-green-600 text-white rounded-lg"
        >
          Экспорт SVG
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={isExporting}
          className="px-3 py-2 bg-purple-600 text-white rounded-lg"
        >
          Экспорт CSV
        </button>
        <button
          onClick={() => handleExport('clipboard')}
          disabled={isExporting}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg"
        >
          Копировать
        </button>
        <button
          onClick={() => handleExport('print')}
          disabled={isExporting}
          className="px-3 py-2 bg-orange-600 text-white rounded-lg"
        >
          Печать
        </button>
      </div>

      {/* Chart */}
      <div ref={chartRef}>
        <PlanFactBarChart
          title="Отчет по бюджету"
          data={data}
          showVariance={true}
        />
      </div>
    </div>
  );
};
```

## Integration Patterns

### With Form Validation

```tsx
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { PlanFactBarChart } from '@/components/charts';
import { validateChartData } from '@/components/charts/utils';

const ChartWithValidation = () => {
  const [chartData, setChartData] = useState([]);
  const [validationError, setValidationError] = useState(null);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = (formData) => {
    try {
      // Transform form data to chart data
      const data = transformFormToChartData(formData);
      
      // Validate chart data
      if (!validateChartData(data, ['name', 'planned_amount', 'actual_amount'])) {
        throw new Error('Invalid chart data format');
      }
      
      setChartData(data);
      setValidationError(null);
    } catch (error) {
      setValidationError(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label>Период</label>
          <input
            {...register('period', { required: 'Период обязателен' })}
            className="w-full border rounded px-3 py-2"
          />
          {errors.period && (
            <span className="text-red-600">{errors.period.message}</span>
          )}
        </div>

        <div>
          <label>Плановая сумма</label>
          <input
            type="number"
            {...register('plannedAmount', { 
              required: 'Плановая сумма обязательна',
              min: { value: 0, message: 'Сумма должна быть положительной' }
            })}
            className="w-full border rounded px-3 py-2"
          />
          {errors.plannedAmount && (
            <span className="text-red-600">{errors.plannedAmount.message}</span>
          )}
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Обновить график
        </button>
      </form>

      {validationError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {validationError}
        </div>
      )}

      <PlanFactBarChart
        title="Результат"
        data={chartData}
        error={validationError}
      />
    </div>
  );
};
```

### With Real-time Updates

```tsx
import React, { useState, useEffect } from 'react';
import { TrendLineChart } from '@/components/charts';
import { useWebSocket } from '@/hooks/useWebSocket';

const RealTimeChart = () => {
  const [chartData, setChartData] = useState([]);
  const { data: wsData, isConnected } = useWebSocket('/api/ws/financial-data');

  useEffect(() => {
    if (wsData) {
      setChartData(prevData => {
        // Add new data point and keep last 50 points
        const newData = [...prevData, wsData].slice(-50);
        return newData;
      });
    }
  }, [wsData]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Данные в реальном времени</h2>
        <div className={`px-3 py-1 rounded-full text-sm ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? 'Подключено' : 'Отключено'}
        </div>
      </div>

      <TrendLineChart
        title="Финансовые потоки"
        data={chartData}
        showMovingAverage={true}
        onPointClick={(data) => {
          console.log('Точка данных:', data);
        }}
      />
    </div>
  );
};
```

### With Data Transformation

```tsx
import React, { useMemo } from 'react';
import { ComposedChartView } from '@/components/charts';
import { 
  transformToPlanFact, 
  calculateMovingAverage,
  formatChartValue 
} from '@/components/charts/utils';

const TransformedChart = ({ rawData }) => {
  const chartData = useMemo(() => {
    if (!rawData) return [];

    // Transform raw data
    const planFactData = transformToPlanFact(rawData);
    
    // Add moving averages
    const planValues = planFactData.map(d => d.planned_amount);
    const factValues = planFactData.map(d => d.actual_amount);
    
    const planMA = calculateMovingAverage(planValues, 3);
    const factMA = calculateMovingAverage(factValues, 3);
    
    // Combine data with moving averages
    return planFactData.map((item, index) => ({
      ...item,
      planMA: planMA[index],
      factMA: factMA[index],
      variance: item.actual_amount - item.planned_amount,
      utilizationPercent: (item.actual_amount / item.planned_amount) * 100,
    }));
  }, [rawData]);

  const chartSeries = [
    {
      dataKey: 'planned_amount',
      name: 'План',
      type: 'bar' as const,
      color: '#3B82F6',
      yAxisId: 'left' as const,
    },
    {
      dataKey: 'actual_amount',
      name: 'Факт',
      type: 'bar' as const,
      color: '#10B981',
      yAxisId: 'left' as const,
    },
    {
      dataKey: 'planMA',
      name: 'Скользящее среднее (План)',
      type: 'line' as const,
      color: '#6366F1',
      yAxisId: 'left' as const,
    },
    {
      dataKey: 'utilizationPercent',
      name: 'Освоение (%)',
      type: 'line' as const,
      color: '#F59E0B',
      yAxisId: 'right' as const,
    },
  ];

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatChartValue(entry.value, 
                entry.dataKey === 'utilizationPercent' ? 'percent' : 'currency'
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ComposedChartView
      title="Расширенный анализ план vs факт"
      data={chartData}
      series={chartSeries}
      showBrush={true}
      enableCrossFilter={true}
      customTooltip={customTooltip}
    />
  );
};
```

## Advanced Examples

### Custom Chart Component

```tsx
import React from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { ChartContainer } from '@/components/charts/core';
import { ChartTheme } from '@/components/charts/utils';

interface CustomMetricChartProps {
  data: Array<{
    period: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }>;
  title?: string;
  loading?: boolean;
  error?: string | null;
}

const CustomMetricChart: React.FC<CustomMetricChartProps> = ({
  data,
  title,
  loading,
  error,
}) => {
  const theme = ChartTheme.getTheme();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          <div className="mt-2 space-y-1">
            <p className="text-green-600">
              Доходы: {data.revenue.toLocaleString()} ₽
            </p>
            <p className="text-red-600">
              Расходы: {data.costs.toLocaleString()} ₽
            </p>
            <p className="text-blue-600">
              Прибыль: {data.profit.toLocaleString()} ₽
            </p>
            <p className="text-purple-600">
              Маржа: {data.margin.toFixed(1)}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title={title}
      loading={loading}
      error={error}
      height={400}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={theme.colors.neutral[2]} 
          />
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: theme.fonts.sizes.small }}
          />
          <YAxis 
            tick={{ fontSize: theme.fonts.sizes.small }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Bar 
            dataKey="revenue" 
            name="Доходы" 
            fill={theme.colors.success} 
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="costs" 
            name="Расходы" 
            fill={theme.colors.error} 
            radius={[2, 2, 0, 0]}
          />
          <Bar 
            dataKey="profit" 
            name="Прибыль" 
            fill={theme.colors.primary} 
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default CustomMetricChart;
```

### Chart with Animation Controls

```tsx
import React, { useState } from 'react';
import { PlanFactBarChart } from '@/components/charts';

const AnimatedChart = ({ data }) => {
  const [animationConfig, setAnimationConfig] = useState({
    enabled: true,
    duration: 1500,
    easing: 'ease-out',
    stagger: 100,
  });

  const animatedData = data.map((item, index) => ({
    ...item,
    animationDelay: animationConfig.stagger * index,
  }));

  return (
    <div className="space-y-4">
      {/* Animation Controls */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium mb-3">Настройки анимации</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={animationConfig.enabled}
              onChange={(e) => 
                setAnimationConfig(prev => ({ 
                  ...prev, 
                  enabled: e.target.checked 
                }))
              }
              className="mr-2"
            />
            Включить анимацию
          </label>

          <div>
            <label className="block text-sm font-medium">Длительность (мс)</label>
            <input
              type="range"
              min="500"
              max="3000"
              value={animationConfig.duration}
              onChange={(e) => 
                setAnimationConfig(prev => ({ 
                  ...prev, 
                  duration: parseInt(e.target.value) 
                }))
              }
              className="w-full"
            />
            <span className="text-sm text-gray-600">
              {animationConfig.duration}мс
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium">Задержка (мс)</label>
            <input
              type="range"
              min="0"
              max="500"
              value={animationConfig.stagger}
              onChange={(e) => 
                setAnimationConfig(prev => ({ 
                  ...prev, 
                  stagger: parseInt(e.target.value) 
                }))
              }
              className="w-full"
            />
            <span className="text-sm text-gray-600">
              {animationConfig.stagger}мс
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium">Тип анимации</label>
            <select
              value={animationConfig.easing}
              onChange={(e) => 
                setAnimationConfig(prev => ({ 
                  ...prev, 
                  easing: e.target.value 
                }))
              }
              className="w-full border rounded px-2 py-1"
            >
              <option value="ease">Ease</option>
              <option value="ease-in">Ease In</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in-out">Ease In Out</option>
              <option value="linear">Linear</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart with Animation */}
      <PlanFactBarChart
        title="График с настраиваемой анимацией"
        data={animatedData}
        animationConfig={animationConfig}
      />
    </div>
  );
};
```

## Best Practices

### Performance Optimization

```tsx
import React, { memo, useMemo } from 'react';
import { PlanFactBarChart } from '@/components/charts';

// Memoize chart component to prevent unnecessary re-renders
const OptimizedChart = memo(({ data, title, ...props }) => {
  // Memoize expensive data transformations
  const processedData = useMemo(() => {
    return data
      .filter(item => item.amount > 0) // Remove invalid data
      .sort((a, b) => new Date(a.date) - new Date(b.date)) // Sort by date
      .slice(-50); // Limit to last 50 items for performance
  }, [data]);

  // Memoize chart configuration
  const chartConfig = useMemo(() => ({
    showVariance: true,
    showPercentage: true,
    height: 400,
  }), []);

  return (
    <PlanFactBarChart
      title={title}
      data={processedData}
      {...chartConfig}
      {...props}
    />
  );
});

OptimizedChart.displayName = 'OptimizedChart';
```

### Error Boundaries

```tsx
import React from 'react';

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart error:', error, errorInfo);
    // Log to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-red-800 font-medium mb-2">
            Ошибка отображения графика
          </h3>
          <p className="text-red-600 text-sm mb-4">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
const ChartWithErrorBoundary = ({ data }) => (
  <ChartErrorBoundary>
    <PlanFactBarChart data={data} />
  </ChartErrorBoundary>
);
```

### Accessibility Implementation

```tsx
import React, { useRef } from 'react';
import { PlanFactBarChart } from '@/components/charts';

const AccessibleChart = ({ data, title }) => {
  const chartRef = useRef(null);
  const descriptionId = `chart-description-${Math.random().toString(36).substr(2, 9)}`;

  // Generate textual description of the data
  const chartDescription = useMemo(() => {
    if (!data || data.length === 0) {
      return 'График не содержит данных';
    }

    const totalPlanned = data.reduce((sum, item) => sum + item.planned_amount, 0);
    const totalActual = data.reduce((sum, item) => sum + item.actual_amount, 0);
    const variance = totalActual - totalPlanned;
    const variancePercent = ((variance / totalPlanned) * 100).toFixed(1);

    return `
      График содержит ${data.length} периодов. 
      Общий план: ${totalPlanned.toLocaleString()} рублей. 
      Общий факт: ${totalActual.toLocaleString()} рублей. 
      Отклонение: ${variance >= 0 ? 'превышение' : 'недовыполнение'} на ${Math.abs(variancePercent)}%.
    `;
  }, [data]);

  return (
    <div>
      <PlanFactBarChart
        ref={chartRef}
        title={title}
        data={data}
        aria-label={`${title}. ${chartDescription}`}
        aria-describedby={descriptionId}
        role="img"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Provide keyboard interaction
            console.log('Chart activated via keyboard');
          }
        }}
      />
      
      {/* Screen reader description */}
      <div id={descriptionId} className="sr-only">
        {chartDescription}
      </div>
      
      {/* Data table for screen readers */}
      <div className="sr-only">
        <table>
          <caption>{title} - табличные данные</caption>
          <thead>
            <tr>
              <th>Период</th>
              <th>План</th>
              <th>Факт</th>
              <th>Отклонение</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.name}</td>
                <td>{item.planned_amount.toLocaleString()} ₽</td>
                <td>{item.actual_amount.toLocaleString()} ₽</td>
                <td>{(item.actual_amount - item.planned_amount).toLocaleString()} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

### Testing Integration

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanFactBarChart } from '@/components/charts';

const ChartWithTestability = ({ data, onDataPointClick }) => {
  return (
    <PlanFactBarChart
      data={data}
      title="Тестируемый график"
      data-testid="plan-fact-chart"
      onBarClick={(data) => {
        // Ensure testable behavior
        onDataPointClick?.(data);
      }}
      // Add test helpers
      testHelpers={{
        getDataPoints: () => data,
        getChartType: () => 'plan_fact_bar',
        isInteractive: () => !!onDataPointClick,
      }}
    />
  );
};

// Test example
describe('ChartWithTestability', () => {
  const mockData = [
    { name: 'Q1', planned_amount: 100, actual_amount: 90 },
    { name: 'Q2', planned_amount: 200, actual_amount: 210 },
  ];

  it('renders chart with data', () => {
    render(<ChartWithTestability data={mockData} />);
    
    expect(screen.getByTestId('plan-fact-chart')).toBeInTheDocument();
    expect(screen.getByText('Тестируемый график')).toBeInTheDocument();
  });

  it('handles data point interactions', () => {
    const mockClick = jest.fn();
    render(
      <ChartWithTestability 
        data={mockData} 
        onDataPointClick={mockClick} 
      />
    );
    
    // Simulate chart interaction
    fireEvent.click(screen.getByTestId('plan-fact-chart'));
    expect(mockClick).toHaveBeenCalled();
  });
});
```