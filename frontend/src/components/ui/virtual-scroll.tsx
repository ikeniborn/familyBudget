import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Types for virtual scrolling
export interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number, scrollLeft: number) => void;
  estimatedItemHeight?: number;
  horizontal?: boolean;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}

interface VirtualScrollState {
  scrollTop: number;
  scrollLeft: number;
  isScrolling: boolean;
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  totalWidth: number;
}

// Virtual Scroll Component
export const VirtualScroll = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  getItemKey = (_, index) => index,
  overscan = 5,
  className = '',
  onScroll,
  estimatedItemHeight = 50,
  horizontal = false,
  onEndReached,
  onEndReachedThreshold = 200
}: VirtualScrollProps<T>) => {
  const [state, setState] = useState<VirtualScrollState>({
    scrollTop: 0,
    scrollLeft: 0,
    isScrolling: false,
    startIndex: 0,
    endIndex: 0,
    totalHeight: 0,
    totalWidth: 0
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const itemHeightCache = useRef<Map<number, number>>(new Map());

  // Calculate item dimensions
  const getItemHeight = useCallback((index: number): number => {
    if (typeof itemHeight === 'function') {
      if (!itemHeightCache.current.has(index)) {
        const height = itemHeight(items[index], index);
        itemHeightCache.current.set(index, height);
      }
      return itemHeightCache.current.get(index) || estimatedItemHeight;
    }
    return itemHeight;
  }, [itemHeight, items, estimatedItemHeight]);

  // Calculate total dimensions and visible range
  const { visibleRange, totalSize, itemPositions } = useMemo(() => {
    const positions: number[] = [];
    let totalSize = 0;

    // Calculate positions for each item
    for (let i = 0; i < items.length; i++) {
      positions[i] = totalSize;
      totalSize += getItemHeight(i);
    }

    const scrollPosition = horizontal ? state.scrollLeft : state.scrollTop;
    const containerSize = horizontal ? containerRef.current?.clientWidth || 0 : containerHeight;

    // Find visible range
    let startIndex = 0;
    let endIndex = items.length - 1;

    // Binary search for start index
    let low = 0;
    let high = items.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midPosition = positions[mid];
      const midSize = getItemHeight(mid);

      if (midPosition + midSize < scrollPosition) {
        low = mid + 1;
      } else {
        high = mid - 1;
        startIndex = mid;
      }
    }

    // Find end index
    let currentPosition = positions[startIndex];
    endIndex = startIndex;
    while (endIndex < items.length && currentPosition < scrollPosition + containerSize) {
      currentPosition += getItemHeight(endIndex);
      endIndex++;
    }

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(items.length - 1, endIndex + overscan);

    return {
      visibleRange: { startIndex, endIndex },
      totalSize,
      itemPositions: positions
    };
  }, [items, state.scrollTop, state.scrollLeft, containerHeight, horizontal, overscan, getItemHeight]);

  // Update state when visible range changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      startIndex: visibleRange.startIndex,
      endIndex: visibleRange.endIndex,
      totalHeight: horizontal ? 0 : totalSize,
      totalWidth: horizontal ? totalSize : 0
    }));
  }, [visibleRange, totalSize, horizontal]);

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollLeft } = event.currentTarget;

    setState(prev => ({
      ...prev,
      scrollTop,
      scrollLeft,
      isScrolling: true
    }));

    onScroll?.(scrollTop, scrollLeft);

    // Check if end reached
    if (onEndReached && !horizontal) {
      const { scrollHeight, clientHeight } = event.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < onEndReachedThreshold) {
        onEndReached();
      }
    }

    // Clear scrolling state after delay
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isScrolling: false }));
    }, 150);
  }, [onScroll, onEndReached, horizontal, onEndReachedThreshold]);

  // Render visible items
  const visibleItems = useMemo(() => {
    const items: React.ReactNode[] = [];

    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      if (i >= 0 && i < items.length) {
        const item = items[i];
        const position = itemPositions[i];
        const size = getItemHeight(i);

        const style: React.CSSProperties = horizontal
          ? {
              position: 'absolute',
              left: position,
              width: size,
              height: '100%'
            }
          : {
              position: 'absolute',
              top: position,
              height: size,
              width: '100%'
            };

        items.push(
          <div key={getItemKey(item, i)} style={style}>
            {renderItem(item, i, style)}
          </div>
        );
      }
    }

    return items;
  }, [visibleRange, items, itemPositions, getItemHeight, horizontal, renderItem, getItemKey]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: state.totalHeight || containerHeight,
          width: state.totalWidth || '100%',
          position: 'relative'
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
};

