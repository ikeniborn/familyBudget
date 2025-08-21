<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ChartJsWrapper from './ChartJsWrapper.svelte';
  import type { ChartData, ChartOptions, ChartType } from 'chart.js';

  type T = $$Generic<ChartType>;

  const dispatch = createEventDispatcher();

  // Props
  export let type: T;
  export let data: ChartData<T>;
  export let options: ChartOptions<T> = {};
  export let plugins = [];

  // Chart instance ref
  export let chart: any = null;

  function handleChartInit(event: CustomEvent) {
    chart = event.detail;
    dispatch('chartInit', event.detail);
  }

  function handleChartUpdate(event: CustomEvent) {
    dispatch('chartUpdate', event.detail);
  }

  function handleChartDestroy() {
    chart = null;
    dispatch('chartDestroy');
  }
</script>

<ChartJsWrapper
  {type}
  {data}
  {options}
  {plugins}
  bind:chart
  on:chartInit={handleChartInit}
  on:chartUpdate={handleChartUpdate}
  on:chartDestroy={handleChartDestroy}
/>