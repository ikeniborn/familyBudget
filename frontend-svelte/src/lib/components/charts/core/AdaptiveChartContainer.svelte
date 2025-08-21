<script lang="ts">
  import { onMount } from 'svelte';
  import ResponsiveChartContainer from './ResponsiveChartContainer.svelte';
  import { ChartTheme } from '../../../utils/charts/ChartTheme';

  interface $$Props {
    class?: string;
  }

  let className = '';
  export { className as class };

  let breakpoint: 'mobile' | 'tablet' | 'desktop' = 'desktop';

  onMount(() => {
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);

    return () => {
      window.removeEventListener('resize', updateBreakpoint);
    };
  });

  function updateBreakpoint() {
    const width = window.innerWidth;
    if (width < ChartTheme.breakpoints.mobile) {
      breakpoint = 'mobile';
    } else if (width < ChartTheme.breakpoints.desktop) {
      breakpoint = 'tablet';
    } else {
      breakpoint = 'desktop';
    }
  }

  const config = {
    mobile: { minHeight: 200, maxHeight: 300, aspectRatio: 1 },
    tablet: { minHeight: 250, maxHeight: 400, aspectRatio: 1.5 },
    desktop: { minHeight: 300, maxHeight: 500, aspectRatio: 2 },
  };

  $: currentConfig = config[breakpoint];
</script>

<ResponsiveChartContainer
  minHeight={currentConfig.minHeight}
  maxHeight={currentConfig.maxHeight}
  aspectRatio={currentConfig.aspectRatio}
  class={className}
>
  <slot />
</ResponsiveChartContainer>