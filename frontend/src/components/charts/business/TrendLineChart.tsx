import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
  Brush,
} from 'recharts';
import { ChartContainer } from '../core/ChartContainer';
import { ChartTheme } from '../utils/ChartTheme';
import { 
  transformToTimeSeries, 
  calculateMovingAverage, 
  filterByDateRange,
  type TimeSeriesDataPoint 
} from '../utils/dataTransform';
import { useChartFilters } from '../hooks/useChartFilters';

interface TrendLineChartProps {
  data: Array<{
    date: string | Date;
    value: number;
    series?: string;
    forecast?: boolean;
    [key: string]: any;
  }>;
  title?: string;
  subtitle?: string;
  height?: number;
  className?: string;
  onPointClick?: (data: TimeSeriesDataPoint, seriesName: string) => void;
  showArea?: boolean;
  showForecast?: boolean;
  showMovingAverage?: boolean;
  movingAverageWindow?: number;
  dateRangeSelector?: boolean;
  multiSeries?: boolean;
  forecastDays?: number;
  loading?: boolean;
  error?: string | null;
}

interface SeriesConfig {
  name: string;
  dataKey: string;
  color: string;
  strokeDashArray?: string;
  opacity?: number;
  forecast?: boolean;
}

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const date = new Date(label);
    const formattedDate = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);

    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg border-none">
        <p className="font-medium mb-2">{formattedDate}</p>
        <div className="space-y-1 text-sm">
          {payload.map((entry: any, index: number) => (
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
      </div>
    );
  }
  return null;
};

