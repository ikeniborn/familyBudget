// Types for search and filtering
export interface SearchFilter {
  id: string;
  name: string;
  field: string;
  operator: FilterOperator;
  value: any;
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'select';
  options?: { value: any; label: string }[];
}

export interface FilterGroup {
  id: string;
  logic: 'AND' | 'OR';
  filters: SearchFilter[];
  groups?: FilterGroup[];
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  filterGroup: FilterGroup;
  isPublic: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  tags: string[];
}

export interface QuickFilter {
  id: string;
  name: string;
  entityType: string;
  filterGroup: FilterGroup;
  icon?: string;
  color?: string;
  shortcut?: string;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  searchTime: number;
  facets?: SearchFacet[];
  suggestions?: string[];
  highlights?: Record<string, string[]>;
}

export interface SearchFacet {
  field: string;
  label: string;
  values: Array<{
    value: any;
    label: string;
    count: number;
  }>;
}

export interface CrossReferenceResult {
  sourceEntity: string;
  sourceId: number;
  targetEntity: string;
  targetItems: any[];
  relationship: string;
}

export interface FullTextSearchOptions {
  entities?: string[];
  fields?: string[];
  fuzzy?: boolean;
  boost?: Record<string, number>;
  highlight?: boolean;
  facets?: string[];
  limit?: number;
  offset?: number;
}

export type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'greater_than' | 'greater_than_or_equal'
  | 'less_than' | 'less_than_or_equal'
  | 'between' | 'not_between'
  | 'in' | 'not_in'
  | 'is_null' | 'is_not_null'
  | 'is_empty' | 'is_not_empty'
  | 'regex' | 'not_regex';

// Search Service Class
class SearchService {
  private searchIndex: Map<string, any[]> = new Map();
  private savedFilters: SavedFilter[] = [];
  private quickFilters: QuickFilter[] = [];

  constructor() {
    this.initializeQuickFilters();
    this.loadSavedFilters();
  }

