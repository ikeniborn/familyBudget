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
    TrendingUp, 
    TrendingDown, 
    Calendar, 
    Building, 
    Tag, 
    DollarSign,
    RefreshCw
  } from 'lucide-svelte';

  interface ExtendedRegistry extends Registry {
    period_name?: string;
    financial_center_name?: string;
    cost_center_name?: string;
    nomenclature_name?: string;
  }

  let budget: ExtendedRegistry[] = [];
  let isLoading = true;
  let isRefreshing = false;

  const toast = useToast();

  // Table columns configuration
  const columns = [
    {
      key: 'operation_dttm',
      title: 'Дата',
      sortable: true,
      format: (value: string) => new Date(value).toLocaleDateString('ru-RU')
    },
    {
      key: 'period_name',
      title: 'Период',
      sortable: true
    },
    {
      key: 'operation_type',
      title: 'Тип',
      sortable: false,
      component: 'badge'
    },
    {
      key: 'financial_center_name',
      title: 'Финансовый центр',
      sortable: true
    },
    {
      key: 'cost_center_name',
      title: 'МВЗ',
      sortable: true,
      format: (value: string | null) => value || '—'
    },
    {
      key: 'nomenclature_name',
      title: 'Номенклатура',
      sortable: true
    },
    {
      key: 'cost_sum',
      title: 'Сумма',
      sortable: true,
      component: 'currency'
    },
    {
      key: 'comment_description',
      title: 'Комментарий',
      sortable: false,
      component: 'comment'
    }
  ];

  onMount(() => {
    loadBudget();
  });

  async function loadBudget() {
    try {
      isLoading = true;
      const data = await registryService.getBudget({ limit: 50 });
      budget = data.map(item => ({
        ...item,
        operation_type: item.cost_sum > 0 ? 'expense' : 'income'
      }));
    } catch (error: any) {
      console.error('Ошибка загрузки бюджета:', error);
      toast.error('Ошибка', error.message || 'Не удалось загрузить планы бюджета');
    } finally {
      isLoading = false;
    }
  }

  async function handleRefresh() {
    isRefreshing = true;
    await loadBudget();
    isRefreshing = false;
  }

  function formatOperationType(item: ExtendedRegistry) {
    const amount = item.cost_sum;
    const isExpense = amount > 0;
    return {
      text: isExpense ? 'Расход' : 'Доход',
      variant: isExpense ? 'destructive' : 'success',
      icon: isExpense ? TrendingDown : TrendingUp
    };
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
  $: totalExpenses = budget.filter(item => item.cost_sum > 0).reduce((sum, item) => sum + item.cost_sum, 0);
  $: totalIncomes = Math.abs(budget.filter(item => item.cost_sum < 0).reduce((sum, item) => sum + item.cost_sum, 0));
  $: netBudget = totalIncomes - totalExpenses;
</script>

<div class="space-y-6">
  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card class="border-l-4 border-l-green-500">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-600">Планируемые доходы</p>
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
            <p class="text-sm font-medium text-slate-600">Планируемые расходы</p>
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

    <Card class="border-l-4 border-l-blue-500">
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-slate-600">Чистый бюджет</p>
            <p class="text-xl font-bold {netBudget >= 0 ? 'text-green-600' : 'text-red-600'}">
              {formatCurrency(netBudget)}
            </p>
          </div>
          <div class="h-10 w-10 {netBudget >= 0 ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center">
            <DollarSign class="h-5 w-5 {netBudget >= 0 ? 'text-green-600' : 'text-red-600'}" />
          </div>
        </div>
      </div>
    </Card>
  </div>

  <!-- Budget Table -->
  <Card class="border-l-4 border-l-purple-500">
    <div class="bg-gradient-to-r from-purple-50 to-blue-50 p-4 border-b flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
          <Calendar class="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Запланированный бюджет</h2>
          <p class="text-sm text-slate-600">Список всех запланированных доходов и расходов</p>
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
          <Loading size="large" text="Загрузка бюджета..." />
        </div>
      {:else if budget.length === 0}
        <div class="text-center py-12">
          <div class="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar class="h-8 w-8 text-slate-400" />
          </div>
          <h3 class="text-lg font-medium text-slate-900 mb-2">Бюджет пуст</h3>
          <p class="text-slate-600 mb-4">Создайте свой первый план доходов или расходов</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-slate-200">
                {#each columns as column}
                  <th class="text-left py-3 px-4 font-medium text-slate-700">
                    {column.title}
                  </th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each budget as item, index}
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

        {#if budget.length >= 50}
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