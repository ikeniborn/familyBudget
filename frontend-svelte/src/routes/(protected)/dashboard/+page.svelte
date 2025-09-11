<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore, currentUser } from '$lib/stores/auth.store';
  import { syncAllReferenceData } from '$lib/stores/referenceData.store';
  import { useToast } from '$lib/stores/toast.store';
  import { goto } from '$app/navigation';
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
    PieChart,
    Home
  } from 'lucide-svelte';
  
  let loading = true;
  
  // Mock data for demonstration - matches React structure
  let budgetSummary = {
    totalBudget: 150000,
    totalSpent: 87500,
    remaining: 62500,
    categories: [
      { id: 1, name: 'Продукты', budget: 40000, spent: 32000, color: 'bg-blue-500' },
      { id: 2, name: 'Транспорт', budget: 25000, spent: 18000, color: 'bg-green-500' },
      { id: 3, name: 'Развлечения', budget: 20000, spent: 22000, color: 'bg-red-500' },
      { id: 4, name: 'Коммунальные', budget: 35000, spent: 15500, color: 'bg-purple-500' },
    ]
  };
  
  let recentTransactions = [
    { id: 101, description: 'Покупка продуктов', amount: -2500, date: '2025-01-12', category: 'Продукты' },
    { id: 102, description: 'Зарплата', amount: 85000, date: '2025-01-10', category: 'Доходы' },
    { id: 103, description: 'Бензин', amount: -3200, date: '2025-01-09', category: 'Транспорт' },
    { id: 104, description: 'Кино', amount: -1800, date: '2025-01-08', category: 'Развлечения' },
  ];
  
  const toast = useToast();
  
  onMount(async () => {
    // Validate session first
    try {
      const isValid = await authStore.validateSession();
      if (!isValid) {
        // Session invalid, auth store will handle redirect
        return;
      }
    } catch (error) {
      console.error('Session validation failed:', error);
      // Let auth store handle redirect
      return;
    }
    
    // Set loading to false immediately so dashboard shows
    loading = false;
    
    // Load reference data in background (non-blocking)
    if ($currentUser?.id) {
      // Fire and forget - don't await, but handle auth errors
      syncAllReferenceData($currentUser.id).catch((error: any) => {
        // Check if it's an authentication error
        if (error?.message?.includes('Authentication')) {
          // Session expired, auth store will handle redirect
          return;
        }
        console.error('Failed to sync reference data:', error);
        toast.error('Справочные данные', 'Не удалось загрузить некоторые справочные данные. Они будут загружены при следующем использовании.');
      });
      
      // Here you would load actual dashboard data from API
      // For now we use mock data that matches the React version
    } else {
      // If no user found in store, try to fetch user data
      try {
        await authStore.checkAuth();
      } catch (error) {
        console.error('Failed to check auth:', error);
      }
    }
  });
</script>

