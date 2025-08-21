<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Download, RefreshCw, Settings } from 'lucide-svelte';
  import { chartExport } from '$lib/utils/charts/export';
  
  const dispatch = createEventDispatcher<{
    export: { format: 'png' | 'svg' };
    refresh: void;
    settingsToggle: void;
  }>();

  export let title = '';
  export let subtitle = '';
  export let height = 400;
  export let className = '';
  export let loading = false;
  export let error: string | null = null;
  export let exportable = true;
  export let refreshable = false;
  export let showSettings = false;
  export let variant: 'navy' | 'sky' | 'beige' | 'steel' = 'navy';
  
  let containerRef: HTMLDivElement;
  let chartRef: HTMLCanvasElement | undefined;

  // Export functionality
  async function handleExport(format: 'png' | 'svg') {
    if (!chartRef) return;
    
    try {
      await chartExport(chartRef, title || 'chart', format);
      dispatch('export', { format });
    } catch (err) {
      console.error('Export failed:', err);
    }
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleSettingsToggle() {
    dispatch('settingsToggle');
  }

  // Expose chart reference for child components
  export function setChartRef(ref: HTMLCanvasElement) {
    chartRef = ref;
  }
</script>

<Card {variant} class="{className}">
  <!-- Header -->
  {#if title || subtitle || exportable || refreshable || showSettings}
    <div class="bg-gradient-to-r from-navy/5 to-sky/5 p-4 border-b border-steel/20">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          {#if title}
            <div class="flex items-center">
              <div class="w-2 h-6 bg-gradient-to-b from-navy to-sky rounded-full mr-3"></div>
              <h2 class="text-lg font-semibold text-navy-dark">{title}</h2>
            </div>
          {/if}
          {#if subtitle}
            <p class="text-sm text-steel-dark mt-1">{subtitle}</p>
          {/if}
        </div>

        <!-- Controls -->
        <div class="flex items-center gap-2">
          <slot name="controls" />
          
          {#if showSettings}
            <Button
              variant="outline"
              size="sm"
              on:click={handleSettingsToggle}
              class="text-xs"
            >
              <Settings class="h-4 w-4" />
            </Button>
          {/if}
          
          {#if refreshable}
            <Button
              variant="outline"
              size="sm"
              on:click={handleRefresh}
              class="text-xs"
            >
              <RefreshCw class="h-4 w-4" />
            </Button>
          {/if}
          
          {#if exportable}
            <div class="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                on:click={() => handleExport('png')}
                class="text-xs"
                title="Экспорт в PNG"
              >
                <Download class="h-4 w-4" />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                on:click={() => handleExport('svg')}
                class="text-xs"
                title="Экспорт в SVG"
              >
                <Download class="h-4 w-4" />
                SVG
              </Button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Content -->
  <div class="p-6" bind:this={containerRef}>
    {#if loading}
      <div class="flex justify-center items-center py-12" style="height: {height}px;">
        <div class="animate-spin h-8 w-8 border-2 border-navy border-t-transparent rounded-full"></div>
        <span class="ml-3 text-steel-dark">Загрузка данных...</span>
      </div>
    {:else if error}
      <div class="flex flex-col justify-center items-center py-12 text-center" style="height: {height}px;">
        <div class="h-16 w-16 bg-steel/20 rounded-full flex items-center justify-center mb-4">
          <svg class="h-8 w-8 text-steel" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-medium text-navy-dark mb-2">Ошибка загрузки</h3>
        <p class="text-steel-dark">{error}</p>
      </div>
    {:else}
      <div style="height: {height}px;" class="relative">
        <slot {chartRef} {setChartRef} />
      </div>
    {/if}
  </div>

  <!-- Footer slot for additional controls/info -->
  <slot name="footer" />
</Card>