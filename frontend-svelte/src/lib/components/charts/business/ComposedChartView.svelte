<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Chart } from '../core';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    type ChartOptions,
    type ChartData,
    type TooltipItem,
  } from 'chart.js';
  import ChartContainer from '../core/ChartContainer.svelte';
  import { formatters, chartTheme, generateColorPalette } from '$lib/utils/charts/formatters';
  import { Search, Filter, X } from 'lucide-svelte';
  
  // Register Chart.js components
  ChartJS.register(
    Title, Tooltip, Legend, BarElement, LineElement, 
    CategoryScale, LinearScale, PointElement
  );
  
  const dispatch = createEventDispatcher<{
    elementClick: { data: any; series: ChartSeries };
    export: { format: 'png' | 'svg' };
  }>();

  // Types
  export interface ChartSeries {
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

  // Props
  export let data: Array<Record<string, any>> = [];
  export let series: ChartSeries[] = [];
  export let title = 'Комбинированный график';
  export let subtitle = '';
  export let height = 400;
  export let className = '';
  export let xAxisKey = 'name';
  export let showBrush = false;
  export let showCrosshair = true;
  export let enableCrossFilter = false;
  export let dashboardLayout = false;
  export let loading = false;
  export let error: string | null = null;

  // State
  let seriesState = [...series];
  let crossFilterKey: string | null = null;
  let searchTerm = '';

  // Update series state when props change
  $: if (series !== seriesState) {
    seriesState = [...series];
  }

  // Filter data
  $: filteredData = searchTerm 
    ? data.filter(item => 
        String(item[xAxisKey]).toLowerCase().includes(searchTerm.toLowerCase()) ||
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : data;

  // Apply cross-filtering
  $: crossFilteredData = crossFilterKey
    ? filteredData.filter(item => {
        const value = item[crossFilterKey];
        return value !== undefined && value !== null && value !== 0;
      })
    : filteredData;

  // Visible series
  $: visibleSeries = seriesState.filter(s => !s.hide);
  $: leftAxisSeries = visibleSeries.filter(s => !s.yAxisId || s.yAxisId === 'left');
  $: rightAxisSeries = visibleSeries.filter(s => s.yAxisId === 'right');

  // Calculate Y-axis domains
  $: yAxisDomains = (() => {
    const leftValues = leftAxisSeries.flatMap(s => 
      crossFilteredData.map(d => d[s.dataKey]).filter(v => v !== undefined && v !== null)
    );
    const rightValues = rightAxisSeries.flatMap(s => 
      crossFilteredData.map(d => d[s.dataKey]).filter(v => v !== undefined && v !== null)
    );
    
    const calculateDomain = (values: number[]) => {
      if (values.length === 0) return [0, 100];
      const min = Math.min(...values);
      const max = Math.max(...values);
      const padding = (max - min) * 0.1;
      return [Math.min(0, min - padding), max + padding];
    };
    
    return {
      left: calculateDomain(leftValues),
      right: calculateDomain(rightValues),
    };
  })();

  // Prepare chart datasets
  $: datasets = visibleSeries.map(seriesItem => {
    const baseDataset = {
      label: seriesItem.name,
      data: crossFilteredData.map(d => d[seriesItem.dataKey]),
      yAxisID: seriesItem.yAxisId || 'y',
    };

    if (seriesItem.type === 'bar') {
      return {
        ...baseDataset,
        type: 'bar' as const,
        backgroundColor: seriesItem.fillOpacity 
          ? `${seriesItem.color}${Math.round(seriesItem.fillOpacity * 255).toString(16).padStart(2, '0')}`
          : seriesItem.color,
        borderColor: seriesItem.color,
        borderWidth: 1,
        borderRadius: 2,
        borderSkipped: false,
      };
    } else {
      return {
        ...baseDataset,
        type: 'line' as const,
        borderColor: seriesItem.color,
        backgroundColor: 'transparent',
        borderWidth: seriesItem.strokeWidth || 2,
        borderDash: seriesItem.strokeDashArray ? seriesItem.strokeDashArray.split(' ').map(Number) : undefined,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: seriesItem.color,
        pointBorderColor: '#FFFFFF',
        pointBorderWidth: 2,
        fill: false,
        tension: 0.1,
      };
    }
  });

  // Chart data
  $: chartData = {
    labels: crossFilteredData.map(d => d[xAxisKey]),
    datasets,
  } as ChartData;

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
          generateLabels: (chart) => {
            return seriesState.map((seriesItem, index) => ({
              text: seriesItem.name,
              fillStyle: seriesItem.hide ? '#D1D5DB' : seriesItem.color,
              strokeStyle: seriesItem.hide ? '#D1D5DB' : seriesItem.color,
              lineWidth: 2,
              pointStyle: seriesItem.type === 'bar' ? 'rect' : 'line',
              hidden: seriesItem.hide,
              index,
            }));
          },
        },
        onClick: (event, legendItem) => {
          if (typeof legendItem.index === 'number') {
            handleSeriesToggle(seriesState[legendItem.index].dataKey);
          }
        },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltip.backgroundColor,
        titleColor: chartTheme.tooltip.color,
        bodyColor: chartTheme.tooltip.color,
        borderColor: '#475569',
        borderWidth: 1,
        cornerRadius: 8,
        filter: (tooltipItem) => {
          // Only show tooltip for visible series
          const dataset = chartData.datasets[tooltipItem.datasetIndex];
          const series = seriesState.find(s => s.name === dataset.label);
          return !series?.hide;
        },
        callbacks: {
          title: (tooltipItems) => {
            return String(tooltipItems[0]?.label || '');
          },
          label: (context: TooltipItem<'bar' | 'line'>) => {
            const value = context.parsed.y;
            const series = seriesState.find(s => s.name === context.dataset.label);
            
            if (series?.yAxisId === 'right' && value < 1) {
              return `${context.dataset.label}: ${formatters.percentage(value)}`;
            } else {
              return `${context.dataset.label}: ${formatters.currency(value)}`;
            }
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
          maxRotation: dashboardLayout ? 0 : 45,
          color: chartTheme.colors.gray,
          font: {
            size: dashboardLayout ? 10 : 11,
          },
        },
      },
      y: {
        type: 'linear' as const,
        display: leftAxisSeries.length > 0,
        position: 'left' as const,
        min: yAxisDomains.left[0],
        max: yAxisDomains.left[1],
        grid: {
          color: chartTheme.grid.color,
          lineWidth: 1,
        },
        ticks: {
          color: chartTheme.colors.gray,
          font: {
            size: dashboardLayout ? 10 : 11,
          },
          callback: (value) => formatters.shortNumber(Number(value)),
        },
      },
      y1: {
        type: 'linear' as const,
        display: rightAxisSeries.length > 0,
        position: 'right' as const,
        min: yAxisDomains.right[0],
        max: yAxisDomains.right[1],
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: chartTheme.colors.gray,
          font: {
            size: dashboardLayout ? 10 : 11,
          },
          callback: (value) => {
            const numValue = Number(value);
            return numValue < 1 ? formatters.percentage(numValue) : formatters.shortNumber(numValue);
          },
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
          const seriesItem = seriesState.find(s => s.name === dataset.label);
          const dataPoint = crossFilteredData[dataIndex];
          
          if (seriesItem && dataPoint) {
            dispatch('elementClick', { data: dataPoint, series: seriesItem });
          }
        }
      }
    },
    animation: {
      duration: dashboardLayout ? 500 : 750,
      easing: 'easeOutQuart',
    },
  } as ChartOptions;

  // Handle series toggle
  function handleSeriesToggle(dataKey: string) {
    seriesState = seriesState.map(s => 
      s.dataKey === dataKey ? { ...s, hide: !s.hide } : s
    );
  }

  // Handle cross-filter
  function handleCrossFilter(dataKey: string) {
    crossFilterKey = crossFilterKey === dataKey ? null : dataKey;
  }

  // Calculate series statistics
  $: seriesStats = visibleSeries.slice(0, 3).map(seriesItem => {
    const values = crossFilteredData
      .map(d => d[seriesItem.dataKey])
      .filter(v => v !== undefined && v !== null && typeof v === 'number');
    
    if (values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return { seriesItem, sum, avg, min, max };
  }).filter(Boolean);

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
  borderColor="border-l-indigo-500"
  on:export={handleExport}
  let:setChartRef
>
  <div slot="controls" class="flex items-center gap-2">
    <div class="relative">
      <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
      <input
        type="text"
        placeholder="Поиск..."
        bind:value={searchTerm}
        class="text-xs border border-gray-300 rounded pl-7 pr-2 py-1 w-24"
      />
    </div>
    
    {#if enableCrossFilter && crossFilterKey}
      <button
        on:click={() => crossFilterKey = null}
        class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1"
      >
        <X class="h-3 w-3" />
        Сбросить фильтр
      </button>
    {/if}
  </div>

  {#if crossFilteredData.length > 0 && visibleSeries.length > 0}
    <div class="h-full">
      <Chart
        type="bar"
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
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Нет данных</h3>
      <p class="text-gray-600">Добавьте данные и серии для отображения графика</p>
    </div>
  {/if}

  <div slot="footer">
    <!-- Interactive Series Legend -->
    {#if seriesState.length > 0}
      <div class="flex flex-wrap justify-center gap-3 mt-4">
        {#each seriesState as seriesItem}
          <div class="flex items-center gap-2">
            <button
              on:click={() => handleSeriesToggle(seriesItem.dataKey)}
              class="flex items-center gap-2 px-2 py-1 rounded transition-all {
                seriesItem.hide ? 'opacity-50 line-through' : 'hover:bg-gray-100'
              }"
            >
              <div
                class="w-3 h-3 rounded"
                style="background-color: {seriesItem.hide ? '#D1D5DB' : seriesItem.color}"
              />
              <span class="text-sm text-gray-600">{seriesItem.name}</span>
              <span class="text-xs text-gray-400">
                ({seriesItem.type === 'bar' ? '■' : '—'})
              </span>
            </button>
            
            {#if enableCrossFilter}
              <button
                on:click={() => handleCrossFilter(seriesItem.dataKey)}
                class="text-xs text-blue-600 hover:text-blue-800 px-1"
                title="Фильтровать по этой серии"
              >
                <Filter class="h-3 w-3" />
              </button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Statistics Panel -->
    {#if !dashboardLayout && seriesStats.length > 0}
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each seriesStats as stat}
          <div class="bg-gray-50 rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
              <div 
                class="w-3 h-3 rounded" 
                style="background-color: {stat.seriesItem.color}"
              />
              <span class="text-sm font-medium">{stat.seriesItem.name}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div class="text-gray-500">Среднее</div>
                <div class="font-medium">
                  {stat.seriesItem.yAxisId === 'right' && stat.avg < 1 
                    ? formatters.percentage(stat.avg)
                    : formatters.shortNumber(stat.avg)}
                </div>
              </div>
              <div>
                <div class="text-gray-500">Общая</div>
                <div class="font-medium">
                  {stat.seriesItem.yAxisId === 'right' && stat.sum < 1
                    ? formatters.percentage(stat.sum)
                    : formatters.shortNumber(stat.sum)}
                </div>
              </div>
              <div>
                <div class="text-gray-500">Мин</div>
                <div class="font-medium">
                  {stat.seriesItem.yAxisId === 'right' && stat.min < 1
                    ? formatters.percentage(stat.min)
                    : formatters.shortNumber(stat.min)}
                </div>
              </div>
              <div>
                <div class="text-gray-500">Макс</div>
                <div class="font-medium">
                  {stat.seriesItem.yAxisId === 'right' && stat.max < 1
                    ? formatters.percentage(stat.max)
                    : formatters.shortNumber(stat.max)}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</ChartContainer>