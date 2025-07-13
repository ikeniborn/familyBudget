# Chart Performance Guidelines

This document provides comprehensive guidelines for optimizing chart performance in the Family Budget application.

## Table of Contents

- [Performance Principles](#performance-principles)
- [Data Optimization](#data-optimization)
- [Rendering Optimization](#rendering-optimization)
- [Memory Management](#memory-management)
- [Network Optimization](#network-optimization)
- [Monitoring and Profiling](#monitoring-and-profiling)
- [Best Practices](#best-practices)

## Performance Principles

### Core Performance Metrics

Monitor these key metrics for chart performance:

- **First Paint**: Time to render initial chart structure
- **Data Load Time**: Time to fetch and process chart data
- **Interaction Response**: Time between user interaction and visual feedback
- **Memory Usage**: Peak memory consumption during chart operations
- **Frame Rate**: Smoothness of animations and interactions

### Performance Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| First Paint | < 500ms | < 1000ms |
| Data Load | < 2s | < 5s |
| Interaction Response | < 100ms | < 300ms |
| Memory Usage | < 50MB | < 100MB |
| Frame Rate | 60fps | 30fps |

## Data Optimization

### Data Limiting

```tsx
// ❌ Poor: Loading unlimited data
const getAllData = async () => {
  const response = await fetch('/api/transactions'); // Could be 100k+ records
  return response.json();
};

// ✅ Good: Implement pagination and limits
const getPagedData = async (page = 1, limit = 1000) => {
  const response = await fetch(`/api/transactions?page=${page}&limit=${limit}`);
  return response.json();
};

// ✅ Better: Use data aggregation for charts
const getAggregatedData = async (groupBy = 'month', limit = 50) => {
  const response = await fetch(`/api/transactions/aggregate?groupBy=${groupBy}&limit=${limit}`);
  return response.json();
};
```

### Data Sampling

```tsx
import { useMemo } from 'react';

const useSampledData = (data, maxPoints = 500) => {
  return useMemo(() => {
    if (!data || data.length <= maxPoints) {
      return data;
    }

    // Intelligent sampling that preserves key data points
    const step = Math.ceil(data.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < data.length; i += step) {
      sampled.push(data[i]);
    }
    
    // Always include the last point
    if (sampled[sampled.length - 1] !== data[data.length - 1]) {
      sampled.push(data[data.length - 1]);
    }
    
    return sampled;
  }, [data, maxPoints]);
};

// Usage in component
const OptimizedChart = ({ rawData }) => {
  const sampledData = useSampledData(rawData, 500);
  
  return <PlanFactBarChart data={sampledData} />;
};
```

### Data Memoization

```tsx
import { useMemo, useCallback } from 'react';

const useOptimizedChartData = (rawData, filters) => {
  // Memoize expensive data transformations
  const processedData = useMemo(() => {
    if (!rawData) return [];
    
    console.time('Data processing');
    
    const result = rawData
      .filter(item => {
        // Apply filters efficiently
        if (filters.category && item.category !== filters.category) return false;
        if (filters.dateRange) {
          const itemDate = new Date(item.date);
          if (itemDate < filters.dateRange[0] || itemDate > filters.dateRange[1]) {
            return false;
          }
        }
        return true;
      })
      .map(item => ({
        // Transform data with minimal overhead
        name: item.period_name,
        planned_amount: Number(item.planned_amount) || 0,
        actual_amount: Number(item.actual_amount) || 0,
        variance: Number(item.actual_amount) - Number(item.planned_amount),
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.timeEnd('Data processing');
    return result;
  }, [rawData, filters]);

  // Memoize aggregations
  const aggregatedData = useMemo(() => {
    if (!processedData.length) return null;
    
    return {
      totalPlanned: processedData.reduce((sum, item) => sum + item.planned_amount, 0),
      totalActual: processedData.reduce((sum, item) => sum + item.actual_amount, 0),
      avgVariance: processedData.reduce((sum, item) => sum + item.variance, 0) / processedData.length,
    };
  }, [processedData]);

  return { processedData, aggregatedData };
};
```

### Data Virtualization

```tsx
import { FixedSizeList as List } from 'react-window';

const VirtualizedChartData = ({ data, renderChart }) => {
  const CHUNK_SIZE = 100;
  const chunks = useMemo(() => {
    const result = [];
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      result.push(data.slice(i, i + CHUNK_SIZE));
    }
    return result;
  }, [data]);

  const renderChartChunk = useCallback(({ index, style }) => {
    return (
      <div style={style}>
        {renderChart(chunks[index])}
      </div>
    );
  }, [chunks, renderChart]);

  return (
    <List
      height={400}
      itemCount={chunks.length}
      itemSize={400}
      itemData={chunks}
    >
      {renderChartChunk}
    </List>
  );
};
```

## Rendering Optimization

### Component Memoization

```tsx
import React, { memo, useMemo, useCallback } from 'react';

// Memoize chart components to prevent unnecessary re-renders
const OptimizedPlanFactChart = memo(({ data, title, onBarClick, ...props }) => {
  // Memoize expensive calculations
  const chartConfig = useMemo(() => ({
    margin: { top: 20, right: 30, left: 20, bottom: 5 },
    colors: {
      planned: '#3B82F6',
      actual: '#10B981',
    },
  }), []);

  // Memoize event handlers
  const handleBarClick = useCallback((chartData, index) => {
    onBarClick?.({ ...chartData, index });
  }, [onBarClick]);

  // Memoize data processing
  const processedData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      id: `${item.name}-${index}`, // Stable keys for React
      utilizationPercent: item.planned_amount > 0 
        ? (item.actual_amount / item.planned_amount) * 100 
        : 0,
    }));
  }, [data]);

  return (
    <PlanFactBarChart
      data={processedData}
      title={title}
      config={chartConfig}
      onBarClick={handleBarClick}
      {...props}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.title === nextProps.title &&
    prevProps.data.length === nextProps.data.length &&
    prevProps.data.every((item, index) => 
      item.planned_amount === nextProps.data[index]?.planned_amount &&
      item.actual_amount === nextProps.data[index]?.actual_amount
    )
  );
});
```

### Lazy Loading

```tsx
import { lazy, Suspense, useState, useEffect } from 'react';

// Lazy load heavy chart components
const HeavyAnalyticsChart = lazy(() => 
  import('./HeavyAnalyticsChart').then(module => ({
    default: module.HeavyAnalyticsChart
  }))
);

const DetailedReportChart = lazy(() => 
  import('./DetailedReportChart')
);

const OptimizedChartsPage = () => {
  const [visibleCharts, setVisibleCharts] = useState(new Set(['summary']));
  
  // Intersection Observer for progressive loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const chartId = entry.target.getAttribute('data-chart-id');
            setVisibleCharts(prev => new Set([...prev, chartId]));
          }
        });
      },
      { threshold: 0.1 }
    );

    // Observe chart containers
    document.querySelectorAll('[data-chart-id]').forEach(
      element => observer.observe(element)
    );

    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-8">
      {/* Always visible summary */}
      <SummaryChart />
      
      {/* Lazy loaded charts */}
      <div data-chart-id="analytics" className="min-h-[400px]">
        {visibleCharts.has('analytics') && (
          <Suspense fallback={<ChartSkeleton />}>
            <HeavyAnalyticsChart />
          </Suspense>
        )}
      </div>
      
      <div data-chart-id="detailed" className="min-h-[400px]">
        {visibleCharts.has('detailed') && (
          <Suspense fallback={<ChartSkeleton />}>
            <DetailedReportChart />
          </Suspense>
        )}
      </div>
    </div>
  );
};
```

### Animation Optimization

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimationOptimizedChart = ({ data, animate = true }) => {
  const prefersReducedMotion = useReducedMotion();
  
  // Disable animations for users who prefer reduced motion
  const shouldAnimate = animate && !prefersReducedMotion;
  
  // Use CSS animations instead of JavaScript when possible
  const animationConfig = useMemo(() => {
    if (!shouldAnimate) {
      return { duration: 0, easing: 'linear' };
    }
    
    return {
      duration: data.length > 50 ? 500 : 1000, // Faster for more data
      easing: 'ease-out',
      // Use hardware acceleration
      animationBegin: 0,
      animationEnd: 400,
    };
  }, [shouldAnimate, data.length]);

  return (
    <div className={shouldAnimate ? 'animate-fade-in' : ''}>
      <BarChart 
        data={data}
        animationDuration={animationConfig.duration}
        animationEasing={animationConfig.easing}
      >
        <Bar 
          dataKey="value"
          animationBegin={animationConfig.animationBegin}
          animationDuration={animationConfig.duration}
        />
      </BarChart>
    </div>
  );
};
```

## Memory Management

### Cleanup and Disposal

```tsx
import { useEffect, useRef, useCallback } from 'react';

const MemoryOptimizedChart = ({ data }) => {
  const chartRef = useRef(null);
  const animationRef = useRef(null);
  const intervalRef = useRef(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Cancel ongoing animations
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    // Clear intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Remove event listeners
    if (chartRef.current) {
      chartRef.current.removeEventListener('resize', handleResize);
    }
    
    // Clear any cached data
    cache.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Cleanup on data change to prevent memory leaks
  useEffect(() => {
    cleanup();
  }, [data, cleanup]);

  const handleResize = useCallback(() => {
    // Debounce resize handling
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(() => {
      // Handle resize logic
      if (chartRef.current) {
        chartRef.current.resize();
      }
    });
  }, []);

  return (
    <div ref={chartRef}>
      {/* Chart content */}
    </div>
  );
};
```

### Data Structure Optimization

```tsx
// ❌ Poor: Nested objects create memory overhead
const inefficientData = data.map(item => ({
  meta: {
    period: {
      name: item.period_name,
      id: item.period_id,
      dates: {
        start: item.start_date,
        end: item.end_date,
      },
    },
    category: {
      name: item.category_name,
      id: item.category_id,
    },
  },
  values: {
    planned: item.planned_amount,
    actual: item.actual_amount,
  },
}));

// ✅ Good: Flat structure reduces memory footprint
const efficientData = data.map(item => ({
  name: item.period_name,
  planned_amount: item.planned_amount,
  actual_amount: item.actual_amount,
  category: item.category_name,
  // Only include essential data for charts
}));

// ✅ Better: Use typed arrays for numeric data when possible
const optimizedNumericData = useMemo(() => {
  const plannedAmounts = new Float32Array(data.length);
  const actualAmounts = new Float32Array(data.length);
  
  data.forEach((item, index) => {
    plannedAmounts[index] = item.planned_amount;
    actualAmounts[index] = item.actual_amount;
  });
  
  return { plannedAmounts, actualAmounts };
}, [data]);
```

### Weak References for Caching

```tsx
import { useCallback, useRef } from 'react';

const useWeakCache = () => {
  const cache = useRef(new WeakMap());
  
  const getCachedValue = useCallback((key, computeFn) => {
    if (cache.current.has(key)) {
      return cache.current.get(key);
    }
    
    const value = computeFn();
    cache.current.set(key, value);
    return value;
  }, []);
  
  return getCachedValue;
};

// Usage
const CachedChart = ({ rawData }) => {
  const getCached = useWeakCache();
  
  const processedData = getCached(rawData, () => {
    // Expensive data processing
    return transformData(rawData);
  });
  
  return <Chart data={processedData} />;
};
```

## Network Optimization

### Request Debouncing

```tsx
import { useCallback, useRef } from 'react';
import { debounce } from 'lodash';

const useOptimizedDataFetch = (endpoint) => {
  const abortControllerRef = useRef(null);
  
  const fetchData = useCallback(
    debounce(async (filters) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(filters),
          signal: abortControllerRef.current.signal,
        });
        
        return await response.json();
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
        }
        throw error;
      }
    }, 300), // 300ms debounce
    [endpoint]
  );
  
  return fetchData;
};
```

### Data Compression

```tsx
// Client-side data compression for large datasets
import pako from 'pako';

const useCompressedData = () => {
  const compressData = useCallback((data) => {
    const jsonString = JSON.stringify(data);
    const compressed = pako.gzip(jsonString);
    return compressed;
  }, []);
  
  const decompressData = useCallback((compressedData) => {
    const decompressed = pako.ungzip(compressedData, { to: 'string' });
    return JSON.parse(decompressed);
  }, []);
  
  return { compressData, decompressData };
};

// Usage with localStorage
const usePersistedChartData = (key) => {
  const { compressData, decompressData } = useCompressedData();
  
  const saveData = useCallback((data) => {
    try {
      const compressed = compressData(data);
      localStorage.setItem(key, btoa(String.fromCharCode(...compressed)));
    } catch (error) {
      console.error('Failed to save compressed data:', error);
    }
  }, [key, compressData]);
  
  const loadData = useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const compressed = new Uint8Array(
        atob(stored).split('').map(char => char.charCodeAt(0))
      );
      return decompressData(compressed);
    } catch (error) {
      console.error('Failed to load compressed data:', error);
      return null;
    }
  }, [key, decompressData]);
  
  return { saveData, loadData };
};
```

### Incremental Loading

```tsx
const useIncrementalData = (baseEndpoint, pageSize = 100) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${baseEndpoint}?page=${page}&limit=${pageSize}`
      );
      const newData = await response.json();
      
      if (newData.length < pageSize) {
        setHasMore(false);
      }
      
      setData(prev => [...prev, ...newData]);
      setPage(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load more data:', error);
    } finally {
      setLoading(false);
    }
  }, [baseEndpoint, page, pageSize, loading, hasMore]);
  
  return { data, loading, hasMore, loadMore };
};

// Usage with intersection observer
const IncrementalChart = () => {
  const { data, loading, hasMore, loadMore } = useIncrementalData('/api/chart-data');
  const loadTriggerRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );
    
    if (loadTriggerRef.current) {
      observer.observe(loadTriggerRef.current);
    }
    
    return () => observer.disconnect();
  }, [loadMore, hasMore]);
  
  return (
    <div>
      <Chart data={data} />
      {hasMore && (
        <div ref={loadTriggerRef} className="h-10 flex items-center justify-center">
          {loading ? 'Загрузка...' : 'Прокрутите для загрузки'}
        </div>
      )}
    </div>
  );
};
```

