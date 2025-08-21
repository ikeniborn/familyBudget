<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ChartJsWrapper from './ChartJsWrapper.svelte';
  import type { ChartData, ChartOptions } from 'chart.js';

  const dispatch = createEventDispatcher();

  // Props
  export let data: ChartData<'line'>;
  export let options: ChartOptions<'line'> = {};
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
  type="line"
  {data}
  {options}
  {plugins}
  bind:chart
  on:chartInit={handleChartInit}
  on:chartUpdate={handleChartUpdate}
  on:chartDestroy={handleChartDestroy}
/>