<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { 
    Chart, 
    type ChartConfiguration, 
    type ChartType,
    // Controllers
    BarController,
    LineController,
    PieController,
    DoughnutController,
    RadarController,
    PolarAreaController,
    BubbleController,
    ScatterController,
    // Scales
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    RadialLinearScale,
    TimeScale,
    // Elements
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    // Components
    Title,
    Tooltip,
    Legend,
    Filler
  } from 'chart.js';
  
  // Register all components
  Chart.register(
    // Controllers
    BarController,
    LineController,
    PieController,
    DoughnutController,
    RadarController,
    PolarAreaController,
    BubbleController,
    ScatterController,
    // Scales
    CategoryScale,
    LinearScale,
    LogarithmicScale,
    RadialLinearScale,
    TimeScale,
    // Elements
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    // Components
    Title,
    Tooltip,
    Legend,
    Filler
  );

  type T = $$Generic<ChartType>;

  // Props
  export let type: T;
  export let data: ChartConfiguration<T>['data'];
  export let options: ChartConfiguration<T>['options'] = {};
  export let plugins: ChartConfiguration<T>['plugins'] = [];
  
  // Event callbacks
  export let onchartInit: ((chart: Chart<T>) => void) | undefined = undefined;
  export let onchartUpdate: ((chart: Chart<T>) => void) | undefined = undefined;
  export let onchartDestroy: (() => void) | undefined = undefined;
  
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
      
      onchartInit?.(chart);
    }
  });

  onDestroy(() => {
    if (chart) {
      chart.destroy();
      onchartDestroy?.();
      chart = null;
    }
  });

  // Update chart when data or options change
  $: if (chart && data) {
    chart.data = data;
    chart.update();
    onchartUpdate?.(chart);
  }

  $: if (chart && options) {
    chart.options = options;
    chart.update();
    onchartUpdate?.(chart);
  }
</script>

<canvas bind:this={canvas}></canvas>