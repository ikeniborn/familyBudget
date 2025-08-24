<script lang="ts">
  import { onMount } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { 
    Table, 
    Download, 
    FileSpreadsheet, 
    TrendingUp, 
    TrendingDown,
    AlertTriangle,
    CheckCircle
  } from 'lucide-svelte';

  import type { BudgetTableData, PlanFactReportData } from '$lib/types';

  export let data: BudgetTableData[] | PlanFactReportData[] = [];
  export let title = 'Бюджетная таблица';
  export let loading = false;
  export let onExport: ((format: 'csv' | 'excel' | 'pdf') => Promise<void>) | undefined = undefined;

  let sortColumn: keyof BudgetTableData | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';
  let searchTerm = '';
  let isExporting = false;

  // Filter data based on search term - make it flexible for different data types
  $: filteredData = data.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    // Check if item has expected fields
    if ('category' in item && 'period' in item) {
      return item.category.toLowerCase().includes(searchLower) ||
             item.period.toLowerCase().includes(searchLower);
    }
    // For PlanFactReportData and other types, check available string fields
    if ('name' in item) {
      return item.name.toLowerCase().includes(searchLower);
    }
    if ('period_name' in item) {
      return item.period_name.toLowerCase().includes(searchLower);
    }
    return true;
  });

  // Sort data
  $: sortedData = sortColumn 
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortColumn as keyof BudgetTableData];
        const bVal = b[sortColumn as keyof BudgetTableData];
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc' 
            ? aVal.localeCompare(bVal, 'ru')
            : bVal.localeCompare(aVal, 'ru');
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return 0;
      })
    : filteredData;

  function handleSort(column: keyof BudgetTableData) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  async function handleExport(format: 'csv' | 'excel') {
    if (!onExport) return;
    
    isExporting = true;
    try {
      await onExport(format);
    } finally {
      isExporting = false;
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  }

  function getExecutionRateBadge(rate: number): { variant: string, icon: any, text: string } {
    if (rate >= 90) {
      return { variant: 'success', icon: CheckCircle, text: 'Отлично' };
    } else if (rate >= 70) {
      return { variant: 'default', icon: TrendingUp, text: 'Хорошо' };
    } else {
      return { variant: 'destructive', icon: AlertTriangle, text: 'Низкий' };
    }
  }

  // Calculate totals
  $: totals = filteredData.reduce((acc, item) => ({
    planned_income: acc.planned_income + item.planned_income,
    planned_expense: acc.planned_expense + item.planned_expense,
    actual_income: acc.actual_income + item.actual_income,
    actual_expense: acc.actual_expense + item.actual_expense,
    income_variance: acc.income_variance + item.income_variance,
    expense_variance: acc.expense_variance + item.expense_variance,
  }), {
    planned_income: 0,
    planned_expense: 0,
    actual_income: 0,
    actual_expense: 0,
    income_variance: 0,
    expense_variance: 0,
  });

  $: averageExecutionRate = filteredData.length > 0 
    ? filteredData.reduce((sum, item) => sum + item.execution_rate, 0) / filteredData.length
    : 0;
</script>

<Card class="border-l-4 border-l-green-500">
  <div class="bg-gradient-to-r from-green-50 to-blue-50 p-4 border-b">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
          <Table class="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-900">{title}</h2>
          <p class="text-sm text-slate-600">Детальный анализ исполнения бюджета</p>
        </div>
      </div>
      
      {#if onExport && data.length > 0}
        <div class="flex items-center gap-2">
          <Button
            on:click={() => handleExport('csv')}
            disabled={isExporting}
            variant="outline"
            class="flex items-center gap-2 text-sm"
          >
            <Download class="h-4 w-4" />
            CSV
          </Button>
          <Button
            on:click={() => handleExport('excel')}
            disabled={isExporting}
            variant="outline"
            class="flex items-center gap-2 text-sm"
          >
            <FileSpreadsheet class="h-4 w-4" />
            Excel
          </Button>
        </div>
      {/if}
    </div>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin h-8 w-8 border-2 border-green-600 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-slate-600">Загрузка таблицы...</span>
      </div>
    {:else if data.length === 0}
      <div class="text-center py-12">
        <div class="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Table class="h-8 w-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-medium text-slate-900 mb-2">Нет данных</h3>
        <p class="text-slate-600">Выберите период и примените фильтры для отображения таблицы</p>
      </div>
    {:else}
      <!-- Search and Summary -->
      <div class="mb-6 space-y-4">
        <!-- Search -->
        <div class="flex items-center gap-4">
          <input
            type="text"
            bind:value={searchTerm}
            placeholder="Поиск по категории или периоду..."
            class="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span class="text-sm text-slate-600">{filteredData.length} из {data.length}</span>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 rounded-lg p-3">
            <p class="text-xs font-medium text-blue-800">Планируемые доходы</p>
            <p class="text-lg font-bold text-blue-900">{formatCurrency(totals.planned_income)}</p>
          </div>
          <div class="bg-red-50 rounded-lg p-3">
            <p class="text-xs font-medium text-red-800">Планируемые расходы</p>
            <p class="text-lg font-bold text-red-900">{formatCurrency(totals.planned_expense)}</p>
          </div>
          <div class="bg-green-50 rounded-lg p-3">
            <p class="text-xs font-medium text-green-800">Фактические доходы</p>
            <p class="text-lg font-bold text-green-900">{formatCurrency(totals.actual_income)}</p>
          </div>
          <div class="bg-purple-50 rounded-lg p-3">
            <p class="text-xs font-medium text-purple-800">Средняя исполнимость</p>
            <p class="text-lg font-bold text-purple-900">{averageExecutionRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto border border-slate-200 rounded-lg">
        <table class="w-full">
          <thead class="bg-slate-50">
            <tr>
              <th class="text-left py-3 px-4">
                <button
                  on:click={() => handleSort('category')}
                  class="flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
                >
                  Категория
                  {#if sortColumn === 'category'}
                    <span class="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
              </th>
              <th class="text-left py-3 px-4">
                <button
                  on:click={() => handleSort('period')}
                  class="flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
                >
                  Период
                  {#if sortColumn === 'period'}
                    <span class="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
              </th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">План доходы</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">План расходы</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">Факт доходы</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">Факт расходы</th>
              <th class="text-center py-3 px-4 font-medium text-slate-700">Исполнение</th>
            </tr>
          </thead>
          <tbody>
            {#each sortedData as item, index}
              <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td class="py-3 px-4 font-medium text-slate-900">{item.category}</td>
                <td class="py-3 px-4 text-slate-600">{item.period}</td>
                <td class="py-3 px-4 text-right text-blue-600">{formatCurrency(item.planned_income)}</td>
                <td class="py-3 px-4 text-right text-red-600">{formatCurrency(item.planned_expense)}</td>
                <td class="py-3 px-4 text-right text-green-600">{formatCurrency(item.actual_income)}</td>
                <td class="py-3 px-4 text-right text-orange-600">{formatCurrency(item.actual_expense)}</td>
                <td class="py-3 px-4 text-center">
                  {#if item.execution_rate >= 0}
                    {@const badge = getExecutionRateBadge(item.execution_rate)}
                    <div class="flex items-center justify-center gap-2">
                      <Badge variant={badge.variant} class="flex items-center gap-1">
                        <svelte:component this={badge.icon} class="h-3 w-3" />
                        {item.execution_rate.toFixed(0)}%
                      </Badge>
                    </div>
                  {:else}
                    <span class="text-slate-400">N/A</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
          
          <!-- Totals Row -->
          <tfoot class="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td class="py-3 px-4 font-bold text-slate-900" colspan="2">Итого</td>
              <td class="py-3 px-4 text-right font-bold text-blue-600">{formatCurrency(totals.planned_income)}</td>
              <td class="py-3 px-4 text-right font-bold text-red-600">{formatCurrency(totals.planned_expense)}</td>
              <td class="py-3 px-4 text-right font-bold text-green-600">{formatCurrency(totals.actual_income)}</td>
              <td class="py-3 px-4 text-right font-bold text-orange-600">{formatCurrency(totals.actual_expense)}</td>
              <td class="py-3 px-4 text-center font-bold text-purple-600">{averageExecutionRate.toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {#if isExporting}
        <div class="text-center py-4">
          <p class="text-sm text-slate-600">Экспорт данных...</p>
        </div>
      {/if}
    {/if}
  </div>
</Card>