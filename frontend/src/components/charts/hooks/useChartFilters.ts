import { useState, useMemo, useCallback } from 'react';
import { filterByDateRange, sortChartData } from '../utils/dataTransform';

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

export interface UseChartFiltersReturn<T> {
  filteredData: T[];
  filters: ChartFilterState;
  setDateRange: (start: string, end: string) => void;
  setCategories: (categories: string[]) => void;
  setSorting: (sortBy: ChartFilterState['sortBy'], order?: ChartFilterState['sortOrder']) => void;
  setSearch: (search: string) => void;
  setLimit: (limit: number) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * Hook for managing chart data filters and transformations
 */
export function useChartFilters<T extends Record<string, any>>(
  data: T[],
  initialFilters: ChartFilterState = {}
): UseChartFiltersReturn<T> {
  const [filters, setFilters] = useState<ChartFilterState>(initialFilters);

  // Apply all filters to the data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Date range filter
    if (filters.dateRange && 'date' in result[0]) {
      result = filterByDateRange(
        result as any[],
        filters.dateRange.start,
        filters.dateRange.end
      ) as T[];
    }

    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      result = result.filter(item => {
        const category = item.category || item.name || '';
        return filters.categories!.includes(category);
      });
    }

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
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
    if (filters.sortBy) {
      result = sortChartData(
        result as any[],
        filters.sortBy,
        filters.sortOrder || 'desc'
      ) as T[];
    }

    // Limit results
    if (filters.limit && filters.limit > 0) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }, [data, filters]);

  // Filter setters
  const setDateRange = useCallback((start: string, end: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: { start, end },
    }));
  }, []);

  const setCategories = useCallback((categories: string[]) => {
    setFilters(prev => ({
      ...prev,
      categories,
    }));
  }, []);

  const setSorting = useCallback((
    sortBy: ChartFilterState['sortBy'],
    order: ChartFilterState['sortOrder'] = 'desc'
  ) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: order,
    }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters(prev => ({
      ...prev,
      search,
    }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setFilters(prev => ({
      ...prev,
      limit,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.dateRange ||
      (filters.categories && filters.categories.length > 0) ||
      filters.search ||
      filters.limit
    );
  }, [filters]);

  return {
    filteredData,
    filters,
    setDateRange,
    setCategories,
    setSorting,
    setSearch,
    setLimit,
    clearFilters,
    hasActiveFilters,
  };
}