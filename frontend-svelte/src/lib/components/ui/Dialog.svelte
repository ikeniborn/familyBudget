<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { X } from 'lucide-svelte';

  export let open: boolean = false;
  export let title: string = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
  export let closable: boolean = true;
  export let closeOnEscape: boolean = true;
  export let closeOnClickOutside: boolean = true;
  export let persistent: boolean = false;
  export let loading: boolean = false;

  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{
    open: void;
    close: void;
    confirm: void;
    cancel: void;
  }>();

  let dialogElement: HTMLDivElement;
  let lastActiveElement: HTMLElement | null = null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4'
  };

  $: if (open) {
    handleOpen();
  } else {
    handleClose();
  }

  function handleOpen() {
    // Store the currently focused element
    lastActiveElement = document.activeElement as HTMLElement;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    dispatch('open');
    
    // Focus the dialog
    setTimeout(() => {
      const focusableElement = dialogElement?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      
      if (focusableElement) {
        focusableElement.focus();
      } else {
        dialogElement?.focus();
      }
    }, 0);
  }

  function handleClose() {
    // Restore body scroll
    document.body.style.overflow = '';
    
    // Restore focus to the previously focused element
    if (lastActiveElement) {
      lastActiveElement.focus();
      lastActiveElement = null;
    }
    
    dispatch('close');
  }

  function closeDialog() {
    if (persistent || loading) return;
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!open) return;

    if (event.key === 'Escape' && closeOnEscape) {
      closeDialog();
      event.preventDefault();
    }

    // Trap focus within dialog
    if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function trapFocus(event: KeyboardEvent) {
    if (!dialogElement) return;

    const focusableElements = dialogElement.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    ) as NodeListOf<HTMLElement>;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable?.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable?.focus();
        event.preventDefault();
      }
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget && closeOnClickOutside) {
      closeDialog();
    }
  }

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
    closeDialog();
  }

  onMount(() => {
    // Add global event listeners
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  onDestroy(() => {
    // Cleanup on component destroy
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleKeydown);
  });

  $: backdropClass = twMerge(
    clsx(
      'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
      'transition-opacity duration-200',
      open ? 'opacity-100' : 'opacity-0 pointer-events-none'
    )
  );

  $: dialogClass = twMerge(
    clsx(
      'relative w-full rounded-lg bg-white shadow-xl',
      'transform transition-all duration-200',
      open ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
      sizeClasses[size],
      className
    )
  );

  $: headerClass = twMerge(
    clsx(
      'flex items-center justify-between p-6 border-b border-gray-200'
    )
  );

  $: bodyClass = twMerge(
    clsx(
      'p-6',
      loading && 'relative'
    )
  );

  $: footerClass = twMerge(
    clsx(
      'flex items-center justify-end space-x-3 p-6 border-t border-gray-200'
    )
  );
</script>

{#if open}
  <div 
    class={backdropClass}
    on:click={handleBackdropClick}
    role="presentation"
  >
    <div
      bind:this={dialogElement}
      class={dialogClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'dialog-title' : undefined}
      tabindex="-1"
      on:click|stopPropagation
    >
      <!-- Loading overlay -->
      {#if loading}
        <div class="absolute inset-0 bg-white/50 flex items-center justify-center z-10 rounded-lg">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      {/if}

      <!-- Header -->
      {#if $$slots.header || title || closable}
        <div class={headerClass}>
          <div class="flex-1">
            {#if $$slots.header}
              <slot name="header" />
            {:else if title}
              <h2 id="dialog-title" class="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            {/if}
          </div>
          
          {#if closable}
            <button
              type="button"
              class="ml-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-1"
              on:click={closeDialog}
              disabled={loading}
            >
              <X size={20} />
            </button>
          {/if}
        </div>
      {/if}

      <!-- Body -->
      <div class={bodyClass}>
        <slot />
      </div>

      <!-- Footer -->
      {#if $$slots.footer}
        <div class={footerClass}>
          <slot name="footer" {handleConfirm} {handleCancel} {loading} />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(body.dialog-open) {
    overflow: hidden;
  }
</style>