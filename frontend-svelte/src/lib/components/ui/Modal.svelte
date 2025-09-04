<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { X } from 'lucide-svelte';
  import Button from './Button.svelte';

  // Props with Svelte 4 syntax
  export let open: boolean = false;
  export let isOpen: boolean = false; // Support old API
  export let title: string = '';
  export let description: string = '';
  export let showCloseButton: boolean = true;
  export let size: 'small' | 'medium' | 'large' | 'extra-large' = 'medium';
  export let onclose: () => void = () => {};
  
  // Support both open and isOpen props
  $: actualOpen = open === true || isOpen === true;

  // Handle body scroll lock
  $: if (typeof document !== 'undefined') {
    if (actualOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }

  onDestroy(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto';
    }
  });

  function handleClose() {
    open = false;
    isOpen = false;
    onclose();
  }

  function handleBackdropClick(event: MouseEvent) {
    // Only close if clicking directly on the backdrop
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && actualOpen) {
      handleClose();
    }
  }

  // Add global keydown listener
  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if actualOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div 
    class="modal-backdrop"
    on:click={handleBackdropClick}
  >
    <div class="modal-container {
      size === 'small' ? 'max-w-sm' :
      size === 'large' ? 'max-w-4xl' :
      size === 'extra-large' ? 'max-w-6xl' :
      'max-w-md'
    }">
      <!-- Header -->
      {#if title || showCloseButton}
        <div class="modal-header">
          <div>
            {#if title}
              <h2 class="modal-title">{title}</h2>
            {/if}
            {#if description}
              <p class="modal-description">{description}</p>
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
      <div class="modal-content">
        <slot></slot>
      </div>

      <!-- Footer -->
      {#if $$slots.footer}
        <div class="modal-footer">
          <slot name="footer"></slot>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: fadeIn 200ms ease-out;
  }

  .modal-container {
    position: relative;
    width: 100%;
    max-height: 90vh;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
    animation: slideUp 200ms ease-out;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .modal-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .modal-content {
    padding: 1.5rem;
    overflow-y: auto;
    max-height: calc(90vh - 8rem);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translateY(10px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .modal-backdrop {
      padding: 0;
    }
    
    .modal-container {
      max-height: 100vh;
      border-radius: 0;
    }
    
    .modal-content {
      max-height: calc(100vh - 8rem);
    }
  }
</style>