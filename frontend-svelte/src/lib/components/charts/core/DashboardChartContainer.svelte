<script lang="ts">
  import ResponsiveChartContainer from './ResponsiveChartContainer.svelte';

  interface $$Props {
    size?: 'small' | 'medium' | 'large';
    class?: string;
  }

  export let size: 'small' | 'medium' | 'large' = 'medium';

  let className = '';
  export { className as class };

  const sizeConfig = {
    small: { minHeight: 150, maxHeight: 250, aspectRatio: 2.5 },
    medium: { minHeight: 200, maxHeight: 300, aspectRatio: 2 },
    large: { minHeight: 300, maxHeight: 450, aspectRatio: 1.8 },
  };

  $: config = sizeConfig[size];
</script>

<ResponsiveChartContainer
  minHeight={config.minHeight}
  maxHeight={config.maxHeight}
  aspectRatio={config.aspectRatio}
  class={className}
>
  <slot />
</ResponsiveChartContainer>