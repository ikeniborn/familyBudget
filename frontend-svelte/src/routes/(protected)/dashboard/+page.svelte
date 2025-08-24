<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { syncAllReferenceData } from '$lib/stores/referenceData.store';
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
    AlertTriangle,
    Wallet,
    TrendingUpIcon as LineChart,
    PieChart
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
    <!-- Welcome Section with Geometric Accent -->
    <div class="mb-8 relative">
      <div class="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-navy/10 to-sky/10 rounded-full opacity-50"></div>
      <div class="absolute top-4 left-4 w-8 h-8 bg-navy/20 rotate-45 rounded-sm"></div>
      <h1 class="text-3xl font-bold text-navy-dark mb-2 relative z-10">Добро пожаловать в Family Budget</h1>
      <p class="text-steel-dark relative z-10">
        Вот краткий обзор вашего финансового состояния на сегодня
      </p>
    </div>

    <!-- Budget Overview Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <Card variant="navy">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-steel-dark">Общий бюджет</p>
              <p class="text-2xl font-bold text-navy-dark">
                {budgetSummary.totalBudget.toLocaleString()} ₽
              </p>
            </div>
            <div class="financial-icon navy sm">
              <Target class="h-6 w-6" />
            </div>
          </div>
        </div>
      </Card>

      <Card variant="steel">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-steel-dark">Потрачено</p>
              <p class="text-2xl font-bold text-navy-dark">
                {budgetSummary.totalSpent.toLocaleString()} ₽
              </p>
              <p class="text-xs text-steel flex items-center mt-1">
                <TrendingDown class="h-3 w-3 mr-1" />
                58% от бюджета
              </p>
            </div>
            <div class="financial-icon steel sm">
              <CreditCard class="h-6 w-6" />
            </div>
          </div>
        </div>
      </Card>

      <Card variant="sky">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-steel-dark">Остаток</p>
              <p class="text-2xl font-bold text-navy-dark">
                {budgetSummary.remaining.toLocaleString()} ₽
              </p>
              <p class="text-xs text-sky flex items-center mt-1">
                <TrendingUp class="h-3 w-3 mr-1" />
                42% доступно
              </p>
            </div>
            <div class="financial-icon sky sm">
              <PiggyBank class="h-6 w-6" />
            </div>
          </div>
        </div>
      </Card>

      <Card variant="beige">
        <div class="p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-steel-dark">Экономия</p>
              <p class="text-2xl font-bold text-navy-dark">
                {(budgetSummary.totalBudget - budgetSummary.totalSpent).toLocaleString()} ₽
              </p>
              <p class="text-xs text-beige flex items-center mt-1">
                <DollarSign class="h-3 w-3 mr-1" />
                К концу месяца
              </p>
            </div>
            <div class="financial-icon beige sm">
              <Wallet class="h-6 w-6" />
            </div>
          </div>
        </div>
      </Card>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Quick Actions -->
      <Card variant="elevated">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 flex items-center text-navy-dark">
            <div class="financial-icon navy sm mr-3">
              <Plus class="h-4 w-4" />
            </div>
            Быстрые действия
          </h3>
          <p class="text-sm text-steel-dark mb-4">
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
      <Card variant="elevated">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 flex items-center text-navy-dark">
            <div class="financial-icon sky sm mr-3">
              <PieChart class="h-4 w-4" />
            </div>
            Прогресс по категориям
          </h3>
          <p class="text-sm text-steel-dark mb-4">
            Использование бюджета по основным категориям
          </p>
          <div class="space-y-4">
            {#each budgetSummary.categories as category}
              {@const percentage = (category.spent / category.budget) * 100}
              {@const isOverBudget = percentage > 100}
              
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-navy-dark">{category.name}</span>
                  <div class="flex items-center space-x-2">
                    {#if isOverBudget}
                      <AlertTriangle class="h-4 w-4 text-red-500" />
                    {/if}
                    <Badge variant={isOverBudget ? "destructive" : "secondary"}>
                      {percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div class="w-full bg-steel/20 rounded-full h-2">
                  <div
                    class="h-2 rounded-full {isOverBudget ? 'bg-steel' : 'bg-sky'}"
                    style="width: {Math.min(percentage, 100)}%"
                  ></div>
                </div>
                <div class="flex justify-between text-xs text-steel">
                  <span>{category.spent.toLocaleString()} ₽</span>
                  <span>{category.budget.toLocaleString()} ₽</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </Card>

      <!-- Recent Transactions -->
      <Card variant="elevated">
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 flex items-center text-navy-dark">
            <div class="financial-icon beige sm mr-3">
              <LineChart class="h-4 w-4" />
            </div>
            Последние операции
          </h3>
          <p class="text-sm text-steel-dark mb-4">
            Недавние доходы и расходы
          </p>
          <div class="space-y-3">
            {#each recentTransactions as transaction}
              <div class="flex items-center justify-between p-3 border border-steel/20 rounded-lg hover:border-navy/30 transition-colors">
                <div class="flex-1">
                  <p class="font-medium text-sm text-navy-dark">{transaction.description}</p>
                  <p class="text-xs text-steel">{transaction.category}</p>
                </div>
                <div class="text-right">
                  <p class="font-semibold {transaction.amount > 0 ? 'text-sky' : 'text-steel'}">
                    {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()} ₽
                  </p>
                  <p class="text-xs text-steel">{transaction.date}</p>
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