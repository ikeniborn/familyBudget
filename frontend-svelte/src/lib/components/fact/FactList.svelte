<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { registryService, type Registry } from '$lib/services/registry.service';
  import Card from '$lib/components/ui/Card.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { 
    CreditCard, 
    Calendar, 
    Building, 
    Tag, 
    DollarSign,
    RefreshCw,
    Receipt,
    TrendingDown,
    TrendingUp,
    Wallet
  } from 'lucide-svelte';

  interface ExtendedRegistry extends Registry {
    period_name?: string;
    financial_center_name?: string;
    cost_center_name?: string;
    nomenclature_name?: string;
  }

  let facts: ExtendedRegistry[] = [];
  let isLoading = true;
  let isRefreshing = false;

  const toast = useToast();

  onMount(() => {
    loadFacts();
  });

  async function loadFacts() {
    try {
      isLoading = true;
      const data = await registryService.getFacts({ limit: 50 });
      facts = data;
    } catch (error: any) {
      console.error('Ошибка загрузки фактов:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить фактические операции');
    } finally {
      isLoading = false;
    }
  }

  async function handleRefresh() {
    isRefreshing = true;
    await loadFacts();
    isRefreshing = false;
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(Math.abs(amount));
  }

  function formatComment(comment: string | null) {
    if (!comment) return '—';
    return comment.length > 50 ? `${comment.substring(0, 50)}...` : comment;
  }

  // Calculate totals
  $: totalExpenses = facts.filter(item => item.cost_sum > 0).reduce((sum, item) => sum + item.cost_sum, 0);
  $: totalIncomes = Math.abs(facts.filter(item => item.cost_sum < 0).reduce((sum, item) => sum + item.cost_sum, 0));
  $: netBalance = totalIncomes - totalExpenses;
</script>

<div class="space-y-6">
  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card class="border-l-4 border-l-green-500">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-600">Фактические доходы</p>
            <p class="text-xl font-bold text-green-600">
              {formatCurrency(totalIncomes)}
            </p>
          </div>
          <div class="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
            <TrendingUp class="h-5 w-5 text-green-600" />
          </div>
        </div>
      </div>
    </Card>

    <Card class="border-l-4 border-l-red-500">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-600">Фактические расходы</p>
            <p class="text-xl font-bold text-red-600">
              {formatCurrency(totalExpenses)}
            </p>
          </div>
          <div class="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
            <TrendingDown class="h-5 w-5 text-red-600" />
          </div>
        </div>
      </div>
    </Card>

    <Card class="border-l-4 border-l-purple-500">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-600">Чистый баланс</p>
            <p class="text-xl font-bold {netBalance >= 0 ? 'text-green-600' : 'text-red-600'}">
              {formatCurrency(netBalance)}
            </p>
          </div>
          <div class="h-10 w-10 {netBalance >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center">
            <Wallet class="h-5 w-5 {netBalance >= 0 ? 'text-green-600' : 'text-red-600'}" />
          </div>
        </div>
      </div>
    </Card>
  </div>

  <!-- Facts Table -->
  <Card class="border-l-4 border-l-blue-500">
    <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
          <Receipt class="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Фактические операции</h2>
          <p class="text-sm text-slate-600">Список всех выполненных операций доходов и расходов</p>
        </div>
      </div>
      <button
        on:click={handleRefresh}
        disabled={isRefreshing}
        class="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50"
      >
        <RefreshCw class="h-4 w-4 {isRefreshing ? 'animate-spin' : ''}" />
        Обновить
      </button>
    </div>

    <div class="p-6">
      {#if isLoading}
        <div class="flex justify-center items-center py-12">
          <Loading size="large" text="Загрузка операций..." />
        </div>
      {:else if facts.length === 0}
        <div class="text-center py-12">
          <div class="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt class="h-8 w-8 text-slate-400" />
          </div>
          <h3 class="text-lg font-medium text-slate-900 mb-2">Операций пока нет</h3>
          <p class="text-slate-600 mb-4">Добавьте свою первую фактическую операцию</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200">
                <th class="text-left py-3 px-4 font-medium text-slate-700">Дата</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Период</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Тип</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Финансовый центр</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">МВЗ</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Номенклатура</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Сумма</th>
                <th class="text-left py-3 px-4 font-medium text-slate-700">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {#each facts as item, index}
                <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td class="py-3 px-4">
                    {new Date(item.operation_dttm).toLocaleDateString('ru-RU')}
                  </td>
                  <td class="py-3 px-4">
                    {item.period_name || '—'}
                  </td>
                  <td class="py-3 px-4">
                    {#if item.cost_sum > 0}
                      <Badge variant="destructive" class="flex items-center gap-1 w-fit">
                        <TrendingDown class="h-3 w-3" />
                        Расход
                      </Badge>
                    {:else}
                      <Badge variant="success" class="flex items-center gap-1 w-fit">
                        <TrendingUp class="h-3 w-3" />
                        Доход
                      </Badge>
                    {/if}
                  </td>
                  <td class="py-3 px-4">
                    {item.financial_center_name || '—'}
                  </td>
                  <td class="py-3 px-4">
                    {item.cost_center_name || '—'}
                  </td>
                  <td class="py-3 px-4">
                    {item.nomenclature_name || '—'}
                  </td>
                  <td class="py-3 px-4 font-medium">
                    <span class="{item.cost_sum > 0 ? 'text-red-600' : 'text-green-600'}">
                      {formatCurrency(item.cost_sum)}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    {#if item.comment_description}
                      <span class="text-sm text-slate-600" title={item.comment_description}>
                        {formatComment(item.comment_description)}
                      </span>
                    {:else}
                      <span class="text-slate-400">—</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        {#if facts.length >= 50}
          <div class="text-center py-4 border-t border-slate-200">
            <p class="text-sm text-slate-600">
              Показаны первые 50 записей. Используйте фильтры для уточнения поиска.
            </p>
          </div>
        {/if}
      {/if}
    </div>
  </Card>
</div>