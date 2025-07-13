import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// Basic debounce hook
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Advanced debounce hook with cancel and immediate options
export const useAdvancedDebounce = <T>(
  value: T,
  delay: number,
  options: {
    leading?: boolean; // Execute immediately on first call
    trailing?: boolean; // Execute after delay (default: true)
    maxWait?: number; // Maximum time to wait before executing
  } = {}
) => {
  const { leading = false, trailing = true, maxWait } = options;
  
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>(0);
  const lastInvokeTimeRef = useRef<number>(0);
  const hasInvokedRef = useRef<boolean>(false);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    hasInvokedRef.current = false;
  }, []);

  const invokeFunc = useCallback(() => {
    setDebouncedValue(value);
    lastInvokeTimeRef.current = Date.now();
    hasInvokedRef.current = true;
  }, [value]);

  const shouldInvoke = useCallback((time: number) => {
    const timeSinceLastCall = time - lastCallTimeRef.current;
    const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

    return (
      !hasInvokedRef.current ||
      timeSinceLastCall >= delay ||
      (maxWait && timeSinceLastInvoke >= maxWait)
    );
  }, [delay, maxWait]);

  const leadingEdge = useCallback((time: number) => {
    lastInvokeTimeRef.current = time;
    if (leading) {
      invokeFunc();
    }
  }, [leading, invokeFunc]);

  const trailingEdge = useCallback(() => {
    timeoutRef.current = undefined;
    if (trailing && hasInvokedRef.current) {
      invokeFunc();
    }
    hasInvokedRef.current = false;
  }, [trailing, invokeFunc]);

  useEffect(() => {
    const time = Date.now();
    lastCallTimeRef.current = time;

    if (shouldInvoke(time)) {
      if (!timeoutRef.current && !hasInvokedRef.current) {
        leadingEdge(time);
      }
    }

    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
    }

    // Set trailing timeout
    if (trailing || !leading) {
      timeoutRef.current = setTimeout(trailingEdge, delay);
    }

    // Set max wait timeout
    if (maxWait && !hasInvokedRef.current) {
      maxTimeoutRef.current = setTimeout(() => {
        if (hasInvokedRef.current) {
          invokeFunc();
        }
      }, maxWait);
    }

    hasInvokedRef.current = true;

    return cancel;
  }, [value, delay, shouldInvoke, leadingEdge, trailingEdge, maxWait, cancel, invokeFunc]);

  return {
    debouncedValue,
    cancel,
    flush: invokeFunc // Execute immediately
  };
};

// Debounced callback hook
export const useDebouncedCallback = <Args extends any[]>(
  callback: (...args: Args) => void | Promise<void>,
  delay: number,
  options: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
  } = {}
) => {
  const { leading = false, trailing = true, maxWait } = options;
  
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>(0);
  const lastInvokeTimeRef = useRef<number>(0);
  const lastArgsRef = useRef<Args>();
  const hasInvokedRef = useRef<boolean>(false);

  const invokeFunc = useCallback(async () => {
    if (lastArgsRef.current) {
      await callback(...lastArgsRef.current);
      lastInvokeTimeRef.current = Date.now();
    }
  }, [callback]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = undefined;
    }
    hasInvokedRef.current = false;
  }, []);

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
      await invokeFunc();
    }
  }, [invokeFunc]);

  const debouncedCallback = useCallback(
    (...args: Args) => {
      const time = Date.now();
      lastCallTimeRef.current = time;
      lastArgsRef.current = args;

      const timeSinceLastCall = time - lastCallTimeRef.current;
      const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

      const shouldInvoke = (
        !hasInvokedRef.current ||
        timeSinceLastCall >= delay ||
        (maxWait && timeSinceLastInvoke >= maxWait)
      );

      // Leading edge
      if (shouldInvoke && leading && !hasInvokedRef.current) {
        invokeFunc();
        lastInvokeTimeRef.current = time;
      }

      // Clear existing timeouts
      cancel();

      // Trailing edge
      if (trailing || !leading) {
        timeoutRef.current = setTimeout(async () => {
          timeoutRef.current = undefined;
          if (hasInvokedRef.current) {
            await invokeFunc();
          }
          hasInvokedRef.current = false;
        }, delay);
      }

      // Max wait
      if (maxWait && !hasInvokedRef.current) {
        maxTimeoutRef.current = setTimeout(async () => {
          if (hasInvokedRef.current) {
            await invokeFunc();
          }
        }, maxWait);
      }

      hasInvokedRef.current = true;
    },
    [callback, delay, leading, trailing, maxWait, invokeFunc, cancel]
  );

  // Cleanup on unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return {
    debouncedCallback,
    cancel,
    flush
  };
};

