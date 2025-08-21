<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { periodStore, syncAllReferenceData } from '$lib/stores/referenceData.store';
  import { useToast } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    CreditCard, 
    Calculator, 
    BarChart3, 
    Package,
    Plus,
    ArrowRight,
    Target,
    PiggyBank,
    AlertTriangle
  } from 'lucide-svelte';
  
  let loading = true;
  
  // Mock data for demonstration - matches React structure
  let budgetSummary = {
    totalBudget: 150000,
    totalSpent: 87500,
    remaining: 62500,
    categories: [
      { name: 'Продукты', budget: 40000, spent: 32000, color: 'bg-blue-500' },
      { name: 'Транспорт', budget: 25000, spent: 18000, color: 'bg-green-500' },
      { name: 'Развлечения', budget: 20000, spent: 22000, color: 'bg-red-500' },
      { name: 'Коммунальные', budget: 35000, spent: 15500, color: 'bg-purple-500' },
    ]
  };
  
  let recentTransactions = [
    { id: 1, description: 'Покупка продуктов', amount: -2500, date: '2025-01-12', category: 'Продукты' },
    { id: 2, description: 'Зарплата', amount: 85000, date: '2025-01-10', category: 'Доходы' },
    { id: 3, description: 'Бензин', amount: -3200, date: '2025-01-09', category: 'Транспорт' },
    { id: 4, description: 'Кино', amount: -1800, date: '2025-01-08', category: 'Развлечения' },
  ];
  
  const toast = useToast();
  
  onMount(async () => {
    try {
      if ($currentUser) {
        await syncAllReferenceData($currentUser.user_id);
        // Here you would load actual dashboard data from API
        // For now we use mock data that matches the React version
      }
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить данные дашборда');
    } finally {
      loading = false;
    }
  });
  
  $: progressPercentage = budgetSummary.totalBudget > 0 ? (budgetSummary.totalSpent / budgetSummary.totalBudget) * 100 : 0;
</script>

<svelte:head>
  <title>Главная - Family Budget</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center min-h-[400px]">
    <Loading size="large" text="Загрузка дашборда..." />
  </div>
{:else}
  <div class="space-y-6">
    <!-- Welcome Section -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-slate-900 mb-2">Добро пожаловать! 👋</h1>
      <p class="text-slate-600">
        Вот краткий обзор вашего финансового состояния на сегодня
      </p>
    </div>

    <!-- Budget Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card class="border-l-4 border-l-blue-500">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Общий бюджет</p>
              <p class="text-2xl font-bold text-slate-900">
                {budgetSummary.totalBudget.toLocaleString()} ₽
              </p>
            </div>
            <div class="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Target class="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </Card>

      <Card class="border-l-4 border-l-red-500">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Потрачено</p>
              <p class="text-2xl font-bold text-slate-900">
                {budgetSummary.totalSpent.toLocaleString()} ₽
              </p>
              <p class="text-xs text-red-600 flex items-center mt-1">
                <TrendingDown class="h-3 w-3 mr-1" />
                58% от бюджета
              </p>
            </div>
            <div class="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <CreditCard class="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </Card>

      <Card class="border-l-4 border-l-green-500">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Остаток</p>
              <p class="text-2xl font-bold text-slate-900">
                {budgetSummary.remaining.toLocaleString()} ₽
              </p>
              <p class="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp class="h-3 w-3 mr-1" />
                42% доступно
              </p>
            </div>
            <div class="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
              <PiggyBank class="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </Card>

      <Card class="border-l-4 border-l-purple-500">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Экономия</p>
              <p class="text-2xl font-bold text-slate-900">
                {(budgetSummary.totalBudget - budgetSummary.totalSpent).toLocaleString()} ₽
              </p>
              <p class="text-xs text-purple-600 flex items-center mt-1">
                <DollarSign class="h-3 w-3 mr-1" />
                К концу месяца
              </p>
            </div>
            <div class="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp class="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <Card>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 flex items-center">
            <Plus class="h-5 w-5 mr-2" />
            Быстрые действия
          </h3>
          <p class="text-sm text-slate-600 mb-4">
            Управляйте вашим бюджетом одним кликом
          </p>
          <div class="space-y-3">
            <Button href="/fact" variant="outline" class="w-full justify-start">
              <CreditCard class="h-4 w-4 mr-2" />
              Добавить расход
            </Button>
            <Button href="/budget" variant="outline" class="w-full justify-start">
              <Calculator class="h-4 w-4 mr-2" />
              Создать бюджет
            </Button>
            <Button href="/reports" variant="outline" class="w-full justify-start">
              <BarChart3 class="h-4 w-4 mr-2" />
              Посмотреть отчеты
            </Button>
            <Button href="/products" variant="outline" class="w-full justify-start">
              <Package class="h-4 w-4 mr-2" />
              Управление товарами
            </Button>
          </div>
        </div>
      </Card>

      <!-- Category Budget Progress -->
      <Card>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">Прогресс по категориям</h3>
          <p class="text-sm text-slate-600 mb-4">
            Использование бюджета по основным категориям
          </p>
          <div class="space-y-4">
            {#each budgetSummary.categories as category}
              {@const percentage = (category.spent / category.budget) * 100}
              {@const isOverBudget = percentage > 100}
              
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{category.name}</span>
                  <div class="flex items-center space-x-2">
                    {#if isOverBudget}
                      <AlertTriangle class="h-4 w-4 text-red-500" />
                    {/if}
                    <Badge variant={isOverBudget ? "destructive" : "secondary"}>
                      {percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-2">
                  <div
                    class="h-2 rounded-full {isOverBudget ? 'bg-red-500' : category.color}"
                    style="width: {Math.min(percentage, 100)}%"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-slate-600">
                  <span>{category.spent.toLocaleString()} ₽</span>
                  <span>{category.budget.toLocaleString()} ₽</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </Card>

      <!-- Recent Transactions -->
      <Card>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">Последние операции</h3>
          <p class="text-sm text-slate-600 mb-4">
            Недавние доходы и расходы
          </p>
          <div class="space-y-3">
            {#each recentTransactions as transaction}
              <div class="flex items-center justify-between p-3 border rounded-lg">
                <div class="flex-1">
                  <p class="font-medium text-sm">{transaction.description}</p>
                  <p class="text-xs text-slate-500">{transaction.category}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold {transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}">
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()} ₽
                  </p>
                  <p class="text-xs text-slate-500">{transaction.date}</p>
                </div>
              </div>
            {/each}
            <Button href="/fact" variant="ghost" class="w-full">
              Все операции
              <ArrowRight class="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>
{/if}