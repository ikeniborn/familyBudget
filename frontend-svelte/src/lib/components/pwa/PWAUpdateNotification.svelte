<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { RefreshCw, X } from 'lucide-svelte';

  let showUpdatePrompt = false;
  let registration: ServiceWorkerRegistration | null = null;
  let isUpdating = false;

  onMount(() => {
    if (!browser || !('serviceWorker' in navigator)) return;

    // Listen for service worker updates
    const handleSWUpdate = (event: CustomEvent) => {
      registration = event.detail;
      showUpdatePrompt = true;
    };

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATE_AVAILABLE') {
        showUpdatePrompt = true;
      }
    });

    // Check for updates periodically
    const checkForUpdates = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.update();
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };

    // Check for updates every 30 minutes
    const updateInterval = setInterval(checkForUpdates, 30 * 60 * 1000);

    // Initial check
    setTimeout(checkForUpdates, 1000);

    return () => {
      clearInterval(updateInterval);
    };
  });

  const handleUpdateClick = async () => {
    if (!registration || !registration.waiting) return;

    isUpdating = true;

    // Tell the service worker to skip waiting and activate
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Listen for the activation
    const handleActivate = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleActivate, {
      once: true
    });

    // Fallback: reload after 3 seconds
    setTimeout(() => {
      if (isUpdating) {
        window.location.reload();
      }
    }, 3000);
  };

  const dismissUpdate = () => {
    showUpdatePrompt = false;
  };
</script>

{#if showUpdatePrompt}
  <div class="fixed top-4 right-4 z-50 max-w-sm">
    <Card class="border-0 bg-white shadow-2xl">
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 p-2 bg-green-100 rounded-full">
            <RefreshCw class="w-5 h-5 text-green-600" />
          </div>
          
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold text-gray-900">
              Обновление доступно
            </h3>
            <p class="mt-1 text-xs text-gray-600">
              Новая версия приложения готова к установке
            </p>
            
            <div class="flex gap-2 mt-3">
              <Button 
                size="sm" 
                class="text-xs px-3 py-1"
                disabled={isUpdating}
                on:click={handleUpdateClick}
              >
                {#if isUpdating}
                  <RefreshCw class="w-3 h-3 animate-spin mr-1" />
                  Обновление...
                {:else}
                  Обновить
                {/if}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                class="text-xs px-3 py-1"
                on:click={dismissUpdate}
                disabled={isUpdating}
              >
                Позже
              </Button>
            </div>
          </div>
          
          <button
            type="button"
            class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
            on:click={dismissUpdate}
            disabled={isUpdating}
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  </div>
{/if}