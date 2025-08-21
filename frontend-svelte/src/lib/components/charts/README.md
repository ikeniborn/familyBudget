# Chart Components Documentation

Портированные chart компоненты для SvelteKit с использованием Chart.js и svelte-chartjs.

## Установленные зависимости
- `chart.js` - Core charting library
- `svelte-chartjs` - Svelte wrapper для Chart.js
- Все компоненты поддерживают экспорт в PNG/SVG

## Компоненты

### 1. BudgetGauge
Полукруглый gauge для отображения использования бюджета с цветовыми индикаторами статуса.

```svelte
<script>
  import { BudgetGauge } from '$lib/components/charts';
</script>

<BudgetGauge
  currentValue={75000}
  maxValue={100000}
  title="Использование бюджета за январь"
  thresholds={{ good: 70, warning: 85, danger: 100 }}
  on:export={(event) => console.log('Exported as', event.detail.format)}
/>
```

**Props:**
- `currentValue: number` - текущее значение
- `maxValue: number` - максимальное значение
- `title?: string` - заголовок
- `thresholds?` - пороги для цветовых индикаторов
- `animated?: boolean` - анимация

### 2. VarianceWaterfall
Waterfall chart для анализа отклонений с поддержкой сортировки и фильтрации.

```svelte
<script>
  import { VarianceWaterfall } from '$lib/components/charts';
  
  const data = [
    { name: 'Продажи', value: 50000, category: 'Доходы' },
    { name: 'Расходы на персонал', value: -30000, category: 'Расходы' },
    { name: 'Маркетинг', value: -5000, category: 'Расходы' }
  ];
</script>

<VarianceWaterfall
  {data}
  title="Анализ отклонений по месяцам"
  showCumulativeLine={true}
  sortable={true}
  on:barClick={(event) => console.log('Clicked:', event.detail.data)}
/>
```

**Props:**
- `data: Array<{name, value, category?}>` - данные для отображения
- `showRunningTotal?: boolean` - показать накопительный итог
- `showCumulativeLine?: boolean` - показать линию накопительного итога
- `sortable?: boolean` - разрешить сортировку
- `colorCoding?: 'impact' | 'category' | 'value'` - стратегия раскраски

### 3. TrendLineChart
Линейный график с поддержкой нескольких серий, прогнозирования и скользящего среднего.

```svelte
<script>
  import { TrendLineChart } from '$lib/components/charts';
  
  const data = [
    { date: '2024-01-01', value: 10000, series: 'Продажи' },
    { date: '2024-01-02', value: 12000, series: 'Продажи' },
    // ...
  ];
</script>

<TrendLineChart
  {data}
  title="Динамика продаж"
  showArea={false}
  showForecast={true}
  showMovingAverage={true}
  movingAverageWindow={7}
  dateRangeSelector={true}
  multiSeries={true}
  on:pointClick={(event) => console.log('Point:', event.detail)}
/>
```

**Props:**
- `data: Array<{date, value, series?, forecast?}>` - временные ряды
- `showArea?: boolean` - показать как area chart
- `showForecast?: boolean` - генерировать прогноз
- `showMovingAverage?: boolean` - скользящее среднее
- `dateRangeSelector?: boolean` - селектор диапазона дат
- `multiSeries?: boolean` - поддержка нескольких серий

### 4. CategoryPieChart
Круговая/кольцевая диаграмма с интерактивной легендой и поиском.

```svelte
<script>
  import { CategoryPieChart } from '$lib/components/charts';
  
  const data = [
    { category: 'Продукты', amount: 15000 },
    { category: 'Транспорт', amount: 5000 },
    { category: 'Развлечения', amount: 3000 },
  ];
</script>

<CategoryPieChart
  {data}
  title="Распределение расходов"
  showDonut={true}
  showPercentageLabels={true}
  minSlicePercentage={2}
  on:sliceClick={(event) => console.log('Slice:', event.detail.data)}
/>
```

