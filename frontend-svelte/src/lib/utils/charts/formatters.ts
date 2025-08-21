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
  // New design system color palette
  colors: {
    primary: '#1e3a5f', // navy-dark
    secondary: '#7fb3d5', // sky-light
    accent: '#d4b896', // beige
    neutral: '#a8c0d0', // steel
    success: '#7fb3d5', // sky-light
    warning: '#d4b896', // beige
    danger: '#a8c0d0', // steel
    info: '#7fb3d5', // sky-light
    gray: '#a8c0d0', // steel
    lightGray: '#f8fafc', // slate-50
    darkGray: '#1e3a5f', // navy-dark
    
    // Extended palette for multiple series - new design system
    palette: [
      '#1e3a5f', // navy-dark (primary)
      '#7fb3d5', // sky-light (secondary)
      '#d4b896', // beige (accent)
      '#a8c0d0', // steel (neutral)
      '#2a4a6b', // navy variant
      '#6ba3c7', // sky variant
      '#c8a582', // beige variant
      '#9bb5c4', // steel variant
      '#345a7f', // navy-light
      '#8bbdd9', // sky-lighter
    ],

    // Variance analysis colors - new design system
    variance: {
      positive: '#7fb3d5', // sky-light
      negative: '#a8c0d0', // steel
      neutral: '#d4b896', // beige
    },

    // Budget gauge colors - new design system
    gauge: {
      good: '#7fb3d5', // sky-light
      warning: '#d4b896', // beige
      danger: '#a8c0d0', // steel
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
    color: '#e2e8f0', // slate-200
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
    backgroundColor: '#1e3a5f', // navy-dark
    color: '#FFFFFF',
    border: '1px solid #a8c0d0', // steel
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