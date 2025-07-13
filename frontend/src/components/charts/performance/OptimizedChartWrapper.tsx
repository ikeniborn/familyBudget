import React, { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { ChartSkeleton } from '../core/ChartContainer';

interface OptimizedChartWrapperProps {
  children: React.ReactNode;
  data: any[];
  loading?: boolean;
  error?: string | null;
  enableVirtualization?: boolean;
  maxDataPoints?: number;
  debounceMs?: number;
  className?: string;
}

/**
 * High-performance chart wrapper with data optimization and virtualization
 */
export const OptimizedChartWrapper: React.FC<OptimizedChartWrapperProps> = memo(({
  children,
  data,
  loading = false,
  error = null,
  enableVirtualization = false,
  maxDataPoints = 1000,
  debounceMs = 100,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [optimizedData, setOptimizedData] = useState(data);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Intersection Observer for lazy rendering
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Data optimization with debouncing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setOptimizedData(optimizeData(data, maxDataPoints, enableVirtualization));
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [data, maxDataPoints, enableVirtualization, debounceMs]);

  // Memoized data optimization
  const optimizeData = useCallback((
    rawData: any[],
    maxPoints: number,
    useVirtualization: boolean
  ): any[] => {
    if (!rawData || rawData.length === 0) return [];

    // If data is within limits, return as-is
    if (rawData.length <= maxPoints) {
      return rawData;
    }

    // For virtualization, return subset
    if (useVirtualization) {
      return rawData.slice(0, maxPoints);
    }

    // Data sampling for large datasets
    const step = Math.ceil(rawData.length / maxPoints);
    const sampled = [];
    
    for (let i = 0; i < rawData.length; i += step) {
      sampled.push(rawData[i]);
    }

    // Always include the last point
    if (sampled[sampled.length - 1] !== rawData[rawData.length - 1]) {
      sampled.push(rawData[rawData.length - 1]);
    }

    return sampled;
  }, []);

  // Error boundary fallback
  const renderErrorFallback = useCallback(() => (
    <div className="flex items-center justify-center h-64 bg-red-50 border border-red-200 rounded-lg">
      <div className="text-center">
        <p className="text-red-600 font-medium">Ошибка отображения графика</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    </div>
  ), [error]);

  // Loading state
  if (loading) {
    return (
      <div ref={containerRef} className={className}>
        <ChartSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div ref={containerRef} className={className}>
        {renderErrorFallback()}
      </div>
    );
  }

  // Empty state
  if (!optimizedData || optimizedData.length === 0) {
    return (
      <div ref={containerRef} className={className}>
        <div className="flex items-center justify-center h-64 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">Нет данных для отображения</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {/* Only render chart when visible (intersection observer) */}
      {isVisible ? (
        <React.Suspense fallback={<ChartSkeleton />}>
          {/* Clone children with optimized data */}
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                ...child.props,
                data: optimizedData,
              });
            }
            return child;
          })}
        </React.Suspense>
      ) : (
        <ChartSkeleton />
      )}
      
      {/* Data optimization indicator */}
      {data.length > maxDataPoints && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Отображено {optimizedData.length} из {data.length} точек данных
        </div>
      )}
    </div>
  );
});

OptimizedChartWrapper.displayName = 'OptimizedChartWrapper';

/**
 * Higher-order component for chart performance optimization
 */
export function withChartOptimization<P extends object>(
  Component: React.ComponentType<P>,
  defaultOptions: Partial<OptimizedChartWrapperProps> = {}
) {
  const OptimizedComponent = memo((props: P & Partial<OptimizedChartWrapperProps>) => {
    const {
      data,
      loading,
      error,
      enableVirtualization,
      maxDataPoints,
      debounceMs,
      className,
      ...componentProps
    } = props as any;

    const optimizationProps = {
      data,
      loading,
      error,
      enableVirtualization: enableVirtualization ?? defaultOptions.enableVirtualization ?? false,
      maxDataPoints: maxDataPoints ?? defaultOptions.maxDataPoints ?? 1000,
      debounceMs: debounceMs ?? defaultOptions.debounceMs ?? 100,
      className: className ?? defaultOptions.className ?? '',
    };

    return (
      <OptimizedChartWrapper {...optimizationProps}>
        <Component {...componentProps} />
      </OptimizedChartWrapper>
    );
  });

  OptimizedComponent.displayName = `withChartOptimization(${Component.displayName || Component.name})`;
  
  return OptimizedComponent;
}

export default OptimizedChartWrapper;