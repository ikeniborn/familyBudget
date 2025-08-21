/**
 * Data transformation utilities for chart components
 */

export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
  color?: string;
  [key: string]: any;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  [key: string]: any;
}

export interface PlanFactDataPoint {
  name: string;
  plan: number;
  fact: number;
  variance?: number;
  percentage?: number;
  [key: string]: any;
}

/**
 * Transform raw budget data for Plan vs Fact chart
 */
export function transformToPlanFact(
  data: Array<{
    name: string;
    planned_amount: number;
    actual_amount: number;
    [key: string]: any;
  }>
): PlanFactDataPoint[] {
  return data.map(item => ({
    name: item.name,
    plan: item.planned_amount,
    fact: item.actual_amount,
    variance: item.actual_amount - item.planned_amount,
    percentage: item.planned_amount > 0 
      ? ((item.actual_amount / item.planned_amount) * 100) 
      : 0,
    ...item,
  }));
}

/**
 * Transform data for category pie chart
 */
export function transformToCategoryPie(
  data: Array<{
    category: string;
    amount: number;
    color?: string;
    [key: string]: any;
  }>
): ChartDataPoint[] {
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  
  return data.map((item, index) => ({
    name: item.category,
    value: item.amount,
    percentage: total > 0 ? (item.amount / total) * 100 : 0,
    color: item.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
    ...item,
  }));
}

/**
 * Transform data for time series chart
 */
export function transformToTimeSeries(
  data: Array<{
    date: string | Date;
    value: number;
    [key: string]: any;
  }>,
  sortBy: 'date' | 'value' = 'date'
): TimeSeriesDataPoint[] {
  const transformed = data.map(item => ({
    date: typeof item.date === 'string' ? item.date : item.date.toISOString().split('T')[0],
    value: item.value,
    label: new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(item.date)),
    ...item,
  }));

  // Sort data
  if (sortBy === 'date') {
    transformed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  } else {
    transformed.sort((a, b) => b.value - a.value);
  }

  return transformed;
}

/**
 * Transform data for waterfall chart
 */
export function transformToWaterfall(
  data: Array<{
    name: string;
    value: number;
    [key: string]: any;
  }>
): Array<{
  name: string;
  value: number;
  cumulative: number;
  type: 'positive' | 'negative' | 'total';
  [key: string]: any;
}> {
  let cumulative = 0;
  
  return data.map((item, index) => {
    const isLast = index === data.length - 1;
    const type = isLast ? 'total' : (item.value >= 0 ? 'positive' : 'negative');
    
    if (!isLast) {
      cumulative += item.value;
    }
    
    return {
      name: item.name,
      value: item.value,
      cumulative: isLast ? cumulative : cumulative - item.value,
      type,
      ...item,
    };
  });
}

/**
 * Aggregate data by time period
 */
export function aggregateByPeriod(
  data: Array<{
    date: string | Date;
    value: number;
    [key: string]: any;
  }>,
  period: 'day' | 'week' | 'month' | 'year' = 'month'
): TimeSeriesDataPoint[] {
  const groups = new Map<string, number>();
  
  data.forEach(item => {
    const date = new Date(item.date);
    let key: string;
    
    switch (period) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        break;
      case 'year':
        key = date.getFullYear().toString();
        break;
    }
    
    groups.set(key, (groups.get(key) || 0) + item.value);
  });
  
  return Array.from(groups.entries()).map(([date, value]) => ({
    date,
    value,
    label: new Intl.DateTimeFormat('ru-RU', {
      day: period === 'day' ? '2-digit' : undefined,
      month: period !== 'year' ? 'short' : undefined,
      year: 'numeric',
    }).format(new Date(date)),
  }));
}

/**
 * Calculate moving average for trend analysis
 */
export function calculateMovingAverage(
  data: TimeSeriesDataPoint[],
  windowSize: number = 7
): TimeSeriesDataPoint[] {
  if (data.length < windowSize) return data;
  
  return data.map((item, index) => {
    if (index < windowSize - 1) {
      return { ...item, movingAverage: item.value };
    }
    
    const window = data.slice(index - windowSize + 1, index + 1);
    const average = window.reduce((sum, point) => sum + point.value, 0) / windowSize;
    
    return {
      ...item,
      movingAverage: average,
    };
  });
}

/**
 * Filter data by date range
 */
export function filterByDateRange(
  data: TimeSeriesDataPoint[],
  startDate: string | Date,
  endDate: string | Date
): TimeSeriesDataPoint[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return data.filter(item => {
    const itemDate = new Date(item.date);
    return itemDate >= start && itemDate <= end;
  });
}

/**
 * Calculate percentage distribution
 */
export function calculatePercentageDistribution(
  data: ChartDataPoint[]
): ChartDataPoint[] {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return data.map(item => ({
    ...item,
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }));
}

/**
 * Sort data with multiple criteria
 */
export function sortChartData<T extends { value: number; name: string }>(
  data: T[],
  sortBy: 'value' | 'name' | 'date' = 'value',
  order: 'asc' | 'desc' = 'desc'
): T[] {
  const sorted = [...data];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'value':
        comparison = a.value - b.value;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name, 'ru');
        break;
      case 'date':
        if ('date' in a && 'date' in b) {
          comparison = new Date(a.date as string).getTime() - new Date(b.date as string).getTime();
        }
        break;
    }
    
    return order === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

/**
 * Format large numbers for chart display
 */
export function formatChartValue(
  value: number,
  format: 'currency' | 'number' | 'percentage' | 'short' = 'currency'
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    
    case 'percentage':
      return `${value.toFixed(1)}%`;
    
    case 'short':
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toString();
    
    default:
      return new Intl.NumberFormat('ru-RU').format(value);
  }
}

/**
 * Generate color palette for chart series
 */
export function generateColorPalette(count: number, baseHue: number = 200): string[] {
  const colors: string[] = [];
  const step = 360 / count;
  
  for (let i = 0; i < count; i++) {
    const hue = (baseHue + (i * step)) % 360;
    const saturation = 70 + (i % 3) * 10; // Vary saturation slightly
    const lightness = 50 + (i % 2) * 10;  // Vary lightness slightly
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
}

/**
 * Validate chart data
 */
export function validateChartData(data: any[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { isValid: false, errors };
  }
  
  if (data.length === 0) {
    errors.push('Data array cannot be empty');
    return { isValid: false, errors };
  }
  
  // Check for required fields
  data.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      errors.push(`Item at index ${index} must be an object`);
      return;
    }
    
    if (!('value' in item) || typeof item.value !== 'number') {
      errors.push(`Item at index ${index} missing valid 'value' field`);
    }
    
    if (isNaN(item.value) || !isFinite(item.value)) {
      errors.push(`Item at index ${index} has invalid value: ${item.value}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}