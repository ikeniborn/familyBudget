import { writable, derived, type Readable } from 'svelte/store';
import { validateChartData } from '../../utils/charts/dataTransform';

export interface ChartDataOptions {
  refreshInterval?: number;
  autoRefresh?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: any[]) => void;
}

export interface ChartDataStore<T> {
  data: Readable<T[]>;
  loading: Readable<boolean>;
  error: Readable<string | null>;
  isValid: Readable<boolean>;
  validationErrors: Readable<string[]>;
  refresh: () => void;
  setData: (data: T[]) => void;
  setDataSource: (dataSource: (() => Promise<T[]>) | T[]) => void;
}

/**
 * Store for managing chart data with loading states and validation
 */
export function createChartDataStore<T = any>(
  dataSource?: (() => Promise<T[]>) | T[],
  options: ChartDataOptions = {}
): ChartDataStore<T> {
  const data = writable<T[]>([]);
  const loading = writable(true);
  const error = writable<string | null>(null);
  
  let currentDataSource = dataSource;
  let refreshIntervalId: NodeJS.Timeout | null = null;
  
  const {
    refreshInterval,
    autoRefresh = false,
    onError,
    onSuccess,
  } = options;

  // Derive validation state
  const validation = derived(data, ($data) => {
    return validateChartData($data);
  });

  const isValid = derived(validation, ($validation) => $validation.isValid);
  const validationErrors = derived(validation, ($validation) => $validation.errors);

  const fetchData = async () => {
    if (!currentDataSource) return;

    if (typeof currentDataSource === 'function') {
      try {
        loading.set(true);
        error.set(null);
        const result = await currentDataSource();
        data.set(result);
        onSuccess?.(result);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load chart data';
        error.set(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        loading.set(false);
      }
    } else {
      data.set(currentDataSource);
      loading.set(false);
      error.set(null);
      onSuccess?.(currentDataSource);
    }
  };

  const setDataSource = (newDataSource: (() => Promise<T[]>) | T[]) => {
    currentDataSource = newDataSource;
    fetchData();
    setupAutoRefresh();
  };

  const setData = (newData: T[]) => {
    data.set(newData);
    loading.set(false);
    error.set(null);
    onSuccess?.(newData);
  };

  const setupAutoRefresh = () => {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }

    if (autoRefresh && refreshInterval && typeof currentDataSource === 'function') {
      refreshIntervalId = setInterval(fetchData, refreshInterval);
    }
  };

  // Initial fetch
  if (currentDataSource) {
    fetchData();
    setupAutoRefresh();
  }

  return {
    data: { subscribe: data.subscribe },
    loading: { subscribe: loading.subscribe },
    error: { subscribe: error.subscribe },
    isValid,
    validationErrors,
    refresh: fetchData,
    setData,
    setDataSource,
  };
}