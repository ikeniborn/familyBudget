<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { errorStore } from '$lib/stores/error.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { AlertTriangle, RefreshCw } from 'lucide-svelte';

  let showDetails = false;

  function handleReset() {
    errorStore.clearError();
    window.location.reload();
  }

  function handleRetry() {
    errorStore.clearError();
  }

  function toggleDetails() {
    showDetails = !showDetails;
  }

  // Auto-clear errors after 30 seconds
  let timer: number | undefined;
  
  // Reactive statement to handle timer management
  $: if ($errorStore && !timer) {
    timer = setTimeout(() => {
      errorStore.clearError();
      timer = undefined;
    }, 30000);
  } else if (!$errorStore && timer) {
    clearTimeout(timer);
    timer = undefined;
  }

  // Cleanup timer on destroy
  onDestroy(() => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  });
</script>

{#if $errorStore}
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card class="max-w-md w-full p-6">
        <div class="text-center space-y-4">
          <div class="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle class="h-8 w-8 text-red-600" />
          </div>
          
          <div>
            <h2 class="text-xl font-semibold text-gray-900">
              Что-то пошло не так
            </h2>
            <p class="mt-2 text-sm text-gray-600">
              Произошла непредвиденная ошибка. Попробуйте повторить действие или обновить страницу.
            </p>
          </div>

          <div class="text-sm text-gray-700">
            <p><strong>Ошибка:</strong> {$errorStore.message}</p>
            {#if $errorStore.details}
              <p class="mt-1"><strong>Детали:</strong> {$errorStore.details}</p>
            {/if}
            <p class="mt-1 text-xs text-gray-500">
              {$errorStore.timestamp.toLocaleString()}
            </p>
          </div>

          {#if $errorStore.stack}
            <div class="text-left">
              <Button
                variant="outline"
                size="sm"
                onclick={toggleDetails}
                class="w-full mb-2"
              >
                {showDetails ? 'Скрыть' : 'Показать'} подробности
              </Button>
              
              {#if showDetails}
                <div class="bg-gray-50 p-3 rounded-lg">
                  <pre class="text-xs text-gray-600 overflow-auto whitespace-pre-wrap">
                    {$errorStore.stack}
                  </pre>
                </div>
              {/if}
            </div>
          {/if}

          <div class="flex space-x-2">
            <Button
              variant="outline"
              onclick={handleRetry}
              class="flex-1"
            >
              Повторить
            </Button>
            
            <Button
              onclick={handleReset}
              class="flex-1"
            >
              <RefreshCw class="h-4 w-4 mr-2" />
              Обновить
            </Button>
          </div>
        </div>
      </Card>
    </div>
{:else}
  <slot />
{/if}