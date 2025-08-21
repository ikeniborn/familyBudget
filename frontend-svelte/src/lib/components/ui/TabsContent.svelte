<!--
  TabsContent component - контент панель для вкладок
  Часть системы компонентов Tabs
-->
<script lang="ts">
  import { getContext } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cn } from '$lib/utils/cn';

  // Props
  export let value = '';
  export let className = '';
  export let forceMount = false;

  // Получаем контекст вкладок
  const tabsContext = getContext<{
    activeTab: any;
  }>('tabs');

  if (!tabsContext) {
    throw new Error('TabsContent must be used within a Tabs component');
  }

  const { activeTab } = tabsContext;

  // Вычисляемые классы
  $: contentClasses = cn(
    'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    className
  );

  $: isActive = $activeTab === value;
</script>

{#if isActive || forceMount}
  <div
    class={contentClasses}
    class:hidden={!isActive && forceMount}
    role="tabpanel"
    id="tabpanel-{value}"
    aria-labelledby="tab-{value}"
    tabindex="0"
    transition:slide={{ duration: 200 }}
  >
    <slot />
  </div>
{/if}