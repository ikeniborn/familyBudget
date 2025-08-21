<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { registryService } from '$lib/services/registry.service';
  import ReportFilters, { type ReportFilters as ReportFiltersType } from '$lib/components/reports/ReportFilters.svelte';
  import PlanFactChart from '$lib/components/reports/PlanFactChart.svelte';
  import BudgetTable from '$lib/components/reports/BudgetTable.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { 
    BarChart3, 
    Download, 
    TrendingUp, 
    Calculator, 
    CreditCard,
    FileSpreadsheet
  } from 'lucide-svelte';

  let loading = false;
  let currentFilters: ReportFiltersType = { report_type: 'plan_fact' };
  
  // Mock data - in real app would come from API
  let planFactData: any[] = [];
  let budgetTableData: any[] = [];

  const toast = useToast();

  async function handleApplyFilters(filters: ReportFiltersType) {
    loading = true;
    currentFilters = filters;
    
    try {
      // In a real implementation, you would call the API with these filters
      if (filters.report_type === 'plan_fact') {
        await loadPlanFactData(filters);
      } else {
        await loadBudgetTableData(filters);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки отчета:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить отчет');
    } finally {
      loading = false;
    }
  }

  async function loadPlanFactData(filters: ReportFiltersType) {
    // Mock implementation - replace with real API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    planFactData = [
      {
        category: 'Продукты питания',
        plan: 50000,
        fact: 47500,
        variance: -2500,
        variance_percent: -5.0
      },
      {
        category: 'Транспорт',
        plan: 25000,
        fact: 28000,
        variance: 3000,
        variance_percent: 12.0
      },
      {
        category: 'Развлечения',
        plan: 15000,
        fact: 18500,
        variance: 3500,
        variance_percent: 23.3
      },
      {
        category: 'Коммунальные услуги',
        plan: 20000,
        fact: 19800,
        variance: -200,
        variance_percent: -1.0
      },
      {
        category: 'Одежда',
        plan: 12000,
        fact: 8500,
        variance: -3500,
        variance_percent: -29.2
      }
    ];
  }

  async function loadBudgetTableData(filters: ReportFiltersType) {
    // Mock implementation - replace with real API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    budgetTableData = [
      {
        category: 'Продукты питания',
        period: 'Январь 2025',
        planned_income: 0,
        planned_expense: 50000,
        actual_income: 0,
        actual_expense: 47500,
        income_variance: 0,
        expense_variance: -2500,
        execution_rate: 95.0
      },
      {
        category: 'Зарплата',
        period: 'Январь 2025',
        planned_income: 120000,
        planned_expense: 0,
        actual_income: 120000,
        actual_expense: 0,
        income_variance: 0,
        expense_variance: 0,
        execution_rate: 100.0
      },
      {
        category: 'Транспорт',
        period: 'Январь 2025',
        planned_income: 0,
        planned_expense: 25000,
        actual_income: 0,
        actual_expense: 28000,
        income_variance: 0,
        expense_variance: 3000,
        execution_rate: 112.0
      }
    ];
  }

  async function handleExport(format: 'csv' | 'excel') {
    try {
      toast.success('Экспорт', `Начинается экспорт в формате ${format.toUpperCase()}`);
      
      // In real implementation, call the API export endpoint
      if (currentFilters.report_type === 'plan_fact') {
        // await registryService.export(format, currentFilters);
        console.log('Exporting plan-fact data as', format);
      } else {
        // await registryService.export(format, currentFilters);
        console.log('Exporting budget table as', format);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate export
      toast.success('Успешно', `Данные экспортированы в формате ${format.toUpperCase()}`);
    } catch (error: any) {
      console.error('Ошибка экспорта:', error);
      toast.error('Ошибка', error.message || 'Не удалось экспортировать данные');
    }
  }

  onMount(() => {
    // Load initial data
    handleApplyFilters({ report_type: 'plan_fact' });
  });
</script>

<svelte:head>
  <title>Отчеты - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div class="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
            <BarChart3 class="h-6 w-6 text-purple-600" />
          </div>
          Отчеты и аналитика
        </h1>
        <p class="text-slate-600 mt-2 ml-15">Анализ планов и фактических данных</p>
      </div>
      <div class="flex items-center gap-3">
        <Button
          href="/budget"
          variant="outline"
          class="flex items-center gap-2"
        >
          <Calculator class="h-4 w-4" />
          План
        </Button>
        <Button
          href="/fact"
          variant="outline"
          class="flex items-center gap-2"
        >
          <CreditCard class="h-4 w-4" />
          Факт
        </Button>
      </div>
    </div>

    <!-- Layout: Filters + Content -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Filters Sidebar -->
      <div class="lg:col-span-1">
        <ReportFilters 
          onApplyFilters={handleApplyFilters}
          isLoading={loading}
        />
      </div>

      <!-- Main Content -->
      <div class="lg:col-span-3 space-y-6">
        {#if currentFilters.report_type === 'plan_fact'}
          <PlanFactChart 
            data={planFactData}
            title="Анализ план-факт по категориям"
            loading={loading}
          />
        {:else}
          <BudgetTable 
            data={budgetTableData}
            title="Детальный анализ бюджета"
            loading={loading}
            onExport={handleExport}
          />
        {/if}

        <!-- Quick Actions -->
        {#if !loading && (planFactData.length > 0 || budgetTableData.length > 0)}
          <div class="flex justify-center">
            <div class="flex items-center gap-3">
              <Button
                on:click={() => handleExport('csv')}
                variant="outline"
                class="flex items-center gap-2"
              >
                <Download class="h-4 w-4" />
                Экспорт CSV
              </Button>
              <Button
                on:click={() => handleExport('excel')}
                variant="outline"
                class="flex items-center gap-2"
              >
                <FileSpreadsheet class="h-4 w-4" />
                Экспорт Excel
              </Button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>