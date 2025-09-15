<script lang="ts">
  import { Settings, AlertCircle, Loader2 } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SettingsNavigation from '$lib/components/settings/SettingsNavigation.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import { dashboardService, type ReferenceDataStats } from '$lib/services/dashboard.service';

  let showAccessDeniedAlert = false;
  let accessDeniedMessage = '';

  // Reference data statistics state
  let referenceStats: ReferenceDataStats | null = null;
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    // Check for access denied error in URL params
    const errorParam = $page.url.searchParams.get('error');
    const message = $page.url.searchParams.get('message');

    if (errorParam === 'access_denied' && message) {
      showAccessDeniedAlert = true;
      accessDeniedMessage = decodeURIComponent(message);

      // Remove the error params from URL after showing message
      const url = new URL($page.url);
      url.searchParams.delete('error');
      url.searchParams.delete('message');
      history.replaceState({}, '', url);
    }

    // Fetch reference data statistics
    try {
      referenceStats = await dashboardService.getReferenceDataStats();
    } catch (err: any) {
      error = err.message || 'Ошибка при загрузке статистики';
    } finally {
      loading = false;
    }
  });

  const dismissAlert = () => {
    showAccessDeniedAlert = false;
  };
</script>

<svelte:head>
  <title>Настройки системы - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <!-- Access Denied Alert -->
  {#if showAccessDeniedAlert}
    <Alert variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <div class="flex items-center justify-between">
        <span>{accessDeniedMessage}</span>
        <button 
          on:click={dismissAlert}
          class="ml-4 text-destructive hover:text-destructive/80"
          aria-label="Закрыть"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Alert>
  {/if}

  <!-- Header -->
  <div class="border-b pb-4">
    <div class="flex items-center gap-3">
      <Settings class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-3xl font-bold text-slate-900">
          Настройки системы
        </h1>
        <p class="text-slate-600 mt-1">
          Управление справочниками и настройками приложения
        </p>
      </div>
    </div>
  </div>

  <!-- Navigation Cards -->
  <SettingsNavigation />

  <!-- Quick Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
    {#if error}
      <div class="col-span-2 md:col-span-4">
        <Alert variant="destructive">
          <AlertCircle class="h-4 w-4" />
          <span>Ошибка загрузки статистики: {error}</span>
        </Alert>
      </div>
    {:else}
      <!-- Active Periods -->
      <div class="bg-white rounded-lg border p-4">
        <div class="text-2xl font-bold text-gray-900">
          {#if loading}
            <Loader2 class="h-6 w-6 animate-spin text-gray-400" />
          {:else}
            {referenceStats?.active_periods ?? 0}
          {/if}
        </div>
        <div class="text-sm text-gray-600">Активных периодов</div>
      </div>

      <!-- Financial Centers -->
      <div class="bg-white rounded-lg border p-4">
        <div class="text-2xl font-bold text-gray-900">
          {#if loading}
            <Loader2 class="h-6 w-6 animate-spin text-gray-400" />
          {:else}
            {referenceStats?.financial_centers ?? 0}
          {/if}
        </div>
        <div class="text-sm text-gray-600">Финансовых центров</div>
      </div>

      <!-- Nomenclatures (Categories) -->
      <div class="bg-white rounded-lg border p-4">
        <div class="text-2xl font-bold text-gray-900">
          {#if loading}
            <Loader2 class="h-6 w-6 animate-spin text-gray-400" />
          {:else}
            {referenceStats?.nomenclatures ?? 0}
          {/if}
        </div>
        <div class="text-sm text-gray-600">Категорий</div>
      </div>

      <!-- Products -->
      <div class="bg-white rounded-lg border p-4">
        <div class="text-2xl font-bold text-gray-900">
          {#if loading}
            <Loader2 class="h-6 w-6 animate-spin text-gray-400" />
          {:else}
            {referenceStats?.products ?? 0}
          {/if}
        </div>
        <div class="text-sm text-gray-600">Продуктов</div>
      </div>
    {/if}
  </div>
</div>