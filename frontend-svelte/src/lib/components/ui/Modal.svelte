<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import Button from './Button.svelte';


  export let open: boolean = false;
  export let isOpen: boolean = false; // Support old API
  export let title: string = '';
  export let description: string = '';
  export let showCloseButton: boolean = true;
  export let size: 'small' | 'medium' | 'large' | 'extra-large' = 'medium';
  export let onclose: (() => void) | undefined = undefined;

  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  let modalElement: HTMLDialogElement;
  let mounted = false;
  
  // Support both open and isOpen props - исправляем логику
  $: actualOpen = open === true || isOpen === true;

  onMount(() => {
    mounted = true;
  });

  // Reactive statement to handle modal open/close
  $: if (modalElement && mounted) {
    if (actualOpen && !modalElement.open) {
      modalElement.showModal();
      document.body.style.overflow = 'hidden';
    } else if (!actualOpen && modalElement.open) {
      modalElement.close();
      document.body.style.overflow = 'auto';
    }
  }

  // Cleanup on destroy
  onDestroy(() => {
    if (modalElement && modalElement.open) {
      modalElement.close();
    }
    document.body.style.overflow = 'auto';
  });

  function handleClose() {
    // Don't modify props directly - just call callbacks
    if (onclose) {
      onclose();
    }
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === modalElement) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<dialog
  bind:this={modalElement}
  class="modal backdrop:bg-black/50 backdrop:backdrop-blur-sm"
  on:click={handleBackdropClick}
  on:keydown={handleKeydown}
  {...$$restProps}
>
  <div class="bg-white rounded-lg shadow-lg w-full max-h-[90vh] overflow-hidden {
    size === 'small' ? 'max-w-sm' :
    size === 'large' ? 'max-w-4xl' :
    size === 'extra-large' ? 'max-w-6xl' :
    'max-w-md'
  }">
    <!-- Header -->
    {#if title || showCloseButton}
      <div class="flex items-center justify-between p-6 border-b">
        <div>
          {#if title}
            <h2 class="text-lg font-semibold text-gray-900">{title}</h2>
          {/if}
          {#if description}
            <p class="text-sm text-gray-600 mt-1">{description}</p>
          {/if}
        </div>
        {#if showCloseButton}
          <Button variant="ghost" size="sm" onclick={handleClose}>
            <X class="h-4 w-4" />
          </Button>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="p-6 overflow-y-auto">
      <slot></slot>
    </div>

    <!-- Footer -->
    <div class="flex justify-end gap-2 p-6 border-t bg-gray-50">
      <slot name="footer"></slot>
    </div>
  </div>
</dialog>

<style>
  .modal {
    @apply fixed inset-0 z-50 flex items-center justify-center;
    border: none;
    padding: 1rem;
  }

  .modal::backdrop {
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
  }

  .modal[open] {
    display: flex;
  }
</style>