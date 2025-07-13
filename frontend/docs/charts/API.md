# Chart Components API Documentation

This document provides comprehensive API documentation for all chart components in the Family Budget application.

## Table of Contents

- [Core Components](#core-components)
- [Business Chart Components](#business-chart-components)
- [Utility Functions](#utility-functions)
- [Hooks](#hooks)
- [Types](#types)
- [Theming](#theming)

## Core Components

### ChartContainer

The foundational wrapper component for all charts.

```typescript
interface ChartContainerProps {
  title?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  showEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
  className?: string;
  'data-testid'?: string;
}
```

**Props:**
- `title` - Chart title displayed at the top
- `children` - Chart content (Recharts components)
- `loading` - Shows skeleton loader when true
- `error` - Error message to display instead of chart
- `showEmpty` - Forces empty state display
- `emptyMessage` - Custom message for empty state
- `height` - Container height in pixels (default: 400)
- `className` - Additional CSS classes
- `data-testid` - Test identifier for automation

**Example:**
```tsx
<ChartContainer title="Revenue Analysis" loading={isLoading} height={500}>
  <BarChart data={data}>
    {/* Chart content */}
  </BarChart>
</ChartContainer>
```

### ResponsiveChartContainer

Responsive wrapper that adapts to different screen sizes.

```typescript
interface ResponsiveChartContainerProps extends ChartContainerProps {
  breakpoints?: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  mobileHeight?: number;
  tabletHeight?: number;
  desktopHeight?: number;
}
```

**Additional Props:**
- `breakpoints` - Custom breakpoint values
- `mobileHeight` - Height for mobile screens (default: 250px)
- `tabletHeight` - Height for tablet screens (default: 350px)
- `desktopHeight` - Height for desktop screens (default: 400px)

## Business Chart Components

### PlanFactBarChart

Bar chart for comparing planned vs actual values.

```typescript
interface PlanFactBarChartProps {
  data: PlanFactDataPoint[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  showVariance?: boolean;
  showPercentage?: boolean;
  onBarClick?: (data: any) => void;
  onElementClick?: (data: any) => void;
  className?: string;
}

interface PlanFactDataPoint {
  name: string;
  planned_amount: number;
  actual_amount: number;
  category?: string;
  period_name?: string;
  [key: string]: any;
}
```

**Props:**
- `data` - Array of plan vs fact data points
- `showVariance` - Display variance indicators
- `showPercentage` - Show percentage completion
- `onBarClick` - Callback for bar click events
- `onElementClick` - Generic element click handler

**Example:**
```tsx
<PlanFactBarChart
  data={[
    { name: 'Q1', planned_amount: 100000, actual_amount: 95000 },
    { name: 'Q2', planned_amount: 120000, actual_amount: 130000 },
  ]}
  showVariance={true}
  onBarClick={(data) => console.log('Clicked:', data)}
/>
```

### CategoryPieChart

Pie chart for category distribution analysis.

```typescript
interface CategoryPieChartProps {
  data: CategoryDataPoint[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  showDonut?: boolean;
  showPercentageLabels?: boolean;
  onSliceClick?: (data: any) => void;
  className?: string;
}

interface CategoryDataPoint {
  category: string;
  amount: number;
  color?: string;
  [key: string]: any;
}
```

**Props:**
- `data` - Category distribution data
- `showDonut` - Render as donut chart instead of pie
- `showPercentageLabels` - Display percentage on slices
- `onSliceClick` - Callback for slice interactions

### BudgetGauge

Circular gauge for budget utilization display.

```typescript
interface BudgetGaugeProps {
  currentValue: number;
  maxValue: number;
  title?: string;
  loading?: boolean;
  error?: string | null;
  showLabel?: boolean;
  showPercentage?: boolean;
  animated?: boolean;
  className?: string;
}
```

**Props:**
- `currentValue` - Current budget usage
- `maxValue` - Total budget amount
- `showLabel` - Display value labels
- `showPercentage` - Show percentage completion
- `animated` - Enable animation effects

### TrendLineChart

Line chart for time series trend analysis.

```typescript
interface TrendLineChartProps {
  data: TimeSeriesDataPoint[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  showForecast?: boolean;
  showMovingAverage?: boolean;
  dateRangeSelector?: boolean;
  onPointClick?: (data: any) => void;
  className?: string;
}

interface TimeSeriesDataPoint {
  date: string | Date;
  value: number;
  series?: string;
  [key: string]: any;
}
```

**Props:**
- `data` - Time series data points
- `showForecast` - Display trend forecast
- `showMovingAverage` - Overlay moving average line
- `dateRangeSelector` - Enable date range selection
- `onPointClick` - Point interaction callback

### VarianceWaterfall

Waterfall chart for variance analysis.

```typescript
interface VarianceWaterfallProps {
  data: VarianceDataPoint[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  showRunningTotal?: boolean;
  showCumulativeLine?: boolean;
  sortable?: boolean;
  onBarClick?: (data: any) => void;
  className?: string;
}

interface VarianceDataPoint {
  name: string;
  value: number;
  category?: string;
  [key: string]: any;
}
```

**Props:**
- `data` - Variance data points
- `showRunningTotal` - Display cumulative totals
- `showCumulativeLine` - Overlay cumulative line
- `sortable` - Allow data sorting
- `onBarClick` - Bar click handler

### ComposedChartView

Combined bar and line chart for complex analysis.

```typescript
interface ComposedChartViewProps {
  data: ComposedDataPoint[];
  series: ComposedSeries[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  showBrush?: boolean;
  enableCrossFilter?: boolean;
  onElementClick?: (data: any) => void;
  className?: string;
}

interface ComposedSeries {
  dataKey: string;
  name: string;
  type: 'bar' | 'line';
  color: string;
  yAxisId?: 'left' | 'right';
}
```

**Props:**
- `data` - Multi-dimensional data points
- `series` - Chart series configuration
- `showBrush` - Enable brush selection
- `enableCrossFilter` - Allow cross-filtering
- `onElementClick` - Element interaction callback

## Utility Functions

### Chart Export Functions

```typescript
// Export chart as PNG image
exportChartAsPNG(
  element: HTMLElement,
  filename?: string,
  options?: {
    backgroundColor?: string;
    pixelRatio?: number;
    quality?: number;
  }
): Promise<void>

// Export chart as SVG
exportChartAsSVG(
  element: HTMLElement,
  filename?: string
): Promise<void>

// Copy chart to clipboard
copyChartToClipboard(
  element: HTMLElement,
  options?: {
    backgroundColor?: string;
    pixelRatio?: number;
  }
): Promise<void>

// Print chart
printChart(
  element: HTMLElement,
  title?: string
): Promise<void>

// Export chart data as CSV
exportChartDataAsCSV(
  data: any[],
  filename?: string,
  columns?: string[]
): Promise<void>
```

### Data Transformation Functions

```typescript
// Transform data for plan vs fact charts
transformToPlanFact(rawData: any[]): PlanFactDataPoint[]

// Transform data for pie charts
transformToCategoryPie(rawData: any[]): CategoryDataPoint[]

// Transform data for time series
transformToTimeSeries(rawData: any[]): TimeSeriesDataPoint[]

// Transform data for waterfall charts
transformToWaterfall(rawData: any[]): VarianceDataPoint[]

// Calculate moving average
calculateMovingAverage(data: number[], window: number): number[]

// Generate color palette
generateColorPalette(count: number, baseColor?: string): string[]

// Format chart values
formatChartValue(value: number, type: 'currency' | 'percent' | 'number'): string

// Validate chart data
validateChartData(data: any[], requiredFields: string[]): boolean
```

## Hooks

### useChartData

Hook for managing chart data lifecycle.

```typescript
interface UseChartDataOptions {
  endpoint: string;
  filters?: Record<string, any>;
  transformFn?: (data: any) => any;
  refreshInterval?: number;
}

interface UseChartDataReturn {
  data: any;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  lastUpdated: Date | null;
}

const useChartData = (options: UseChartDataOptions): UseChartDataReturn
```

### useChartExport

Hook for chart export functionality.

```typescript
interface UseChartExportOptions {
  defaultFormat?: 'png' | 'svg' | 'csv';
  defaultFilename?: string;
}

interface UseChartExportReturn {
  exportAsPNG: (element: HTMLElement, filename?: string) => Promise<void>;
  exportAsSVG: (element: HTMLElement, filename?: string) => Promise<void>;
  exportAsCSV: (data: any[], filename?: string) => Promise<void>;
  copyToClipboard: (element: HTMLElement) => Promise<void>;
  print: (element: HTMLElement, title?: string) => Promise<void>;
  isExporting: boolean;
}

const useChartExport = (options?: UseChartExportOptions): UseChartExportReturn
```

### useChartFilters

Hook for managing chart filters.

```typescript
interface ChartFilterState {
  dateRange?: [Date, Date];
  categories?: string[];
  reportType?: string;
  [key: string]: any;
}

interface UseChartFiltersReturn {
  filters: ChartFilterState;
  setFilter: (key: string, value: any) => void;
  resetFilters: () => void;
  applyFilters: (data: any[]) => any[];
}

const useChartFilters = (initialFilters?: ChartFilterState): UseChartFiltersReturn
```

## Types

### Core Types

```typescript
// Base data point interface
interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

// Time series specific
interface TimeSeriesDataPoint extends ChartDataPoint {
  date: string | Date;
  series?: string;
}

// Plan vs Fact specific
interface PlanFactDataPoint {
  name: string;
  planned_amount: number;
  actual_amount: number;
  category?: string;
  period_name?: string;
  [key: string]: any;
}
```

### Theme Types

```typescript
interface ChartTheme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    neutral: string[];
  };
  fonts: {
    family: string;
    sizes: {
      small: number;
      medium: number;
      large: number;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}
```

## Theming

### Default Theme

```typescript
const defaultTheme: ChartTheme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6B7280',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    neutral: ['#F3F4F6', '#E5E7EB', '#D1D5DB', '#9CA3AF', '#6B7280'],
  },
  fonts: {
    family: 'Inter, sans-serif',
    sizes: {
      small: 12,
      medium: 14,
      large: 16,
    },
  },
  spacing: {
    small: 8,
    medium: 16,
    large: 24,
  },
};
```

### Theme Customization

```typescript
// Apply custom theme
import { ChartThemeProvider } from '@/components/charts';

const customTheme = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    primary: '#8B5CF6',
  },
};

<ChartThemeProvider theme={customTheme}>
  <YourChartComponents />
</ChartThemeProvider>
```

## Performance Considerations

### Optimization Tips

1. **Data Pagination**: Limit data points to improve rendering performance
   ```typescript
   const optimizedData = data.slice(0, 1000); // Limit to 1000 points
   ```

2. **Virtualization**: Use `OptimizedChartWrapper` for large datasets
   ```tsx
   <OptimizedChartWrapper
     data={largeDataset}
     enableVirtualization={true}
     maxDataPoints={500}
   >
     <YourChart />
   </OptimizedChartWrapper>
   ```

3. **Debounced Updates**: Use debouncing for real-time data
   ```typescript
   const debouncedData = useDebounce(realTimeData, 300);
   ```

4. **Memoization**: Memoize expensive calculations
   ```typescript
   const processedData = useMemo(() => 
     transformData(rawData), [rawData]
   );
   ```

## Error Handling

### Common Error Patterns

```typescript
// Handle missing data
if (!data || data.length === 0) {
  return <ChartEmpty message="No data available" />;
}

// Handle invalid data
try {
  const validatedData = validateChartData(data, ['name', 'value']);
  if (!validatedData) {
    throw new Error('Invalid data format');
  }
} catch (error) {
  return <ChartContainer error={error.message} />;
}

// Handle export errors
try {
  await exportChartAsPNG(chartRef.current);
} catch (error) {
  console.error('Export failed:', error);
  // Show user-friendly error message
}
```

## Accessibility

### ARIA Support

All chart components include proper ARIA attributes:

- `role="img"` for chart containers
- `aria-label` for descriptive labels
- `aria-describedby` for detailed descriptions
- `tabindex="0"` for keyboard navigation

### Keyboard Navigation

Charts support keyboard interaction:
- `Tab` - Navigate between interactive elements
- `Enter/Space` - Activate focused element
- `Arrow keys` - Navigate within chart elements

### Screen Reader Support

```tsx
<ChartContainer
  title="Revenue Trends"
  aria-label="Line chart showing revenue trends over 12 months"
  aria-describedby="chart-description"
>
  <div id="chart-description" className="sr-only">
    Revenue increased from $50K in January to $120K in December
  </div>
  {/* Chart content */}
</ChartContainer>
```