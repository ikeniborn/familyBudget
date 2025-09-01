<script lang="ts">
  import { onMount } from 'svelte';
  import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-svelte';
  import { clsx } from 'clsx';
  import type { ToastType } from '$lib/stores/toast.store';

  interface Props {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
    onClose: (id: string) => void;
    isExpanded?: boolean;
  }

  export let id: string;
  export let type: ToastType;
  export let title: string;
  export let message: string | undefined = undefined;
  export let duration: number = 5000;
  export let onClose: (id: string) => void;
  export let isExpanded: boolean = false;

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const styles = {
    success: {
      bg: 'bg-green-50',
      icon: 'text-green-400',
      title: 'text-green-800',
      message: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50',
      icon: 'text-red-400',
      title: 'text-red-800',
      message: 'text-red-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-400',
      title: 'text-yellow-800',
      message: 'text-yellow-700',
    },
    info: {
      bg: 'bg-blue-50',
      icon: 'text-blue-400',
      title: 'text-blue-800',
      message: 'text-blue-700',
    },
  };

  $: Icon = icons[type];
  $: style = styles[type];

  onMount(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  });

  function handleClose() {
    onClose(id);
  }
</script>

<div
  class={clsx(
    'pointer-events-auto w-full overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 transform transition-all duration-300 ease-in-out',
    isExpanded ? 'max-w-none' : 'sm:max-w-sm md:max-w-md lg:max-w-lg',
    !isExpanded && 'hover:scale-105',
    'hover:shadow-xl',
    style.bg
  )}
>
  <div class={clsx('p-4', isExpanded && 'sm:p-6')}>
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <Icon class={clsx(isExpanded ? 'h-6 w-6' : 'h-5 w-5', style.icon)} />
      </div>
      <div class="ml-3 w-0 flex-1">
        <p class={clsx(isExpanded ? 'text-base font-semibold' : 'text-sm font-medium', style.title)}>{title}</p>
        {#if message}
          <p class={clsx('mt-1', isExpanded ? 'text-base' : 'text-sm', style.message)}>{message}</p>
        {/if}
      </div>
      <div class="ml-4 flex flex-shrink-0">
        <button
          type="button"
          class={clsx(
            'inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:bg-black hover:bg-opacity-5',
            style.title
          )}
          onclick={handleClose}
        >
          <span class="sr-only">Закрыть</span>
          <X class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</div>