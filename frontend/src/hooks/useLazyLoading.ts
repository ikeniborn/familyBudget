import { useState, useEffect, useRef, useCallback } from 'react';

// Types for lazy loading
export interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  enabled?: boolean;
}

export interface LazyDataOptions<T> {
  pageSize?: number;
  loadDelay?: number;
  cacheKey?: string;
  prefetchNext?: boolean;
  estimatedTotal?: number;
}

export interface LazyDataState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  total?: number;
}

// Hook for lazy loading elements (Intersection Observer)
export const useLazyLoad = (options: LazyLoadOptions = {}) => {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    triggerOnce = true,
    enabled = true
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || (triggerOnce && hasTriggered)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) {
            setHasTriggered(true);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    const element = elementRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold, rootMargin, triggerOnce, enabled, hasTriggered]);

  return {
    elementRef,
    isVisible: enabled ? isVisible : true,
    hasTriggered
  };
};

// Hook for lazy loading data with pagination
export const useLazyData = <T>(
  loadFunction: (page: number, pageSize: number) => Promise<{
    data: T[];
    total?: number;
    hasMore?: boolean;
  }>,
  options: LazyDataOptions<T> = {}
) => {
  const {
    pageSize = 20,
    loadDelay = 0,
    cacheKey,
    prefetchNext = false,
    estimatedTotal
  } = options;

  const [state, setState] = useState<LazyDataState<T>>({
    data: [],
    loading: false,
    error: null,
    hasMore: true,
    page: 0,
    total: estimatedTotal
  });

  const cache = useRef<Map<string, T[]>>(new Map());
  const loadTimeoutRef = useRef<NodeJS.Timeout>();

  // Load more data
  const loadMore = useCallback(async (reset = false) => {
    if (state.loading || (!state.hasMore && !reset)) return;

    const nextPage = reset ? 1 : state.page + 1;
    const key = cacheKey ? `${cacheKey}-${nextPage}` : `page-${nextPage}`;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      ...(reset && { data: [], page: 0, hasMore: true })
    }));

    try {
      // Check cache first
      if (cache.current.has(key)) {
        const cachedData = cache.current.get(key)!;
        setState(prev => ({
          ...prev,
          data: reset ? cachedData : [...prev.data, ...cachedData],
          loading: false,
          page: nextPage,
          hasMore: cachedData.length === pageSize
        }));
        return;
      }

      // Add delay if specified
      if (loadDelay > 0) {
        await new Promise(resolve => {
          loadTimeoutRef.current = setTimeout(resolve, loadDelay);
        });
      }

      const result = await loadFunction(nextPage, pageSize);

      // Cache the result
      if (cacheKey) {
        cache.current.set(key, result.data);
      }

      setState(prev => ({
        ...prev,
        data: reset ? result.data : [...prev.data, ...result.data],
        loading: false,
        page: nextPage,
        hasMore: result.hasMore ?? (result.data.length === pageSize),
        total: result.total || prev.total
      }));

      // Prefetch next page if enabled
      if (prefetchNext && result.hasMore !== false && result.data.length === pageSize) {
        const nextKey = cacheKey ? `${cacheKey}-${nextPage + 1}` : `page-${nextPage + 1}`;
        if (!cache.current.has(nextKey)) {
          setTimeout(async () => {
            try {
              const nextResult = await loadFunction(nextPage + 1, pageSize);
              if (cacheKey) {
                cache.current.set(nextKey, nextResult.data);
              }
            } catch (error) {
              // Ignore prefetch errors
              console.warn('Prefetch failed:', error);
            }
          }, 100);
        }
      }

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load data'
      }));
    }
  }, [state.loading, state.hasMore, state.page, loadFunction, pageSize, loadDelay, cacheKey, prefetchNext]);

  // Reset data
  const reset = useCallback(() => {
    if (cacheKey) {
      cache.current.clear();
    }
    loadMore(true);
  }, [loadMore, cacheKey]);

  // Retry last failed request
  const retry = useCallback(() => {
    if (state.error) {
      setState(prev => ({ ...prev, error: null }));
      loadMore();
    }
  }, [state.error, loadMore]);

  // Clear cache
  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    if (state.data.length === 0 && !state.loading && !state.error) {
      loadMore();
    }
  }, []);

  return {
    ...state,
    loadMore,
    reset,
    retry,
    clearCache,
    isInitialLoad: state.page === 0 && state.loading
  };
};

