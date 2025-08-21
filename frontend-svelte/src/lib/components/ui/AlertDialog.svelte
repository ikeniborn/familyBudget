<!--
  AlertDialog component - модальное диалоговое окно для подтверждения действий
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import Button from './Button.svelte';
  import { cn } from '$lib/utils/cn';

  // Props
  export let open = false;
  export let title = '';
  export let description = '';
  export let destructive = false;
  export let cancelText = 'Отмена';
  export let actionText = 'Подтвердить';
  export let disabled = false;
  
  // CSS classes
  export let className = '';
  export let overlayClass = '';
  export let contentClass = '';
  export let headerClass = '';
  export let footerClass = '';
  export let titleClass = '';
  export let descriptionClass = '';

  const dispatch = createEventDispatcher<{
    cancel: void;
    confirm: void;
    close: void;
  }>();

  let dialogElement: HTMLDialogElement;

  // Управление открытием/закрытием
  $: if (dialogElement) {
    if (open) {
      dialogElement.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialogElement.close();
      document.body.style.overflow = '';
    }
  }

  // Обработчики событий
  function handleCancel() {
    open = false;
    dispatch('cancel');
    dispatch('close');
  }

  function handleConfirm() {
    open = false;
    dispatch('confirm');
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialogElement) {
      handleCancel();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleCancel();
    }
  }

  onMount(() => {
    return () => {
      document.body.style.overflow = '';
    };
  });
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
  bind:this={dialogElement}
  class={cn('modal', className)}
  on:click={handleBackdropClick}
  on:keydown={handleKeydown}
>
  {#if open}
    <!-- Overlay -->
    <div
      class={cn(
        'fixed inset-0 z-50 bg-black/80',
        overlayClass
      )}
      transition:fade={{ duration: 200 }}
    />
    
    <!-- Dialog Content -->
    <div
      class={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
        contentClass
      )}
      transition:scale={{ duration: 200, start: 0.95 }}
      role="alertdialog"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <!-- Header -->
      <div
        class={cn(
          'flex flex-col space-y-2 text-center sm:text-left',
          headerClass
        )}
      >
        {#if title}
          <h2
            id="alert-dialog-title"
            class={cn(
              'text-lg font-semibold',
              titleClass
            )}
          >
            {title}
          </h2>
        {/if}
        
        {#if description}
          <p
            id="alert-dialog-description"
            class={cn(
              'text-sm text-muted-foreground',
              descriptionClass
            )}
          >
            {description}
          </p>
        {/if}
      </div>

      <!-- Slot для кастомного контента -->
      <slot />

      <!-- Footer -->
      <div
        class={cn(
          'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
          footerClass
        )}
      >
        <Button
          variant="outline"
          class="mt-2 sm:mt-0"
          on:click={handleCancel}
          {disabled}
        >
          {cancelText}
        </Button>
        
        <Button
          variant={destructive ? 'destructive' : 'default'}
          on:click={handleConfirm}
          {disabled}
        >
          {actionText}
        </Button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .modal {
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    max-width: none;
    max-height: none;
  }

  .modal::backdrop {
    display: none;
  }
</style>