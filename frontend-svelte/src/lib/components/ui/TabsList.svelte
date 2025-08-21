<!--
  TabsList component - контейнер для кнопок вкладок
  Часть системы компонентов Tabs
-->
<script lang="ts">
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils/cn';

  // Props
  export let className = '';

  // Получаем контекст вкладок
  const tabsContext = getContext<{
    activeTab: any;
    orientation: 'horizontal' | 'vertical';
  }>('tabs');

  const { orientation } = tabsContext || { orientation: 'horizontal' };

  // Вычисляемые классы
  $: listClasses = cn(
    'inline-flex items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
    {
      'h-10': orientation === 'horizontal',
      'flex-col h-auto w-auto': orientation === 'vertical'
    },
    className
  );
</script>

<div
  class={listClasses}
  role="tablist"
  aria-orientation={orientation}
>
  <slot />
</div>