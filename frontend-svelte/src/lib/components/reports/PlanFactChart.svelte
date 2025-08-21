<script lang="ts">
  import { onMount } from 'svelte';
  import { Bar } from 'svelte-chartjs';
  import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale
  } from 'chart.js';
  import Card from '$lib/components/ui/Card.svelte';
  import { BarChart3, TrendingUp, TrendingDown } from 'lucide-svelte';

  // Register Chart.js components
  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

  export let data: PlanFactData[] = [];
  export let title = 'Анализ план-факт';
  export let loading = false;

  interface PlanFactData {
    category: string;
    plan: number;
    fact: number;
    variance: number;
    variance_percent: number;
  }

  let chartData: any = {};
  let chartOptions: any = {};

  $: if (data.length > 0) {
    updateChartData();
  }

  function updateChartData() {
    chartData = {
      labels: data.map(item => item.category),
      datasets: [
        {
          label: 'План',
          data: data.map(item => item.plan),
          backgroundColor: 'rgba(59, 130, 246, 0.8)', // blue-500
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: 'Факт',
          data: data.map(item => item.fact),
          backgroundColor: 'rgba(239, 68, 68, 0.8)', // red-500
          borderColor: 'rgb(239, 68, 68)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ]
    };

    chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: title,
          font: {
            size: 16,
            weight: 'bold'
          },
          color: '#1e293b' // slate-800
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#475569',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: function(context: any) {
              const value = new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
              }).format(context.parsed.y);
              return `${context.dataset.label}: ${value}`;
            },
            afterBody: function(tooltipItems: any[]) {
              if (tooltipItems.length > 0) {
                const dataIndex = tooltipItems[0].dataIndex;
                const item = data[dataIndex];
                if (item) {
                  const variance = new Intl.NumberFormat('ru-RU', {
                    style: 'currency',
                    currency: 'RUB',
                  }).format(item.variance);
                  return `Отклонение: ${variance} (${item.variance_percent.toFixed(1)}%)`;
                }
              }
              return '';
            }
          }
        },
        legend: {
          position: 'top' as const,
          labels: {
            font: {
              size: 12
            },
            color: '#475569' // slate-600
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#6b7280', // gray-500
            font: {
              size: 11
            },
            maxRotation: 45
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9' // slate-100
          },
          ticks: {
            color: '#6b7280', // gray-500
            font: {
              size: 11
            },
            callback: function(value: any) {
              return new Intl.NumberFormat('ru-RU', {
                style: 'currency',
                currency: 'RUB',
                notation: 'compact'
              }).format(value);
            }
          }
        }
      }
    };
  }

  onMount(() => {
    if (data.length > 0) {
      updateChartData();
    }
  });

  // Calculate summary statistics
  $: totalPlan = data.reduce((sum, item) => sum + item.plan, 0);
  $: totalFact = data.reduce((sum, item) => sum + item.fact, 0);
  $: totalVariance = totalFact - totalPlan;
  $: totalVariancePercent = totalPlan > 0 ? (totalVariance / totalPlan) * 100 : 0;

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  }
</script>

<Card class="border-l-4 border-l-blue-500">
  <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b">
    <div class="flex items-center gap-3">
      <div class="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
        <BarChart3 class="h-5 w-5 text-blue-600" />
      </div>
      <div>
        <h2 class="text-lg font-semibold text-slate-900">{title}</h2>
        <p class="text-sm text-slate-600">Сравнение планируемых и фактических значений</p>
      </div>
    </div>
  </div>

  <div class="p-6">
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        <span class="ml-3 text-slate-600">Загрузка данных...</span>
      </div>
    {:else if data.length === 0}
      <div class="text-center py-12">
        <div class="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BarChart3 class="h-8 w-8 text-slate-400" />
        </div>
        <h3 class="text-lg font-medium text-slate-900 mb-2">Нет данных</h3>
        <p class="text-slate-600">Выберите период и примените фильтры для отображения диаграммы</p>
      </div>
    {:else}
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="bg-blue-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-blue-800">Общий план</p>
              <p class="text-xl font-bold text-blue-900">{formatCurrency(totalPlan)}</p>
            </div>
            <TrendingUp class="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div class="bg-red-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-red-800">Общий факт</p>
              <p class="text-xl font-bold text-red-900">{formatCurrency(totalFact)}</p>
            </div>
            <TrendingDown class="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div class="bg-slate-50 rounded-lg p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-slate-600">Отклонение</p>
              <p class="text-xl font-bold {totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}">
                {formatCurrency(totalVariance)}
              </p>
              <p class="text-xs text-slate-500">{totalVariancePercent.toFixed(1)}%</p>
            </div>
            <div class="h-8 w-8 {totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}">
              {#if totalVariance >= 0}
                <TrendingUp class="h-8 w-8" />
              {:else}
                <TrendingDown class="h-8 w-8" />
              {/if}
            </div>
          </div>
        </div>
      </div>

      <!-- Chart -->
      <div class="h-96 w-full">
        <Bar {data=chartData} options={chartOptions} />
      </div>

      <!-- Data Table -->
      <div class="mt-6 overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="text-left py-3 px-4 font-medium text-slate-700">Категория</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">План</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">Факт</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">Отклонение</th>
              <th class="text-right py-3 px-4 font-medium text-slate-700">%</th>
            </tr>
          </thead>
          <tbody>
            {#each data as item}
              <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-3 px-4 font-medium text-slate-900">{item.category}</td>
                <td class="py-3 px-4 text-right text-blue-600">{formatCurrency(item.plan)}</td>
                <td class="py-3 px-4 text-right text-red-600">{formatCurrency(item.fact)}</td>
                <td class="py-3 px-4 text-right {item.variance >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {formatCurrency(item.variance)}
                </td>
                <td class="py-3 px-4 text-right {item.variance_percent >= 0 ? 'text-green-600' : 'text-red-600'}">
                  {item.variance_percent.toFixed(1)}%
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</Card>