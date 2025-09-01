<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import Pie from '../core/PieChart.svelte';
  import Doughnut from '../core/DoughnutChart.svelte';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    type ChartOptions,
    type ChartData,
    type TooltipItem,
  } from 'chart.js';
  import ChartContainer from '../core/ChartContainer.svelte';
  import { formatters, chartTheme, generateColorPalette } from '$lib/utils/charts/formatters';
  import { transformToCategoryPie, type ChartDataPoint } from '$lib/utils/charts/dataTransform';
  import { Search, Eye, EyeOff } from 'lucide-svelte';
  
  // Register Chart.js components
  ChartJS.register(Title, Tooltip, Legend, ArcElement);
  
  const dispatch = createEventDispatcher<{
    sliceClick: { data: ChartDataPoint };
    export: { format: 'png' | 'svg' };
  }>();

  // Props
  export let data: Array<{
    category: string;
    amount: number;
    color?: string;
    [key: string]: any;
  }> = [];
  export let title: string = 'Распределение по категориям';
  export let subtitle: string = '';
  export let height: number = 300;
  export let className: string = '';
  export let showDonut: boolean = true;
  export let showPercentageLabels: boolean = true;
  export let showLegend: boolean = true;
  export let minSlicePercentage: number = 2;
  export let loading: boolean = false;
  export let error: string | null = null;

  // State
  let hiddenCategories = new Set<string>();
  let activeIndex: number | null = null;
  let searchTerm = '';

  // Process data - step by step to avoid circular dependencies
  $: transformedData = transformToCategoryPie(data);
  
  $: filteredBySearch = searchTerm 
    ? transformedData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : transformedData;

  // Calculate base visible data (without hiddenCategories dependency here)
  $: baseVisibleData = filteredBySearch;

  // Process data into main and "other" categories
  $: processedDataAndOthers = (() => {
    // Separate small slices into "Other" category
    const mainData: ChartDataPoint[] = [];
    let otherSum = 0;
    const otherItems: ChartDataPoint[] = [];
    
    baseVisibleData.forEach((item) => {
      if (item.percentage >= minSlicePercentage) {
        mainData.push(item);
      } else {
        otherSum += item.value;
        otherItems.push(item);
      }
    });
    
    // Add "Other" category if there are small slices
    if (otherSum > 0) {
      const total = baseVisibleData.reduce((sum, item) => sum + item.value, 0);
      mainData.push({
        name: 'Прочее',
        value: otherSum,
        percentage: (otherSum / total) * 100,
        color: chartTheme.colors.neutral,
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
      otherData: otherItems,
    };
  })();

  // Extract values
  $: allProcessedData = processedDataAndOthers.chartData;
  $: otherData = processedDataAndOthers.otherData;
  
  // Apply hidden categories filter at the very end for display
  $: processedData = allProcessedData.filter(item => !hiddenCategories.has(item.name));
  $: visibleData = baseVisibleData.filter(item => !hiddenCategories.has(item.name));

  // Chart data
  $: chartData = {
    labels: processedData.map(d => d.name),
    datasets: [{
      data: processedData.map(d => d.value),
      backgroundColor: processedData.map(d => d.color),
      borderColor: '#FFFFFF',
      borderWidth: 2,
      hoverBorderWidth: 3,
      hoverOffset: 4,
    }],
  } as ChartData<'pie'>;

  // Chart options
  $: chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: showDonut ? '40%' : '0%',
    plugins: {
      title: {
        display: false,
      },
      legend: {
        display: false, // Use custom legend instead to avoid circular dependency
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
            return tooltipItems[0]?.label || '';
          },
          label: (context: TooltipItem<'pie'>) => {
            const dataPoint = processedData[context.dataIndex];
            const lines: string[] = [];
            
            lines.push(`Сумма: ${formatters.currency(dataPoint.value)}`);
            lines.push(`Доля: ${dataPoint.percentage.toFixed(1)}%`);
            
            return lines;
          },
        },
      },
    },
    elements: {
      arc: {
        borderWidth: 2,
        hoverBorderWidth: 3,
      },
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const dataPoint = processedData[index];
        
        if (dataPoint && !dataPoint.isOther) {
          dispatch('sliceClick', { data: dataPoint });
        }
        
        activeIndex = activeIndex === index ? null : index;
      }
    },
    animation: {
      animateRotate: true,
      duration: 750,
      easing: 'easeOutQuart',
    },
    // Custom label display
    ...(showPercentageLabels && {
      plugins: {
        ...chartOptions?.plugins,
        datalabels: {
          display: (context: any) => {
            return context.parsed >= minSlicePercentage;
          },
          color: '#FFFFFF',
          font: {
            size: 12,
            weight: 'bold',
          },
          formatter: (value: number, context: any) => {
            const percentage = processedData[context.dataIndex]?.percentage || 0;
            return percentage >= 5 ? `${percentage.toFixed(0)}%` : '';
          },
        },
      },
    }),
  } as ChartOptions<'pie'>;

  // Handle legend click
  function handleLegendClick(dataKey: string) {
    if (hiddenCategories.has(dataKey)) {
      hiddenCategories.delete(dataKey);
    } else {
      hiddenCategories.add(dataKey);
    }
    hiddenCategories = new Set(hiddenCategories);
  }

  // Calculate total for visible slices - use visibleData directly since it's now properly computed
  $: visibleTotal = visibleData.reduce((sum, item) => sum + item.value, 0);

  // Summary statistics - use the computed visibleData
  $: summaryStats = (() => {
    const categoryCount = visibleData.filter(item => !item.isOther).length;
    const largestPercentage = visibleData.length > 0 ? visibleData[0].percentage : 0;
    const averagePercentage = visibleData.length > 0 ? 100 / visibleData.length : 0;
    
    return { categoryCount, largestPercentage, averagePercentage };
  })();

  let chartRef: HTMLCanvasElement | undefined;

  function handleExport(event: CustomEvent<{ format: 'png' | 'svg' }>) {
    dispatch('export', event.detail);
  }

  const ChartComponent = showDonut ? Doughnut : Pie;
