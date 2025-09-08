<script lang="ts">
  import { Settings, AlertCircle } from 'lucide-svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import SettingsNavigation from '$lib/components/settings/SettingsNavigation.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

  let showAccessDeniedAlert = false;
  let accessDeniedMessage = '';

  onMount(() => {
    // Check for access denied error in URL params
    const error = $page.url.searchParams.get('error');
    const message = $page.url.searchParams.get('message');
    
    if (error === 'access_denied' && message) {
      showAccessDeniedAlert = true;
      accessDeniedMessage = decodeURIComponent(message);
      
      // Remove the error params from URL after showing message
      const url = new URL($page.url);
      url.searchParams.delete('error');
      url.searchParams.delete('message');
      history.replaceState({}, '', url);
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
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">12</div>
      <div class="text-sm text-gray-600">Активных периодов</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">5</div>
      <div class="text-sm text-gray-600">Финансовых центров</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">23</div>
      <div class="text-sm text-gray-600">Категорий</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">156</div>
      <div class="text-sm text-gray-600">Продуктов</div>
    </div>
  </div>
</div>