import React, { useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';
import { transformToPlanFact, type PlanFactDataPoint } from '../utils/dataTransform';
import { useChartFilters } from '../hooks/useChartFilters';

interface PlanFactBarChartProps {
  data: Array<{
    name: string;
    planned_amount: number;
    actual_amount: number;
    [key: string]: any;
  }>;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  onBarClick?: (data: PlanFactDataPoint, category: 'plan' | 'fact') => void;
  showVariance?: boolean;
  showPercentage?: boolean;
  loading?: boolean;
  error?: string | null;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const planData = payload.find((p: any) => p.dataKey === 'plan');
    const factData = payload.find((p: any) => p.dataKey === 'fact');
    
    const planValue = planData?.value || 0;
    const factValue = factData?.value || 0;
    const variance = factValue - planValue;
    const percentage = planValue > 0 ? ((factValue / planValue) * 100) : 0;

    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border-none">
        <p className="font-medium mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: ChartTheme.colors.plan }}></div>
              План:
            </span>
            <span className="font-medium">{ChartTheme.formatters.currency(planValue)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: ChartTheme.colors.fact }}></div>
              Факт:
            </span>
            <span className="font-medium">{ChartTheme.formatters.currency(factValue)}</span>
          </div>
          <hr className="border-gray-600 my-2" />
          <div className="flex items-center justify-between gap-4">
            <span>Отклонение:</span>
            <span className={`font-medium ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {variance >= 0 ? '+' : ''}{ChartTheme.formatters.currency(variance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Выполнение:</span>
            <span className={`font-medium ${percentage >= 100 ? 'text-green-400' : percentage >= 80 ? 'text-yellow-400' : 'text-red-400'}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend: React.FC<any> = ({ payload }) => {
  return (
    <div className="flex justify-center gap-6 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-600">
            {entry.value === 'plan' ? 'План' : 'Факт'}
          </span>
        </div>
      ))}
    </div>
  );
};

export const PlanFactBarChart: React.FC<PlanFactBarChartProps> = ({
  data,
  title = 'План vs Факт',
  subtitle,
  height = ChartTheme.sizes.medium.height,
  className = '',
  onBarClick,
  showVariance = false,
  showPercentage = false,
  loading = false,
  error = null,
}) => {
  // Transform data
  const chartData = useMemo(() => {
    return transformToPlanFact(data);
  }, [data]);

  // Apply filters
  const { filteredData, setSorting } = useChartFilters(chartData, {
    sortBy: 'value',
    sortOrder: 'desc',
  });

  // Handle bar click
  const handleBarClick = useCallback((data: any, event: any) => {
    if (!onBarClick) return;
    
    const { dataKey } = event;
    const category = dataKey as 'plan' | 'fact';
    onBarClick(data, category);
  }, [onBarClick]);

  // Mobile responsive configuration
  const isMobile = typeof window !== 'undefined' && window.innerWidth < ChartTheme.breakpoints.tablet;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      height={height}
      className={className}
      loading={loading}
      error={error}
      controls={
        <div className="flex items-center gap-2">
          <select
            onChange={(e) => setSorting(e.target.value as any)}
            className="text-xs border border-gray-300 rounded px-2 py-1"
            defaultValue="value"
          >
            <option value="value">По сумме</option>
            <option value="name">По названию</option>
          </select>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filteredData}
          margin={ChartTheme.defaults.margin}
          barCategoryGap="20%"
        >
          <CartesianGrid 
            {...ChartTheme.grid}
            horizontal={true}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            {...ChartTheme.axis}
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 80 : 60}
            interval={0}
          />
          <YAxis
            {...ChartTheme.axis}
            tickFormatter={ChartTheme.formatters.shortNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          
          <Bar
            dataKey="plan"
            name="plan"
            fill={ChartTheme.colors.plan}
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          />
          <Bar
            dataKey="fact"
            name="fact"
            fill={ChartTheme.colors.fact}
            radius={[4, 4, 0, 0]}
            onClick={handleBarClick}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Variance indicators */}
      {showVariance && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredData.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600 truncate">{item.name}</span>
              <span className={`text-xs font-medium ${
                item.variance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.variance >= 0 ? '+' : ''}{ChartTheme.formatters.shortNumber(item.variance)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Percentage indicators */}
      {showPercentage && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredData.slice(0, 6).map((item, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600 truncate">{item.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-12 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      item.percentage >= 100 ? 'bg-green-500' :
                      item.percentage >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-12 text-right">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartContainer>
  );
};

export default PlanFactBarChart;