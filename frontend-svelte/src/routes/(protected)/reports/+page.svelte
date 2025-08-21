<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { reportService, type ReportFilters } from '$lib/services/reportService';
  import { reportDataTransformer, type TransformedReportData } from '$lib/services/reportDataTransformer';
  import ReportFiltersComponent from '$lib/components/reports/ReportFilters.svelte';
  import { 
    ComposedChartView, 
    CategoryPieChart, 
    TrendLineChart, 
    VarianceWaterfall,
    BudgetGauge,
    type ChartSeries 
  } from '$lib/components/charts';
  import BudgetTable from '$lib/components/reports/BudgetTable.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import ChartSelector from '$lib/components/reports/ChartSelector.svelte';
  import ViewModeToggle from '$lib/components/reports/ViewModeToggle.svelte';
  import DynamicChartRenderer from '$lib/components/reports/DynamicChartRenderer.svelte';
  import { 
    BarChart3, 
    Download, 
    TrendingUp, 
    Calculator, 
    CreditCard,
    FileSpreadsheet,
    PieChart,
    Activity,
    Settings
  } from 'lucide-svelte';

  // State
  let loading = false;
  let currentFilters: ReportFilters = { report_type: 'plan_fact' };
  let transformedData: TransformedReportData = {};
  let selectedChartType: 'composed' | 'pie' | 'trend' | 'waterfall' | 'gauge' = 'composed';
  let viewMode: 'chart' | 'table' = 'chart';
  let availableReportTypes = [
    { value: 'plan_fact', label: 'План-факт анализ', icon: BarChart3 },
    { value: 'budget', label: 'Бюджетный анализ', icon: PieChart },
    { value: 'categories', label: 'Анализ по категориям', icon: Activity },
    { value: 'trends', label: 'Временные ряды', icon: TrendingUp },
    { value: 'analytics', label: 'Расширенная аналитика', icon: Settings }
  ] as const;

  const toast = useToast();

  async function handleApplyFilters(filters: ReportFilters) {
    loading = true;
    currentFilters = filters;
    
    try {
      let rawData;
      
      // Load data based on report type
      switch (filters.report_type) {
        case 'plan_fact':
          rawData = await reportService.getPlanFactReport(filters);
          break;
        case 'budget':
          rawData = await reportService.getBudgetReport(filters);
          break;
        case 'categories':
        case 'trends':
        case 'analytics':
          rawData = await reportService.getAnalyticsData(filters);
          break;
        default:
          // Use mock data for development
          rawData = reportDataTransformer.generateMockData(filters);
      }
      
      // Transform data for visualization
      transformedData = reportDataTransformer.transform(rawData, filters);
      
    } catch (error: any) {
      console.error('Ошибка загрузки отчета:', error);
      
      // Fallback to mock data in case of API error
      try {
        const mockRawData = reportDataTransformer.generateMockData(filters);
        transformedData = reportDataTransformer.transform(mockRawData, filters);
        toast.info('Информация', 'Используются тестовые данные');
      } catch (mockError) {
        toast.error('Ошибка', error.message || 'Не удалось загрузить отчет');
      }
    } finally {
      loading = false;
    }
  }

  // Handle chart type selection
  function handleChartTypeChange(type: typeof selectedChartType) {
    selectedChartType = type;
  }

  // Handle view mode toggle
  function handleViewModeChange(mode: typeof viewMode) {
    viewMode = mode;
  }

  // Handle report type change
  function handleReportTypeChange(reportType: ReportFilters['report_type']) {
    currentFilters = { ...currentFilters, report_type: reportType };
    handleApplyFilters(currentFilters);
  }

  // Handle export functionality
  async function handleExport(format: 'excel' | 'pdf') {
    try {
      toast.info('Экспорт', `Начинается экспорт в формате ${format.toUpperCase()}`);
      
      let exportBlob: Blob;
      
      if (currentFilters.report_type === 'plan_fact') {
        exportBlob = await reportService.exportPlanFactToExcel(currentFilters);
      } else {
        exportBlob = await reportService.exportBudgetToExcel(currentFilters);
      }
      
      // Create download link
      const url = window.URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `report_${currentFilters.report_type}_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Успешно', `Отчет экспортирован в формате ${format.toUpperCase()}`);
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      toast.error('Ошибка', error.message || 'Не удалось экспортировать отчет');
    }
  }

  // Get chart series configuration based on selected data
  $: chartSeries = transformedData.composedSeries || [];
  
  // Check if data is available for current view
  $: hasData = transformedData && (
    transformedData.planFactData?.length ||
    transformedData.categoryData?.length ||
    transformedData.timeSeriesData?.length ||
    transformedData.composedData?.length
  );

  onMount(() => {
    // Load initial data with plan_fact report type
    handleApplyFilters(currentFilters);
  });
</script>

<svelte:head>
  <title>Отчеты - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div class="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
            <BarChart3 class="h-6 w-6 text-purple-600" />
          </div>
          Отчеты и аналитика
        </h1>
        <p class="text-slate-600 mt-2 ml-15">Комплексный анализ бюджетных данных</p>
      </div>
      
      <!-- Header Controls -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <!-- Report Type Selector -->
        <div class="flex flex-wrap gap-2">
          {#each availableReportTypes as reportType}
            <button
              on:click={() => handleReportTypeChange(reportType.value)}
              class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all {
                currentFilters.report_type === reportType.value
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
              }"
            >
              <svelte:component this={reportType.icon} class="h-4 w-4" />
              {reportType.label}
            </button>
          {/each}
        </div>
        
        <!-- Quick Actions -->
        <div class="flex items-center gap-2">
          <Button
            href="/budget"
            variant="outline"
            size="sm"
            class="flex items-center gap-2"
          >
            <Calculator class="h-4 w-4" />
            План
          </Button>
          <Button
            href="/fact"
            variant="outline"
            size="sm"
            class="flex items-center gap-2"
          >
            <CreditCard class="h-4 w-4" />
            Факт
          </Button>
        </div>
      </div>
    </div>

    <!-- Layout: Filters + Content -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Enhanced Filters Sidebar -->
      <div class="lg:col-span-1 space-y-6">
        <ReportFiltersComponent 
          onApplyFilters={handleApplyFilters}
          isLoading={loading}
        />
        
        <!-- View Controls -->
        <div class="bg-white rounded-lg shadow-sm border border-l-4 border-l-purple-500 p-4">
          <h3 class="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
            <Settings class="h-4 w-4" />
            Настройки отображения
          </h3>
          
          <!-- View Mode Toggle -->
          <ViewModeToggle 
            currentMode={viewMode}
            onModeChange={handleViewModeChange}
          />
          
          <!-- Chart Type Selector (only in chart mode) -->
          {#if viewMode === 'chart'}
            <div class="mt-4">
              <ChartSelector 
                currentType={selectedChartType}
                onTypeChange={handleChartTypeChange}
                reportType={currentFilters.report_type}
              />
            </div>
          {/if}
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="lg:col-span-3 space-y-6">
        {#if loading}
          <div class="bg-white rounded-lg shadow-sm p-8 border border-l-4 border-l-blue-500">
            <div class="flex items-center justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <span class="ml-3 text-gray-600">Загрузка отчета...</span>
            </div>
          </div>
        {:else if hasData}
          <!-- Dynamic Content Rendering -->
          {#if viewMode === 'chart'}
            <DynamicChartRenderer 
              {transformedData}
              chartType={selectedChartType}
              reportType={currentFilters.report_type}
              {loading}
            />
          {:else}
            <!-- Table View -->
            <div class="bg-white rounded-lg shadow-sm border border-l-4 border-l-green-500">
              <div class="px-6 py-4 border-b border-gray-200">
                <h2 class="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <BarChart3 class="h-5 w-5" />
                  Табличное представление
                </h2>
              </div>
              <div class="p-6">
                <BudgetTable 
                  data={transformedData.planFactData || []}
                  title="Детальные данные"
                  loading={false}
                  onExport={handleExport}
                />
              </div>
            </div>
          {/if}

          <!-- Export Actions -->
          <div class="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white rounded-lg shadow-sm p-4 border border-l-4 border-l-amber-500">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <FileSpreadsheet class="h-4 w-4" />
              Экспорт данных в различных форматах
            </div>
            <div class="flex items-center gap-3">
              <Button
                on:click={() => handleExport('excel')}
                variant="outline"
                size="sm"
                class="flex items-center gap-2"
              >
                <Download class="h-4 w-4" />
                Excel
              </Button>
              <Button
                on:click={() => handleExport('pdf')}
                variant="outline"
                size="sm"
                class="flex items-center gap-2"
              >
                <Download class="h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        {:else}
          <!-- Empty State -->
          <div class="bg-white rounded-lg shadow-sm p-12 text-center border border-l-4 border-l-gray-400">
            <div class="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 class="h-8 w-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Данные не найдены</h3>
            <p class="text-gray-600 mb-4">Измените параметры фильтра или выберите другой тип отчета</p>
            <Button 
              on:click={() => handleApplyFilters(currentFilters)}
              variant="outline"
              size="sm"
            >
              Обновить
            </Button>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>