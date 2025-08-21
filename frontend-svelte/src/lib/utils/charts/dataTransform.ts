// Data transformation utilities for charts

export interface ChartDataPoint {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
  isOther?: boolean;
  [key: string]: any;
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  forecast?: boolean;
  movingAverage?: number;
  [key: string]: any;
}

export interface WaterfallDataPoint {
  name: string;
  value: number;
  cumulative: number;
  cumulativeStart: number;
  type: 'positive' | 'negative' | 'total';
  impact: 'high' | 'medium' | 'low';
  category?: string;
  color: string;
  [key: string]: any;
}

// Transform data for category pie charts
export function transformToCategoryPie(data: Array<{
  category: string;
  amount: number;
  color?: string;
  [key: string]: any;
}>): ChartDataPoint[] {
  const total = data.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  
  return data.map(item => ({
    name: item.category,
    value: Math.abs(item.amount),
    percentage: total > 0 ? (Math.abs(item.amount) / total) * 100 : 0,
    color: item.color,
    ...item,
  }));
}

// Transform data for time series charts
export function transformToTimeSeries(
  data: Array<{
    date: string | Date;
    value: number;
    [key: string]: any;
  }>,
  dateKey = 'date'
): TimeSeriesDataPoint[] {
  return data
    .map(item => ({
      date: typeof item[dateKey] === 'string' 
        ? item[dateKey] 
        : item[dateKey].toISOString().split('T')[0],
      value: item.value,
      label: typeof item[dateKey] === 'string' 
        ? item[dateKey] 
        : item[dateKey].toISOString().split('T')[0],
      ...item,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Transform data for waterfall charts
export function transformToWaterfall(data: Array<{
  name: string;
  value: number;
  category?: string;
  [key: string]: any;
}>): WaterfallDataPoint[] {
  let cumulative = 0;
  const maxAbsValue = Math.max(...data.map(d => Math.abs(d.value)));
  
  const waterfallData: WaterfallDataPoint[] = data.map((item, index) => {
    const cumulativeStart = cumulative;
    cumulative += item.value;
    
    // Calculate impact
    const absValue = Math.abs(item.value);
    const impact: 'high' | 'medium' | 'low' = 
      absValue > maxAbsValue * 0.7 ? 'high' :
      absValue > maxAbsValue * 0.3 ? 'medium' : 'low';
    
    // Determine type and color
    const type: 'positive' | 'negative' | 'total' = 
      item.value >= 0 ? 'positive' : 'negative';
    
    const color = type === 'positive' ? '#10B981' : '#EF4444';
    
    return {
      name: item.name,
      value: item.value,
      cumulative: cumulative,
      cumulativeStart: cumulativeStart,
      type,
      impact,
      color,
      category: item.category || 'Общее',
      ...item,
    };
  });

  // Add total bar if needed
  if (data.length > 1) {
    waterfallData.push({
      name: 'Итого',
      value: cumulative,
      cumulative: cumulative,
      cumulativeStart: 0,
      type: 'total',
      impact: 'high',
      color: '#6B7280',
      category: 'Итого',
    });
  }

  return waterfallData;
}

// Calculate moving average
export function calculateMovingAverage(
  data: TimeSeriesDataPoint[], 
  window = 7
): TimeSeriesDataPoint[] {
  return data.map((item, index) => {
    const start = Math.max(0, index - Math.floor(window / 2));
    const end = Math.min(data.length, index + Math.ceil(window / 2));
    const windowData = data.slice(start, end);
    const avg = windowData.reduce((sum, d) => sum + d.value, 0) / windowData.length;
    
    return {
      ...item,
      movingAverage: avg,
    };
  });
}

// Filter data by date range
export function filterByDateRange(
  data: TimeSeriesDataPoint[],
  startDate?: string,
  endDate?: string
): TimeSeriesDataPoint[] {
  if (!startDate && !endDate) return data;
  
  return data.filter(item => {
    const itemDate = new Date(item.date);
    
    if (startDate && itemDate < new Date(startDate)) return false;
    if (endDate && itemDate > new Date(endDate)) return false;
    
    return true;
  });
}

// Group data by period (day, week, month)
export function groupByPeriod(
  data: TimeSeriesDataPoint[],
  period: 'day' | 'week' | 'month' | 'quarter' | 'year'
): TimeSeriesDataPoint[] {
  const groups: Record<string, TimeSeriesDataPoint[]> = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    let key: string;
    
    switch (period) {
      case 'day':
        key = item.date;
        break;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'year':
        key = String(date.getFullYear());
        break;
      default:
        key = item.date;
    }
    
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  
  return Object.entries(groups).map(([key, items]) => {
    const totalValue = items.reduce((sum, item) => sum + item.value, 0);
    const avgValue = totalValue / items.length;
    
    return {
      date: key,
      value: totalValue,
      average: avgValue,
      count: items.length,
      label: key,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Calculate variance analysis data
export function calculateVarianceData(planData: number[], factData: number[]): Array<{
  index: number;
  plan: number;
  fact: number;
  variance: number;
  variancePercent: number;
}> {
  const maxLength = Math.max(planData.length, factData.length);
  
  return Array.from({ length: maxLength }, (_, index) => {
    const plan = planData[index] || 0;
    const fact = factData[index] || 0;
    const variance = fact - plan;
    const variancePercent = plan !== 0 ? (variance / plan) * 100 : 0;
    
    return {
      index,
      plan,
      fact,
      variance,
      variancePercent,
    };
  });
}

// Generate mock time series data for testing
export function generateMockTimeSeriesData(
  days = 30,
  baseValue = 1000,
  volatility = 0.1
): TimeSeriesDataPoint[] {
  const data: TimeSeriesDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    const trend = (days - i) * 10; // Slight upward trend
    const random = (Math.random() - 0.5) * baseValue * volatility;
    const value = Math.max(0, baseValue + trend + random);
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value),
      label: date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }),
    });
  }
  
  return data;
}

// Generate mock category data for testing
export function generateMockCategoryData(categories: string[]): ChartDataPoint[] {
  return categories.map(category => ({
    name: category,
    value: Math.round(Math.random() * 100000) + 10000,
  }));
}

// Sort data by various criteria
export function sortChartData<T extends { name: string; value: number }>(
  data: T[],
  sortBy: 'name' | 'value' | 'impact',
  order: 'asc' | 'desc' = 'desc'
): T[] {
  const sorted = [...data].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'ru');
        break;
      case 'value':
        comparison = a.value - b.value;
        break;
      case 'impact':
        comparison = Math.abs(a.value) - Math.abs(b.value);
        break;
    }
    
    return order === 'desc' ? -comparison : comparison;
  });
  
  return sorted;
}

// Calculate aggregations for chart data
export function calculateAggregations(data: ChartDataPoint[]): {
  total: number;
  average: number;
  min: number;
  max: number;
  count: number;
  median: number;
} {
  if (data.length === 0) {
    return { total: 0, average: 0, min: 0, max: 0, count: 0, median: 0 };
  }
  
  const values = data.map(d => d.value);
  const total = values.reduce((sum, val) => sum + val, 0);
  const average = total / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  return {
    total,
    average,
    min,
    max,
    count: data.length,
    median,
  };
}