import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';
import { useChartFilters } from '../hooks/useChartFilters';

interface ChartSeries {
  dataKey: string;
  name: string;
  type: 'bar' | 'line';
  color: string;
  yAxisId?: 'left' | 'right';
  strokeDashArray?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  hide?: boolean;
}

interface ComposedChartViewProps {
  data: Array<Record<string, any>>;
  series: ChartSeries[];
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  xAxisKey?: string;
  onElementClick?: (data: any, series: ChartSeries) => void;
  showBrush?: boolean;
  showCrosshair?: boolean;
  enableCrossFilter?: boolean;
  dashboardLayout?: boolean;
  loading?: boolean;
  error?: string | null;
}

interface TooltipData {
  active: boolean;
  payload: Array<{
    dataKey: string;
    name: string;
    value: number;
    color: string;
    payload: any;
  }>;
  label: string;
}

const SynchronizedTooltip: React.FC<TooltipData> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  // Group payload by Y axis
  const leftAxisData = payload.filter(p => {
    const series = p.payload._series?.find((s: ChartSeries) => s.dataKey === p.dataKey);
    return !series?.yAxisId || series.yAxisId === 'left';
  });
  
  const rightAxisData = payload.filter(p => {
    const series = p.payload._series?.find((s: ChartSeries) => s.dataKey === p.dataKey);
    return series?.yAxisId === 'right';
  });

  return (
    <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border-none min-w-48">
      <p className="font-medium mb-2 text-center">{label}</p>
      
      {/* Left axis data */}
      {leftAxisData.length > 0 && (
        <div className="space-y-1 text-sm">
          {leftAxisData.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-medium">
                {ChartTheme.formatters.currency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {/* Separator if both axes have data */}
      {leftAxisData.length > 0 && rightAxisData.length > 0 && (
        <hr className="border-gray-600 my-2" />
      )}
      
      {/* Right axis data */}
      {rightAxisData.length > 0 && (
        <div className="space-y-1 text-sm">
          {rightAxisData.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-medium">
                {typeof entry.value === 'number' && entry.value < 1 
                  ? ChartTheme.formatters.percentage(entry.value)
                  : ChartTheme.formatters.number(entry.value)
                }
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InteractiveLegend: React.FC<{
  series: ChartSeries[];
  onToggle: (dataKey: string) => void;
  onFilter: (dataKey: string) => void;
  enableCrossFilter: boolean;
}> = ({ series, onToggle, onFilter, enableCrossFilter }) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {series.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2">
          <button
            onClick={() => onToggle(item.dataKey)}
            className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
              item.hide ? 'opacity-50 line-through' : 'hover:bg-gray-100'
            }`}
          >
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: item.hide ? '#D1D5DB' : item.color }}
            />
            <span className="text-sm text-gray-600">{item.name}</span>
            <span className="text-xs text-gray-400">
              ({item.type === 'bar' ? '■' : '—'})
            </span>
          </button>
          
          {enableCrossFilter && (
            <button
              onClick={() => onFilter(item.dataKey)}
              className="text-xs text-blue-600 hover:text-blue-800 px-1"
              title="Фильтровать по этой серии"
            >
              🔍
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const ComposedChartView: React.FC<ComposedChartViewProps> = ({
  data,
  series: initialSeries,
  title = 'Комбинированный график',
  subtitle,
  height = ChartTheme.sizes.large.height,
  className = '',
  xAxisKey = 'name',
  onElementClick,
  showBrush = false,
  showCrosshair = true,
  enableCrossFilter = false,
  dashboardLayout = false,
  loading = false,
  error = null,
}) => {
  const [series, setSeries] = useState<ChartSeries[]>(initialSeries);
  const [crossFilterKey, setCrossFilterKey] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<[number, number] | null>(null);
  const chartRef = useRef<any>(null);

  // Enhance data with series info for tooltip
  const enhancedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      _series: series,
    }));
  }, [data, series]);

  // Apply filters
  const { filteredData, setSearch, filters } = useChartFilters(enhancedData);

  // Apply cross-filtering
  const crossFilteredData = useMemo(() => {
    if (!crossFilterKey) return filteredData;
    
    // Filter data based on the selected series values
    return filteredData.filter(item => {
      const value = item[crossFilterKey];
      return value !== undefined && value !== null && value !== 0;
    });
  }, [filteredData, crossFilterKey]);

  // Handle series toggle
  const handleSeriesToggle = useCallback((dataKey: string) => {
    setSeries(prev => 
      prev.map(s => 
        s.dataKey === dataKey ? { ...s, hide: !s.hide } : s
      )
    );
  }, []);

  // Handle cross-filter
  const handleCrossFilter = useCallback((dataKey: string) => {
    setCrossFilterKey(prev => prev === dataKey ? null : dataKey);
  }, []);

  // Handle element click
  const handleElementClick = useCallback((data: any, event: any) => {
    if (!onElementClick) return;
    
    const clickedSeries = series.find(s => s.dataKey === event.dataKey);
    if (clickedSeries) {
      onElementClick(data, clickedSeries);
    }
  }, [onElementClick, series]);

  // Calculate Y-axis domains
  const { leftDomain, rightDomain } = useMemo(() => {
    const leftSeries = series.filter(s => !s.hide && (!s.yAxisId || s.yAxisId === 'left'));
    const rightSeries = series.filter(s => !s.hide && s.yAxisId === 'right');
    
    const getValues = (seriesList: ChartSeries[]) => {
      return seriesList.flatMap(s => 
        crossFilteredData.map(d => d[s.dataKey]).filter(v => v !== undefined && v !== null)
      );
    };
    
    const leftValues = getValues(leftSeries);
    const rightValues = getValues(rightSeries);
    
    const calculateDomain = (values: number[]) => {
      if (values.length === 0) return [0, 100];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const padding = (max - min) * 0.1;
      return [Math.min(0, min - padding), max + padding];
    };
    
    return {
      leftDomain: calculateDomain(leftValues),
      rightDomain: calculateDomain(rightValues),
    };
  }, [series, crossFilteredData]);

  // Visible series
  const visibleSeries = series.filter(s => !s.hide);
  const leftAxisSeries = visibleSeries.filter(s => !s.yAxisId || s.yAxisId === 'left');
  const rightAxisSeries = visibleSeries.filter(s => s.yAxisId === 'right');

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
            placeholder="Поиск..."
            value={filters.search || ''}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 w-24"
          />
          {enableCrossFilter && crossFilterKey && (
            <button
              onClick={() => setCrossFilterKey(null)}
              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
            >
              Сбросить фильтр
            </button>
          )}
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          ref={chartRef}
          data={crossFilteredData}
          margin={dashboardLayout ? 
            { top: 10, right: 10, left: 10, bottom: 10 } : 
            ChartTheme.defaults.margin
          }
        >
          <CartesianGrid {...ChartTheme.grid} />
          
          <XAxis
            dataKey={xAxisKey}
            {...ChartTheme.axis}
            angle={dashboardLayout ? 0 : -45}
            textAnchor={dashboardLayout ? 'middle' : 'end'}
            height={dashboardLayout ? 30 : 60}
          />
          
          {/* Left Y Axis */}
          {leftAxisSeries.length > 0 && (
            <YAxis
              yAxisId="left"
              {...ChartTheme.axis}
              domain={leftDomain}
              tickFormatter={ChartTheme.formatters.shortNumber}
              orientation="left"
            />
          )}
          
          {/* Right Y Axis */}
          {rightAxisSeries.length > 0 && (
            <YAxis
              yAxisId="right"
              {...ChartTheme.axis}
              domain={rightDomain}
              tickFormatter={(value) => 
                value < 1 ? ChartTheme.formatters.percentage(value) : 
                ChartTheme.formatters.shortNumber(value)
              }
              orientation="right"
            />
          )}
          
          <Tooltip 
            content={<SynchronizedTooltip />} 
            cursor={showCrosshair ? { strokeDasharray: '3 3' } : false}
          />
          
          {/* Reference lines */}
          <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
          
          {/* Render series */}
          {visibleSeries.map((seriesItem) => {
            const yAxisId = seriesItem.yAxisId || 'left';
            
            if (seriesItem.type === 'bar') {
              return (
                <Bar
                  key={seriesItem.dataKey}
                  yAxisId={yAxisId}
                  dataKey={seriesItem.dataKey}
                  name={seriesItem.name}
                  fill={seriesItem.color}
                  fillOpacity={seriesItem.fillOpacity || 0.8}
                  onClick={handleElementClick}
                  cursor="pointer"
                  radius={[2, 2, 0, 0]}
                />
              );
            } else {
              return (
                <Line
                  key={seriesItem.dataKey}
                  yAxisId={yAxisId}
                  type="monotone"
                  dataKey={seriesItem.dataKey}
                  name={seriesItem.name}
                  stroke={seriesItem.color}
                  strokeWidth={seriesItem.strokeWidth || 2}
                  strokeDasharray={seriesItem.strokeDashArray}
                  dot={{ r: 3, fill: seriesItem.color }}
                  activeDot={{ r: 5, stroke: seriesItem.color, strokeWidth: 2 }}
                  onClick={handleElementClick}
                  connectNulls={false}
                />
              );
            }
          })}
          
          {/* Brush for data range selection */}
          {showBrush && crossFilteredData.length > 10 && (
            <Brush
              dataKey={xAxisKey}
              height={30}
              stroke={ChartTheme.colors.primary}
              onChange={(range) => setSelectedRange(range ? [range.startIndex, range.endIndex] : null)}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Interactive Legend */}
      <InteractiveLegend
        series={series}
        onToggle={handleSeriesToggle}
        onFilter={handleCrossFilter}
        enableCrossFilter={enableCrossFilter}
      />

      {/* Statistics Panel */}
      {!dashboardLayout && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleSeries.slice(0, 3).map((seriesItem) => {
            const values = crossFilteredData
              .map(d => d[seriesItem.dataKey])
              .filter(v => v !== undefined && v !== null && typeof v === 'number');
            
            if (values.length === 0) return null;

            const sum = values.reduce((acc, val) => acc + val, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            
            return (
              <div key={seriesItem.dataKey} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: seriesItem.color }}
                  />
                  <span className="text-sm font-medium">{seriesItem.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Среднее</div>
                    <div className="font-medium">
                      {seriesItem.yAxisId === 'right' && avg < 1 ? 
                        ChartTheme.formatters.percentage(avg) :
                        ChartTheme.formatters.shortNumber(avg)
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Общая</div>
                    <div className="font-medium">
                      {seriesItem.yAxisId === 'right' && sum < 1 ?
                        ChartTheme.formatters.percentage(sum) :
                        ChartTheme.formatters.shortNumber(sum)
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Мин</div>
                    <div className="font-medium">
                      {seriesItem.yAxisId === 'right' && min < 1 ?
                        ChartTheme.formatters.percentage(min) :
                        ChartTheme.formatters.shortNumber(min)
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Макс</div>
                    <div className="font-medium">
                      {seriesItem.yAxisId === 'right' && max < 1 ?
                        ChartTheme.formatters.percentage(max) :
                        ChartTheme.formatters.shortNumber(max)
                      }
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ChartContainer>
  );
};

// Dashboard optimized version
export const ComposedChartDashboard: React.FC<Omit<ComposedChartViewProps, 'height' | 'dashboardLayout'>> = (props) => {
  return (
    <ComposedChartView
      {...props}
      height={250}
      dashboardLayout={true}
      showBrush={false}
    />
  );
};

export default ComposedChartView;