<!--
  Tabs component - компонент вкладок для организации контента
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { createEventDispatcher, setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { cn } from '$lib/utils/cn';

  // Props
  export let value = '';
  export let defaultValue = '';
  export let className = '';
  export let orientation: 'horizontal' | 'vertical' = 'horizontal';

  const dispatch = createEventDispatcher<{
    change: { value: string };
  }>();

  // Инициализация активной вкладки
  if (!value && defaultValue) {
    value = defaultValue;
  }

  // Store для управления состоянием вкладок
  const activeTab = writable(value);
  const tabsContext = {
    activeTab,
    setActiveTab: (newValue: string) => {
      value = newValue;
      activeTab.set(newValue);
      dispatch('change', { value: newValue });
    },
    orientation
  };

  // Предоставляем контекст дочерним компонентам
  setContext('tabs', tabsContext);

  // Синхронизируем внешнее значение с внутренним состоянием
  $: activeTab.set(value);
</script>

<div
  class={cn(
    'tabs',
    {
      'flex flex-col': orientation === 'vertical',
      'w-full': orientation === 'horizontal'
    },
    className
  )}
  role="tablist"
  aria-orientation={orientation}
>
  <slot />
</div>