<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { periodStore, syncAllReferenceData } from '$lib/stores/referenceData.store';
  import { useToast } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import { Home, TrendingUp, CreditCard, BarChart3, DollarSign } from 'lucide-svelte';
  
  let loading = true;
  let stats = {
    totalBudget: 0,
    totalSpent: 0,
    remaining: 0,
    categories: 0
  };
  
  const toast = useToast();
  
  onMount(async () => {
    try {
      if ($currentUser) {
        await syncAllReferenceData($currentUser.user_id);
        // Here you would load actual dashboard data
        stats = {
          totalBudget: 50000,
          totalSpent: 32000,
          remaining: 18000,
          categories: 8
        };
      }
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить данные дашборда');
    } finally {
      loading = false;
    }
  });
  
  $: progressPercentage = stats.totalBudget > 0 ? (stats.totalSpent / stats.totalBudget) * 100 : 0;
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
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        Добро пожаловать, {$currentUser?.first_name || $currentUser?.username || 'Пользователь'}!
      </h1>
      <p class="text-gray-600">
        Обзор вашего семейного бюджета на сегодня
      </p>
    </div>

    <!-- Stats Cards Grid -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <!-- Total Budget -->
      <Card class="p-6 border-l-4 border-l-blue-500">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="p-3 bg-blue-100 rounded-full">
              <DollarSign class="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Общий бюджет</p>
            <p class="text-2xl font-bold text-gray-900">
              {stats.totalBudget.toLocaleString()} ₽
            </p>
          </div>
        </div>
      </Card>

      <!-- Total Spent -->
      <Card class="p-6 border-l-4 border-l-red-500">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="p-3 bg-red-100 rounded-full">
              <CreditCard class="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Потрачено</p>
            <p class="text-2xl font-bold text-gray-900">
              {stats.totalSpent.toLocaleString()} ₽
            </p>
          </div>
        </div>
      </Card>

      <!-- Remaining -->
      <Card class="p-6 border-l-4 border-l-green-500">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="p-3 bg-green-100 rounded-full">
              <TrendingUp class="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Остаток</p>
            <p class="text-2xl font-bold text-gray-900">
              {stats.remaining.toLocaleString()} ₽
            </p>
          </div>
        </div>
      </Card>

      <!-- Categories -->
      <Card class="p-6 border-l-4 border-l-purple-500">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="p-3 bg-purple-100 rounded-full">
              <BarChart3 class="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Категории</p>
            <p class="text-2xl font-bold text-gray-900">{stats.categories}</p>
          </div>
        </div>
      </Card>
    </div>

    <!-- Progress Section -->
    <Card class="p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        Прогресс использования бюджета
      </h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">Использовано</span>
          <span class="font-medium">{progressPercentage.toFixed(1)}%</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
          <div 
            class="h-3 rounded-full transition-all duration-300"
            class:bg-red-500={progressPercentage > 90}
            class:bg-yellow-500={progressPercentage > 70 && progressPercentage <= 90}
            class:bg-green-500={progressPercentage <= 70}
            style="width: {Math.min(progressPercentage, 100)}%"
          ></div>
        </div>
        <div class="flex justify-between text-xs text-gray-500">
          <span>0 ₽</span>
          <span>{stats.totalBudget.toLocaleString()} ₽</span>
        </div>
      </div>
    </Card>

    <!-- Quick Actions -->
    <Card class="p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        Быстрые действия
      </h3>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Button class="h-12 justify-start" href="/fact">
          <CreditCard class="h-5 w-5 mr-2" />
          Добавить расход
        </Button>
        
        <Button variant="outline" class="h-12 justify-start" href="/budget">
          <DollarSign class="h-5 w-5 mr-2" />
          Планировать бюджет
        </Button>
        
        <Button variant="outline" class="h-12 justify-start" href="/reports">
          <BarChart3 class="h-5 w-5 mr-2" />
          Посмотреть отчеты
        </Button>
        
        <Button variant="outline" class="h-12 justify-start" href="/products">
          <Home class="h-5 w-5 mr-2" />
          Управлять продуктами
        </Button>
      </div>
    </Card>
  </div>
{/if}