<script lang="ts">
  import BudgetGauge from './BudgetGauge.svelte';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();

  // Re-export all props except height
  export let currentValue: number;
  export let maxValue: number;
  export let title = 'Использование бюджета';
  export let subtitle = '';
  export let className = '';
  export let showLabel = true;
  export let showPercentage = true;
  export let thresholds = {
    good: 70,
    warning: 85,
    danger: 100,
  };
  export let animated = true;
  export let loading = false;
  export let error: string | null = null;
</script>

<BudgetGauge
  {currentValue}
  {maxValue}
  {title}
  {subtitle}
  {className}
  {showLabel}
  {showPercentage}
  {thresholds}
  {animated}
  {loading}
  {error}
  height={180}
  on:export
/>