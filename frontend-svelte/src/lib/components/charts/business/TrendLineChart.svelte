<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Line } from '../core';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Filler,
    type ChartOptions,
    type ChartData,
    type TooltipItem,
  } from 'chart.js';
  import ChartContainer from '../core/ChartContainer.svelte';
  import { formatters, chartTheme, generateColorPalette } from '$lib/utils/charts/formatters';
  import { 
    transformToTimeSeries, 
    calculateMovingAverage, 
    filterByDateRange,
    type TimeSeriesDataPoint 
  } from '$lib/utils/charts/dataTransform';
  import { Calendar } from 'lucide-svelte';
  
  // Register Chart.js components
  ChartJS.register(
    Title, Tooltip, Legend, LineElement, CategoryScale, 
    LinearScale, PointElement, Filler
  );
  
  const dispatch = createEventDispatcher<{
    pointClick: { data: TimeSeriesDataPoint; seriesName: string };
    export: { format: 'png' | 'svg' };
  }>();

  // Props
  export let data: Array<{
    date: string | Date;
    value: number;
    series?: string;
    forecast?: boolean;
    [key: string]: any;
  }> = [];
  export let title = 'Динамика расходов';
  export let subtitle = '';
  export let height = 400;
  export let className = '';
  export let showArea = false;
  export let showForecast = true;
  export let showMovingAverage = false;
  export let movingAverageWindow = 7;
  export let dateRangeSelector = true;
  export let multiSeries = true;
  export let forecastDays = 30;
  export let loading = false;
  export let error: string | null = null;

  // State
  let selectedDateRange: { start: string; end: string } | null = null;

  // Process data
  $: processedData = (() => {
    if (data.length === 0) return { chartData: [], seriesConfig: [], forecastData: [] };

    // Group data by series if multiSeries is enabled
    const groupedData = multiSeries
      ? data.reduce((acc, item) => {
          const seriesName = item.series || 'Основная серия';
          if (!acc[seriesName]) acc[seriesName] = [];
          acc[seriesName].push(item);
          return acc;
        }, {} as Record<string, typeof data>)
      : { 'Основная серия': data };

    // Transform each series
    const transformedSeries: Record<string, TimeSeriesDataPoint[]> = {};
    const colors = generateColorPalette(Object.keys(groupedData).length);
    let colorIndex = 0;

    Object.entries(groupedData).forEach(([seriesName, seriesData]) => {
      const transformed = transformToTimeSeries(
        seriesData.filter(item => !item.forecast),
        'date'
      );
      
      // Add moving average if requested
      const finalData = showMovingAverage 
        ? calculateMovingAverage(transformed, movingAverageWindow)
        : transformed;

      transformedSeries[seriesName] = finalData;
    });

    // Apply date range filter if set
    const filteredSeries: Record<string, TimeSeriesDataPoint[]> = {};
    Object.entries(transformedSeries).forEach(([seriesName, seriesData]) => {
      filteredSeries[seriesName] = selectedDateRange
        ? filterByDateRange(seriesData, selectedDateRange.start, selectedDateRange.end)
        : seriesData;
    });

    // Generate forecast data if requested
    const forecastSeries: Record<string, TimeSeriesDataPoint[]> = {};
    if (showForecast) {
      Object.entries(filteredSeries).forEach(([seriesName, seriesData]) => {
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
              label: formatters.shortDate(forecastDate),
              forecast: true,
            });
          }
          
          forecastSeries[seriesName] = forecast;
        }
      });
    }

    // Combine all data into single timeline
    const allDates = new Set<string>();
    Object.values(filteredSeries).forEach(series => {
      series.forEach(point => allDates.add(point.date));
    });
    Object.values(forecastSeries).forEach(series => {
      series.forEach(point => allDates.add(point.date));
    });

    const combinedData = Array.from(allDates)
      .sort()
      .map(date => {
        const dataPoint: any = { 
          date: date,
          label: formatters.shortDate(new Date(date))
        };
        
        // Add actual data
        Object.entries(filteredSeries).forEach(([seriesName, seriesData]) => {
          const point = seriesData.find(p => p.date === date);
          if (point) {
            dataPoint[seriesName] = point.value;
            if ('movingAverage' in point) {
              dataPoint[`${seriesName}_MA`] = point.movingAverage;
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
      seriesConfig: Object.keys(filteredSeries),
      forecastData: forecastSeries,
    };
  })();

  // Chart data
  $: chartData = {
    labels: processedData.chartData.map(d => d.label),
    datasets: [
      // Main series
      ...processedData.seriesConfig.map((seriesName, index) => {
        const color = generateColorPalette(processedData.seriesConfig.length)[index];
        return {
          label: seriesName,
          data: processedData.chartData.map(d => d[seriesName]),
          borderColor: color,
          backgroundColor: showArea ? `${color}20` : 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color,
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          fill: showArea ? 'origin' : false,
          tension: 0.1,
        };
      }),
      // Moving average series
      ...(showMovingAverage ? processedData.seriesConfig.map((seriesName, index) => {
        const color = generateColorPalette(processedData.seriesConfig.length)[index];
        return {
          label: `${seriesName} (MA${movingAverageWindow})`,
          data: processedData.chartData.map(d => d[`${seriesName}_MA`]),
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          tension: 0.1,
        };
      }) : []),
      // Forecast series
      ...(showForecast ? processedData.seriesConfig.map((seriesName, index) => {
        const color = generateColorPalette(processedData.seriesConfig.length)[index];
        return {
          label: `${seriesName} (прогноз)`,
          data: processedData.chartData.map(d => d[`${seriesName}_forecast`]),
          borderColor: `${color}80`,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 2,
          pointBackgroundColor: `${color}80`,
          fill: false,
          tension: 0.1,
        };
      }) : []),
    ],
  } as ChartData<'line'>;

  // Chart options
  $: chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: false,
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          font: {
            size: 12,
          },
          color: chartTheme.colors.gray,
          usePointStyle: true,
          filter: (legendItem) => {
            // Show legend items for all series
            return true;
          },
        },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltip.backgroundColor,
        titleColor: chartTheme.tooltip.color,
        bodyColor: chartTheme.tooltip.color,
        borderColor: chartTheme.colors.neutral,
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems) => {
            const dataIndex = tooltipItems[0]?.dataIndex;
            if (dataIndex !== undefined && processedData.chartData[dataIndex]) {
              const date = processedData.chartData[dataIndex].date;
              return formatters.date(new Date(date));
            }
            return '';
          },
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y;
            if (value === null || value === undefined) return '';
            
            return `${context.dataset.label}: ${formatters.currency(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: chartTheme.colors.gray,
          font: {
            size: 11,
          },
          maxRotation: 0,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: chartTheme.grid.color,
          lineWidth: 1,
        },
        ticks: {
          color: chartTheme.colors.gray,
          font: {
            size: 11,
          },
          callback: (value) => formatters.shortNumber(Number(value)),
        },
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const element = elements[0];
        const dataIndex = element.index;
        const datasetIndex = element.datasetIndex;
        
        if (dataIndex !== undefined && datasetIndex !== undefined) {
          const dataset = chartData.datasets[datasetIndex];
          const seriesName = dataset.label?.replace(/ \(.*\)$/, '') || '';
          const dataPoint = processedData.chartData[dataIndex];
          
          if (dataPoint && seriesName) {
            dispatch('pointClick', {
              data: {
                date: dataPoint.date,
                value: dataPoint[seriesName] || 0,
                label: dataPoint.label,
              },
              seriesName,
            });
          }
        }
      }
    },
    animation: {
      duration: 750,
      easing: 'easeOutQuart',
    },
  } as ChartOptions<'line'>;

  // Handle date range change
  function handleDateRangeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const { name, value } = target;
    
    if (selectedDateRange) {
      selectedDateRange = { ...selectedDateRange, [name]: value };
    } else {
      selectedDateRange = { start: value, end: value };
    }
  }

  function resetDateRange() {
    selectedDateRange = null;
  }

  // Calculate statistics
  $: statistics = (() => {
    const stats: Record<string, any> = {};
    
    processedData.seriesConfig.forEach(seriesName => {
      const values = processedData.chartData
        .map(d => d[seriesName])
        .filter(v => v !== undefined && v !== null);
      
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        const trend = values.length > 1 ? values[values.length - 1] - values[0] : 0;
        
        stats[seriesName] = { avg, min, max, trend, sum };
      }
    });
    
    return stats;
  })();

  let chartRef: HTMLCanvasElement | undefined;

  function handleExport(event: CustomEvent<{ format: 'png' | 'svg' }>) {
    dispatch('export', event.detail);
  }
</script>

<ChartContainer
  {title}
  {subtitle}
  {height}
  {className}
  {loading}
  {error}
  exportable={true}
  variant="sky"
  on:export={handleExport}
  let:setChartRef
>
  <div slot="controls" class="flex items-center gap-2">
    {#if dateRangeSelector}
      <div class="flex items-center gap-2 text-xs">
        <Calendar class="h-4 w-4 text-gray-400" />
        <input
          type="date"
          name="start"
          value={selectedDateRange?.start || ''}
          on:change={handleDateRangeChange}
          class="border border-gray-300 rounded px-2 py-1"
        />
        <span class="text-gray-500">-</span>
        <input
          type="date"
          name="end"
          value={selectedDateRange?.end || ''}
          on:change={handleDateRangeChange}
          class="border border-gray-300 rounded px-2 py-1"
        />
        <button
          on:click={resetDateRange}
          class="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
        >
          Сбросить
        </button>
      </div>
    {/if}
  </div>

  {#if processedData.chartData.length > 0}
    <div class="h-full">
      <Line
        data={chartData}
        options={chartOptions}
        bind:chart={chartRef}
        on:chartInit={() => chartRef && setChartRef(chartRef)}
      />
    </div>
  {:else}
    <div class="flex flex-col justify-center items-center py-12 text-center h-full">
      <div class="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg class="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Нет данных</h3>
      <p class="text-gray-600">Добавьте временные ряды для отображения динамики</p>
    </div>
  {/if}

  <div slot="footer">
    <!-- Statistics -->
    {#if Object.keys(statistics).length > 0}
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
        {#each Object.entries(statistics).slice(0, 2) as [seriesName, stats]}
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-1">{seriesName}</div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="text-gray-400">Среднее</div>
                <div class="font-medium">{formatters.shortNumber(stats.avg)}</div>
              </div>
              <div>
                <div class="text-gray-400">Тренд</div>
                <div class="font-medium {stats.trend >= 0 ? 'text-red-600' : 'text-green-600'}">
                  {stats.trend >= 0 ? '+' : ''}{formatters.shortNumber(stats.trend)}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</ChartContainer>