// Hook for virtual scrolling with dynamic heights
export const useVirtualScroll = <T,>(
  items: T[],
  containerHeight: number,
  estimatedItemHeight = 50
) => {
  const [itemHeights, setItemHeights] = useState<Map<number, number>>(new Map());
  const [scrollTop, setScrollTop] = useState(0);

  const measureItem = useCallback((index: number, height: number) => {
    setItemHeights(prev => {
      const newMap = new Map(prev);
      newMap.set(index, height);
      return newMap;
    });
  }, []);

  const getItemHeight = useCallback((index: number) => {
    return itemHeights.get(index) || estimatedItemHeight;
  }, [itemHeights, estimatedItemHeight]);

  const scrollToIndex = useCallback((index: number) => {
    let totalHeight = 0;
    for (let i = 0; i < index; i++) {
      totalHeight += getItemHeight(i);
    }
    setScrollTop(totalHeight);
  }, [getItemHeight]);

  const scrollToTop = useCallback(() => {
    setScrollTop(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    let totalHeight = 0;
    for (let i = 0; i < items.length; i++) {
      totalHeight += getItemHeight(i);
    }
    setScrollTop(totalHeight - containerHeight);
  }, [items.length, getItemHeight, containerHeight]);

  return {
    scrollTop,
    measureItem,
    getItemHeight,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    setScrollTop
  };
};

// Grid Virtual Scroll Component for 2D layouts
export interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  getItemKey?: (item: T, index: number) => string | number;
  gap?: number;
  overscan?: number;
  className?: string;
}

export const VirtualGrid = <T,>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  getItemKey = (_, index) => index,
  gap = 0,
  overscan = 5,
  className = ''
}: VirtualGridProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const columns = Math.floor(containerWidth / (itemWidth + gap));
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap) - gap;

  // Calculate visible range
  const { startRow, endRow, visibleItems } = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
    const endRow = Math.min(
      rows - 1,
      Math.ceil((scrollTop + containerHeight) / (itemHeight + gap)) + overscan
    );

    const visibleItems: React.ReactNode[] = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (index >= items.length) break;

        const item = items[index];
        const x = col * (itemWidth + gap);
        const y = row * (itemHeight + gap);

        const style: React.CSSProperties = {
          position: 'absolute',
          left: x,
          top: y,
          width: itemWidth,
          height: itemHeight
        };

        visibleItems.push(
          <div key={getItemKey(item, index)} style={style}>
            {renderItem(item, index, style)}
          </div>
        );
      }
    }

    return { startRow, endRow, visibleItems };
  }, [
    scrollTop,
    containerHeight,
    itemHeight,
    itemWidth,
    gap,
    overscan,
    rows,
    columns,
    items,
    renderItem,
    getItemKey
  ]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      style={{ width: containerWidth, height: containerHeight }}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: totalHeight,
          width: '100%',
          position: 'relative'
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
};

// Intersection Observer based lazy loading for virtual scroll
export const LazyVirtualScroll = <T,>({
  renderItem,
  ...props
}: VirtualScrollProps<T>) => {
  const observerRef = useRef<IntersectionObserver>();
  const [loadedItems, setLoadedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const newLoadedItems = new Set(loadedItems);
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            newLoadedItems.add(index);
          }
        });
        setLoadedItems(newLoadedItems);
      },
      { threshold: 0.1 }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadedItems]);

  const lazyRenderItem = useCallback(
    (item: T, index: number, style: React.CSSProperties) => {
      const isLoaded = loadedItems.has(index);

      return (
        <div
          data-index={index}
          ref={(el) => {
            if (el && observerRef.current) {
              observerRef.current.observe(el);
            }
          }}
          style={style}
        >
          {isLoaded ? (
            renderItem(item, index, style)
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="animate-pulse text-gray-400">Загрузка...</div>
            </div>
          )}
        </div>
      );
    },
    [renderItem, loadedItems]
  );

  return <VirtualScroll {...props} renderItem={lazyRenderItem} />;
};