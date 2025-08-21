// Chart formatting utilities for consistent styling across all charts
export const formatters = {
  // Currency formatter (Russian locale)
  currency: (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  },

  // Short number formatter for charts (K, M, B)
  shortNumber: (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  },

  // Regular number formatter
  number: (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 2,
    }).format(value);
  },

  // Percentage formatter
  percentage: (value: number): string => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value);
  },

  // Date formatter (Russian locale)
  date: (value: string | Date): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  },

  // Short date formatter for chart axes
  shortDate: (value: string | Date): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  },

  // Time formatter
  time: (value: string | Date): string => {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  },
};

// Chart theme constants
export const chartTheme = {
  // Color palette
  colors: {
    primary: '#3B82F6', // blue-500
    secondary: '#8B5CF6', // violet-500
    success: '#10B981', // emerald-500
    warning: '#F59E0B', // amber-500
    danger: '#EF4444', // red-500
    info: '#06B6D4', // cyan-500
    gray: '#6B7280', // gray-500
    lightGray: '#F3F4F6', // gray-100
    darkGray: '#1F2937', // gray-800
    
    // Extended palette for multiple series
    palette: [
      '#3B82F6', // blue-500
      '#EF4444', // red-500  
      '#10B981', // emerald-500
      '#F59E0B', // amber-500
      '#8B5CF6', // violet-500
      '#06B6D4', // cyan-500
      '#EC4899', // pink-500
      '#84CC16', // lime-500
      '#F97316', // orange-500
      '#6366F1', // indigo-500
    ],

    // Variance analysis colors
    variance: {
      positive: '#10B981',
      negative: '#EF4444',
      neutral: '#6B7280',
    },

    // Budget gauge colors
    gauge: {
      good: '#10B981',
      warning: '#F59E0B', 
      danger: '#EF4444',
    },
  },

  // Font settings
  fonts: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    sizes: {
      xs: 10,
      sm: 12,
      base: 14,
      lg: 16,
      xl: 18,
    },
  },

  // Chart dimensions
  sizes: {
    dashboard: {
      height: 200,
      width: '100%',
    },
    medium: {
      height: 300,
      width: '100%',
    },
    large: {
      height: 400,
      width: '100%',
    },
    xlarge: {
      height: 500,
      width: '100%',
    },
  },

  // Default margins and padding
  spacing: {
    margin: {
      top: 20,
      right: 30,
      bottom: 60,
      left: 60,
    },
    padding: {
      small: 10,
      medium: 20,
      large: 30,
    },
  },

  // Grid and axis styling
  grid: {
    color: '#F1F5F9', // slate-100
    strokeDasharray: '2 2',
    strokeWidth: 1,
  },

  // Animation settings
  animation: {
    duration: 750,
    easing: 'ease-out',
  },

  // Tooltip styling
  tooltip: {
    backgroundColor: '#1E293B', // slate-800
    color: '#FFFFFF',
    border: '1px solid #475569', // slate-600
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
  },
};

// Generate color palette for multiple series
export function generateColorPalette(count: number): string[] {
  const colors = [...chartTheme.colors.palette];
  while (colors.length < count) {
    colors.push(...chartTheme.colors.palette);
  }
  return colors.slice(0, count);
}

// Get color by index with fallback
export function getColorByIndex(index: number): string {
  return chartTheme.colors.palette[index % chartTheme.colors.palette.length];
}

// Calculate color based on value and thresholds
export function getValueColor(
  value: number,
  thresholds: { good: number; warning: number; danger: number }
): { color: string; status: 'good' | 'warning' | 'danger' } {
  const absValue = Math.abs(value);
  
  if (absValue <= thresholds.good) {
    return { color: chartTheme.colors.gauge.good, status: 'good' };
  } else if (absValue <= thresholds.warning) {
    return { color: chartTheme.colors.gauge.warning, status: 'warning' };
  } else {
    return { color: chartTheme.colors.gauge.danger, status: 'danger' };
  }
}

// Generate gradient colors
export function generateGradient(baseColor: string, opacity = 0.2): string {
  // Simple opacity-based gradient
  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;
  
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

// Helper: Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}