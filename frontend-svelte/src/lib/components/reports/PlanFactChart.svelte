<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Bar } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    type ChartOptions,
    type ChartData,
    type TooltipItem,
  } from 'chart.js';
  import ChartContainer from '$lib/components/charts/core/ChartContainer.svelte';
  import { formatters, chartTheme } from '$lib/utils/charts/formatters';
  import { BarChart3, TrendingUp, TrendingDown, Search } from 'lucide-svelte';

  // Register Chart.js components
  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement);

  const dispatch = createEventDispatcher<{
    barClick: { data: PlanFactData };
    export: { format: 'png' | 'svg' };
  }>();

  export let data: PlanFactData[] = [];
  export let title = 'Анализ план-факт';
  export let subtitle = '';
  export let height = 400;
  export let className = '';
  export let loading = false;
  export let error: string | null = null;
  export let showVarianceLine = true;
  export let sortable = true;

  interface PlanFactData {
    category: string;
    plan: number;
    fact: number;
    variance: number;
    variance_percent: number;
  }

  // State
  let searchTerm = '';
  let sortBy: 'category' | 'plan' | 'fact' | 'variance' = 'variance';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Process data
  $: filteredData = searchTerm 
    ? data.filter(item => 
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : data;

  $: sortedData = sortable ? [...filteredData].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'category':
        comparison = a.category.localeCompare(b.category, 'ru');
        break;
      case 'plan':
        comparison = a.plan - b.plan;
        break;
      case 'fact':
        comparison = a.fact - b.fact;
        break;
      case 'variance':
        comparison = Math.abs(a.variance) - Math.abs(b.variance);
        break;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  }) : filteredData;

  let chartData: ChartData<'bar'>;
  let chartOptions: ChartOptions<'bar'>;

  $: if (sortedData.length > 0) {
    updateChartData();
  }

  function updateChartData() {
    chartData = {
      labels: sortedData.map(item => item.category),
      datasets: [
        {
          label: 'План',
          data: sortedData.map(item => item.plan),
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Факт',
          data: sortedData.map(item => item.fact),
          backgroundColor: 'rgba(239, 68, 68, 0.8)', // red-500
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          borderRadius: 4,
        },
        ...(showVarianceLine ? [{
          type: 'line' as const,
          label: 'Отклонение %',
          data: sortedData.map(item => item.variance_percent),
          borderColor: 'rgb(168, 85, 247)', // violet-500
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgb(168, 85, 247)',
          yAxisID: 'y1',
          fill: false,
        }] : [])
      ]
    };

    chartOptions = {
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
              if (context.datasetIndex === 0 || context.datasetIndex === 1) {
                return `${context.dataset.label}: ${formatters.currency(context.parsed.y)}`;
              } else {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              }
            },
            afterBody: (tooltipItems) => {
              if (tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                const item = sortedData[dataIndex];
                if (item) {
                  return `Отклонение: ${formatters.currency(item.variance)}`;
                }
              }
              return [];
            }
          }
        },
        legend: {
          position: 'top' as const,
          labels: {
            font: {
              size: 12
            },
            color: chartTheme.colors.gray,
            usePointStyle: true,
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: chartTheme.colors.gray,
            font: {
              size: 11
            },
            maxRotation: 45
          }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          beginAtZero: true,
          grid: {
            color: chartTheme.grid.color
          },
          ticks: {
            color: chartTheme.colors.gray,
            font: {
              size: 11
            },
            callback: (value) => formatters.shortNumber(Number(value))
          }
        },
        y1: {
          type: 'linear' as const,
          display: showVarianceLine,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: chartTheme.colors.gray,
            font: {
              size: 11
            },
            callback: (value) => `${Number(value).toFixed(1)}%`
          }
        }
      },
      onClick: (event, elements) => {
        if (elements.length > 0 && elements[0].datasetIndex < 2) {
          const index = elements[0].index;
          const dataPoint = sortedData[index];
          if (dataPoint) {
            dispatch('barClick', { data: dataPoint });
          }
        }
      },
      animation: {
        duration: 750,
        easing: 'easeOutQuart',
      },
    };
  }

  // Handle sort change
  function handleSortChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const [newSortBy, newSortOrder] = target.value.split('-') as [typeof sortBy, typeof sortOrder];
    sortBy = newSortBy;
    sortOrder = newSortOrder;
  }

  onMount(() => {
    if (sortedData.length > 0) {
      updateChartData();
    }
  });

  // Calculate summary statistics
  $: totalPlan = sortedData.reduce((sum, item) => sum + item.plan, 0);
  $: totalFact = sortedData.reduce((sum, item) => sum + item.fact, 0);
  $: totalVariance = totalFact - totalPlan;
  $: totalVariancePercent = totalPlan > 0 ? (totalVariance / totalPlan) * 100 : 0;

  // Top variance contributors
  $: topVariance = sortedData
    .slice()
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance))
    .slice(0, 3);

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
  borderColor="border-l-blue-500"
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
        <option value="variance-desc">По отклонению ↓</option>
        <option value="variance-asc">По отклонению ↑</option>
        <option value="category-asc">По категории ↑</option>
        <option value="plan-desc">По плану ↓</option>
        <option value="fact-desc">По факту ↓</option>
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

  {#if sortedData.length > 0}
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
        <BarChart3 class="h-8 w-8 text-gray-400" />
      </div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">Нет данных</h3>
      <p class="text-gray-600">Выберите период и примените фильтры для отображения диаграммы</p>
    </div>
  {/if}

  <div slot="footer">
    {#if sortedData.length > 0}
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-blue-800">Общий план</p>
              <p class="text-xl font-bold text-blue-900">{formatters.currency(totalPlan)}</p>
            </div>
            <TrendingUp class="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div class="bg-red-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-red-800">Общий факт</p>
              <p class="text-xl font-bold text-red-900">{formatters.currency(totalFact)}</p>
            </div>
            <TrendingDown class="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div class="bg-slate-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Отклонение</p>
              <p class="text-xl font-bold {totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}">
                {formatters.currency(totalVariance)}
              </p>
              <p class="text-xs text-slate-500">{totalVariancePercent.toFixed(1)}%</p>
            </div>
            <div class="h-8 w-8 {totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}">
              {#if totalVariance >= 0}
                <TrendingUp class="h-8 w-8" />
              {:else}
                <TrendingDown class="h-8 w-8" />
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Top Variance Contributors -->
      <div class="mb-6">
        <h4 class="text-sm font-medium text-gray-900 mb-3">Наибольшие отклонения</h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          {#each topVariance as item, index}
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-600 truncate">{item.category}</span>
                <span class="text-sm font-medium {item.variance >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {item.variance >= 0 ? '+' : ''}{formatters.shortNumber(item.variance)}
                </span>
              </div>
              <div class="text-xs text-gray-500 mt-1">
                {item.variance_percent.toFixed(1)}%
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Data Table -->
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4 font-medium text-gray-700">Категория</th>
              <th class="text-right py-3 px-4 font-medium text-gray-700">План</th>
              <th class="text-right py-3 px-4 font-medium text-gray-700">Факт</th>
              <th class="text-right py-3 px-4 font-medium text-gray-700">Отклонение</th>
              <th class="text-right py-3 px-4 font-medium text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedData as item}
              <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 px-4 font-medium text-gray-900">{item.category}</td>
                <td class="py-3 px-4 text-right text-blue-600">{formatters.currency(item.plan)}</td>
                <td class="py-3 px-4 text-right text-red-600">{formatters.currency(item.fact)}</td>
                <td class="py-3 px-4 text-right {item.variance >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {formatters.currency(item.variance)}
                </td>
                <td class="py-3 px-4 text-right {item.variance_percent >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {item.variance_percent.toFixed(1)}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</ChartContainer>