<script lang="ts">
  import { 
    BarChart3, 
    PieChart, 
    TrendingUp, 
    Activity, 
    Gauge 
  } from 'lucide-svelte';
  import type { ReportFilters } from '$lib/services/reportService';

  // Props (legacy syntax for compatibility)
  export let currentType: 'composed' | 'pie' | 'trend' | 'waterfall' | 'gauge';
  export let onTypeChange: (type: 'composed' | 'pie' | 'trend' | 'waterfall' | 'gauge') => void;
  export let reportType: ReportFilters['report_type'];

  // Chart type configurations with availability per report type
  const chartTypes = [
    {
      value: 'composed' as const,
      label: 'Комбинированный',
      icon: BarChart3,
      description: 'Столбцы и линии',
      availableFor: ['plan_fact', 'budget', 'analytics']
    },
    {
      value: 'pie' as const,
      label: 'Круговая диаграмма',
      icon: PieChart,
      description: 'Распределение по категориям',
      availableFor: ['budget', 'categories']
    },
    {
      value: 'trend' as const,
      label: 'Тренды',
      icon: TrendingUp,
      description: 'Временные ряды',
      availableFor: ['plan_fact', 'trends', 'analytics']
    },
    {
      value: 'waterfall' as const,
      label: 'Каскадная диаграмма',
      icon: Activity,
      description: 'Анализ отклонений',
      availableFor: ['plan_fact', 'analytics']
    },
    {
      value: 'gauge' as const,
      label: 'Индикатор',
      icon: Gauge,
      description: 'Выполнение бюджета',
      availableFor: ['budget', 'plan_fact']
    }
  ];

  // Filter chart types based on current report type
  $: availableChartTypes = chartTypes.filter(chart => 
    chart.availableFor.includes(reportType)
  );

  // Handle chart type selection
  function handleTypeSelect(type: typeof currentType) {
    if (type !== currentType) {
      onTypeChange(type);
    }
  }
</script>

<div class="space-y-3">
  <label class="text-xs font-medium text-gray-700 uppercase tracking-wide">
    Тип графика
  </label>
  
  <div class="grid grid-cols-1 gap-2">
    {#each availableChartTypes as chartType}
      <button
        on:click={() => handleTypeSelect(chartType.value)}
        class="flex items-center gap-3 p-3 rounded-lg border transition-all text-left {
          currentType === chartType.value
            ? 'bg-purple-50 border-purple-200 text-purple-900'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
        }"
      >
        <div class="flex-shrink-0 {
          currentType === chartType.value
            ? 'text-purple-600'
            : 'text-gray-400'
        }">
          <svelte:component this={chartType.icon} class="h-4 w-4" />
        </div>
        
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">
            {chartType.label}
          </div>
          <div class="text-xs text-gray-500 mt-1">
            {chartType.description}
          </div>
        </div>
        
        {#if currentType === chartType.value}
          <div class="flex-shrink-0">
            <div class="w-2 h-2 bg-purple-600 rounded-full"></div>
          </div>
        {/if}
      </button>
    {/each}
  </div>
  
  <!-- Info about selected chart type -->
  {#if currentType}
    {@const selectedChart = chartTypes.find(c => c.value === currentType)}
    {#if selectedChart}
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800">
        <div class="flex items-center gap-2 mb-1">
          <svelte:component this={selectedChart.icon} class="h-3 w-3" />
          <span class="font-medium">Выбрано: {selectedChart.label}</span>
        </div>
        <p class="text-purple-600">{selectedChart.description}</p>
      </div>
    {/if}
  {/if}
</div>