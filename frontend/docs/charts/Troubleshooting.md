# Chart Troubleshooting Guide

This guide helps diagnose and resolve common issues with chart components in the Family Budget application.

## Table of Contents

- [Common Issues](#common-issues)
- [Data-Related Problems](#data-related-problems)
- [Rendering Issues](#rendering-issues)
- [Performance Problems](#performance-problems)
- [Export and Printing Issues](#export-and-printing-issues)
- [Browser Compatibility](#browser-compatibility)
- [Development and Debugging](#development-and-debugging)

## Common Issues

### Chart Not Displaying

**Symptoms:**
- Blank space where chart should appear
- Loading spinner never disappears
- Console errors about missing data

**Debugging Steps:**

1. **Check data prop:**
```tsx
// Add debugging to verify data
const DebugChart = ({ data, ...props }) => {
  console.log('Chart data:', data);
  console.log('Data length:', data?.length);
  console.log('First item:', data?.[0]);
  
  if (!data || data.length === 0) {
    return <div>No data provided to chart</div>;
  }
  
  return <PlanFactBarChart data={data} {...props} />;
};
```

2. **Verify required fields:**
```tsx
const validateChartData = (data, requiredFields) => {
  if (!Array.isArray(data)) {
    console.error('Chart data must be an array');
    return false;
  }
  
  for (const item of data) {
    for (const field of requiredFields) {
      if (!(field in item)) {
        console.error(`Missing required field: ${field}`, item);
        return false;
      }
    }
  }
  
  return true;
};

// Usage
const SafeChart = ({ data }) => {
  const isValid = validateChartData(data, ['name', 'planned_amount', 'actual_amount']);
  
  if (!isValid) {
    return <div>Invalid chart data format</div>;
  }
  
  return <PlanFactBarChart data={data} />;
};
```

3. **Check container dimensions:**
```tsx
// Ensure parent container has dimensions
const ChartWrapper = ({ children }) => (
  <div style={{ width: '100%', height: '400px' }}>
    {children}
  </div>
);
```

**Common Solutions:**
- Ensure data prop is not null/undefined
- Verify data structure matches expected format
- Check parent container has explicit dimensions
- Confirm all required dependencies are installed

### Chart Displays But Data Is Wrong

**Symptoms:**
- Charts render but show incorrect values
- Missing data points
- Wrong colors or formatting

**Debugging Steps:**

1. **Data transformation debugging:**
```tsx
const useDebugTransform = (rawData, transformFn) => {
  return useMemo(() => {
    console.group('Data Transformation');
    console.log('Raw data:', rawData);
    
    const transformed = transformFn(rawData);
    console.log('Transformed data:', transformed);
    
    // Validate transformation
    if (rawData.length !== transformed.length) {
      console.warn('Data length changed during transformation');
    }
    
    console.groupEnd();
    return transformed;
  }, [rawData, transformFn]);
};
```

2. **Type checking:**
```tsx
const validateDataTypes = (data) => {
  data.forEach((item, index) => {
    Object.entries(item).forEach(([key, value]) => {
      if (key.includes('amount') && typeof value !== 'number') {
        console.error(`Item ${index}: ${key} should be number, got ${typeof value}`, item);
      }
      if (key === 'name' && typeof value !== 'string') {
        console.error(`Item ${index}: ${key} should be string, got ${typeof value}`, item);
      }
    });
  });
};
```

**Common Solutions:**
- Convert string numbers to actual numbers: `Number(value)` or `+value`
- Handle null/undefined values in data transformation
- Ensure date formats are consistent
- Check for correct field mapping in transformations

### Console Errors

**"Cannot read property 'map' of undefined"**
```tsx
// ❌ Problem
const Chart = ({ data }) => (
  <BarChart data={data}>
    {data.map(item => <Bar key={item.id} />)} {/* Error if data is undefined */}
  </BarChart>
);

// ✅ Solution
const Chart = ({ data = [] }) => (
  <BarChart data={data}>
    {data.map(item => <Bar key={item.id} />)}
  </BarChart>
);
```

**"Warning: Each child in a list should have a unique 'key' prop"**
```tsx
// ❌ Problem
{data.map((item, index) => (
  <Bar key={index} /> // Using index as key
))}

// ✅ Solution
{data.map((item) => (
  <Bar key={`${item.name}-${item.period}`} /> // Unique, stable key
))}
```

**"Module not found: Can't resolve 'recharts'"**
```bash
# Install missing dependencies
npm install recharts
# or
yarn add recharts
```

## Data-Related Problems

### Empty or Null Data

**Problem:** API returns empty array or null data

**Solutions:**

```tsx
const EmptyStateChart = ({ data, title }) => {
  if (!data || data.length === 0) {
    return (
      <ChartContainer title={title} showEmpty={true}>
        <div className="text-center py-8">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет данных
          </h3>
          <p className="text-gray-600 mb-4">
            Данные для графика отсутствуют
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Обновить
          </button>
        </div>
      </ChartContainer>
    );
  }
  
  return <PlanFactBarChart data={data} title={title} />;
};
```

### Malformed Data

**Problem:** Data doesn't match expected structure

**Solution:** Create data normalizer

```tsx
const normalizeChartData = (rawData) => {
  if (!Array.isArray(rawData)) {
    console.error('Expected array, got:', typeof rawData);
    return [];
  }
  
  return rawData.map((item, index) => {
    // Provide defaults for missing fields
    const normalized = {
      name: item.name || item.period_name || item.title || `Item ${index + 1}`,
      planned_amount: Number(item.planned_amount || item.plan || item.budget || 0),
      actual_amount: Number(item.actual_amount || item.actual || item.fact || 0),
      category: item.category || item.nomenclature_name || 'Uncategorized',
    };
    
    // Validate normalized data
    if (isNaN(normalized.planned_amount) || isNaN(normalized.actual_amount)) {
      console.warn('Invalid numeric data detected:', item);
      normalized.planned_amount = 0;
      normalized.actual_amount = 0;
    }
    
    return normalized;
  });
};

// Usage
const RobustChart = ({ rawData }) => {
  const data = useMemo(() => normalizeChartData(rawData), [rawData]);
  return <PlanFactBarChart data={data} />;
};
```

### Large Datasets

**Problem:** Chart becomes slow or unresponsive with large datasets

**Solutions:**

1. **Data sampling:**
```tsx
const useSampledData = (data, maxPoints = 100) => {
  return useMemo(() => {
    if (!data || data.length <= maxPoints) return data;
    
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, index) => index % step === 0);
  }, [data, maxPoints]);
};
```

2. **Data aggregation:**
```tsx
const aggregateDataByMonth = (data) => {
  const grouped = data.reduce((acc, item) => {
    const month = new Date(item.date).toISOString().slice(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { planned_amount: 0, actual_amount: 0, count: 0 };
    }
    acc[month].planned_amount += item.planned_amount;
    acc[month].actual_amount += item.actual_amount;
    acc[month].count += 1;
    return acc;
  }, {});
  
  return Object.entries(grouped).map(([month, values]) => ({
    name: month,
    planned_amount: values.planned_amount,
    actual_amount: values.actual_amount,
    count: values.count,
  }));
};
```

3. **Virtualization:**
```tsx
import { FixedSizeList as List } from 'react-window';

const VirtualizedChartList = ({ data, itemHeight = 400 }) => (
  <List
    height={600}
    itemCount={Math.ceil(data.length / 10)}
    itemSize={itemHeight}
    itemData={data}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <PlanFactBarChart 
          data={data.slice(index * 10, (index + 1) * 10)}
          title={`Данные ${index * 10 + 1}-${(index + 1) * 10}`}
        />
      </div>
    )}
  </List>
);
```

## Rendering Issues

### Charts Not Responsive

**Problem:** Charts don't resize with container

**Solutions:**

1. **Force re-render on resize:**
```tsx
const useWindowSize = () => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateSize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', updateSize);
    updateSize();
    
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  return size;
};

const ResponsiveChart = ({ data }) => {
  const windowSize = useWindowSize();
  
  return (
    <div key={`${windowSize.width}-${windowSize.height}`}>
      <PlanFactBarChart data={data} />
    </div>
  );
};
```

2. **Use ResizeObserver:**
```tsx
const useResizeObserver = (ref) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  
  return dimensions;
};

const AdaptiveChart = ({ data }) => {
  const containerRef = useRef(null);
  const { width, height } = useResizeObserver(containerRef);
  
  return (
    <div ref={containerRef} style={{ width: '100%', height: '400px' }}>
      {width > 0 && (
        <PlanFactBarChart 
          data={data} 
          width={width} 
          height={height} 
        />
      )}
    </div>
  );
};
```

### Animation Issues

**Problem:** Charts animate incorrectly or animations are janky

**Solutions:**

1. **Disable animations for performance:**
```tsx
const PerformantChart = ({ data, reduceMotion = false }) => (
  <BarChart 
    data={data}
    animationDuration={reduceMotion ? 0 : 1000}
  >
    <Bar animationDuration={reduceMotion ? 0 : 800} />
  </BarChart>
);
```

2. **Use CSS transforms for better performance:**
```css
.chart-container {
  transform: translateZ(0); /* Force hardware acceleration */
  will-change: transform; /* Hint browser about animations */
}

.chart-bar {
  transition: transform 0.3s ease-out;
}

.chart-bar:hover {
  transform: scale(1.05);
}
```

3. **Respect user motion preferences:**
```tsx
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReducedMotion;
};
```

### Color and Theme Issues

**Problem:** Charts have incorrect colors or don't follow theme

**Solutions:**

1. **Theme provider:**
```tsx
const ChartThemeProvider = ({ children, theme = 'light' }) => {
  const themeColors = {
    light: {
      primary: '#3B82F6',
      secondary: '#10B981',
      background: '#FFFFFF',
      text: '#1F2937',
    },
    dark: {
      primary: '#60A5FA',
      secondary: '#34D399',
      background: '#1F2937',
      text: '#F9FAFB',
    },
  };
  
  return (
    <div data-theme={theme} style={{ '--chart-colors': JSON.stringify(themeColors[theme]) }}>
      {children}
    </div>
  );
};
```

2. **Dynamic color calculation:**
```tsx
const useThemeColors = () => {
  const [colors, setColors] = useState({});
  
  useEffect(() => {
    const computedStyle = getComputedStyle(document.documentElement);
    setColors({
      primary: computedStyle.getPropertyValue('--color-primary') || '#3B82F6',
      secondary: computedStyle.getPropertyValue('--color-secondary') || '#10B981',
    });
  }, []);
  
  return colors;
};
```

## Performance Problems

### Slow Rendering

**Problem:** Charts take too long to render

**Diagnostic tools:**

```tsx
const PerformanceDiagnostics = ({ children, name }) => {
  useEffect(() => {
    performance.mark(`${name}-start`);
    return () => {
      performance.mark(`${name}-end`);
      performance.measure(`${name}-duration`, `${name}-start`, `${name}-end`);
      
      const measures = performance.getEntriesByName(`${name}-duration`);
      console.log(`${name} render time:`, measures[0]?.duration.toFixed(2) + 'ms');
    };
  });
  
  return children;
};

// Usage
<PerformanceDiagnostics name="PlanFactChart">
  <PlanFactBarChart data={data} />
</PerformanceDiagnostics>
```

**Solutions:**

1. **Memoization:**
```tsx
const OptimizedChart = memo(({ data, title }) => {
  const processedData = useMemo(() => 
    data.map(item => ({ ...item, variance: item.actual - item.planned })),
    [data]
  );
  
  return <PlanFactBarChart data={processedData} title={title} />;
});
```

2. **Debounced updates:**
```tsx
const useDebouncedData = (data, delay = 300) => {
  const [debouncedData, setDebouncedData] = useState(data);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedData(data), delay);
    return () => clearTimeout(timer);
  }, [data, delay]);
  
  return debouncedData;
};
```

### Memory Leaks

**Problem:** Memory usage increases over time

**Detection:**
```tsx
const useMemoryMonitor = (componentName) => {
  useEffect(() => {
    const startMemory = performance.memory?.usedJSHeapSize || 0;
    
    const interval = setInterval(() => {
      const currentMemory = performance.memory?.usedJSHeapSize || 0;
      const diff = currentMemory - startMemory;
      
      if (diff > 50 * 1024 * 1024) { // 50MB
        console.warn(`${componentName} memory usage: ${diff / 1024 / 1024}MB`);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [componentName]);
};
```

**Solutions:**

1. **Proper cleanup:**
```tsx
const ChartWithCleanup = ({ data }) => {
  const intervalRef = useRef(null);
  const animationRef = useRef(null);
  
  useEffect(() => {
    // Setup timers
    intervalRef.current = setInterval(updateChart, 1000);
    
    return () => {
      // Cleanup
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);
  
  return <Chart data={data} />;
};
```

2. **Weak references:**
```tsx
const useWeakRef = (value) => {
  const ref = useRef(new WeakRef(value));
  return ref.current;
};
```

## Export and Printing Issues

### Export Failures

**Problem:** Chart export functions throw errors

**Solutions:**

1. **Error handling:**
```tsx
const SafeExport = () => {
  const chartRef = useRef(null);
  
  const handleExport = async (format) => {
    try {
      if (!chartRef.current) {
        throw new Error('Chart reference not available');
      }
      
      switch (format) {
        case 'png':
          await exportChartAsPNG(chartRef.current);
          break;
        case 'svg':
          await exportChartAsSVG(chartRef.current);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Ошибка экспорта: ${error.message}`);
    }
  };
  
  return (
    <div>
      <div ref={chartRef}>
        <Chart />
      </div>
      <button onClick={() => handleExport('png')}>Export PNG</button>
    </div>
  );
};
```

2. **Canvas compatibility:**
```tsx
const checkCanvasSupport = () => {
  const canvas = document.createElement('canvas');
  return !!(canvas.getContext && canvas.getContext('2d'));
};

const ExportableChart = () => {
  const [canExport, setCanExport] = useState(false);
  
  useEffect(() => {
    setCanExport(checkCanvasSupport());
  }, []);
  
  return (
    <div>
      <Chart />
      {canExport ? (
        <button onClick={handleExport}>Export</button>
      ) : (
        <p>Export not supported in this browser</p>
      )}
    </div>
  );
};
```

### Print Styling Issues

**Problem:** Charts look wrong when printed

**Solutions:**

1. **Print-specific CSS:**
```css
@media print {
  .chart-container {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  
  .chart-background {
    background: white !important;
  }
  
  .chart-text {
    color: black !important;
  }
  
  .no-print {
    display: none !important;
  }
}
```

2. **Print optimization:**
```tsx
const PrintOptimizedChart = ({ data }) => {
  const [isPrintMode, setIsPrintMode] = useState(false);
  
  useEffect(() => {
    const beforePrint = () => setIsPrintMode(true);
    const afterPrint = () => setIsPrintMode(false);
    
    window.addEventListener('beforeprint', beforePrint);
    window.addEventListener('afterprint', afterPrint);
    
    return () => {
      window.removeEventListener('beforeprint', beforePrint);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, []);
  
  return (
    <Chart 
      data={data}
      theme={isPrintMode ? 'print' : 'default'}
      animations={!isPrintMode}
    />
  );
};
```

## Browser Compatibility

### IE11 Support Issues

**Problem:** Charts don't work in Internet Explorer 11

**Solutions:**

1. **Polyfills:**
```bash
npm install core-js
```

```tsx
// In index.tsx or App.tsx
import 'core-js/stable';
import 'core-js/features/array/find';
import 'core-js/features/array/includes';
import 'core-js/features/object/assign';
```

2. **Feature detection:**
```tsx
const useFeatureSupport = () => {
  const [support, setSupport] = useState({
    svg: false,
    canvas: false,
    flexbox: false,
  });
  
  useEffect(() => {
    setSupport({
      svg: !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect),
      canvas: !!(document.createElement('canvas').getContext),
      flexbox: CSS.supports('display', 'flex'),
    });
  }, []);
  
  return support;
};
```

### Safari Issues

**Problem:** Charts render differently in Safari

**Solutions:**

1. **Safari-specific styles:**
```css
/* Safari-specific fixes */
@supports (-webkit-appearance: none) {
  .chart-container {
    -webkit-transform: translateZ(0);
  }
}
```

2. **Date handling:**
```tsx
const safariSafeDate = (dateString) => {
  // Safari requires specific date format
  return new Date(dateString.replace(/-/g, '/'));
};
```

## Development and Debugging

### Debug Mode

**Enable comprehensive debugging:**

```tsx
const DEBUG_CHARTS = process.env.NODE_ENV === 'development';

const DebugWrapper = ({ children, name }) => {
  useEffect(() => {
    if (DEBUG_CHARTS) {
      console.group(`Chart Debug: ${name}`);
      console.log('Props:', children.props);
      console.log('Environment:', { NODE_ENV: process.env.NODE_ENV });
      console.groupEnd();
    }
  }, [children.props, name]);
  
  if (DEBUG_CHARTS) {
    return (
      <div style={{ border: '2px dashed red', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '-20px',
          left: '0',
          background: 'red',
          color: 'white',
          fontSize: '12px',
          padding: '2px 6px',
        }}>
          DEBUG: {name}
        </div>
        {children}
      </div>
    );
  }
  
  return children;
};

// Usage
<DebugWrapper name="PlanFactChart">
  <PlanFactBarChart data={data} />
</DebugWrapper>
```

### Error Boundaries

```tsx
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Chart Error Boundary:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Send to error reporting service
    if (window.Sentry) {
      window.Sentry.captureException(error);
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-error-boundary">
          <h3>Что-то пошло не так с графиком</h3>
          <p>Попробуйте обновить страницу</p>
          {process.env.NODE_ENV === 'development' && (
            <details>
              <summary>Детали ошибки</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

### Logging Utilities

```tsx
const chartLogger = {
  info: (message, data) => {
    if (DEBUG_CHARTS) {
      console.log(`[CHART INFO] ${message}`, data);
    }
  },
  warn: (message, data) => {
    console.warn(`[CHART WARN] ${message}`, data);
  },
  error: (message, error) => {
    console.error(`[CHART ERROR] ${message}`, error);
  },
  performance: (name, duration) => {
    if (DEBUG_CHARTS) {
      console.log(`[CHART PERF] ${name}: ${duration.toFixed(2)}ms`);
    }
  },
};

// Usage
chartLogger.info('Rendering chart', { dataLength: data.length });
chartLogger.warn('Large dataset detected', { size: data.length });
chartLogger.error('Chart render failed', error);
```

This troubleshooting guide should help you quickly identify and resolve most chart-related issues in the Family Budget application. Remember to check the browser console for error messages and use the debugging tools provided to diagnose problems effectively.