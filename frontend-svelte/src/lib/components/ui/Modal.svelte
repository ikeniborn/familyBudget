<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import Button from './Button.svelte';

  export let open = false;
  export let title = '';
  export let description = '';
  export let showCloseButton = true;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let modalElement: HTMLDialogElement;

  $: if (modalElement) {
    if (open) {
      modalElement.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      modalElement.close();
      document.body.style.overflow = 'auto';
    }
  }

  function handleClose() {
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

  onMount(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<dialog
  bind:this={modalElement}
  class="modal backdrop:bg-black/50 backdrop:backdrop-blur-sm"
  on:click={handleBackdropClick}
  on:keydown={handleKeydown}
>
  <div class="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden">
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
          <Button variant="ghost" size="sm" on:click={handleClose}>
            <X class="h-4 w-4" />
          </Button>
        {/if}
      </div>
    {/if}

    <!-- Content -->
    <div class="p-6 overflow-y-auto">
      <slot />
    </div>

    <!-- Footer -->
    {#if $$slots.footer}
      <div class="flex justify-end gap-2 p-6 border-t bg-gray-50">
        <slot name="footer" />
      </div>
    {/if}
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