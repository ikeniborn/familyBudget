import { useMemo } from 'react';

interface VirtualizationOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualizedResult<T> {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  scrollTop: number;
}

/**
 * Hook for virtualizing large datasets to improve performance
 */
export function useVirtualizedData<T>(
  data: T[],
  scrollTop: number,
  options: VirtualizationOptions
): VirtualizedResult<T> {
  const { itemHeight, containerHeight, overscan = 5 } = options;

  return useMemo(() => {
    const totalHeight = data.length * itemHeight;
    
    // Calculate visible range
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      data.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    // Get visible items
    const visibleItems = data.slice(startIndex, endIndex + 1);

    return {
      visibleItems,
      startIndex,
      endIndex,
      totalHeight,
      scrollTop: startIndex * itemHeight,
    };
  }, [data, scrollTop, itemHeight, containerHeight, overscan]);
}

export default useVirtualizedData;