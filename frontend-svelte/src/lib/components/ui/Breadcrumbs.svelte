<!--
  Breadcrumbs component - навигационная цепочка
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  // Типы
  export interface BreadcrumbItem {
    label: string;
    href?: string;
    current?: boolean;
    disabled?: boolean;
  }

  // Props
  export let items: BreadcrumbItem[] = [];
  export let separator = '/';
  export let className = '';
  export let maxItems: number | undefined = undefined;
  export let showCollapsed = true;

  // Обработка ограничения количества элементов
  $: displayItems = maxItems && items.length > maxItems && showCollapsed
    ? [
        ...items.slice(0, 1),
        { label: '...', disabled: true },
        ...items.slice(-maxItems + 2)
      ]
    : items;

  // Вычисляемые классы
  $: breadcrumbsClasses = cn(
    'flex items-center space-x-1 text-sm text-muted-foreground',
    className
  );
</script>

<nav
  aria-label="Breadcrumb"
  class={breadcrumbsClasses}
>
  <ol class="flex items-center space-x-1">
    {#each displayItems as item, index (item.label + index)}
      <li class="flex items-center">
        {#if item.href && !item.current && !item.disabled}
          <a
            href={item.href}
            class="hover:text-foreground transition-colors"
            aria-current={item.current ? 'page' : undefined}
          >
            {item.label}
          </a>
        {:else}
          <span
            class={cn(
              {
                'text-foreground font-medium': item.current,
                'cursor-default': item.disabled,
                'text-muted-foreground': !item.current && !item.disabled
              }
            )}
            aria-current={item.current ? 'page' : undefined}
          >
            {item.label}
          </span>
        {/if}

        <!-- Separator -->
        {#if index < displayItems.length - 1}
          <span
            class="mx-2 text-muted-foreground/50"
            aria-hidden="true"
          >
            {separator}
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>