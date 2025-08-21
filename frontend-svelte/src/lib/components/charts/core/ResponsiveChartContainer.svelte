<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ChartTheme } from '../../../utils/charts/ChartTheme';

  interface $$Props {
    minHeight?: number;
    maxHeight?: number;
    aspectRatio?: number; // width/height ratio
    class?: string;
    onResize?: (width: number, height: number) => void;
  }

  export let minHeight = 200;
  export let maxHeight = 600;
  export let aspectRatio = 2; // 2:1 ratio by default
  export let onResize: ((width: number, height: number) => void) | undefined = undefined;

  let className = '';
  export { className as class };

  let containerElement: HTMLDivElement;
  let dimensions = { width: 0, height: 0 };
  let resizeObserver: ResizeObserver | null = null;

  onMount(() => {
    updateDimensions();
    setupResizeObserver();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
  });

  function updateDimensions() {
    if (!containerElement) return;

    const { width } = containerElement.getBoundingClientRect();
    
    // Calculate height based on aspect ratio, constrained by min/max
    let height = width / aspectRatio;
    height = Math.max(minHeight, Math.min(maxHeight, height));

    dimensions = { width, height };
    onResize?.(width, height);
  }

  function setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions();
      });

      if (containerElement) {
        resizeObserver.observe(containerElement);
      }
    } else {
      // Fallback for environments without ResizeObserver
      window.addEventListener('resize', updateDimensions);
    }
  }

  // Reactive updates when props change
  $: if (containerElement && (aspectRatio || minHeight || maxHeight)) {
    updateDimensions();
  }
</script>

<div 
  bind:this={containerElement}
  class="w-full {className}"
  style="height: {dimensions.height || minHeight}px"
>
  <slot {dimensions} />
</div>