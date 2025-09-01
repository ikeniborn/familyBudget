<script lang="ts">
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { isAuthenticated } from '$lib/stores/auth.store';
  import { reportService, type ReportFilters } from '$lib/services/reportService';
  import { reportDataTransformer, type TransformedReportData } from '$lib/services/reportDataTransformer';
  import ReportFiltersComponent from '$lib/components/reports/ReportFilters.svelte';
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
  let initialLoadCompleted = false;
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
        case 'plan_fact': {
          const planFactData = await reportService.getPlanFactReport(filters);
          // Convert to RawReportData format - use the data structure from API response
          rawData = {
            periods: planFactData.map((item) => ({
              period_id: item.period_id,
              period_name: item.period_name,
              period_ru_name: item.period_name,
              planned_amount: item.budget_amount,
              actual_amount: item.actual_amount,
              financial_center_name: '',
              cost_center_name: '',
              nomenclature_name: item.nomenclature_name
            }))
          };
          break;
        }
        case 'budget': {
          const budgetData = await reportService.getBudgetReport(filters);
          // Convert to RawReportData format - handle API response structure
          rawData = {
            categories: budgetData.map((item) => ({
              nomenclature_name: item.nomenclature_name,
              total_amount: item.budget_amount || item.actual_amount || 0,
              financial_center_name: ''
            })),
            budget_summary: {
              total_planned: budgetData.reduce((sum, item) => sum + (item.budget_amount || 0), 0),
              total_actual: budgetData.reduce((sum, item) => sum + (item.actual_amount || 0), 0),
              utilization_percent: budgetData.length > 0 ? 
                Math.round((budgetData.reduce((sum, item) => sum + (item.actual_amount || 0), 0) / 
                           budgetData.reduce((sum, item) => sum + (item.budget_amount || 0), 0)) * 100) : 0
            }
          };
          break;
        }
        case 'categories':
        case 'trends':
        case 'analytics': {
          const analyticsData = await reportService.getAnalyticsData(filters);
          // Convert to RawReportData format
          rawData = {
            categories: analyticsData.categories.map(item => ({
              nomenclature_name: item.name,
              total_amount: item.value
            })),
            time_series: [
              ...analyticsData.trends.map(item => ({
                date: item.date,
                amount: item.plan,
                type: 'plan' as 'plan' | 'fact'
              })),
              ...analyticsData.trends.map(item => ({
                date: item.date,
                amount: item.fact,
                type: 'fact' as 'plan' | 'fact'
              }))
            ]
          };
          break;
        }
        default:
          // Use mock data for development
          rawData = reportDataTransformer.generateMockData(filters);
      }
      
      // Transform data for visualization
      transformedData = reportDataTransformer.transform(rawData as any, filters);
      
    } catch (error: any) {
      console.error('Ошибка загрузки отчета:', error);
      
      // Fallback to mock data in case of API error
      try {
        const mockRawData = reportDataTransformer.generateMockData(filters);
        transformedData = reportDataTransformer.transform(mockRawData as any, filters);
        toast.info('Информация', 'Используются тестовые данные');
      } catch (mockError) {
        toast.error('Ошибка', error.message || 'Не удалось загрузить отчет');
        // Ensure we have empty data to prevent infinite loading
        transformedData = {};
      }
    } finally {
      loading = false;
      initialLoadCompleted = true;
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
  async function handleExport(format: 'csv' | 'excel' | 'pdf') {
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

  
  // Check if data is available for current view
  $: hasData = transformedData && (
    transformedData.planFactData?.length ||
    transformedData.categoryData?.length ||
    transformedData.timeSeriesData?.length ||
    transformedData.composedData?.length
  );

  // Load initial data when component mounts and user is authenticated
  onMount(async () => {
    if ($isAuthenticated && !initialLoadCompleted) {
      await handleApplyFilters(currentFilters);
    }
  });
</script>

<svelte:head>
  <title>Отчеты | Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    <!-- Заголовок страницы -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <BarChart3 class="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 class="page-title">
            Отчеты и аналитика
          </h1>
          <p class="page-subtitle">
            Комплексный анализ бюджетных данных и финансовые отчеты
          </p>
        </div>
      </div>
    </div>
    
    <!-- Панель действий -->
    <div class="action-panel">
      <!-- Report Type Selector -->
      <div class="flex flex-wrap gap-3">
        {#each availableReportTypes as reportType}
          <button
            on:click={() => handleReportTypeChange(reportType.value)}
            class="action-btn {
              currentFilters.report_type === reportType.value
                ? 'action-btn-primary'
                : 'action-btn-secondary'
            }"
          >
            <svelte:component this={reportType.icon} class="h-5 w-5" />
            {reportType.label}
          </button>
        {/each}
      </div>
      
      <!-- Quick Actions -->
      <div class="flex items-center gap-3">
        <a href="/budget" class="action-btn action-btn-secondary">
          <Calculator class="h-5 w-5" />
          План
        </a>
        <a href="/fact" class="action-btn action-btn-secondary">
          <CreditCard class="h-5 w-5" />
          Факт
        </a>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="main-content">
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <!-- Enhanced Filters Sidebar -->
        <div class="lg:col-span-1 space-y-6">
          <ReportFiltersComponent 
            onApplyFilters={handleApplyFilters}
            isLoading={loading}
          />
          
          <!-- View Controls -->
          <div class="content-card">
            <h3 class="card-title">
              <Settings class="h-5 w-5" />
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
            <div class="content-card">
              <div class="flex items-center justify-center p-8">
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
              <div class="content-card">
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
            <div class="export-card">
              <div class="flex items-center gap-2 text-sm text-gray-600">
                <FileSpreadsheet class="h-4 w-4" />
                Экспорт данных в различных форматах
              </div>
              <div class="flex items-center gap-3">
                <button
                  on:click={() => handleExport('excel')}
                  class="export-btn"
                >
                  <Download class="h-4 w-4" />
                  Excel
                </button>
                <button
                  on:click={() => handleExport('pdf')}
                  class="export-btn"
                >
                  <Download class="h-4 w-4" />
                  PDF
                </button>
              </div>
            </div>
          {:else if initialLoadCompleted}
            <!-- Empty State -->
            <div class="content-card text-center p-12">
              <div class="h-16 w-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 class="h-8 w-8 text-purple-600" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">Данные не найдены</h3>
              <p class="text-gray-600 mb-4">Измените параметры фильтра или выберите другой тип отчета</p>
              <button 
                on:click={() => handleApplyFilters(currentFilters)}
                class="action-btn action-btn-secondary"
              >
                Обновить
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(.container) {
    max-width: 1200px;
  }

  .page-header {
    @apply mb-8 p-8 rounded-2xl;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.4);
  }

  .header-content {
    @apply flex items-center gap-4;
  }

  .header-icon-wrapper {
    @apply flex items-center justify-center w-16 h-16 rounded-xl;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    backdrop-filter: blur(10px);
  }

  .page-title {
    @apply text-3xl font-bold text-white mb-1;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .page-subtitle {
    @apply text-white/80;
  }

  .action-panel {
    @apply flex flex-wrap justify-between items-center gap-4 mb-6;
  }

  .action-btn {
    @apply flex items-center gap-2 px-4 py-2 rounded-xl font-medium;
    @apply transition-all duration-200 transform hover:-translate-y-0.5;
    @apply shadow-md hover:shadow-lg;
  }

  .action-btn-primary {
    @apply text-white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .action-btn-primary:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #6b5b95 100%);
  }

  .action-btn-secondary {
    @apply bg-white/90 text-gray-700 hover:bg-white;
    backdrop-filter: blur(10px);
  }

  .main-content {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .content-card {
    @apply bg-white/90 rounded-xl p-6 shadow-lg;
    backdrop-filter: blur(10px);
  }

  .card-title {
    @apply text-lg font-semibold mb-3 flex items-center gap-2 text-gray-800;
  }

  .export-card {
    @apply flex flex-col sm:flex-row justify-between items-center gap-4;
    @apply bg-white/90 rounded-xl p-4 shadow-lg;
    backdrop-filter: blur(10px);
  }

  .export-btn {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg;
    @apply bg-gradient-to-r from-purple-50 to-pink-50 text-gray-700;
    @apply hover:from-purple-100 hover:to-pink-100;
    @apply transition-all duration-200 border border-purple-200/50;
  }
</style>