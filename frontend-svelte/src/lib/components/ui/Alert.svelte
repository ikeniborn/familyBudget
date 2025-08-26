<!--
  Alert component - уведомления для показа важной информации пользователям
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  interface Props {
    variant?: 'default' | 'destructive';
    title?: string;
    class?: string;
    icon?: string | null;
    [key: string]: any; // For rest props
  }

  export let variant: Props['variant'] = 'default';
  export let title: string = '';
  let className: string = '';
  export { className as class };
  export let icon: string | null = null;

  // Вычисляемые классы на основе варианта
  $: alertClasses = cn(
    'relative w-full rounded-lg border p-4',
    '[&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
    {
      'bg-background text-foreground': variant === 'default',
      'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive': variant === 'destructive'
    },
    className
  );
</script>

<div
  role="alert"
  class={alertClasses}
  {...$$restProps}
>
  <!-- Иконка (опционально) -->
  {#if icon}
    <svg
      class="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon} />
    </svg>
  {/if}

  <!-- Содержимое -->
  <div>
    {#if title}
      <h5 class="mb-1 font-medium leading-none tracking-tight">
        {title}
      </h5>
    {/if}
    
    <!-- Основное содержимое через slot -->
    <div class="text-sm [&_p]:leading-relaxed">
      <slot />
    </div>
  </div>
</div>