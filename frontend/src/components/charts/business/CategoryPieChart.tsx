import React, { useState, useMemo, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';
import { transformToCategoryPie, generateColorPalette, type ChartDataPoint } from '../utils/dataTransform';
import { useChartFilters } from '../hooks/useChartFilters';

interface CategoryPieChartProps {
  data: Array<{
    category: string;
    amount: number;
    color?: string;
    [key: string]: any;
  }>;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  onSliceClick?: (data: ChartDataPoint) => void;
  showDonut?: boolean;
  showPercentageLabels?: boolean;
  showLegend?: boolean;
  minSlicePercentage?: number; // Minimum percentage to show slice separately
  loading?: boolean;
  error?: string | null;
}

const CustomTooltip: React.FC<any> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border-none">
        <p className="font-medium mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>Сумма:</span>
            <span className="font-medium">{ChartTheme.formatters.currency(data.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Доля:</span>
            <span className="font-medium">{data.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend: React.FC<{
  payload: any[];
  onLegendClick: (dataKey: string) => void;
  hiddenCategories: Set<string>;
}> = ({ payload, onLegendClick, hiddenCategories }) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {payload.map((entry, index) => {
        const isHidden = hiddenCategories.has(entry.value);
        return (
          <button
            key={index}
            onClick={() => onLegendClick(entry.value)}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
              isHidden ? 'opacity-50 line-through' : 'hover:bg-gray-100'
            }`}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: isHidden ? '#D1D5DB' : entry.color }}
            />
            <span className="text-sm text-gray-600">{entry.value}</span>
          </button>
        );
      })}
    </div>
  );
};

const CustomLabel: React.FC<any> = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null; // Don't show labels for slices < 5%
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize="12"
      fontWeight="bold"
      className="drop-shadow-md"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  data,
  title = 'Распределение по категориям',
  subtitle,
  height = ChartTheme.sizes.medium.height,
  className = '',
  onSliceClick,
  showDonut = true,
  showPercentageLabels = true,
  showLegend = true,
  minSlicePercentage = 2,
  loading = false,
  error = null,
}) => {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Transform and process data
  const { chartData, otherData } = useMemo(() => {
    const transformed = transformToCategoryPie(data);
    
    // Separate small slices into "Other" category
    const mainData: ChartDataPoint[] = [];
    let otherSum = 0;
    
    transformed.forEach((item) => {
      if (item.percentage >= minSlicePercentage) {
        mainData.push(item);
      } else {
        otherSum += item.value;
      }
    });
    
    // Add "Other" category if there are small slices
    if (otherSum > 0) {
      const total = transformed.reduce((sum, item) => sum + item.value, 0);
      mainData.push({
        name: 'Прочее',
        value: otherSum,
        percentage: (otherSum / total) * 100,
        color: '#9CA3AF',
        isOther: true,
      });
    }

    // Generate colors for main data
    const colors = generateColorPalette(mainData.length);
    const coloredData = mainData.map((item, index) => ({
      ...item,
      color: item.color || colors[index],
    }));

    return {
      chartData: coloredData,
      otherData: transformed.filter(item => item.percentage < minSlicePercentage),
    };
  }, [data, minSlicePercentage]);

  // Apply filters
  const { filteredData, setSearch, filters } = useChartFilters(
    chartData.filter(item => !hiddenCategories.has(item.name))
  );

  // Handle slice click
  const handleSliceClick = useCallback((data: any, index: number) => {
    setActiveIndex(activeIndex === index ? null : index);
    if (onSliceClick && !data.isOther) {
      onSliceClick(data);
    }
  }, [onSliceClick, activeIndex]);

  // Handle legend click (toggle visibility)
  const handleLegendClick = useCallback((dataKey: string) => {
    setHiddenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dataKey)) {
        newSet.delete(dataKey);
      } else {
        newSet.add(dataKey);
      }
      return newSet;
    });
  }, []);

  // Calculate total for visible slices
  const visibleTotal = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.value, 0);
  }, [filteredData]);

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
          <input
            type="text"
            placeholder="Поиск категорий..."
            value={filters.search || ''}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 w-32"
          />
        </div>
      }
    >
      <div className="h-full flex flex-col">
        {/* Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={showPercentageLabels ? CustomLabel : false}
                outerRadius="80%"
                innerRadius={showDonut ? "40%" : "0%"}
                paddingAngle={2}
                dataKey="value"
                onClick={handleSliceClick}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke={activeIndex === index ? '#374151' : 'none'}
                    strokeWidth={activeIndex === index ? 2 : 0}
                    style={{
                      filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Center label for donut chart */}
        {showDonut && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {ChartTheme.formatters.currency(visibleTotal)}
              </div>
              <div className="text-xs text-gray-500">Всего</div>
            </div>
          </div>
        )}

        {/* Legend */}
        {showLegend && (
          <CustomLegend
            payload={filteredData.map(item => ({
              value: item.name,
              color: item.color,
            }))}
            onLegendClick={handleLegendClick}
            hiddenCategories={hiddenCategories}
          />
        )}

        {/* Other categories details */}
        {otherData.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
              Показать детали категории "Прочее" ({otherData.length} категорий)
            </summary>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {otherData.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                  <span className="text-gray-600 truncate">{item.name}</span>
                  <span className="font-medium text-gray-900 ml-2">
                    {ChartTheme.formatters.currency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-500 text-xs">Категорий</div>
            <div className="font-medium text-gray-900">
              {filteredData.filter(item => !item.isOther).length}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-500 text-xs">Крупнейшая</div>
            <div className="font-medium text-gray-900">
              {filteredData.length > 0 ? `${filteredData[0].percentage.toFixed(1)}%` : '0%'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-500 text-xs">Средняя</div>
            <div className="font-medium text-gray-900">
              {filteredData.length > 0 ? `${(100 / filteredData.length).toFixed(1)}%` : '0%'}
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};

// Compact version for dashboards
export const CategoryPieChartCompact: React.FC<Omit<CategoryPieChartProps, 'height' | 'showLegend'>> = (props) => {
  return (
    <CategoryPieChart
      {...props}
      height={200}
      showLegend={false}
      showPercentageLabels={true}
    />
  );
};

export default CategoryPieChart;