## Monitoring and Profiling

### Performance Monitoring

```tsx
import { useEffect } from 'react';

const usePerformanceMonitor = (chartName) => {
  useEffect(() => {
    // Mark the start of chart rendering
    performance.mark(`${chartName}-start`);
    
    return () => {
      // Mark the end and measure duration
      performance.mark(`${chartName}-end`);
      performance.measure(
        `${chartName}-render-duration`,
        `${chartName}-start`,
        `${chartName}-end`
      );
      
      // Get the measurement
      const measures = performance.getEntriesByName(`${chartName}-render-duration`);
      if (measures.length > 0) {
        const duration = measures[0].duration;
        console.log(`${chartName} render time: ${duration.toFixed(2)}ms`);
        
        // Send to analytics if duration is concerning
        if (duration > 1000) {
          // analytics.track('slow_chart_render', { chartName, duration });
        }
      }
    };
  }, [chartName]);
};

// Usage
const MonitoredChart = ({ data }) => {
  usePerformanceMonitor('PlanFactChart');
  
  return <PlanFactBarChart data={data} />;
};
```

### Memory Profiling

```tsx
const useMemoryProfiler = (componentName) => {
  useEffect(() => {
    if (!performance.memory) return;
    
    const startMemory = performance.memory.usedJSHeapSize;
    
    return () => {
      const endMemory = performance.memory.usedJSHeapSize;
      const memoryDiff = endMemory - startMemory;
      
      console.log(`${componentName} memory usage: ${memoryDiff} bytes`);
      
      // Alert if memory usage is high
      if (memoryDiff > 10 * 1024 * 1024) { // 10MB
        console.warn(`${componentName} used ${memoryDiff / 1024 / 1024}MB`);
      }
    };
  }, [componentName]);
};
```