// Debounced search hook
export const useDebouncedSearch = <T>(
  searchFunction: (query: string) => Promise<T[]>,
  delay: number = 300,
  options: {
    minLength?: number;
    maxResults?: number;
    cache?: boolean;
    cacheTimeout?: number;
  } = {}
) => {
  const { minLength = 1, maxResults, cache = true, cacheTimeout = 5 * 60 * 1000 } = options;
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const cacheRef = useRef<Map<string, { data: T[]; timestamp: number }>>(new Map());
  const abortControllerRef = useRef<AbortController>();

  const search = useCallback(async (searchQuery: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery.length < minLength) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Check cache
    if (cache && cacheRef.current.has(searchQuery)) {
      const cached = cacheRef.current.get(searchQuery)!;
      const isExpired = Date.now() - cached.timestamp > cacheTimeout;
      
      if (!isExpired) {
        setResults(cached.data);
        setLoading(false);
        setError(null);
        return;
      } else {
        cacheRef.current.delete(searchQuery);
      }
    }

    setLoading(true);
    setError(null);

    try {
      abortControllerRef.current = new AbortController();
      
      const searchResults = await searchFunction(searchQuery);
      
      // Apply max results limit
      const limitedResults = maxResults 
        ? searchResults.slice(0, maxResults)
        : searchResults;

      // Cache results
      if (cache) {
        cacheRef.current.set(searchQuery, {
          data: limitedResults,
          timestamp: Date.now()
        });
      }

      setResults(limitedResults);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Search failed');
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [searchFunction, minLength, maxResults, cache, cacheTimeout]);

  const debouncedSearch = useDebouncedCallback(search, delay);

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch.debouncedCallback(query);
  }, [query, debouncedSearch]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    clearResults,
    clearCache,
    cancelSearch: debouncedSearch.cancel
  };
};

// Debounced async effect hook
export const useDebouncedEffect = (
  effect: () => void | Promise<void>,
  deps: React.DependencyList,
  delay: number
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      await effect();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [...deps, delay]);
};

// Debounced state hook with persistence
export const useDebouncedState = <T>(
  initialValue: T,
  delay: number,
  options: {
    persistKey?: string;
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  } = {}
) => {
  const { persistKey, serialize = JSON.stringify, deserialize = JSON.parse } = options;

  // Load initial value from storage if available
  const getInitialValue = (): T => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(persistKey);
        return stored ? deserialize(stored) : initialValue;
      } catch {
        return initialValue;
      }
    }
    return initialValue;
  };

  const [immediateValue, setImmediateValue] = useState<T>(getInitialValue);
  const debouncedValue = useDebounce(immediateValue, delay);

  // Persist debounced value to storage
  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(persistKey, serialize(debouncedValue));
      } catch (error) {
        console.warn('Failed to persist debounced state:', error);
      }
    }
  }, [debouncedValue, persistKey, serialize]);

  return [immediateValue, setImmediateValue, debouncedValue] as const;
};

// Hook for debounced API calls with automatic retry
export const useDebouncedAPI = <T, Args extends any[]>(
  apiFunction: (...args: Args) => Promise<T>,
  delay: number = 300,
  options: {
    retries?: number;
    retryDelay?: number;
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const { retries = 3, retryDelay = 1000, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const retryCountRef = useRef(0);

  const execute = useCallback(async (...args: Args) => {
    setLoading(true);
    setError(null);
    retryCountRef.current = 0;

    const attemptCall = async (): Promise<void> => {
      try {
        const result = await apiFunction(...args);
        setData(result);
        onSuccess?.(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        
        if (retryCountRef.current < retries) {
          retryCountRef.current++;
          setTimeout(attemptCall, retryDelay);
        } else {
          setError(error);
          onError?.(error);
        }
      } finally {
        if (retryCountRef.current >= retries || !error) {
          setLoading(false);
        }
      }
    };

    await attemptCall();
  }, [apiFunction, retries, retryDelay, onSuccess, onError]);

  const debouncedExecute = useDebouncedCallback(execute, delay);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
    debouncedExecute.cancel();
  }, [debouncedExecute]);

  return {
    data,
    loading,
    error,
    execute: debouncedExecute.debouncedCallback,
    cancel: debouncedExecute.cancel,
    flush: debouncedExecute.flush,
    reset
  };
};