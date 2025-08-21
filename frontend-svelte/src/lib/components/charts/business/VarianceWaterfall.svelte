<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Bar } from '../core';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    type ChartOptions,
    type ChartData,
    type TooltipItem,
  } from 'chart.js';
  import ChartContainer from '../core/ChartContainer.svelte';
  import { formatters, chartTheme, generateColorPalette } from '$lib/utils/charts/formatters';
  import { transformToWaterfall, sortChartData, type WaterfallDataPoint } from '$lib/utils/charts/dataTransform';
  import { Search } from 'lucide-svelte';
  
  // Register Chart.js components
  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);
  
  const dispatch = createEventDispatcher<{
    barClick: { data: WaterfallDataPoint };
    export: { format: 'png' | 'svg' };
  }>();

  // Props
  export let data: Array<{
    name: string;
    value: number;
    category?: string;
    [key: string]: any;
  }> = [];
  export let title = 'Анализ отклонений';
  export let subtitle = '';
  export let height = 400;
  export let className = '';
  export let showRunningTotal = true;
  export let showCumulativeLine = true;
  export let sortable = true;
  export let colorCoding: 'impact' | 'category' | 'value' = 'impact';
  export let loading = false;
  export let error: string | null = null;

  // State
  let sortBy: 'value' | 'name' | 'impact' = 'value';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let searchTerm = '';

  // Process data
  $: sortedData = sortable ? sortChartData(data, sortBy, sortOrder) : data;
  $: filteredData = searchTerm 
    ? sortedData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : sortedData;
  $: waterfallData = transformToWaterfall(filteredData);

  // Calculate Y-axis domain
  $: yDomain = (() => {
    if (waterfallData.length === 0) return [0, 100];
    
    const values = waterfallData.map(d => d.cumulative);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const padding = (max - min) * 0.1;
    return [min - padding, max + padding];
  })();

  // Chart data
  $: chartData = {
    labels: waterfallData.map(d => d.name),
    datasets: [
      {
        label: 'Изменение',
        data: waterfallData.map(d => ({
          x: d.name,
          y: d.value,
          cumulative: d.cumulative,
          cumulativeStart: d.cumulativeStart,
          type: d.type,
          impact: d.impact,
          category: d.category,
        })),
        backgroundColor: waterfallData.map(d => d.color),
        borderColor: waterfallData.map(d => d.type === 'total' ? '#374151' : d.color),
        borderWidth: waterfallData.map(d => d.type === 'total' ? 2 : 0),
        borderDash: waterfallData.map(d => d.type === 'total' ? [5, 5] : []),
        barThickness: 'flex',
        maxBarThickness: 60,
      },
      ...(showCumulativeLine ? [{
        label: 'Накопительный итог',
        type: 'line' as const,
        data: waterfallData.map(d => d.cumulative),
        borderColor: chartTheme.colors.darkGray,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: chartTheme.colors.darkGray,
        tension: 0,
        fill: false,
      }] : []),
    ],
  } as ChartData<'bar'>;

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
          filter: (legendItem) => {
            // Hide cumulative line from legend if disabled
            return showCumulativeLine || legendItem.text !== 'Накопительный итог';
          },
        },
      },
      tooltip: {
        backgroundColor: chartTheme.tooltip.backgroundColor,
        titleColor: chartTheme.tooltip.color,
        bodyColor: chartTheme.tooltip.color,
        borderColor: '#475569',
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          title: (tooltipItems) => {
            return tooltipItems[0]?.label || '';
          },
          label: (context: TooltipItem<'bar'>) => {
            const dataPoint = context.raw as any;
            const lines: string[] = [];
            
            if (context.datasetIndex === 0) {
              lines.push(`Изменение: ${dataPoint.y >= 0 ? '+' : ''}${formatters.currency(dataPoint.y)}`);
              lines.push(`Накопительный итог: ${formatters.currency(dataPoint.cumulative)}`);
              lines.push(`Влияние: ${
                dataPoint.impact === 'high' ? 'Высокое' : 
                dataPoint.impact === 'medium' ? 'Среднее' : 'Низкое'
              }`);
              if (dataPoint.category) {
                lines.push(`Категория: ${dataPoint.category}`);
              }
            } else {
              lines.push(`Накопительный итог: ${formatters.currency(context.parsed.y)}`);
            }
            
            return lines;
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
          maxRotation: 45,
          color: chartTheme.colors.gray,
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: false,
        min: yDomain[0],
        max: yDomain[1],
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
      if (elements.length > 0 && elements[0].datasetIndex === 0) {
        const index = elements[0].index;
        const dataPoint = waterfallData[index];
        if (dataPoint && dataPoint.type !== 'total') {
          dispatch('barClick', { data: dataPoint });
        }
      }
    },
    animation: {
      duration: 750,
      easing: 'easeOutQuart',
    },
  } as ChartOptions<'bar'>;

  // Handle sort change
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const [newSortBy, newSortOrder] = target.value.split('-') as [typeof sortBy, typeof sortOrder];
    sortBy = newSortBy;
    sortOrder = newSortOrder;
  }

  // Summary statistics
  $: summaryStats = (() => {
    const positive = filteredData.filter(d => d.value > 0).reduce((sum, d) => sum + d.value, 0);
    const negative = filteredData.filter(d => d.value < 0).reduce((sum, d) => sum + d.value, 0);
    const total = positive + negative;
    const topContributors = filteredData
      .slice()
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 3);
    
    const impactDistribution = ['high', 'medium', 'low'].map(impact => {
      const count = waterfallData.filter(d => d.impact === impact && d.type !== 'total').length;
      return { impact, count, percentage: waterfallData.length > 0 ? (count / waterfallData.length) * 100 : 0 };
    });

    return { positive, negative, total, topContributors, impactDistribution };
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
  borderColor="border-l-red-500"
  on:export={handleExport}
  let:setChartRef
>
  <div slot="controls" class="flex items-center gap-2">
    {#if sortable}
      <select
        value="{sortBy}-{sortOrder}"
        on:change={handleSortChange}
        class="text-xs border border-gray-300 rounded px-2 py-1"
      >
        <option value="value-desc">По влиянию ↓</option>
        <option value="value-asc">По влиянию ↑</option>
        <option value="name-asc">По названию ↑</option>
        <option value="name-desc">По названию ↓</option>
      </select>
    {/if}
    <div class="relative">
      <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
      <input
        type="text"
        placeholder="Поиск..."
        bind:value={searchTerm}
        class="text-xs border border-gray-300 rounded pl-7 pr-2 py-1 w-24"
      />
    </div>
  </div>

  {#if waterfallData.length > 0}
    <div class="h-full">
      <Bar
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
      <p class="text-gray-600">Добавьте данные для отображения анализа отклонений</p>
    </div>
  {/if}

  <div slot="footer">
    <!-- Impact Analysis -->
    {#if waterfallData.length > 0}
      <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Summary Statistics -->
        <div class="bg-gray-50 rounded-lg p-3">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Итоговое влияние</h4>
          <div class="space-y-1 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600">Положительное:</span>
              <span class="font-medium text-green-600">
                +{formatters.currency(summaryStats.positive)}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600">Отрицательное:</span>
              <span class="font-medium text-red-600">
                {formatters.currency(summaryStats.negative)}
              </span>
            </div>
            <div class="flex justify-between border-t pt-1">
              <span class="text-gray-600">Общий эффект:</span>
              <span class="font-medium">
                {formatters.currency(summaryStats.total)}
              </span>
            </div>
          </div>
        </div>

        <!-- Top Contributors -->
        <div class="bg-gray-50 rounded-lg p-3">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Наибольшее влияние</h4>
          <div class="space-y-1 text-sm">
            {#each summaryStats.topContributors as item}
              <div class="flex justify-between items-center">
                <span class="text-gray-600 truncate flex-1">{item.name}</span>
                <span class="font-medium ml-2 {item.value >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {item.value >= 0 ? '+' : ''}{formatters.shortNumber(item.value)}
                </span>
              </div>
            {/each}
          </div>
        </div>

        <!-- Impact Distribution -->
        <div class="bg-gray-50 rounded-lg p-3">
          <h4 class="text-sm font-medium text-gray-900 mb-2">Распределение по влиянию</h4>
          <div class="space-y-2">
            {#each summaryStats.impactDistribution as { impact, count, percentage }}
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded {
                  impact === 'high' ? 'bg-red-500' :
                  impact === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                }" />
                <span class="text-xs text-gray-600 flex-1">
                  {impact === 'high' ? 'Высокое' : 
                   impact === 'medium' ? 'Среднее' : 'Низкое'}
                </span>
                <span class="text-xs font-medium">{count} ({percentage.toFixed(0)}%)</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</ChartContainer>