### Bundle Size Analysis

```bash
# Analyze bundle size impact
npm run build:analyze

# Check specific chart component sizes
npx webpack-bundle-analyzer build/static/js/*.js
```

```tsx
// Dynamic imports for code splitting
const ChartComponents = {
  PlanFactBarChart: lazy(() => 
    import('./PlanFactBarChart').then(module => ({ 
      default: module.PlanFactBarChart 
    }))
  ),
  CategoryPieChart: lazy(() => 
    import('./CategoryPieChart').then(module => ({ 
      default: module.CategoryPieChart 
    }))
  ),
  // ... other charts
};

const DynamicChart = ({ type, ...props }) => {
  const ChartComponent = ChartComponents[type];
  
  if (!ChartComponent) {
    return <div>Unknown chart type: {type}</div>;
  }
  
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartComponent {...props} />
    </Suspense>
  );
};
```

## Best Practices

### Performance Checklist

- [ ] **Data Limiting**: Implement pagination or data sampling for large datasets
- [ ] **Memoization**: Use React.memo, useMemo, and useCallback appropriately
- [ ] **Lazy Loading**: Load charts progressively based on visibility
- [ ] **Animation**: Optimize animations and respect user preferences
- [ ] **Memory**: Clean up resources and avoid memory leaks
- [ ] **Network**: Debounce requests and implement caching
- [ ] **Monitoring**: Track performance metrics and memory usage
- [ ] **Testing**: Include performance tests in your test suite

