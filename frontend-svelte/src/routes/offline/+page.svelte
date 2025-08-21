<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { WifiOff, RefreshCw, Home } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  let isOnline = true;
  let retryCount = 0;

  onMount(() => {
    if (!browser) return;

    isOnline = navigator.onLine;

    const handleOnline = () => {
      isOnline = true;
      retryCount = 0;
      // Automatically redirect to dashboard when back online
      setTimeout(() => {
        goto('/dashboard');
      }, 1000);
    };

    const handleOffline = () => {
      isOnline = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  });

  const retryConnection = async () => {
    retryCount++;
    
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        isOnline = true;
        goto('/dashboard');
      } else {
        throw new Error('Server not responding');
      }
    } catch (error) {
      console.log('Still offline:', error);
      // Show feedback that retry failed
      setTimeout(() => {
        // Reset button state after showing feedback
      }, 1000);
    }
  };

  const goHome = () => {
    goto('/dashboard');
  };
</script>

<svelte:head>
  <title>Офлайн - Family Budget</title>
  <meta name="description" content="Приложение работает в офлайн режиме" />
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4">
  <Card class="w-full max-w-md mx-auto text-center">
    <div class="p-8">
      <!-- Offline icon -->
      <div class="mx-auto mb-6 p-4 bg-orange-100 rounded-full w-fit">
        <WifiOff class="w-8 h-8 text-orange-600" />
      </div>

      <!-- Title and description -->
      <h1 class="text-xl font-bold text-gray-900 mb-2">
        Нет подключения к интернету
      </h1>
      
      <p class="text-gray-600 mb-6">
        Проверьте подключение к интернету и попробуйте еще раз. 
        Некоторые функции могут быть доступны в офлайн режиме.
      </p>

      <!-- Connection status -->
      <div class="mb-6 p-3 rounded-lg {isOnline ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}">
        <div class="flex items-center justify-center gap-2 text-sm font-medium">
          <div class="w-2 h-2 rounded-full {isOnline ? 'bg-green-500' : 'bg-red-500'}"></div>
          {isOnline ? 'Подключение восстановлено' : 'Нет подключения'}
        </div>
      </div>

      <!-- Action buttons -->
      <div class="space-y-3">
        <Button 
          class="w-full" 
          on:click={retryConnection}
          disabled={isOnline}
        >
          <RefreshCw class="w-4 h-4 mr-2" />
          Повторить попытку
          {#if retryCount > 0}
            ({retryCount})
          {/if}
        </Button>

        <Button 
          variant="outline" 
          class="w-full" 
          on:click={goHome}
        >
          <Home class="w-4 h-4 mr-2" />
          На главную
        </Button>
      </div>

      <!-- Offline features info -->
      <div class="mt-8 p-4 bg-blue-50 rounded-lg text-left">
        <h3 class="font-semibold text-blue-900 mb-2">Доступно офлайн:</h3>
        <ul class="text-sm text-blue-800 space-y-1">
          <li>• Просмотр ранее загруженных данных</li>
          <li>• Создание записей (синхронизируются при подключении)</li>
          <li>• Просмотр сохраненных отчетов</li>
        </ul>
      </div>

      <!-- Tips -->
      <div class="mt-6 text-xs text-gray-500">
        <p>Совет: добавьте приложение на главный экран для лучшей работы офлайн</p>
      </div>
    </div>
  </Card>
</div>

<style>
  /* Add subtle animation for the connection status */
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>