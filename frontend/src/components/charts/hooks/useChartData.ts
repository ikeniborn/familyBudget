import { useState, useEffect, useMemo } from 'react';
import { validateChartData } from '../utils/dataTransform';

export interface UseChartDataOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: any[]) => void;
}

export interface UseChartDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isValid: boolean;
  validationErrors: string[];
}

/**
 * Hook for managing chart data with loading states and validation
 */
export function useChartData<T = any>(
  dataSource: (() => Promise<T[]>) | T[],
  options: UseChartDataOptions = {}
): UseChartDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const {
    refreshInterval,
    autoRefresh = false,
    onError,
    onSuccess,
  } = options;

  // Validate data
  const validation = useMemo(() => {
    return validateChartData(data);
  }, [data]);

  const fetchData = async () => {
    if (typeof dataSource === 'function') {
      try {
        setLoading(true);
        setError(null);
        const result = await dataSource();
        setData(result);
        onSuccess?.(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load chart data';
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    } else {
      setData(dataSource);
      setLoading(false);
      setError(null);
      onSuccess?.(dataSource);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !refreshInterval || typeof dataSource !== 'function') {
      return;
    }

    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  return {
    data,
    loading,
    error,
    refresh: fetchData,
    isValid: validation.isValid,
    validationErrors: validation.errors,
  };
}