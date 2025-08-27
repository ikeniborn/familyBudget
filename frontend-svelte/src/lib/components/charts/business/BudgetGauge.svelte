<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Doughnut } from '../core';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    type ChartOptions,
    type ChartData,
  } from 'chart.js';
  import ChartContainer from '../core/ChartContainer.svelte';
  import { formatters, chartTheme, getValueColor } from '$lib/utils/charts/formatters';
  
  // Register Chart.js components
  ChartJS.register(Title, Tooltip, Legend, ArcElement);
  
  const dispatch = createEventDispatcher<{
    export: { format: 'png' | 'svg' };
  }>();

  // Props
  interface Props {
    data?: {
      currentValue: number;
      maxValue: number;
      utilization?: number;
      category?: string;
    };
    currentValue?: number;
    maxValue?: number;
    title?: string;
    subtitle?: string;
    height?: number;
    className?: string;
    showLabel?: boolean;
    showPercentage?: boolean;
    thresholds?: {
      good: number;
      warning: number;
      danger: number;
    };
    animated?: boolean;
    loading?: boolean;
    error?: string | null;
  }
  
  let {
    data = undefined,
    currentValue = 0,
    maxValue = 100,
    title = 'Использование бюджета',
    subtitle = '',
    height = 400,
    className = '',
    showLabel = true,
    showPercentage = true,
    thresholds = {
      good: 70,
      warning: 85,
      danger: 100,
    },
    animated = true,
    loading = false,
    error = null
  }: Props = $props();

  // Reactive calculations
  $: actualCurrentValue = data?.currentValue ?? currentValue;
  $: actualMaxValue = data?.maxValue ?? maxValue;
  $: percentage = actualMaxValue > 0 ? Math.min((actualCurrentValue / actualMaxValue) * 100, 100) : 0;
  $: colorAndStatus = getValueColor(percentage, thresholds);
  $: color = colorAndStatus.color;
  $: status = colorAndStatus.status;
  $: remainingValue = Math.max(0, actualMaxValue - actualCurrentValue);
  $: overageValue = Math.max(0, actualCurrentValue - actualMaxValue);

  // Status configuration with new design system colors
  const statusConfig = {
    good: {
      message: 'В пределах нормы',
      icon: '✅',
      bgColor: 'bg-sky/10',
      textColor: 'text-sky',
    },
    warning: {
      message: 'Приближается к лимиту',
      icon: '⚠️',
      bgColor: 'bg-beige/20',
      textColor: 'text-beige',
    },
    danger: {
      message: 'Превышен лимит',
      icon: '🚨',
      bgColor: 'bg-steel/20',
      textColor: 'text-steel',
    },
  };

  $: currentStatus = statusConfig[status];

  // Chart data
  $: chartData = {
    labels: ['Использовано', 'Доступно'],
    datasets: [{
      data: [percentage, Math.max(0, 100 - percentage)],
      backgroundColor: [
        color,
        chartTheme.colors.neutral + '40', // steel with opacity
      ],
      borderWidth: 0,
      cutout: '60%',
      circumference: 180, // Half circle
      rotation: 270, // Start from top
    }],
  } as ChartData<'doughnut'>;

  // Chart options
  $: chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      animateRotate: animated,
      duration: animated ? 1000 : 0,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        backgroundColor: chartTheme.tooltip.backgroundColor,
        titleColor: chartTheme.tooltip.color,
        bodyColor: chartTheme.tooltip.color,
        borderColor: chartTheme.colors.neutral,
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const label = context.label;
            const value = context.parsed;
            if (label === 'Использовано') {
              return `${label}: ${formatters.currency(actualCurrentValue)} (${value.toFixed(1)}%)`;
            } else {
              return `${label}: ${formatters.currency(remainingValue)} (${value.toFixed(1)}%)`;
            }
          },
        },
      },
    },
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
      },
    },
  } as ChartOptions<'doughnut'>;

  let chartRef: HTMLCanvasElement | undefined;

  function handleExport(event: CustomEvent<{ format: 'png' | 'svg' }>) {
    dispatch('export', event.detail);
  }
</script>

<ChartContainer
  {title}
  {subtitle}
  {height}
  {className}
  {loading}
  {error}
  exportable={true}
  variant="navy"
  on:export={handleExport}
  let:setChartRef
>
  <div class="flex flex-col items-center justify-center h-full">
    <!-- Gauge Chart -->
    <div class="relative w-full max-w-xs">
      <div style="height: 200px;">
        <Doughnut
          data={chartData}
          options={chartOptions}
          bind:chart={chartRef}
          on:chartInit={() => chartRef && setChartRef(chartRef)}
        />
      </div>
      
      <!-- Center Label -->
      {#if showLabel}
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div class="text-center mt-8">
            {#if showPercentage}
              <div class="text-3xl font-bold text-navy-dark mb-1">
                {percentage.toFixed(1)}%
              </div>
            {/if}
            <div class="text-sm text-steel-dark">
              {formatters.currency(actualCurrentValue)}
            </div>
            <div class="text-xs text-steel">
              из {formatters.currency(actualMaxValue)}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Status Indicator -->
    <div class="mt-4 px-3 py-2 rounded-lg {currentStatus.bgColor} {currentStatus.textColor} text-center">
      <div class="flex items-center justify-center gap-2">
        <span class="text-lg">{currentStatus.icon}</span>
        <span class="text-sm font-medium">{currentStatus.message}</span>
      </div>
    </div>

    <!-- Threshold Indicators -->
    <div class="mt-4 w-full max-w-xs">
      <div class="flex justify-between text-xs text-steel mb-1">
        <span>0%</span>
        <span>{thresholds.good}%</span>
        <span>{thresholds.warning}%</span>
        <span>100%</span>
      </div>
      <div class="relative h-2 bg-steel/20 rounded-full overflow-hidden">
        <!-- Good zone -->
        <div
          class="absolute top-0 left-0 h-full bg-sky"
          style="width: {thresholds.good}%"
        />
        <!-- Warning zone -->
        <div
          class="absolute top-0 h-full bg-beige"
          style="left: {thresholds.good}%; width: {thresholds.warning - thresholds.good}%"
        />
        <!-- Danger zone -->
        <div
          class="absolute top-0 h-full bg-steel"
          style="left: {thresholds.warning}%; width: {100 - thresholds.warning}%"
        />
        <!-- Current position indicator -->
        <div
          class="absolute top-0 w-1 h-full bg-navy-dark transition-all duration-1000"
          style="left: {Math.min(percentage, 100)}%"
        />
      </div>
    </div>

    <!-- Additional Metrics -->
    <div class="mt-4 grid grid-cols-2 gap-4 w-full max-w-xs text-center">
      <div class="bg-navy/5 rounded-lg p-2">
        <div class="text-xs text-steel">Остаток</div>
        <div class="text-sm font-medium text-navy-dark">
          {formatters.currency(remainingValue)}
        </div>
      </div>
      <div class="bg-navy/5 rounded-lg p-2">
        <div class="text-xs text-steel">
          {percentage > 100 ? 'Превышение' : 'До лимита'}
        </div>
        <div class="text-sm font-medium text-navy-dark">
          {percentage > 100 
            ? formatters.currency(overageValue)
            : `${(100 - percentage).toFixed(1)}%`}
        </div>
      </div>
    </div>
  </div>
</ChartContainer>