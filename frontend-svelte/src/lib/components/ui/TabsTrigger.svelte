<!--
  TabsTrigger component - кнопка для переключения вкладок
  Часть системы компонентов Tabs
-->
<script lang="ts">
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils/cn';

  // Props
  export let value = '';
  export let disabled = false;
  export let className = '';

  // Получаем контекст вкладок
  const tabsContext = getContext<{
    activeTab: any;
    setActiveTab: (value: string) => void;
    orientation: 'horizontal' | 'vertical';
  }>('tabs');

  if (!tabsContext) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }

  const { activeTab, setActiveTab, orientation } = tabsContext;

  // Обработчик клика
  function handleClick() {
    if (!disabled) {
      setActiveTab(value);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
      event.preventDefault();
      setActiveTab(value);
    }
  }

  // Вычисляемые классы
  $: triggerClasses = cn(
    'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    {
      'bg-background text-foreground shadow-sm': $activeTab === value,
      'hover:bg-muted/50': $activeTab !== value && !disabled,
      'w-full': orientation === 'vertical'
    },
    className
  );
</script>

<button
  type="button"
  class={triggerClasses}
  role="tab"
  aria-selected={$activeTab === value}
  aria-controls="tabpanel-{value}"
  tabindex={$activeTab === value ? 0 : -1}
  {disabled}
  on:click={handleClick}
  on:keydown={handleKeydown}
>
  <slot />
</button>