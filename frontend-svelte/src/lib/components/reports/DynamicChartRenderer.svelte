<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TransformedReportData } from '$lib/services/reportDataTransformer';
  import type { ReportFilters } from '$lib/services/reportService';
  import { 
    ComposedChartView, 
    CategoryPieChart, 
    TrendLineChart, 
    VarianceWaterfall,
    BudgetGauge,
    type ChartSeries 
  } from '$lib/components/charts';
  import { BarChart3, AlertCircle, TrendingUp } from 'lucide-svelte';

  const dispatch = createEventDispatcher<{
    chartClick: { data: any; series?: ChartSeries };
    export: { format: 'png' | 'svg' };
  }>();

  // Props
  interface Props {
    transformedData: TransformedReportData;
    chartType: 'composed' | 'pie' | 'trend' | 'waterfall' | 'gauge';
    reportType: ReportFilters['report_type'];
    loading?: boolean;
  }
  
  let { transformedData, chartType, reportType, loading = false }: Props = $props();

  // Chart titles and configurations
  const chartConfigs = {
    composed: {
      title: 'Комбинированный анализ',
      subtitle: 'План, факт и показатели выполнения',
      borderColor: 'border-l-blue-500'
    },
    pie: {
      title: 'Распределение по категориям',
      subtitle: 'Структура расходов и доходов',
      borderColor: 'border-l-green-500'
    },
    trend: {
      title: 'Временные ряды',
      subtitle: 'Динамика изменений во времени',
      borderColor: 'border-l-purple-500'
    },
    waterfall: {
      title: 'Анализ отклонений',
      subtitle: 'Каскадная диаграмма изменений',
      borderColor: 'border-l-red-500'
    },
    gauge: {
      title: 'Выполнение бюджета',
      subtitle: 'Индикатор использования средств',
      borderColor: 'border-l-amber-500'
    }
  };

  // Get current chart configuration
  $: currentConfig = chartConfigs[chartType];

  // Check data availability for current chart type
  $: hasDataForChart = (() => {
    switch (chartType) {
      case 'composed':
        return transformedData.composedData?.length > 0;
      case 'pie':
        return transformedData.categoryData?.length > 0;
      case 'trend':
        return transformedData.timeSeriesData?.length > 0;
      case 'waterfall':
        return transformedData.varianceData?.length > 0;
      case 'gauge':
        return transformedData.budgetData !== undefined;
      default:
        return false;
    }
  })();

  // Handle chart interactions
  function handleChartClick(event: CustomEvent) {
    dispatch('chartClick', event.detail);
  }

  function handleExport(event: CustomEvent) {
    dispatch('export', event.detail);
  }
</script>

{#if loading}
  <div class="bg-white rounded-lg shadow-sm p-8 border border-l-4 {currentConfig.borderColor}">
    <div class="flex items-center justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      <span class="ml-3 text-gray-600">Загрузка графика...</span>
    </div>
  </div>
{:else if hasDataForChart}
  <!-- Dynamic Chart Rendering -->
  {#if chartType === 'composed'}
    <ComposedChartView
      data={transformedData.composedData || []}
      series={transformedData.composedSeries || []}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      height={450}
      className="bg-white rounded-lg shadow-sm border border-l-4 {currentConfig.borderColor}"
      dashboardLayout={false}
      showBrush={true}
      showCrosshair={true}
      enableCrossFilter={true}
      on:elementClick={handleChartClick}
      on:export={handleExport}
    />
  
  {:else if chartType === 'pie'}
    <CategoryPieChart
      data={transformedData.categoryData || []}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      height={450}
      className="bg-white rounded-lg shadow-sm border border-l-4 {currentConfig.borderColor}"
      showLegend={true}
      on:sliceClick={handleChartClick}
      on:export={handleExport}
    />
  
  {:else if chartType === 'trend'}
    <TrendLineChart
      data={transformedData.timeSeriesData || []}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      height={450}
      className="bg-white rounded-lg shadow-sm border border-l-4 {currentConfig.borderColor}"
      on:pointClick={handleChartClick}
      on:export={handleExport}
    />
  
  {:else if chartType === 'waterfall'}
    <VarianceWaterfall
      data={transformedData.varianceData || []}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      height={450}
      className="bg-white rounded-lg shadow-sm border border-l-4 {currentConfig.borderColor}"
      on:barClick={handleChartClick}
      on:export={handleExport}
    />
  
  {:else if chartType === 'gauge'}
    <BudgetGauge
      data={transformedData.budgetData}
      title={currentConfig.title}
      subtitle={currentConfig.subtitle}
      height={450}
      className="bg-white rounded-lg shadow-sm border border-l-4 {currentConfig.borderColor}"
      on:export={handleExport}
    />
  {/if}
{:else}
  <!-- No Data State -->
  <div class="bg-white rounded-lg shadow-sm p-8 text-center border border-l-4 {currentConfig.borderColor}">
    <div class="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      {#if chartType === 'composed'}
        <BarChart3 class="h-8 w-8 text-gray-400" />
      {:else if chartType === 'trend'}
        <TrendingUp class="h-8 w-8 text-gray-400" />
      {:else}
        <AlertCircle class="h-8 w-8 text-gray-400" />
      {/if}
    </div>
    <h3 class="text-lg font-medium text-gray-900 mb-2">
      Нет данных для {currentConfig.title.toLowerCase()}
    </h3>
    <p class="text-gray-600 mb-4">
      {#if chartType === 'composed'}
        Данные для комбинированного графика недоступны. Проверьте фильтры отчета.
      {:else if chartType === 'pie'}
        Нет данных о распределении по категориям. Убедитесь, что выбран правильный тип отчета.
      {:else if chartType === 'trend'}
        Временные ряды недоступны. Данный тип графика требует данных за несколько периодов.
      {:else if chartType === 'waterfall'}
        Нет данных для анализа отклонений. Убедитесь, что есть плановые и фактические значения.
      {:else if chartType === 'gauge'}
        Данные о выполнении бюджета недоступны. Проверьте настройки отчета.
      {:else}
        Выберите другой тип графика или измените параметры фильтра.
      {/if}
    </p>
    
    <!-- Suggestions for alternative chart types -->
    <div class="text-sm text-gray-500">
      <p class="font-medium mb-2">Доступные альтернативы:</p>
      <div class="flex flex-wrap justify-center gap-2">
        {#if transformedData.composedData?.length && chartType !== 'composed'}
          <span class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
            <BarChart3 class="h-3 w-3 mr-1" />
            Комбинированный
          </span>
        {/if}
        {#if transformedData.categoryData?.length && chartType !== 'pie'}
          <span class="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
            Круговая диаграмма
          </span>
        {/if}
        {#if transformedData.timeSeriesData?.length && chartType !== 'trend'}
          <span class="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
            <TrendingUp class="h-3 w-3 mr-1" />
            Тренды
          </span>
        {/if}
      </div>
    </div>
  </div>
{/if}