**Props:**
- `data: Array<{category, amount, color?}>` - категории и значения
- `showDonut?: boolean` - кольцевая диаграмма
- `showPercentageLabels?: boolean` - процентные подписи
- `showLegend?: boolean` - показать легенду
- `minSlicePercentage?: number` - минимальный размер сегмента

### 5. ComposedChartView
Комбинированный график (бары + линии) с двумя осями Y и продвинутой интерактивностью.

```svelte
<script>
  import { ComposedChartView } from '$lib/components/charts';
  import type { ChartSeries } from '$lib/components/charts';
  
  const data = [
    { month: 'Янв', revenue: 50000, margin: 0.15 },
    { month: 'Фев', revenue: 60000, margin: 0.18 },
  ];
  
  const series: ChartSeries[] = [
    { dataKey: 'revenue', name: 'Выручка', type: 'bar', color: '#3B82F6', yAxisId: 'left' },
    { dataKey: 'margin', name: 'Маржа', type: 'line', color: '#EF4444', yAxisId: 'right' }
  ];
</script>

<ComposedChartView
  {data}
  {series}
  title="Выручка и маржинальность"
  xAxisKey="month"
  enableCrossFilter={true}
  on:elementClick={(event) => console.log('Element:', event.detail)}
/>
```

**Props:**
- `data: Array<Record<string, any>>` - данные
- `series: ChartSeries[]` - конфигурация серий
- `xAxisKey?: string` - ключ для оси X
- `enableCrossFilter?: boolean` - кросс-фильтрация
- `dashboardLayout?: boolean` - компактная версия для dashboard

### 6. PlanFactChart (обновленный)
Улучшенный план-факт анализ с дополнительной линией отклонений в %.

```svelte
<script>
  import PlanFactChart from '$lib/components/reports/PlanFactChart.svelte';
  
  const data = [
    {
      category: 'Продажи',
      plan: 100000,
      fact: 95000,
      variance: -5000,
      variance_percent: -5
    }
  ];
</script>

<PlanFactChart
  {data}
  title="План-факт анализ"
  showVarianceLine={true}
  sortable={true}
  on:barClick={(event) => console.log('Bar clicked:', event.detail.data)}
  on:export={(event) => console.log('Exported:', event.detail.format)}
/>
```

## Компактные версии

Для dashboard-ов доступны компактные версии:
- `BudgetGaugeCompact` - высота 180px
- `ComposedChartDashboard` - высота 250px, упрощенная раскладка

## Экспорт данных

Все компоненты поддерживают экспорт в PNG и SVG:

```svelte
<script>
  import { chartExport } from '$lib/utils/charts/export';
  
  function handleExport(event) {
    const { format } = event.detail;
    console.log(`Chart exported as ${format}`);
  }
</script>

<BudgetGauge 
  exportable={true}
  on:export={handleExport}
  {/* other props */}
/>
```

## Утилиты

### Форматирование
```javascript
import { formatters } from '$lib/utils/charts/formatters';

// Валюта: formatters.currency(1500) => "1 500 ₽"
// Короткие числа: formatters.shortNumber(1500000) => "1,5М"  
// Проценты: formatters.percentage(0.15) => "15,0%"
// Даты: formatters.date(new Date()) => "21 авг. 2024 г."
```

### Трансформация данных
```javascript
import { transformToCategoryPie, transformToTimeSeries } from '$lib/utils/charts/dataTransform';

const pieData = transformToCategoryPie(rawData);
const timeSeriesData = transformToTimeSeries(rawTimeData);
```

## Общие возможности

- 🎨 **Консистентная тематизация** с использованием chartTheme
- 📱 **Адаптивность** для всех размеров экрана  
- 🎯 **Интерактивность** с событиями клика и ховера
- 📈 **Экспорт** в PNG/SVG форматы
- 🔍 **Поиск и фильтрация** в большинстве компонентов
- 📊 **Статистика** с автоматическими вычислениями
- ♿ **Доступность** с поддержкой ARIA
- 🌐 **Локализация** на русском языке