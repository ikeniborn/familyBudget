<script lang="ts">
  import ResponsiveChartContainer from './ResponsiveChartContainer.svelte';

  interface $$Props {
    fullWidth?: boolean;
    class?: string;
  }

  export let fullWidth = true;

  let className = '';
  export { className as class };

  $: containerClass = `${fullWidth ? 'col-span-full' : ''} ${className}`;
</script>

<ResponsiveChartContainer
  minHeight={400}
  maxHeight={600}
  aspectRatio={fullWidth ? 2.5 : 2}
  class={containerClass}
>
  <slot />
</ResponsiveChartContainer>