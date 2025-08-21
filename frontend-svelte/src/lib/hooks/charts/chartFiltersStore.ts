import { writable, derived, type Readable } from 'svelte/store';
import { filterByDateRange, sortChartData } from '../../utils/charts/dataTransform';

export interface ChartFilterState {
  dateRange?: {
    start: string;
    end: string;
  };
  categories?: string[];
  sortBy?: 'value' | 'name' | 'date';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  limit?: number;
}

export interface ChartFiltersStore<T> {
  filteredData: Readable<T[]>;
  filters: Readable<ChartFilterState>;
  hasActiveFilters: Readable<boolean>;
  setDateRange: (start: string, end: string) => void;
  setCategories: (categories: string[]) => void;
  setSorting: (sortBy: ChartFilterState['sortBy'], order?: ChartFilterState['sortOrder']) => void;
  setSearch: (search: string) => void;
  setLimit: (limit: number) => void;
  clearFilters: () => void;
  updateFilters: (newFilters: Partial<ChartFilterState>) => void;
}

/**
 * Store for managing chart data filters and transformations
 */
export function createChartFiltersStore<T extends Record<string, any>>(
  data: Readable<T[]>,
  initialFilters: ChartFilterState = {}
): ChartFiltersStore<T> {
  const filters = writable<ChartFilterState>(initialFilters);

  // Apply all filters to the data
  const filteredData = derived([data, filters], ([$data, $filters]) => {
    let result = [...$data];

    // Date range filter
    if ($filters.dateRange && 'date' in result[0]) {
      result = filterByDateRange(
        result as any[],
        $filters.dateRange.start,
        $filters.dateRange.end
      ) as T[];
    }

    // Category filter
    if ($filters.categories && $filters.categories.length > 0) {
      result = result.filter(item => {
        const category = item.category || item.name || '';
        return $filters.categories!.includes(category);
      });
    }

    // Search filter
    if ($filters.search) {
      const searchLower = $filters.search.toLowerCase();
      result = result.filter(item => {
        const searchableFields = [
          item.name,
          item.category,
          item.label,
          item.description,
        ].filter(Boolean);
        
        return searchableFields.some(field => 
          String(field).toLowerCase().includes(searchLower)
        );
      });
    }

    // Sorting
    if ($filters.sortBy) {
      result = sortChartData(
        result as any[],
        $filters.sortBy,
        $filters.sortOrder || 'desc'
      ) as T[];
    }

    // Limit results
    if ($filters.limit && $filters.limit > 0) {
      result = result.slice(0, $filters.limit);
    }

    return result;
  });

  // Check if any filters are active
  const hasActiveFilters = derived(filters, ($filters) => {
    return !!(
      $filters.dateRange ||
      ($filters.categories && $filters.categories.length > 0) ||
      $filters.search ||
      $filters.limit
    );
  });

  // Filter setters
  const setDateRange = (start: string, end: string) => {
    filters.update(prev => ({
      ...prev,
      dateRange: { start, end },
    }));
  };

  const setCategories = (categories: string[]) => {
    filters.update(prev => ({
      ...prev,
      categories,
    }));
  };

  const setSorting = (
    sortBy: ChartFilterState['sortBy'],
    order: ChartFilterState['sortOrder'] = 'desc'
  ) => {
    filters.update(prev => ({
      ...prev,
      sortBy,
      sortOrder: order,
    }));
  };

  const setSearch = (search: string) => {
    filters.update(prev => ({
      ...prev,
      search,
    }));
  };

  const setLimit = (limit: number) => {
    filters.update(prev => ({
      ...prev,
      limit,
    }));
  };

  const clearFilters = () => {
    filters.set({});
  };

  const updateFilters = (newFilters: Partial<ChartFilterState>) => {
    filters.update(prev => ({
      ...prev,
      ...newFilters,
    }));
  };

  return {
    filteredData,
    filters: { subscribe: filters.subscribe },
    hasActiveFilters,
    setDateRange,
    setCategories,
    setSorting,
    setSearch,
    setLimit,
    clearFilters,
    updateFilters,
  };
}