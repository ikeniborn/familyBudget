import React, { useMemo, useCallback, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';
import { transformToWaterfall } from '../utils/dataTransform';
import { useChartFilters } from '../hooks/useChartFilters';

interface VarianceWaterfallProps {
  data: Array<{
    name: string;
    value: number;
    category?: string;
    [key: string]: any;
  }>;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  onBarClick?: (data: any) => void;
  showRunningTotal?: boolean;
  showCumulativeLine?: boolean;
  sortable?: boolean;
  colorCoding?: 'impact' | 'category' | 'value';
  loading?: boolean;
  error?: string | null;
}

interface WaterfallDataPoint {
  name: string;
  value: number;
  cumulative: number;
  cumulativeStart: number;
  type: 'positive' | 'negative' | 'total';
  impact: 'high' | 'medium' | 'low';
  category?: string;
  color: string;
  [key: string]: any;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as WaterfallDataPoint;
    
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border-none">
        <p className="font-medium mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span>Изменение:</span>
            <span className={`font-medium ${data.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.value >= 0 ? '+' : ''}{ChartTheme.formatters.currency(data.value)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Накопительный итог:</span>
            <span className="font-medium">
              {ChartTheme.formatters.currency(data.cumulative)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span>Влияние:</span>
            <span className={`font-medium ${
              data.impact === 'high' ? 'text-red-400' : 
              data.impact === 'medium' ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {data.impact === 'high' ? 'Высокое' : 
               data.impact === 'medium' ? 'Среднее' : 'Низкое'}
            </span>
          </div>
          {data.category && (
            <div className="flex items-center justify-between gap-4">
              <span>Категория:</span>
              <span className="font-medium">{data.category}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Custom bar shape for waterfall effect
const WaterfallBar: React.FC<any> = (props) => {
  const { fill, x, y, width, height, payload } = props;
  
  if (!payload) return null;
  
  const actualY = payload.type === 'total' ? y : payload.cumulativeStart - payload.value;
  const actualHeight = payload.type === 'total' ? height : Math.abs(payload.value);
  
  return (
    <g>
      <rect
        x={x}
        y={actualY}
        width={width}
        height={actualHeight}
        fill={fill}
        stroke={payload.type === 'total' ? '#374151' : 'none'}
        strokeWidth={payload.type === 'total' ? 2 : 0}
        strokeDasharray={payload.type === 'total' ? '5 5' : 'none'}
        opacity={payload.type === 'total' ? 0.8 : 1}
      />
      {/* Connection line to previous bar */}
      {payload.type !== 'total' && x > 0 && (
        <line
          x1={x}
          y1={payload.cumulativeStart}
          x2={x + width}
          y2={payload.cumulativeStart}
          stroke="#94A3B8"
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.6}
        />
      )}
    </g>
  );
};

export const VarianceWaterfall: React.FC<VarianceWaterfallProps> = ({
  data,
  title = 'Анализ отклонений',
  subtitle,
  height = ChartTheme.sizes.large.height,
  className = '',
  onBarClick,
  showRunningTotal = true,
  showCumulativeLine = true,
  sortable = true,
  colorCoding = 'impact',
  loading = false,
  error = null,
}) => {
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'impact'>('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Process and transform data
  const chartData = useMemo(() => {
    // Sort data if enabled
    let processedData = [...data];
    if (sortable) {
      processedData.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'value':
            comparison = Math.abs(a.value) - Math.abs(b.value);
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name, 'ru');
            break;
          case 'impact':
            // Sort by absolute value as impact measure
            comparison = Math.abs(a.value) - Math.abs(b.value);
            break;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    // Transform to waterfall format
    const waterfallData = transformToWaterfall(processedData);
    
    // Enhance with additional properties
    const maxAbsValue = Math.max(...waterfallData.map(d => Math.abs(d.value)));
    
    const enhancedData: WaterfallDataPoint[] = waterfallData.map((item, index) => {
      // Calculate impact based on absolute value
      const absValue = Math.abs(item.value);
      const impact: 'high' | 'medium' | 'low' = 
        absValue > maxAbsValue * 0.7 ? 'high' :
        absValue > maxAbsValue * 0.3 ? 'medium' : 'low';
      
      // Determine color based on coding strategy
      let color: string;
      switch (colorCoding) {
        case 'impact':
          color = impact === 'high' ? '#EF4444' : 
                  impact === 'medium' ? '#F59E0B' : '#10B981';
          break;
        case 'value':
          color = item.value >= 0 ? ChartTheme.colors.variance.positive : 
                  ChartTheme.colors.variance.negative;
          break;
        case 'category':
          const categoryColors = ChartTheme.colors.palette;
          color = categoryColors[index % categoryColors.length];
          break;
        default:
          color = ChartTheme.colors.primary;
      }

      // Calculate start position for waterfall effect
      let cumulativeStart = 0;
      if (index > 0) {
        cumulativeStart = waterfallData[index - 1].cumulative;
      }
      
      return {
        ...item,
        impact,
        color,
        cumulativeStart: item.type === 'total' ? 0 : cumulativeStart,
        category: item.category || 'Общее',
      };
    });

    return enhancedData;
  }, [data, sortable, sortBy, sortOrder, colorCoding]);

  // Apply additional filters
  const { filteredData, setSearch, filters } = useChartFilters(chartData);

  // Handle bar click
  const handleBarClick = useCallback((data: any) => {
    if (onBarClick) {
      onBarClick(data);
    }
  }, [onBarClick]);

  // Handle sorting change
  const handleSortChange = useCallback((newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  }, [sortBy, sortOrder]);

  // Calculate domain for Y axis to accommodate waterfall effect
  const yDomain = useMemo(() => {
    const values = filteredData.map(d => d.cumulative);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
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
          {sortable && (
            <div className="flex items-center gap-1">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSortBy, newSortOrder] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                  setSortBy(newSortBy);
                  setSortOrder(newSortOrder);
                }}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="value-desc">По влиянию ↓</option>
                <option value="value-asc">По влиянию ↑</option>
                <option value="name-asc">По названию ↑</option>
                <option value="name-desc">По названию ↓</option>
              </select>
            </div>
          )}
          <input
            type="text"
            placeholder="Поиск..."
            value={filters.search || ''}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 w-24"
          />
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={filteredData}
          margin={ChartTheme.defaults.margin}
        >
          <CartesianGrid {...ChartTheme.grid} />
          <XAxis
            dataKey="name"
            {...ChartTheme.axis}
            angle={-45}
            textAnchor="end"
            height={80}
            interval={0}
          />
          <YAxis
            {...ChartTheme.axis}
            domain={yDomain}
            tickFormatter={ChartTheme.formatters.shortNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {/* Zero reference line */}
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
          
          {/* Waterfall bars */}
          <Bar
            dataKey="value"
            shape={<WaterfallBar />}
            onClick={handleBarClick}
            cursor="pointer"
          >
            {filteredData.map((entry, index) => (
              <Bar key={`bar-${index}`} fill={entry.color} />
            ))}
          </Bar>
          
          {/* Cumulative line */}
          {showCumulativeLine && (
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={ChartTheme.colors.textDark}
              strokeWidth={2}
              dot={{ r: 4, fill: ChartTheme.colors.textDark }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Impact Analysis */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Summary Statistics */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Итоговое влияние</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Положительное:</span>
              <span className="font-medium text-green-600">
                +{ChartTheme.formatters.currency(
                  filteredData.filter(d => d.value > 0).reduce((sum, d) => sum + d.value, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Отрицательное:</span>
              <span className="font-medium text-red-600">
                {ChartTheme.formatters.currency(
                  filteredData.filter(d => d.value < 0).reduce((sum, d) => sum + d.value, 0)
                )}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1">
              <span className="text-gray-600">Общий эффект:</span>
              <span className="font-medium">
                {ChartTheme.formatters.currency(
                  filteredData.reduce((sum, d) => sum + d.value, 0)
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Top Contributors */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Наибольшее влияние</h4>
          <div className="space-y-1 text-sm">
            {filteredData
              .filter(d => d.type !== 'total')
              .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
              .slice(0, 3)
              .map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-600 truncate flex-1">{item.name}</span>
                  <span className={`font-medium ml-2 ${
                    item.value >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.value >= 0 ? '+' : ''}{ChartTheme.formatters.shortNumber(item.value)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Impact Distribution */}
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Распределение по влиянию</h4>
          <div className="space-y-2">
            {['high', 'medium', 'low'].map(impact => {
              const count = filteredData.filter(d => d.impact === impact && d.type !== 'total').length;
              const percentage = filteredData.length > 0 ? (count / filteredData.length) * 100 : 0;
              
              return (
                <div key={impact} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${
                    impact === 'high' ? 'bg-red-500' :
                    impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  <span className="text-xs text-gray-600 flex-1">
                    {impact === 'high' ? 'Высокое' : 
                     impact === 'medium' ? 'Среднее' : 'Низкое'}
                  </span>
                  <span className="text-xs font-medium">{count} ({percentage.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ChartContainer>
  );
};

// Compact version for dashboards
export const VarianceWaterfallCompact: React.FC<Omit<VarianceWaterfallProps, 'height' | 'sortable'>> = (props) => {
  return (
    <VarianceWaterfall
      {...props}
      height={250}
      sortable={false}
      showCumulativeLine={true}
    />
  );
};

export default VarianceWaterfall;