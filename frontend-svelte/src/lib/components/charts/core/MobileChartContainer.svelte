<script lang="ts">
  import { onMount } from 'svelte';
  import ResponsiveChartContainer from './ResponsiveChartContainer.svelte';
  import { ChartTheme } from '../../../utils/charts/ChartTheme';

  interface $$Props {
    class?: string;
  }

  let className = '';
  export { className as class };

  let isMobile = false;

  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  function checkMobile() {
    isMobile = window.innerWidth < ChartTheme.breakpoints.tablet;
  }
</script>

<ResponsiveChartContainer
  minHeight={isMobile ? 250 : 300}
  maxHeight={isMobile ? 350 : 500}
  aspectRatio={isMobile ? 1.2 : 2}
  class={className}
>
  <slot />
</ResponsiveChartContainer>