<svelte:head>
  <title>Главная | Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    {#if loading}
      <div class="flex justify-center items-center min-h-[400px]">
        <Loading size="large" text="Загрузка дашборда..." />
      </div>
    {:else}
      <!-- Заголовок страницы -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon-wrapper">
            <Home class="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 class="page-title">
              Главная панель
            </h1>
            <p class="page-subtitle">
              Обзор вашего финансового состояния и быстрый доступ к функциям
            </p>
          </div>
        </div>
      </div>

      <!-- Основной контент -->
      <div class="main-content">
        <!-- Budget Overview Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div class="stat-card">
            <div class="stat-card-icon bg-gradient-to-br from-purple-500 to-pink-500">
              <Target class="h-6 w-6 text-white" />
            </div>
            <div class="stat-card-content">
              <p class="stat-label">Общий бюджет</p>
              <p class="stat-value">
                {budgetSummary.totalBudget.toLocaleString()} ₽
              </p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-icon bg-gradient-to-br from-orange-500 to-red-500">
              <CreditCard class="h-6 w-6 text-white" />
            </div>
            <div class="stat-card-content">
              <p class="stat-label">Потрачено</p>
              <p class="stat-value">
                {budgetSummary.totalSpent.toLocaleString()} ₽
              </p>
              <p class="stat-detail flex items-center mt-1">
                <TrendingDown class="h-3 w-3 mr-1" />
                58% от бюджета
              </p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-icon bg-gradient-to-br from-green-500 to-teal-500">
              <PiggyBank class="h-6 w-6 text-white" />
            </div>
            <div class="stat-card-content">
              <p class="stat-label">Остаток</p>
              <p class="stat-value">
                {budgetSummary.remaining.toLocaleString()} ₽
              </p>
              <p class="stat-detail flex items-center mt-1">
                <TrendingUp class="h-3 w-3 mr-1" />
                42% доступно
              </p>
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-card-icon bg-gradient-to-br from-blue-500 to-indigo-500">
              <Wallet class="h-6 w-6 text-white" />
            </div>
            <div class="stat-card-content">
              <p class="stat-label">Экономия</p>
              <p class="stat-value">
                {(budgetSummary.totalBudget - budgetSummary.totalSpent).toLocaleString()} ₽
              </p>
              <p class="stat-detail flex items-center mt-1">
                <DollarSign class="h-3 w-3 mr-1" />
                К концу месяца
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Quick Actions -->
          <div class="content-card">
            <h3 class="card-title">
              <Plus class="h-5 w-5" />
              Быстрые действия
            </h3>
            <p class="card-subtitle">
              Управляйте вашим бюджетом одним кликом
            </p>
            <div class="space-y-3">
              <a href="/fact" class="quick-action-btn">
                <CreditCard class="h-4 w-4" />
                Добавить расход
              </a>
              <a href="/budget" class="quick-action-btn">
                <Calculator class="h-4 w-4" />
                Создать бюджет
              </a>
              <a href="/reports" class="quick-action-btn">
                <BarChart3 class="h-4 w-4" />
                Посмотреть отчеты
              </a>
              <a href="/products" class="quick-action-btn">
                <Package class="h-4 w-4" />
                Управление товарами
              </a>
            </div>
          </div>

          <!-- Category Budget Progress -->
          <div class="content-card">
            <h3 class="card-title">
              <PieChart class="h-5 w-5" />
              Прогресс по категориям
            </h3>
            <p class="card-subtitle">
              Использование бюджета по основным категориям
            </p>
            <div class="space-y-4">
              {#each budgetSummary.categories as category (category.id)}
                {@const percentage = (category.spent / category.budget) * 100}
                {@const isOverBudget = percentage > 100}
                
                <div class="category-progress">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700">{category.name}</span>
                    <div class="flex items-center space-x-2">
                      {#if isOverBudget}
                        <AlertTriangle class="h-4 w-4 text-red-500" />
                      {/if}
                      <span class="text-sm font-semibold {isOverBudget ? 'text-red-500' : 'text-purple-600'}">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div class="progress-bar">
                    <div
                      class="progress-fill {isOverBudget ? 'bg-gradient-to-r from-red-400 to-red-600' : 'bg-gradient-to-r from-purple-400 to-pink-500'}"
                      style="width: {Math.min(percentage, 100)}%"
                    ></div>
                  </div>
                  <div class="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{category.spent.toLocaleString()} ₽</span>
                    <span>{category.budget.toLocaleString()} ₽</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- Recent Transactions -->
          <div class="content-card">
            <h3 class="card-title">
              <LineChart class="h-5 w-5" />
              Последние операции
            </h3>
            <p class="card-subtitle">
              Недавние доходы и расходы
            </p>
            <div class="space-y-3">
              {#each recentTransactions as transaction (transaction.id)}
                <div class="transaction-item">
                  <div class="flex-1">
                    <p class="font-medium text-sm text-gray-800">{transaction.description}</p>
                    <p class="text-xs text-gray-500">{transaction.category}</p>
                  </div>
                  <div class="text-right">
                    <p class="font-semibold {transaction.amount > 0 ? 'text-green-600' : 'text-gray-700'}">
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()} ₽
                    </p>
                    <p class="text-xs text-gray-500">{transaction.date}</p>
                  </div>
                </div>
              {/each}
              <a href="/fact" class="view-all-btn">
                Все операции
                <ArrowRight class="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    {/if}
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

  .main-content {
    @apply space-y-6;
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

  .stat-card {
    @apply bg-white/90 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200;
    @apply flex items-center gap-4;
    backdrop-filter: blur(10px);
  }

  .stat-card-icon {
    @apply w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0;
  }

  .stat-card-content {
    @apply flex-1;
  }

  .stat-label {
    @apply text-sm font-medium text-gray-600 mb-1;
  }

  .stat-value {
    @apply text-2xl font-bold text-gray-800;
  }

  .stat-detail {
    @apply text-xs text-gray-500;
  }

  .content-card {
    @apply bg-white/90 rounded-xl p-6 shadow-lg;
    backdrop-filter: blur(10px);
  }

  .card-title {
    @apply text-lg font-semibold mb-2 flex items-center gap-2 text-gray-800;
  }

  .card-subtitle {
    @apply text-sm text-gray-600 mb-4;
  }

  .quick-action-btn {
    @apply flex items-center gap-2 px-4 py-3 rounded-lg;
    @apply bg-gradient-to-r from-purple-50 to-pink-50 text-gray-700;
    @apply hover:from-purple-100 hover:to-pink-100;
    @apply transition-all duration-200 transform hover:-translate-y-0.5;
    @apply border border-purple-200/50;
  }

  .category-progress {
    @apply space-y-1;
  }

  .progress-bar {
    @apply w-full bg-gray-200 rounded-full h-2 overflow-hidden;
  }

  .progress-fill {
    @apply h-2 rounded-full transition-all duration-300;
  }

  .transaction-item {
    @apply flex items-center justify-between p-3;
    @apply bg-gradient-to-r from-purple-50/50 to-pink-50/50;
    @apply border border-purple-200/30 rounded-lg;
    @apply hover:border-purple-300/50 transition-colors;
  }

  .view-all-btn {
    @apply flex items-center justify-center gap-2 px-4 py-2;
    @apply text-purple-600 font-medium;
    @apply hover:text-purple-700 transition-colors;
  }
</style>