</script>

<ChartContainer
  {title}
  {subtitle}
  {height}
  {className}
  {loading}
  {error}
  exportable={true}
  variant="beige"
  on:export={handleExport}
  let:setChartRef
>
  <div slot="controls" class="flex items-center gap-2">
    <div class="relative">
      <Search class="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
      <input
        type="text"
        placeholder="Поиск категорий..."
        bind:value={searchTerm}
        class="text-xs border border-steel/30 rounded pl-7 pr-2 py-1 w-32 focus:border-navy/50 focus:outline-none"
      />
    </div>
  </div>

  <div class="h-full flex flex-col">
    {#if processedData.length > 0}
      <!-- Chart -->
      <div class="flex-1 relative">
        <svelte:component 
          this={ChartComponent}
          data={chartData}
          options={chartOptions}
          bind:chart={chartRef}
          on:chartInit={() => chartRef && setChartRef(chartRef)}
        />
        
        <!-- Center label for donut chart -->
        {#if showDonut}
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="text-center">
              <div class="text-lg font-bold text-navy-dark">
                {formatters.currency(visibleTotal)}
              </div>
              <div class="text-xs text-steel">Всего</div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Custom Legend -->
      {#if allProcessedData.length > 0}
        <div class="flex flex-wrap justify-center gap-3 mt-4">
          {#each allProcessedData as item, index}
            <button
              on:click={() => handleLegendClick(item.name)}
              class="flex items-center gap-2 px-2 py-1 rounded transition-all {
                hiddenCategories.has(item.name) ? 'opacity-50 line-through' : 'hover:bg-navy/5'
              }"
            >
              <div
                class="w-3 h-3 rounded"
                style="background-color: {hiddenCategories.has(item.name) ? chartTheme.colors.neutral : item.color}"
              />
              <span class="text-sm text-steel-dark">{item.name}</span>
              {#if hiddenCategories.has(item.name)}
                <EyeOff class="h-3 w-3 text-steel" />
              {:else}
                <Eye class="h-3 w-3 text-steel" />
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="flex flex-col justify-center items-center py-12 text-center h-full">
        <div class="h-16 w-16 bg-steel/20 rounded-full flex items-center justify-center mb-4">
          <svg class="h-8 w-8 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-navy-dark mb-2">Нет данных</h3>
        <p class="text-steel-dark">Добавьте категории для отображения распределения</p>
      </div>
    {/if}
  </div>

  <div slot="footer">
    {#if processedData.length > 0}
      <!-- Other categories details -->
      {#if otherData.length > 0}
        <details class="mt-4">
          <summary class="text-sm text-steel-dark cursor-pointer hover:text-navy-dark">
            Показать детали категории "Прочее" ({otherData.length} категорий)
          </summary>
          <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {#each otherData as item}
              <div class="flex items-center justify-between p-2 bg-navy/5 rounded text-sm">
                <span class="text-steel-dark truncate">{item.name}</span>
                <span class="font-medium text-navy-dark ml-2">
                  {formatters.currency(item.value)}
                </span>
              </div>
            {/each}
          </div>
        </details>
      {/if}

      <!-- Summary stats -->
      <div class="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
        <div class="bg-navy/5 rounded-lg p-2">
          <div class="text-steel text-xs">Категорий</div>
          <div class="font-medium text-navy-dark">
            {summaryStats.categoryCount}
          </div>
        </div>
        <div class="bg-navy/5 rounded-lg p-2">
          <div class="text-steel text-xs">Крупнейшая</div>
          <div class="font-medium text-navy-dark">
            {summaryStats.largestPercentage.toFixed(1)}%
          </div>
        </div>
        <div class="bg-navy/5 rounded-lg p-2">
          <div class="text-steel text-xs">Средняя</div>
          <div class="font-medium text-navy-dark">
            {summaryStats.averagePercentage.toFixed(1)}%
          </div>
        </div>
      </div>
    {/if}
  </div>
</ChartContainer>