### Code Review Guidelines

```tsx
// ❌ Performance anti-patterns to avoid

// 1. Processing data in render
const BadChart = ({ rawData }) => {
  const processedData = rawData.map(item => ({ // ❌ Runs on every render
    ...item,
    calculated: item.value * 1.2,
  }));
  return <Chart data={processedData} />;
};

// 2. Inline object creation
const BadChart2 = ({ data }) => (
  <Chart 
    data={data}
    config={{ margin: { top: 20 } }} // ❌ New object every render
    onUpdate={() => console.log('updated')} // ❌ New function every render
  />
);

// 3. Unnecessary re-renders
const BadParent = () => {
  const [count, setCount] = useState(0);
  const data = getData(); // ❌ Not memoized
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <ExpensiveChart data={data} /> {/* ❌ Re-renders on count change */}
    </div>
  );
};

// ✅ Optimized versions

// 1. Memoize data processing
const GoodChart = ({ rawData }) => {
  const processedData = useMemo(() => 
    rawData.map(item => ({
      ...item,
      calculated: item.value * 1.2,
    })), [rawData]
  );
  return <Chart data={processedData} />;
};

// 2. Memoize configuration objects
const GoodChart2 = ({ data, onUpdate }) => {
  const config = useMemo(() => ({ 
    margin: { top: 20 } 
  }), []);
  
  const handleUpdate = useCallback(() => {
    console.log('updated');
    onUpdate?.();
  }, [onUpdate]);
  
  return (
    <Chart 
      data={data}
      config={config}
      onUpdate={handleUpdate}
    />
  );
};

// 3. Isolate expensive components
const GoodParent = () => {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>{count}</button>
      <MemoizedExpensiveChart /> {/* ✅ Won't re-render */}
    </div>
  );
};

const MemoizedExpensiveChart = memo(() => {
  const data = useMemo(() => getData(), []);
  return <ExpensiveChart data={data} />;
});
```

### Performance Testing

```tsx
// Performance test example
import { render, screen } from '@testing-library/react';
import { performance } from 'perf_hooks';

describe('Chart Performance', () => {
  it('renders large dataset within performance budget', async () => {
    const largeDataset = generateMockData(1000); // 1000 data points
    
    const startTime = performance.now();
    render(<PlanFactBarChart data={largeDataset} />);
    
    // Wait for chart to be rendered
    await screen.findByRole('img'); // Charts have role="img"
    
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    
    // Should render within 1 second
    expect(renderTime).toBeLessThan(1000);
  });
  
  it('handles rapid data updates efficiently', async () => {
    const { rerender } = render(<PlanFactBarChart data={[]} />);
    
    const startTime = performance.now();
    
    // Simulate rapid updates
    for (let i = 0; i < 100; i++) {
      const data = generateMockData(50);
      rerender(<PlanFactBarChart data={data} />);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Should handle 100 updates in reasonable time
    expect(totalTime).toBeLessThan(5000);
  });
});
```

By following these performance guidelines, you can ensure that charts in the Family Budget application remain responsive and efficient, providing a smooth user experience even with large datasets and complex visualizations.