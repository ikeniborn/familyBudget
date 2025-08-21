<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import ChartSkeleton from '../core/ChartSkeleton.svelte';

  interface $$Props {
    data: any[];
    loading?: boolean;
    error?: string | null;
    enableVirtualization?: boolean;
    maxDataPoints?: number;
    debounceMs?: number;
    class?: string;
  }

  export let data: any[] = [];
  export let loading = false;
  export let error: string | null = null;
  export let enableVirtualization = false;
  export let maxDataPoints = 1000;
  export let debounceMs = 100;

  let className = '';
  export { className as class };

  let isVisible = false;
  let optimizedData: any[] = [];
  let containerElement: HTMLDivElement;
  let debounceTimeout: NodeJS.Timeout | null = null;
  let intersectionObserver: IntersectionObserver | null = null;

  // Intersection Observer for lazy rendering
  onMount(() => {
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
        },
        { threshold: 0.1 }
      );

      if (containerElement) {
        intersectionObserver.observe(containerElement);
      }
    } else {
      // Fallback for environments without IntersectionObserver
      isVisible = true;
    }
  });

  onDestroy(() => {
    intersectionObserver?.disconnect();
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  });

  // Data optimization with debouncing
  $: {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(() => {
      optimizedData = optimizeData(data, maxDataPoints, enableVirtualization);
    }, debounceMs);
  }

  // Data optimization function
  function optimizeData(
    rawData: any[],
    maxPoints: number,
    useVirtualization: boolean
  ): any[] {
    if (!rawData || rawData.length === 0) return [];

    // If data is within limits, return as-is
    if (rawData.length <= maxPoints) {
      return rawData;
    }

    // For virtualization, return subset
    if (useVirtualization) {
      return rawData.slice(0, maxPoints);
    }

    // Data sampling for large datasets
    const step = Math.ceil(rawData.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < rawData.length; i += step) {
      sampled.push(rawData[i]);
    }

    // Always include the last point
    if (sampled[sampled.length - 1] !== rawData[rawData.length - 1]) {
      sampled.push(rawData[rawData.length - 1]);
    }

    return sampled;
  }
</script>

<div bind:this={containerElement} class={className}>
  {#if loading}
    <ChartSkeleton />
  {:else if error}
    <div class="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
      <div class="text-center">
        <p class="text-red-600 font-medium">Ошибка отображения графика</p>
        <p class="text-red-500 text-sm mt-1">{error}</p>
      </div>
    </div>
  {:else if !optimizedData || optimizedData.length === 0}
    <div class="flex items-center justify-center h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
      <p class="text-gray-500">Нет данных для отображения</p>
    </div>
  {:else}
    <!-- Only render chart when visible (intersection observer) -->
    {#if isVisible}
      <slot {optimizedData} />
    {:else}
      <ChartSkeleton />
    {/if}
    
    <!-- Data optimization indicator -->
    {#if data.length > maxDataPoints}
      <div class="mt-2 text-xs text-gray-500 text-center">
        Отображено {optimizedData.length} из {data.length} точек данных
      </div>
    {/if}
  {/if}
</div>