// Hook for infinite scroll
export const useInfiniteScroll = <T>(
  loadFunction: (page: number, pageSize: number) => Promise<{
    data: T[];
    total?: number;
    hasMore?: boolean;
  }>,
  options: LazyDataOptions<T> & { offset?: number } = {}
) => {
  const { offset = 100, ...lazyOptions } = options;
  const { elementRef, isVisible } = useLazyLoad({
    threshold: 0.1,
    triggerOnce: false
  });

  const lazyData = useLazyData(loadFunction, lazyOptions);

  // Load more when trigger element becomes visible
  useEffect(() => {
    if (isVisible && lazyData.hasMore && !lazyData.loading) {
      lazyData.loadMore();
    }
  }, [isVisible, lazyData.hasMore, lazyData.loading]);

  return {
    ...lazyData,
    triggerRef: elementRef
  };
};

// Hook for lazy loading images
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { elementRef, isVisible } = useLazyLoad({
    threshold: 0.1,
    triggerOnce: true
  });

  useEffect(() => {
    if (isVisible && src) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
        setError(null);
      };

      img.onerror = () => {
        setError('Failed to load image');
        setIsLoaded(false);
      };

      img.src = src;
    }
  }, [isVisible, src]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isVisible,
    error
  };
};

// Component for lazy loading reference data
export interface LazyReferenceDataProps<T> {
  loadFunction: () => Promise<T[]>;
  children: (data: T[], loading: boolean, error: string | null) => React.ReactNode;
  cacheKey?: string;
  refreshInterval?: number;
  fallback?: React.ReactNode;
}

export const LazyReferenceData = <T,>({
  loadFunction,
  children,
  cacheKey,
  refreshInterval,
  fallback
}: LazyReferenceDataProps<T>) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useRef<Map<string, { data: T[]; timestamp: number }>>(new Map());

  const loadData = useCallback(async () => {
    try {
      // Check cache first
      if (cacheKey && cache.current.has(cacheKey)) {
        const cached = cache.current.get(cacheKey)!;
        const isExpired = refreshInterval && 
          Date.now() - cached.timestamp > refreshInterval;
        
        if (!isExpired) {
          setData(cached.data);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      const result = await loadFunction();
      
      // Cache the result
      if (cacheKey) {
        cache.current.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [loadFunction, cacheKey, refreshInterval]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto refresh
  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [loadData, refreshInterval]);

  if (loading && data.length === 0 && fallback) {
    return <>{fallback}</>;
  }

  return <>{children(data, loading, error)}</>;
};

// Utility for preloading data
export const preloadData = async <T>(
  key: string,
  loadFunction: () => Promise<T>,
  cache: Map<string, { data: T; timestamp: number }> = new Map()
): Promise<T> => {
  try {
    const result = await loadFunction();
    cache.set(key, {
      data: result,
      timestamp: Date.now()
    });
    return result;
  } catch (error) {
    console.error(`Failed to preload data for key: ${key}`, error);
    throw error;
  }
};

// Hook for managing lazy loading state across components
export const useLazyLoadingManager = () => {
  const [loadingStates, setLoadingStates] = useState<Map<string, boolean>>(new Map());
  const cache = useRef<Map<string, any>>(new Map());

  const setLoading = useCallback((key: string, loading: boolean) => {
    setLoadingStates(prev => {
      const newMap = new Map(prev);
      newMap.set(key, loading);
      return newMap;
    });
  }, []);

  const isLoading = useCallback((key: string) => {
    return loadingStates.get(key) || false;
  }, [loadingStates]);

  const cacheData = useCallback((key: string, data: any) => {
    cache.current.set(key, {
      data,
      timestamp: Date.now()
    });
  }, []);

  const getCachedData = useCallback((key: string, maxAge?: number) => {
    const cached = cache.current.get(key);
    if (!cached) return null;

    if (maxAge && Date.now() - cached.timestamp > maxAge) {
      cache.current.delete(key);
      return null;
    }

    return cached.data;
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      cache.current.delete(key);
    } else {
      cache.current.clear();
    }
  }, []);

  return {
    setLoading,
    isLoading,
    cacheData,
    getCachedData,
    clearCache,
    hasLoadingStates: loadingStates.size > 0
  };
};