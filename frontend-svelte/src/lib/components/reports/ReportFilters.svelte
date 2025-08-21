<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { 
    periodStore, 
    financialCenterStore 
  } from '$lib/stores/referenceData.store';
  import { useToast } from '$lib/stores/toast.store';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { Filter, BarChart3 } from 'lucide-svelte';

  export let onApplyFilters: (filters: ReportFilters) => void;
  export let isLoading = false;

  export interface ReportFilters {
    period_id?: number;
    financial_center_id?: number;
    report_type: 'budget' | 'plan_fact';
  }

  let loading = true;
  let filters: ReportFilters = {
    report_type: 'plan_fact',
  };

  const toast = useToast();

  const reportTypeOptions = [
    { value: 'plan_fact', label: 'План-факт анализ' },
    { value: 'budget', label: 'Бюджет по статьям' },
  ];

  onMount(async () => {
    try {
      // Load reference data if not already loaded
      if ($periodStore.length === 0) {
        await periodStore.load($currentUser?.user_id || 0);
      }
      if ($financialCenterStore.length === 0) {
        await financialCenterStore.load($currentUser?.user_id || 0);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки данных фильтров:', error);
      toast.error('Ошибка', 'Не удалось загрузить данные для фильтров');
    } finally {
      loading = false;
    }
  });

  function handleFilterChange(key: keyof ReportFilters, value: string) {
    if (value === 'all') {
      filters = {
        ...filters,
        [key]: undefined,
      };
    } else {
      filters = {
        ...filters,
        [key]: key === 'report_type' ? value : parseInt(value),
      };
    }
  }

  function handleApplyFilters() {
    onApplyFilters(filters);
  }

  // Create options with "All" option
  $: periodOptions = [
    { value: 'all', label: 'Все периоды' },
    ...$periodStore.map(period => ({
      value: period.period_id.toString(),
      label: period.period_ru_name,
    })),
  ];

  $: financialCenterOptions = [
    { value: 'all', label: 'Все ФЦ' },
    ...$financialCenterStore.map(fc => ({
      value: fc.financial_center_id.toString(),
      label: fc.financial_center_name,
    })),
  ];
</script>

<Card class="border-l-4 border-l-purple-500">
  <div class="bg-gradient-to-r from-purple-50 to-blue-50 p-4 border-b">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
        <Filter class="h-5 w-5 text-purple-600" />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-slate-900">Фильтры отчетов</h2>
        <p class="text-sm text-slate-600">Настройте параметры для анализа данных</p>
      </div>
    </div>
  </div>

  <div class="p-6 space-y-4">
    {#if loading}
      <div class="text-center py-4">
        <div class="animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full mx-auto"></div>
        <p class="text-sm text-slate-600 mt-2">Загрузка фильтров...</p>
      </div>
    {:else}
      <!-- Report Type -->
      <div class="space-y-2">
        <label for="report-type" class="flex items-center gap-2 text-sm font-medium text-slate-700">
          <BarChart3 class="h-4 w-4" />
          Тип отчета
        </label>
        <select
          id="report-type"
          value={filters.report_type}
          on:change={(e) => handleFilterChange('report_type', e.currentTarget.value)}
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          {#each reportTypeOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Period Filter -->
      <div class="space-y-2">
        <label for="period" class="text-sm font-medium text-slate-700">Период</label>
        <select
          id="period"
          value={filters.period_id?.toString() || 'all'}
          on:change={(e) => handleFilterChange('period_id', e.currentTarget.value)}
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          {#each periodOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Financial Center Filter -->
      <div class="space-y-2">
        <label for="financial-center" class="text-sm font-medium text-slate-700">Финансовый центр</label>
        <select
          id="financial-center"
          value={filters.financial_center_id?.toString() || 'all'}
          on:change={(e) => handleFilterChange('financial_center_id', e.currentTarget.value)}
          class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        >
          {#each financialCenterOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Apply Button -->
      <Button
        on:click={handleApplyFilters}
        disabled={isLoading}
        class="w-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
      >
        {#if isLoading}
          <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          Загрузка...
        {:else}
          <Filter class="h-4 w-4" />
          Применить фильтры
        {/if}
      </Button>
    {/if}
  </div>
</Card>