const CustomLegend: React.FC<any> = ({ payload }) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-600">{entry.value}</span>
          {entry.payload?.forecast && (
            <span className="text-xs text-gray-400">(прогноз)</span>
          )}
        </div>
      ))}
    </div>
  );
};

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  title = 'Динамика расходов',
  subtitle,
  height = ChartTheme.sizes.large.height,
  className = '',
  onPointClick,
  showArea = false,
  showForecast = true,
  showMovingAverage = false,
  movingAverageWindow = 7,
  dateRangeSelector = true,
  multiSeries = true,
  forecastDays = 30,
  loading = false,
  error = null,
}) => {
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [showBrush, setShowBrush] = useState(dateRangeSelector);

  // Process and transform data
  const { chartData, seriesConfig, forecastData } = useMemo(() => {
    // Group data by series if multiSeries is enabled
    const processedData = multiSeries
      ? data.reduce((acc, item) => {
          const seriesName = item.series || 'Основная серия';
          if (!acc[seriesName]) acc[seriesName] = [];
          acc[seriesName].push(item);
          return acc;
        }, {} as Record<string, typeof data>)
      : { 'Основная серия': data };

    // Transform each series
    const transformedSeries: Record<string, TimeSeriesDataPoint[]> = {};
    const seriesConfigs: SeriesConfig[] = [];
    const colors = ChartTheme.colors.palette;

    Object.entries(processedData).forEach(([seriesName, seriesData], index) => {
      const transformed = transformToTimeSeries(
        seriesData.filter(item => !item.forecast),
        'date'
      );
      
      // Add moving average if requested
      const finalData = showMovingAverage 
        ? calculateMovingAverage(transformed, movingAverageWindow)
        : transformed;

      transformedSeries[seriesName] = finalData;

      // Create series config
      seriesConfigs.push({
        name: seriesName,
        dataKey: `${seriesName}_value`,
        color: colors[index % colors.length],
        forecast: false,
      });

      // Add moving average series if enabled
      if (showMovingAverage) {
        seriesConfigs.push({
          name: `${seriesName} (MA${movingAverageWindow})`,
          dataKey: `${seriesName}_movingAverage`,
          color: colors[index % colors.length],
          opacity: 0.7,
          strokeDashArray: '5 5',
          forecast: false,
        });
      }
    });

    // Generate forecast data if requested
    let forecastSeries: Record<string, TimeSeriesDataPoint[]> = {};
    if (showForecast) {
      Object.entries(transformedSeries).forEach(([seriesName, seriesData]) => {
        if (seriesData.length >= 3) {
          const lastPoint = seriesData[seriesData.length - 1];
          const secondLastPoint = seriesData[seriesData.length - 2];
          const thirdLastPoint = seriesData[seriesData.length - 3];
          
          // Simple linear trend calculation
          const trend = (lastPoint.value - thirdLastPoint.value) / 2;
          const forecast: TimeSeriesDataPoint[] = [];
          
          for (let i = 1; i <= forecastDays; i++) {
            const forecastDate = new Date(lastPoint.date);
            forecastDate.setDate(forecastDate.getDate() + i);
            
            forecast.push({
              date: forecastDate.toISOString().split('T')[0],
              value: Math.max(0, lastPoint.value + (trend * i)),
              label: ChartTheme.formatters.date(forecastDate),
              forecast: true,
            });
          }
          
          forecastSeries[seriesName] = forecast;
          
          // Add forecast series config
          const originalIndex = seriesConfigs.findIndex(s => s.name === seriesName);
          if (originalIndex >= 0) {
            seriesConfigs.push({
              name: `${seriesName} (прогноз)`,
              dataKey: `${seriesName}_forecast`,
              color: seriesConfigs[originalIndex].color,
              strokeDashArray: '3 3',
              opacity: 0.6,
              forecast: true,
            });
          }
        }
      });
    }

    // Combine all data into single array for chart
    const allDates = new Set<string>();
    Object.values(transformedSeries).forEach(series => {
      series.forEach(point => allDates.add(point.date));
    });
    Object.values(forecastSeries).forEach(series => {
      series.forEach(point => allDates.add(point.date));
    });

    const combinedData = Array.from(allDates)
      .sort()
      .map(date => {
        const dataPoint: any = { date };
        
        // Add actual data
        Object.entries(transformedSeries).forEach(([seriesName, seriesData]) => {
          const point = seriesData.find(p => p.date === date);
          if (point) {
            dataPoint[`${seriesName}_value`] = point.value;
            if ('movingAverage' in point) {
              dataPoint[`${seriesName}_movingAverage`] = point.movingAverage;
            }
          }
        });
        
        // Add forecast data
        Object.entries(forecastSeries).forEach(([seriesName, seriesData]) => {
          const point = seriesData.find(p => p.date === date);
          if (point) {
            dataPoint[`${seriesName}_forecast`] = point.value;
          }
        });
        
        return dataPoint;
      });

    return {
      chartData: combinedData,
      seriesConfig: seriesConfigs,
      forecastData: forecastSeries,
    };
  }, [data, multiSeries, showMovingAverage, movingAverageWindow, showForecast, forecastDays]);

  // Apply date range filter
  const { filteredData, setDateRange, filters } = useChartFilters(chartData, {
    dateRange: selectedDateRange || undefined,
  });

  // Handle point click
  const handlePointClick = useCallback((data: any, event: any) => {
    if (!onPointClick) return;
    
    const { dataKey } = event;
    const seriesName = dataKey.replace(/_value|_movingAverage|_forecast$/, '');
    onPointClick(data, seriesName);
  }, [onPointClick]);

  // Handle date range selection
  const handleDateRangeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (selectedDateRange) {
      const newRange = { ...selectedDateRange, [name]: value };
      setSelectedDateRange(newRange);
      setDateRange(newRange.start, newRange.end);
    } else {
      const newRange = { start: value, end: value };
      setSelectedDateRange(newRange);
    }
  }, [selectedDateRange, setDateRange]);

  const ChartComponent = showArea ? AreaChart : LineChart;

  return (
    <ChartContainer
      title={title}
      subtitle={subtitle}
      height={height}
      className={className}
      loading={loading}
      error={error}
      controls={
        dateRangeSelector && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              name="start"
              value={selectedDateRange?.start || ''}
              onChange={handleDateRangeChange}
              className="border border-gray-300 rounded px-2 py-1"
            />
            <span className="text-gray-500">-</span>
            <input
              type="date"
              name="end"
              value={selectedDateRange?.end || ''}
              onChange={handleDateRangeChange}
              className="border border-gray-300 rounded px-2 py-1"
            />
            <button
              onClick={() => {
                setSelectedDateRange(null);
                setDateRange('', '');
              }}
              className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
            >
              Сбросить
            </button>
            <button
              onClick={() => setShowBrush(!showBrush)}
              className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
            >
              {showBrush ? 'Скрыть' : 'Показать'} навигатор
            </button>
          </div>
        )
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={filteredData}
          margin={ChartTheme.defaults.margin}
        >
          <CartesianGrid {...ChartTheme.grid} />
          <XAxis
            dataKey="date"
            {...ChartTheme.axis}
            tickFormatter={ChartTheme.formatters.date}
          />
          <YAxis
            {...ChartTheme.axis}
            tickFormatter={ChartTheme.formatters.shortNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* Render lines/areas for each series */}
          {seriesConfig.map((series, index) => {
            if (showArea && !series.forecast) {
              return (
                <Area
                  key={series.dataKey}
                  type="monotone"
                  dataKey={series.dataKey}
                  stackId={series.forecast ? undefined : "1"}
                  stroke={series.color}
                  fill={series.color}
                  fillOpacity={series.opacity || 0.1}
                  strokeWidth={ChartTheme.defaults.strokeWidth.medium}
                  strokeDasharray={series.strokeDashArray}
                  onClick={handlePointClick}
                  isAnimationActive={true}
                  animationDuration={ChartTheme.defaults.animationDuration}
                />
              );
            } else {
              return (
                <Line
                  key={series.dataKey}
                  type="monotone"
                  dataKey={series.dataKey}
                  stroke={series.color}
                  strokeWidth={series.forecast ? 1 : ChartTheme.defaults.strokeWidth.medium}
                  strokeDasharray={series.strokeDashArray}
                  strokeOpacity={series.opacity || 1}
                  dot={series.forecast ? false : { r: 3 }}
                  activeDot={{ r: 5, stroke: series.color, strokeWidth: 2 }}
                  onClick={handlePointClick}
                  connectNulls={false}
                  isAnimationActive={true}
                  animationDuration={ChartTheme.defaults.animationDuration}
                />
              );
            }
          })}

          {/* Add reference lines for forecasts */}
          {showForecast && Object.keys(forecastData).length > 0 && (
            <ReferenceLine
              x={filteredData.find(d => 
                Object.values(forecastData).some(forecast => 
                  forecast.some(f => f.date === d.date)
                )
              )?.date}
              stroke="#94A3B8"
              strokeDasharray="2 2"
              strokeOpacity={0.7}
            />
          )}

          {/* Brush for date range selection */}
          {showBrush && filteredData.length > 20 && (
            <Brush
              dataKey="date"
              height={30}
              stroke={ChartTheme.colors.primary}
              tickFormatter={ChartTheme.formatters.date}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>

      {/* Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
        {Object.entries(seriesConfig.filter(s => !s.forecast && !s.strokeDashArray)).map(([, series]) => {
          const values = filteredData
            .map(d => d[series.dataKey])
            .filter(v => v !== undefined && v !== null);
          
          if (values.length === 0) return null;

          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;

          return (
            <div key={series.dataKey} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">{series.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-400">Среднее</div>
                  <div className="font-medium">{ChartTheme.formatters.shortNumber(avg)}</div>
                </div>
                <div>
                  <div className="text-gray-400">Тренд</div>
                  <div className={`font-medium ${trend >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {trend >= 0 ? '+' : ''}{ChartTheme.formatters.shortNumber(trend)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartContainer>
  );
};

// Compact version for dashboards
export const TrendLineChartCompact: React.FC<Omit<TrendLineChartProps, 'height' | 'dateRangeSelector'>> = (props) => {
  return (
    <TrendLineChart
      {...props}
      height={200}
      dateRangeSelector={false}
      showMovingAverage={false}
    />
  );
};

export default TrendLineChart;