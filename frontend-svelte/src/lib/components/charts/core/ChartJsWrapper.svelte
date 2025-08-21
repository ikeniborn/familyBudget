<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Chart, type ChartConfiguration, type ChartType } from 'chart.js';

  type T = $$Generic<ChartType>;

  const dispatch = createEventDispatcher<{
    chartInit: Chart<T>;
    chartUpdate: Chart<T>;
    chartDestroy: void;
  }>();

  // Props
  export let type: T;
  export let data: ChartConfiguration<T>['data'];
  export let options: ChartConfiguration<T>['options'] = {};
  export let plugins: ChartConfiguration<T>['plugins'] = [];
  
  // Chart instance and canvas ref
  let canvas: HTMLCanvasElement;
  let chart: Chart<T> | null = null;

  // Expose chart instance
  export { chart };

  onMount(() => {
    if (canvas) {
      chart = new Chart(canvas, {
        type,
        data,
        options,
        plugins,
      });
      
      dispatch('chartInit', chart);
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
      dispatch('chartDestroy');
      chart = null;
    }
  });

  // Update chart when data or options change
  $: if (chart && data) {
    chart.data = data;
    chart.update();
    dispatch('chartUpdate', chart);
  }

  $: if (chart && options) {
    chart.options = options;
    chart.update();
    dispatch('chartUpdate', chart);
  }
</script>

<canvas bind:this={canvas}></canvas>