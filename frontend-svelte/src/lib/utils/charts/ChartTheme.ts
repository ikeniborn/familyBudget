/**
 * Chart theme configuration for consistent styling across all charts
 */

export const ChartColors = {
  // Primary colors
  primary: '#3B82F6', // Blue - for main data series
  secondary: '#10B981', // Green - for positive values/success
  tertiary: '#F59E0B', // Amber - for warnings
  danger: '#EF4444', // Red - for negative values/errors
  
  // Chart specific colors
  plan: '#3B82F6', // Blue for planned values
  fact: '#10B981', // Green for actual values
  variance: {
    positive: '#10B981', // Green for positive variance
    negative: '#EF4444', // Red for negative variance
  },
  
  // Extended palette for multiple series
  palette: [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#84CC16', // Lime
  ],
  
  // Neutral colors
  grid: '#E5E7EB',
  text: '#6B7280',
  textDark: '#374151',
  background: '#FFFFFF',
  backgroundAlt: '#F9FAFB',
} as const;

export const ChartDefaults = {
  // Animation
  animationDuration: 300,
  animationEasing: 'ease-out' as const,
  
  // Margins
  margin: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  
  // Font sizes
  fontSize: {
    small: 11,
    medium: 12,
    large: 14,
    title: 16,
  },
  
  // Stroke widths
  strokeWidth: {
    thin: 1,
    medium: 2,
    thick: 3,
  },
  
  // Border radius
  borderRadius: 4,
  
  // Opacity
  opacity: {
    hover: 0.8,
    disabled: 0.3,
    fill: 0.1,
  },
} as const;

export const ChartTooltipStyle = {
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 12px',
  fontSize: '12px',
  color: '#FFFFFF',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
} as const;

export const ChartLegendStyle = {
  fontSize: '12px',
  color: ChartColors.text,
  iconSize: 16,
  verticalAlign: 'middle' as const,
  height: 36,
} as const;

export const ChartAxisStyle = {
  fontSize: ChartDefaults.fontSize.small,
  color: ChartColors.text,
  tickLine: false,
  axisLine: {
    stroke: ChartColors.grid,
    strokeWidth: 1,
  },
} as const;

export const ChartGridStyle = {
  stroke: ChartColors.grid,
  strokeDasharray: '3 3',
  strokeWidth: 1,
} as const;

// Responsive breakpoints
export const ChartBreakpoints = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
} as const;

// Chart size presets
export const ChartSizes = {
  small: {
    width: '100%',
    height: 200,
  },
  medium: {
    width: '100%',
    height: 300,
  },
  large: {
    width: '100%',
    height: 400,
  },
  dashboard: {
    width: '100%',
    height: 250,
  },
} as const;

// Format functions for common use cases
export const ChartFormatters = {
  // Currency formatter
  currency: (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  },
  
  // Percentage formatter
  percentage: (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  },
  
  // Number formatter with thousand separators
  number: (value: number): string => {
    return new Intl.NumberFormat('ru-RU').format(value);
  },
  
  // Short number formatter (1.2K, 1.5M, etc.)
  shortNumber: (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  },
  
  // Date formatter
  date: (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
    }).format(d);
  },
  
  // Month formatter
  month: (date: string | Date): string => {
    const d = new Date(date);
    return new Intl.DateTimeFormat('ru-RU', {
      month: 'long',
      year: 'numeric',
    }).format(d);
  },
} as const;

// Export theme object
export const ChartTheme = {
  colors: ChartColors,
  defaults: ChartDefaults,
  tooltip: ChartTooltipStyle,
  legend: ChartLegendStyle,
  axis: ChartAxisStyle,
  grid: ChartGridStyle,
  breakpoints: ChartBreakpoints,
  sizes: ChartSizes,
  formatters: ChartFormatters,
} as const;

export default ChartTheme;