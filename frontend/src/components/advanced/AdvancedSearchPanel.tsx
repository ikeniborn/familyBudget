import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '../ui/badge';
import { toast } from '../ui/use-toast';
import {
  SearchFilter,
  FilterGroup,
  SavedFilter,
  QuickFilter,
  FilterOperator,
  searchService
} from '../../services/searchService';
import {
  Search,
  Filter,
  Plus,
  Minus,
  Save,
  Star,
  Clock,
  Tag,
  X,
  Settings,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  BookOpen,
  RefreshCw
} from 'lucide-react';

interface AdvancedSearchPanelProps {
  entityType: string;
  data: any[];
  onFilteredData: (filteredData: any[]) => void;
  userId: number;
}

export const AdvancedSearchPanel: React.FC<AdvancedSearchPanelProps> = ({
  entityType,
  data,
  onFilteredData,
  userId
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: 'root',
    logic: 'AND',
    filters: [],
    groups: []
  });
  
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Filter creation state
  const [newFilter, setNewFilter] = useState<Partial<SearchFilter>>({
    field: '',
    operator: 'equals',
    value: '',
    dataType: 'string'
  });

  // Available fields for the entity type
  const availableFields = useMemo(() => {
    const fieldMappings: Record<string, Array<{field: string, label: string, type: string}>> = {
      periods: [
        { field: 'period_name', label: 'Название', type: 'string' },
        { field: 'period_year', label: 'Год', type: 'number' },
        { field: 'period_month', label: 'Месяц', type: 'number' },
        { field: 'period_order', label: 'Порядок', type: 'number' },
        { field: 'is_active', label: 'Активен', type: 'boolean' },
        { field: 'created_at', label: 'Дата создания', type: 'date' }
      ],
      financial_centers: [
        { field: 'financial_center_name', label: 'Название', type: 'string' },
        { field: 'financial_center_description', label: 'Описание', type: 'string' },
        { field: 'financial_center_order', label: 'Порядок', type: 'number' },
        { field: 'is_active', label: 'Активен', type: 'boolean' },
        { field: 'created_at', label: 'Дата создания', type: 'date' }
      ],
      cost_centers: [
        { field: 'cost_center_name', label: 'Название', type: 'string' },
        { field: 'cost_center_description', label: 'Описание', type: 'string' },
        { field: 'budget_limit', label: 'Бюджетный лимит', type: 'number' },
        { field: 'budget_period', label: 'Период бюджета', type: 'select' },
        { field: 'is_active', label: 'Активен', type: 'boolean' },
        { field: 'created_at', label: 'Дата создания', type: 'date' }
      ],
      nomenclatures: [
        { field: 'nomenclature_name', label: 'Название', type: 'string' },
        { field: 'nomenclature_type', label: 'Тип', type: 'select' },
        { field: 'color', label: 'Цвет', type: 'string' },
        { field: 'icon', label: 'Иконка', type: 'string' },
        { field: 'is_active', label: 'Активен', type: 'boolean' },
        { field: 'created_at', label: 'Дата создания', type: 'date' }
      ],
      products: [
        { field: 'product_name', label: 'Название', type: 'string' },
        { field: 'product_description', label: 'Описание', type: 'string' },
        { field: 'barcode', label: 'Штрихкод', type: 'string' },
        { field: 'unit', label: 'Единица измерения', type: 'select' },
        { field: 'is_active', label: 'Активен', type: 'boolean' },
        { field: 'created_at', label: 'Дата создания', type: 'date' }
      ]
    };
    
    return fieldMappings[entityType] || [];
  }, [entityType]);

  // Load saved and quick filters
  useEffect(() => {
    setSavedFilters(searchService.getSavedFilters(entityType, userId));
    setQuickFilters(searchService.getQuickFilters(entityType));
  }, [entityType, userId]);

  // Apply search and filters
  useEffect(() => {
    applyFiltersToData();
  }, [searchQuery, filterGroup, data]);

  const applyFiltersToData = async () => {
    setIsSearching(true);
    
    try {
      let filteredData = [...data];
      
      // Apply full-text search
      if (searchQuery.trim()) {
        const searchResult = await searchService.fullTextSearch(searchQuery, {
          entities: [entityType],
          limit: 1000
        });
        
        const searchIds = new Set(searchResult.items.map(item => item.id || item[getIdField()]));
        filteredData = filteredData.filter(item => searchIds.has(item.id || item[getIdField()]));
      }
      
      // Apply advanced filters
      if (filterGroup.filters.length > 0 || (filterGroup.groups && filterGroup.groups.length > 0)) {
        filteredData = await searchService.applyFilters(filteredData, filterGroup);
      }
      
      onFilteredData(filteredData);
    } catch (error) {
      console.error('Filter application failed:', error);
      onFilteredData(data);
    } finally {
      setIsSearching(false);
    }
  };

  const getIdField = () => {
    const idFields: Record<string, string> = {
      periods: 'period_id',
      financial_centers: 'financial_center_id',
      cost_centers: 'cost_center_id',
      nomenclatures: 'nomenclature_id',
      products: 'product_id'
    };
    return idFields[entityType] || 'id';
  };

  // Add a new filter
  const addFilter = () => {
    if (!newFilter.field || !newFilter.operator) {
      toast({
        title: 'Ошибка',
        description: 'Выберите поле и оператор для фильтра',
        variant: 'destructive'
      });
      return;
    }

    const filter: SearchFilter = {
      id: `filter_${Date.now()}`,
      name: `${getFieldLabel(newFilter.field!)} ${getOperatorLabel(newFilter.operator!)}`,
      field: newFilter.field!,
      operator: newFilter.operator!,
      value: newFilter.value,
      dataType: newFilter.dataType!
    };

    setFilterGroup({
      ...filterGroup,
      filters: [...filterGroup.filters, filter]
    });

    // Reset new filter form
    setNewFilter({
      field: '',
      operator: 'equals',
      value: '',
      dataType: 'string'
    });
  };

  // Remove a filter
  const removeFilter = (filterId: string) => {
    setFilterGroup({
      ...filterGroup,
      filters: filterGroup.filters.filter(f => f.id !== filterId)
    });
  };

  // Update filter value
  const updateFilterValue = (filterId: string, value: any) => {
    setFilterGroup({
      ...filterGroup,
      filters: filterGroup.filters.map(f => 
        f.id === filterId ? { ...f, value } : f
      )
    });
  };

  // Apply quick filter
  const applyQuickFilter = async (quickFilterId: string) => {
    try {
      const filteredData = await searchService.applyQuickFilter(data, quickFilterId);
      onFilteredData(filteredData);
      
      toast({
        title: 'Фильтр применен',
        description: `Найдено записей: ${filteredData.length}`
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка применения фильтра',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Apply saved filter
  const applySavedFilter = async (savedFilterId: string) => {
    try {
      const filteredData = await searchService.applySavedFilter(data, savedFilterId);
      onFilteredData(filteredData);
      
      // Load the filter configuration
      const savedFilter = savedFilters.find(f => f.id === savedFilterId);
      if (savedFilter) {
        setFilterGroup(savedFilter.filterGroup);
      }
      
      toast({
        title: 'Фильтр применен',
        description: `Найдено записей: ${filteredData.length}`
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка применения фильтра',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Save current filter
  const saveCurrentFilter = async (name: string, description: string, isPublic: boolean) => {
    try {
      const savedFilter = await searchService.saveFilter(
        name,
        description,
        entityType,
        filterGroup,
        userId,
        isPublic
      );
      
      setSavedFilters([...savedFilters, savedFilter]);
      setShowSaveDialog(false);
      
      toast({
        title: 'Фильтр сохранен',
        description: `Фильтр "${name}" успешно сохранен`
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterGroup({
      id: 'root',
      logic: 'AND',
      filters: [],
      groups: []
    });
    onFilteredData(data);
  };

  // Helper functions
  const getFieldLabel = (field: string) => {
    const fieldInfo = availableFields.find(f => f.field === field);
    return fieldInfo?.label || field;
  };

  const getOperatorLabel = (operator: FilterOperator) => {
    const labels: Record<FilterOperator, string> = {
      equals: 'равно',
      not_equals: 'не равно',
      contains: 'содержит',
      not_contains: 'не содержит',
      starts_with: 'начинается с',
      ends_with: 'заканчивается на',
      greater_than: 'больше',
      greater_than_or_equal: 'больше или равно',
      less_than: 'меньше',
      less_than_or_equal: 'меньше или равно',
      between: 'между',
      not_between: 'не между',
      in: 'в списке',
      not_in: 'не в списке',
      is_null: 'пустое',
      is_not_null: 'не пустое',
      is_empty: 'пустая строка',
      is_not_empty: 'не пустая строка',
      regex: 'регулярное выражение',
      not_regex: 'не регулярное выражение'
    };
    return labels[operator] || operator;
  };

  const getOperatorsForDataType = (dataType: string): FilterOperator[] => {
    const baseOperators: FilterOperator[] = ['equals', 'not_equals', 'is_null', 'is_not_null'];
    
    switch (dataType) {
      case 'string':
        return [...baseOperators, 'contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty', 'regex', 'not_regex'];
      case 'number':
        return [...baseOperators, 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between', 'not_between'];
      case 'date':
        return [...baseOperators, 'greater_than', 'greater_than_or_equal', 'less_than', 'less_than_or_equal', 'between', 'not_between'];
      case 'boolean':
        return ['equals', 'not_equals'];
      case 'select':
        return [...baseOperators, 'in', 'not_in'];
      default:
        return baseOperators;
    }
  };

  // Save Dialog Component
  const SaveFilterDialog = () => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    if (!showSaveDialog) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">Сохранить фильтр</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Название</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Название фильтра"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
                placeholder="Описание фильтра"
              />
            </div>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span>Публичный фильтр</span>
            </label>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={() => saveCurrentFilter(name, description, isPublic)}
              disabled={!name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!showPanel) {
    return (
      <div className="flex items-center gap-2">
        {/* Quick search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="pl-10 pr-4 py-2 border rounded-lg w-64"
          />
          {isSearching && (
            <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-blue-600 animate-spin" />
          )}
        </div>

        {/* Quick filters */}
        {quickFilters.slice(0, 3).map(filter => (
          <button
            key={filter.id}
            onClick={() => applyQuickFilter(filter.id)}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm flex items-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {filter.name}
          </button>
        ))}

        <button
          onClick={() => setShowPanel(true)}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Расширенный поиск
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold">Расширенный поиск и фильтрация</h2>
            <button
              onClick={() => setShowPanel(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Search Section */}
            <div>
              <h3 className="text-lg font-medium mb-3">Полнотекстовый поиск</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Введите поисковый запрос..."
                  className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-600 animate-spin" />
                )}
              </div>
            </div>

            {/* Quick Filters */}
            {quickFilters.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Быстрые фильтры</h3>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => applyQuickFilter(filter.id)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm flex items-center gap-2"
                    >
                      <Zap className="h-4 w-4" />
                      {filter.name}
                      {filter.shortcut && (
                        <span className="text-xs text-gray-500">({filter.shortcut})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Filters */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Расширенные фильтры</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSaveDialog(true)}
                    disabled={filterGroup.filters.length === 0}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Сохранить
                  </button>
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Очистить
                  </button>
                </div>
              </div>

              {/* Add new filter */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="grid grid-cols-5 gap-3 mb-3">
                  <select
                    value={newFilter.field}
                    onChange={(e) => {
                      const fieldInfo = availableFields.find(f => f.field === e.target.value);
                      setNewFilter({
                        ...newFilter,
                        field: e.target.value,
                        dataType: fieldInfo?.type as any || 'string'
                      });
                    }}
                    className="border rounded px-3 py-2"
                  >
                    <option value="">Выберите поле</option>
                    {availableFields.map(field => (
                      <option key={field.field} value={field.field}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newFilter.operator}
                    onChange={(e) => setNewFilter({
                      ...newFilter,
                      operator: e.target.value as FilterOperator
                    })}
                    className="border rounded px-3 py-2"
                  >
                    {getOperatorsForDataType(newFilter.dataType || 'string').map(op => (
                      <option key={op} value={op}>
                        {getOperatorLabel(op)}
                      </option>
                    ))}
                  </select>

                  <input
                    type={newFilter.dataType === 'number' ? 'number' : newFilter.dataType === 'date' ? 'date' : 'text'}
                    value={newFilter.value}
                    onChange={(e) => setNewFilter({
                      ...newFilter,
                      value: e.target.value
                    })}
                    placeholder="Значение"
                    className="border rounded px-3 py-2"
                  />

                  <select
                    value={filterGroup.logic}
                    onChange={(e) => setFilterGroup({
                      ...filterGroup,
                      logic: e.target.value as 'AND' | 'OR'
                    })}
                    className="border rounded px-3 py-2"
                  >
                    <option value="AND">И (AND)</option>
                    <option value="OR">ИЛИ (OR)</option>
                  </select>

                  <button
                    onClick={addFilter}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Current filters */}
              {filterGroup.filters.length > 0 && (
                <div className="space-y-2">
                  {filterGroup.filters.map((filter, index) => (
                    <div key={filter.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      {index > 0 && (
                        <span className="text-sm font-medium text-blue-600">
                          {filterGroup.logic}
                        </span>
                      )}
                      
                      <span className="text-sm font-medium">
                        {getFieldLabel(filter.field)}
                      </span>
                      
                      <span className="text-sm text-gray-600">
                        {getOperatorLabel(filter.operator)}
                      </span>
                      
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilterValue(filter.id, e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      
                      <button
                        onClick={() => removeFilter(filter.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div>
                <h3 className="text-lg font-medium mb-3">Сохраненные фильтры</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {savedFilters.map(filter => (
                    <div
                      key={filter.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => applySavedFilter(filter.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{filter.name}</h4>
                        <div className="flex items-center gap-1">
                          {filter.isPublic && <Star className="h-4 w-4 text-yellow-500" />}
                          <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                      {filter.description && (
                        <p className="text-sm text-gray-600 mb-2">{filter.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Использований: {filter.usageCount}</span>
                        <span>{new Date(filter.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <SaveFilterDialog />
    </>
  );
};