  // Full-text search across all entities
  async fullTextSearch(
    query: string,
    options: FullTextSearchOptions = {}
  ): Promise<SearchResult<any>> {
    const startTime = Date.now();
    const {
      entities = ['periods', 'financial_centers', 'cost_centers', 'nomenclatures'],
      fields = [],
      fuzzy = true,
      boost = {},
      highlight = false,
      facets = [],
      limit = 50,
      offset = 0
    } = options;

    try {
      let allResults: any[] = [];
      const facetData: Record<string, Map<any, number>> = {};

      // Initialize facet data
      facets.forEach(facet => {
        facetData[facet] = new Map();
      });

      // Search each entity type
      for (const entityType of entities) {
        const entityResults = await this.searchEntity(entityType, query, fields, fuzzy, boost[entityType]);
        
        // Add entity type to results
        entityResults.forEach(item => {
          item._entityType = entityType;
          item._score = this.calculateRelevanceScore(item, query, boost[entityType] || 1);
        });

        allResults.push(...entityResults);

        // Collect facet data
        if (facets.length > 0) {
          this.collectFacetData(entityResults, facets, facetData);
        }
      }

      // Sort by relevance score
      allResults.sort((a, b) => (b._score || 0) - (a._score || 0));

      // Apply pagination
      const total = allResults.length;
      const paginatedResults = allResults.slice(offset, offset + limit);

      // Generate highlights
      const highlights: Record<string, string[]> = {};
      if (highlight) {
        paginatedResults.forEach((item, index) => {
          highlights[index] = this.generateHighlights(item, query);
        });
      }

      // Convert facet data to SearchFacet format
      const searchFacets: SearchFacet[] = facets.map(facetField => ({
        field: facetField,
        label: this.getFacetLabel(facetField),
        values: Array.from(facetData[facetField].entries())
          .map(([value, count]) => ({
            value,
            label: String(value),
            count
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10) // Top 10 facet values
      }));

      const searchTime = Date.now() - startTime;

      return {
        items: paginatedResults,
        total,
        searchTime,
        facets: searchFacets,
        suggestions: this.generateSuggestions(query, allResults),
        highlights
      };
    } catch (error) {
      console.error('Full-text search failed:', error);
      return {
        items: [],
        total: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  // Apply advanced filters
  async applyFilters<T>(
    data: T[],
    filterGroup: FilterGroup
  ): Promise<T[]> {
    return this.applyFilterGroup(data, filterGroup);
  }

  // Save a filter
  async saveFilter(
    name: string,
    description: string,
    entityType: string,
    filterGroup: FilterGroup,
    userId: number,
    isPublic = false,
    tags: string[] = []
  ): Promise<SavedFilter> {
    const savedFilter: SavedFilter = {
      id: `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      entityType,
      filterGroup,
      isPublic,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      tags
    };

    this.savedFilters.push(savedFilter);
    this.persistSavedFilters();

    return savedFilter;
  }

  // Get saved filters
  getSavedFilters(entityType?: string, userId?: number): SavedFilter[] {
    let filters = this.savedFilters;

    if (entityType) {
      filters = filters.filter(f => f.entityType === entityType);
    }

    if (userId) {
      filters = filters.filter(f => f.isPublic || f.createdBy === userId);
    }

    return filters.sort((a, b) => b.usageCount - a.usageCount);
  }

  // Apply saved filter
  async applySavedFilter<T>(
    data: T[],
    filterId: string
  ): Promise<T[]> {
    const filter = this.savedFilters.find(f => f.id === filterId);
    if (!filter) {
      throw new Error('Saved filter not found');
    }

    // Increment usage count
    filter.usageCount++;
    filter.updatedAt = new Date().toISOString();
    this.persistSavedFilters();

    return this.applyFilters(data, filter.filterGroup);
  }

  // Get quick filters
  getQuickFilters(entityType?: string): QuickFilter[] {
    if (entityType) {
      return this.quickFilters.filter(f => f.entityType === entityType);
    }
    return this.quickFilters;
  }

  // Apply quick filter
  async applyQuickFilter<T>(
    data: T[],
    filterId: string
  ): Promise<T[]> {
    const filter = this.quickFilters.find(f => f.id === filterId);
    if (!filter) {
      throw new Error('Quick filter not found');
    }

    return this.applyFilters(data, filter.filterGroup);
  }

  // Private helper methods
  private async searchEntity(
    entityType: string,
    query: string,
    fields: string[],
    fuzzy: boolean,
    boost: number = 1
  ): Promise<any[]> {
    // Get data from cache or service
    let data = this.searchIndex.get(entityType);
    if (!data) {
      data = await this.loadEntityData(entityType);
      this.searchIndex.set(entityType, data);
    }

    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: any[] = [];

    for (const item of data) {
      let score = 0;
      const searchableFields = fields.length > 0 ? fields : this.getSearchableFields(entityType);

      for (const field of searchableFields) {
        const fieldValue = String(item[field] || '').toLowerCase();
        
        for (const term of searchTerms) {
          if (fieldValue.includes(term)) {
            score += this.getFieldBoost(field) * boost;
            
            // Exact match bonus
            if (fieldValue === term) {
              score += 5;
            }
            
            // Start of field bonus
            if (fieldValue.startsWith(term)) {
              score += 2;
            }
          } else if (fuzzy && this.fuzzyMatch(fieldValue, term)) {
            score += 0.5 * boost;
          }
        }
      }

      if (score > 0) {
        results.push({ ...item, _score: score });
      }
    }

    return results;
  }

  private calculateRelevanceScore(item: any, _query: string, boost: number): number {
    return (item._score || 0) * boost;
  }

  private collectFacetData(
    results: any[],
    facets: string[],
    facetData: Record<string, Map<any, number>>
  ): void {
    for (const item of results) {
      for (const facetField of facets) {
        const value = item[facetField];
        if (value !== undefined && value !== null) {
          const currentCount = facetData[facetField].get(value) || 0;
          facetData[facetField].set(value, currentCount + 1);
        }
      }
    }
  }

  private generateHighlights(item: any, query: string): string[] {
    const highlights: string[] = [];
    const terms = query.toLowerCase().split(/\s+/);

    for (const [field, value] of Object.entries(item)) {
      const stringValue = String(value).toLowerCase();
      for (const term of terms) {
        if (stringValue.includes(term)) {
          const highlightedValue = String(value).replace(
            new RegExp(term, 'gi'),
            `<mark>$&</mark>`
          );
          highlights.push(`${field}: ${highlightedValue}`);
        }
      }
    }

    return highlights;
  }

  private generateSuggestions(query: string, results: any[]): string[] {
    // Generate search suggestions based on query and results
    const suggestions: Set<string> = new Set();
    
    // Add common field values that partially match the query
    for (const item of results.slice(0, 10)) {
      for (const [, value] of Object.entries(item)) {
        const stringValue = String(value);
        if (stringValue.toLowerCase().includes(query.toLowerCase()) && 
            stringValue.length > query.length) {
          suggestions.add(stringValue);
        }
      }
    }

    return Array.from(suggestions).slice(0, 5);
  }

  private getFacetLabel(field: string): string {
    const labels: Record<string, string> = {
      'is_active': 'Статус',
      'nomenclature_type': 'Тип номенклатуры',
      'budget_period': 'Период бюджета',
      'unit': 'Единица измерения',
      '_entityType': 'Тип сущности'
    };
    
    return labels[field] || field;
  }

  private applyFilterGroup<T>(data: T[], group: FilterGroup): T[] {
    let result = data;

    // Apply filters within this group
    if (group.filters.length > 0) {
      if (group.logic === 'AND') {
        for (const filter of group.filters) {
          result = this.applyFilter(result, filter);
        }
      } else {
        // OR logic - combine results from each filter
        const allResults: T[] = [];
        for (const filter of group.filters) {
          const filterResults = this.applyFilter(data, filter);
          allResults.push(...filterResults);
        }
        // Remove duplicates
        result = Array.from(new Set(allResults));
      }
    }

    // Apply nested groups
    if (group.groups && group.groups.length > 0) {
      if (group.logic === 'AND') {
        for (const nestedGroup of group.groups) {
          result = this.applyFilterGroup(result, nestedGroup);
        }
      } else {
        const allResults: T[] = [];
        for (const nestedGroup of group.groups) {
          const groupResults = this.applyFilterGroup(data, nestedGroup);
          allResults.push(...groupResults);
        }
        result = Array.from(new Set([...result, ...allResults]));
      }
    }

    return result;
  }

  private applyFilter<T>(data: T[], filter: SearchFilter): T[] {
    return data.filter(item => {
      const fieldValue = (item as any)[filter.field];
      return this.evaluateFilter(fieldValue, filter.operator, filter.value);
    });
  }

  private evaluateFilter(fieldValue: any, operator: FilterOperator, filterValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === filterValue;
      case 'not_equals':
        return fieldValue !== filterValue;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase());
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(filterValue);
      case 'greater_than_or_equal':
        return Number(fieldValue) >= Number(filterValue);
      case 'less_than':
        return Number(fieldValue) < Number(filterValue);
      case 'less_than_or_equal':
        return Number(fieldValue) <= Number(filterValue);
      case 'between':
        const [min, max] = Array.isArray(filterValue) ? filterValue : [filterValue, filterValue];
        return Number(fieldValue) >= Number(min) && Number(fieldValue) <= Number(max);
      case 'not_between':
        const [notMin, notMax] = Array.isArray(filterValue) ? filterValue : [filterValue, filterValue];
        return Number(fieldValue) < Number(notMin) || Number(fieldValue) > Number(notMax);
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(fieldValue);
      case 'not_in':
        return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'is_empty':
        return fieldValue === '' || fieldValue === null || fieldValue === undefined;
      case 'is_not_empty':
        return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
      case 'regex':
        try {
          return new RegExp(filterValue).test(String(fieldValue));
        } catch {
          return false;
        }
      case 'not_regex':
        try {
          return !new RegExp(filterValue).test(String(fieldValue));
        } catch {
          return true;
        }
      default:
        return true;
    }
  }

  private fuzzyMatch(text: string, pattern: string): boolean {
    // Simple fuzzy matching algorithm (Levenshtein distance)
    const maxDistance = Math.floor(pattern.length / 3);
    return this.levenshteinDistance(text, pattern) <= maxDistance;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async loadEntityData(_entityType: string): Promise<any[]> {
    // This would typically load from a service
    // For now, return empty array - services would be called in real implementation
    return [];
  }

  private getSearchableFields(entityType: string): string[] {
    const fieldMappings: Record<string, string[]> = {
      periods: ['period_name', 'period_year', 'period_month'],
      financial_centers: ['financial_center_name', 'financial_center_description'],
      cost_centers: ['cost_center_name', 'cost_center_description'],
      nomenclatures: ['nomenclature_name', 'nomenclature_type'],
    };

    return fieldMappings[entityType] || [];
  }

  private getFieldBoost(field: string): number {
    const boosts: Record<string, number> = {
      'name': 3,
      'period_name': 3,
      'financial_center_name': 3,
      'cost_center_name': 3,
      'nomenclature_name': 3,
      'product_name': 3,
      'description': 1,
      'barcode': 2
    };

    return boosts[field] || 1;
  }

  private initializeQuickFilters(): void {
    this.quickFilters = [
      {
        id: 'active_only',
        name: 'Только активные',
        entityType: 'all',
        icon: 'check-circle',
        color: 'green',
        shortcut: 'Ctrl+A',
        filterGroup: {
          id: 'active_filter',
          logic: 'AND',
          filters: [{
            id: 'is_active_filter',
            name: 'Активные записи',
            field: 'is_active',
            operator: 'equals',
            value: true,
            dataType: 'boolean'
          }]
        }
      },
      {
        id: 'inactive_only',
        name: 'Только неактивные',
        entityType: 'all',
        icon: 'x-circle',
        color: 'red',
        filterGroup: {
          id: 'inactive_filter',
          logic: 'AND',
          filters: [{
            id: 'is_inactive_filter',
            name: 'Неактивные записи',
            field: 'is_active',
            operator: 'equals',
            value: false,
            dataType: 'boolean'
          }]
        }
      },
      {
        id: 'income_nomenclatures',
        name: 'Доходы',
        entityType: 'nomenclatures',
        icon: 'trending-up',
        color: 'green',
        filterGroup: {
          id: 'income_filter',
          logic: 'AND',
          filters: [{
            id: 'income_type_filter',
            name: 'Тип: Доход',
            field: 'nomenclature_type',
            operator: 'equals',
            value: 'INCOME',
            dataType: 'select'
          }]
        }
      },
      {
        id: 'expense_nomenclatures',
        name: 'Расходы',
        entityType: 'nomenclatures',
        icon: 'trending-down',
        color: 'red',
        filterGroup: {
          id: 'expense_filter',
          logic: 'AND',
          filters: [{
            id: 'expense_type_filter',
            name: 'Тип: Расход',
            field: 'nomenclature_type',
            operator: 'equals',
            value: 'EXPENSE',
            dataType: 'select'
          }]
        }
      }
    ];
  }

  private loadSavedFilters(): void {
    const key = 'search_saved_filters';
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        this.savedFilters = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to load saved filters:', error);
        this.savedFilters = [];
      }
    }
  }

  private persistSavedFilters(): void {
    const key = 'search_saved_filters';
    try {
      localStorage.setItem(key, JSON.stringify(this.savedFilters));
    } catch (error) {
      console.error('Failed to persist saved filters:', error);
    }
  }
}

// Export singleton instance
export const searchService = new SearchService();