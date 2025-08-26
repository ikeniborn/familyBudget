<script lang="ts">
  import { clsx } from 'clsx';

  interface Props {
    size?: 'small' | 'medium' | 'large';
    color?: 'primary' | 'white';
    fullScreen?: boolean;
    text?: string;
  }

  export let size: Props['size'] = 'medium';
  export let color: Props['color'] = 'primary';
  export let fullScreen: boolean = false;
  export let text: string | undefined = undefined;

  const sizeClasses = {
    small: 'h-4 w-4 border-2',
    medium: 'h-8 w-8 border-3',
    large: 'h-12 w-12 border-4'
  };

  const colorClasses = {
    primary: 'border-blue-600',
    white: 'border-white'
  };

  $: spinnerClass = clsx(
    'animate-spin rounded-full border-t-transparent',
    sizeClasses[size],
    colorClasses[color]
  );

  $: textClass = clsx(
    'mt-2 text-sm',
    color === 'white' ? 'text-white' : 'text-gray-600'
  );
</script>

{#if fullScreen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
    <div class="flex flex-col items-center">
      <div class={spinnerClass}></div>
      {#if text}
        <p class={textClass}>{text}</p>
      {/if}
    </div>
  </div>
{:else}
  <div class="flex flex-col items-center">
    <div class={spinnerClass}></div>
    {#if text}
      <p class={textClass}>{text}</p>
    {/if}
  </div>
{/if}