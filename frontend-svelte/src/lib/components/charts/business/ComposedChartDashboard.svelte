<script lang="ts">
  import ComposedChartView from './ComposedChartView.svelte';
  import type { ChartSeries } from './ComposedChartView.svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();

  // Re-export all props except height and dashboardLayout
  export let data: Array<Record<string, any>> = [];
  export let series: ChartSeries[] = [];
  export let title = 'Комбинированный график';
  export let subtitle = '';
  export let className = '';
  export let xAxisKey = 'name';
  export let enableCrossFilter = false;
  export let loading = false;
  export let error: string | null = null;
</script>

<ComposedChartView
  {data}
  {series}
  {title}
  {subtitle}
  {className}
  {xAxisKey}
  {enableCrossFilter}
  {loading}
  {error}
  height={250}
  showBrush={false}
  dashboardLayout={true}
  on:elementClick
  on:export
/>