<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly, scale } from 'svelte/transition';
  import Toast from './Toast.svelte';
  import { toastStore } from '$lib/stores/toast.store';
  import { Maximize2, Minimize2 } from 'lucide-svelte';

  $: toasts = $toastStore.toasts;
  
  let isExpanded = false;

  function handleClose(id: string) {
    toastStore.remove(id);
  }
  
  function toggleExpanded() {
    isExpanded = !isExpanded;
  }
</script>

<div
  aria-live="assertive"
  class="pointer-events-none fixed inset-0 flex items-end px-2 py-4 sm:px-4 sm:py-6 sm:items-start sm:p-6 z-50"
>
  <div 
    class="flex flex-col items-center space-y-4 sm:items-end ml-auto transition-all duration-300 ease-in-out {isExpanded 
      ? 'w-full sm:w-1/2 max-w-none' 
      : 'w-full max-w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl'}"
  >
    {#if toasts.length > 0}
      <button
        onclick={toggleExpanded}
        type="button"
        class="pointer-events-auto mb-2 p-2 rounded-lg bg-white shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 hover:text-gray-800"
        title={isExpanded ? 'Свернуть уведомления' : 'Развернуть уведомления'}
      >
        {#if isExpanded}
          <Minimize2 class="h-5 w-5" />
        {:else}
          <Maximize2 class="h-5 w-5" />
        {/if}
      </button>
    {/if}
    
    <div class="w-full space-y-4 {isExpanded ? 'max-h-[80vh] overflow-y-auto pr-2' : ''}">
      {#each toasts as toast (toast.id)}
        <div
          animate:flip={{ duration: 200 }}
          in:fly={{ x: 300, duration: 300 }}
          out:scale={{ duration: 200, start: 0.8 }}
        >
          <Toast
            id={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            duration={toast.duration}
            onClose={handleClose}
            {isExpanded}
          />
        </div>
      {/each}
    </div>
  </div>
</div>