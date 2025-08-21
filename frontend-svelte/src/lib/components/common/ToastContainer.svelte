<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly, scale } from 'svelte/transition';
  import Toast from './Toast.svelte';
  import { toastStore } from '$lib/stores/toast.store';

  $: toasts = $toastStore.toasts;

  function handleClose(id: string) {
    toastStore.remove(id);
  }
</script>

<div
  aria-live="assertive"
  class="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 z-50"
>
  <div class="flex w-full flex-col items-center space-y-4 sm:items-end">
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
        />
      </div>
    {/each}
  </div>
</div>