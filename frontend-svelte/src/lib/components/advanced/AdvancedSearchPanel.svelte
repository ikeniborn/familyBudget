<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable, type Writable } from 'svelte/store';
  
  import Button from '../ui/Button.svelte';
  import Card from '../ui/Card.svelte';
  import Input from '../ui/Input.svelte';
  import Select from '../ui/Select.svelte';
  import Modal from '../ui/Modal.svelte';
  
  import {
    searchService,
    type SearchFilter,
    type FilterGroup,
    type SavedFilter,
    type QuickFilter,
    type FilterOperator
  } from '$lib/services/searchService';
  
  import { toastStore } from '$lib/stores/toast.store';
  
  // Lucide icons as Unicode symbols or text
  const icons = {
    search: '🔍',
    filter: '🔽',
    plus: '➕',
    minus: '➖',
    save: '💾',
    star: '⭐',
    clock: '🕐',
    tag: '🏷️',
    x: '✖',
    settings: '⚙️',
    chevronDown: '▼',
    chevronRight: '▶',
    eye: '👁',
    eyeOff: '👁‍🗨',
    zap: '⚡',
    bookOpen: '📖',
    refreshCw: '🔄'
  };

  export let entityType: string;
  export let data: any[] = [];
  export let userId: number;

  const dispatch = createEventDispatcher<{
    filteredData: { data: any[] };
  }>();

  // Reactive stores for UI state
  let showPanel = false;
  let searchQuery = '';
  let isSearching = false;
  
  // Filter group store
  const filterGroup: Writable<FilterGroup> = writable({
    id: 'root',
    logic: 'AND',
    filters: [],
    groups: []
  });

  // New filter form store
  const newFilter: Writable<Partial<SearchFilter>> = writable({
    field: '',
    operator: 'equals',
    value: '',
    dataType: 'string'
  });

  // Stores for filters
  let savedFilters: SavedFilter[] = [];
  let quickFilters: QuickFilter[] = [];
  
  // Save dialog state
  let showSaveDialog = false;
  let saveDialogData = {
    name: '',
    description: '',
    isPublic: false
  };

  // Available fields for the entity type
  const availableFields: Array<{field: string, label: string, type: string}> = (() => {
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
    };
    
    return fieldMappings[entityType] || [];
  })();

  // Load saved and quick filters
  onMount(() => {
    savedFilters = searchService.getSavedFilters(entityType, userId);
    quickFilters = searchService.getQuickFilters(entityType);
  });

  // Reactive statement to apply filters when data changes
  $: if (searchQuery || $filterGroup.filters.length > 0 || ($filterGroup.groups && $filterGroup.groups.length > 0)) {
    applyFiltersToData();
  }

  const applyFiltersToData = async () => {
    isSearching = true;
    
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
      if ($filterGroup.filters.length > 0 || ($filterGroup.groups && $filterGroup.groups.length > 0)) {
        filteredData = await searchService.applyFilters(filteredData, $filterGroup);
      }
      
      dispatch('filteredData', { data: filteredData });
    } catch (error) {
      console.error('Filter application failed:', error);
      dispatch('filteredData', { data });
    } finally {
      isSearching = false;
    }
  };

  const getIdField = () => {
    const idFields: Record<string, string> = {
      periods: 'period_id',
      financial_centers: 'financial_center_id',
      cost_centers: 'cost_center_id',
      nomenclatures: 'nomenclature_id',
    };
    return idFields[entityType] || 'id';
  };

  // Add a new filter
  const addFilter = () => {
    const currentNewFilter = $newFilter;
    
    if (!currentNewFilter.field || !currentNewFilter.operator) {
      toastStore.error('Ошибка', 'Выберите поле и оператор для фильтра');
      return;
    }

    const filter: SearchFilter = {
      id: `filter_${Date.now()}`,
      name: `${getFieldLabel(currentNewFilter.field!)} ${getOperatorLabel(currentNewFilter.operator!)}`,
      field: currentNewFilter.field!,
      operator: currentNewFilter.operator!,
      value: currentNewFilter.value,
      dataType: currentNewFilter.dataType!
    };

    filterGroup.update(fg => ({
      ...fg,
      filters: [...fg.filters, filter]
    }));

    // Reset new filter form
    newFilter.set({
      field: '',
      operator: 'equals',
      value: '',
      dataType: 'string'
    });
  };

  // Remove a filter
  const removeFilter = (filterId: string) => {
    filterGroup.update(fg => ({
      ...fg,
      filters: fg.filters.filter(f => f.id !== filterId)
    }));
  };

  // Update filter value
  const updateFilterValue = (filterId: string, value: any) => {
    filterGroup.update(fg => ({
      ...fg,
      filters: fg.filters.map(f => 
        f.id === filterId ? { ...f, value } : f
      )
    }));
  };

  // Apply quick filter
  const applyQuickFilter = async (quickFilterId: string) => {
    try {
      const filteredData = await searchService.applyQuickFilter(data, quickFilterId);
      dispatch('filteredData', { data: filteredData });
      
      toastStore.success('Фильтр применен', `Найдено записей: ${filteredData.length}`);
    } catch (error: any) {
      toastStore.error('Ошибка применения фильтра', error.message);
    }
  };

  // Apply saved filter
  const applySavedFilter = async (savedFilterId: string) => {
    try {
      const filteredData = await searchService.applySavedFilter(data, savedFilterId);
      dispatch('filteredData', { data: filteredData });
      
      // Load the filter configuration
      const savedFilter = savedFilters.find(f => f.id === savedFilterId);
      if (savedFilter) {
        filterGroup.set(savedFilter.filterGroup);
      }
      
      toastStore.success('Фильтр применен', `Найдено записей: ${filteredData.length}`);
    } catch (error: any) {
      toastStore.error('Ошибка применения фильтра', error.message);
    }
  };

  // Save current filter
  const saveCurrentFilter = async () => {
    try {
      const savedFilter = await searchService.saveFilter(
        saveDialogData.name,
        saveDialogData.description,
        entityType,
        $filterGroup,
        userId,
        saveDialogData.isPublic
      );
      
      savedFilters = [...savedFilters, savedFilter];
      showSaveDialog = false;
      saveDialogData = { name: '', description: '', isPublic: false };
      
      toastStore.success('Фильтр сохранен', `Фильтр "${saveDialogData.name}" успешно сохранен`);
    } catch (error: any) {
      toastStore.error('Ошибка сохранения', error.message);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    searchQuery = '';
    filterGroup.set({
      id: 'root',
      logic: 'AND',
      filters: [],
      groups: []
    });
    dispatch('filteredData', { data });
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

  // Handle field selection change
  const handleFieldChange = (field: string) => {
    const fieldInfo = availableFields.find(f => f.field === field);
    newFilter.update(nf => ({
      ...nf,
      field: field,
      dataType: (fieldInfo?.type as any) || 'string'
    }));
  };
</script>

{#if !showPanel}
  <div class="flex items-center gap-2">
    <!-- Quick search -->
    <div class="relative">
      <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
        {icons.search}
      </span>
      <Input
        bind:value={searchQuery}
        placeholder="Поиск..."
        class="pl-10 pr-4 py-2 w-64"
      />
      {#if isSearching}
        <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600">
          {icons.refreshCw}
        </span>
      {/if}
    </div>

    <!-- Quick filters -->
    {#each quickFilters.slice(0, 3) as filter}
      <Button
        variant="secondary"
        size="sm"
        on:click={() => applyQuickFilter(filter.id)}
        class="flex items-center gap-2"
      >
        <span>{icons.zap}</span>
        {filter.name}
      </Button>
    {/each}

    <Button
      variant="default"
      on:click={() => showPanel = true}
      class="flex items-center gap-2"
    >
      <span>{icons.filter}</span>
      Расширенный поиск
    </Button>
  </div>
{:else}
  <!-- Main advanced search panel -->
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
    <div class="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-xl font-semibold">Расширенный поиск и фильтрация</h2>
        <button
          on:click={() => showPanel = false}
          class="text-gray-500 hover:text-gray-700"
        >
          {icons.x}
        </button>
      </div>

      <div class="p-6 space-y-6">
        <!-- Search Section -->
        <div>
          <h3 class="text-lg font-medium mb-3">Полнотекстовый поиск</h3>
          <div class="relative">
            <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {icons.search}
            </span>
            <Input
              bind:value={searchQuery}
              placeholder="Введите поисковый запрос..."
              class="w-full pl-10 pr-4 py-3 text-lg"
            />
            {#if isSearching}
              <span class="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600">
                {icons.refreshCw}
              </span>
            {/if}
          </div>
        </div>

        <!-- Quick Filters -->
        {#if quickFilters.length > 0}
          <div>
            <h3 class="text-lg font-medium mb-3">Быстрые фильтры</h3>
            <div class="flex flex-wrap gap-2">
              {#each quickFilters as filter}
                <Button
                  variant="secondary"
                  size="sm"
                  on:click={() => applyQuickFilter(filter.id)}
                  class="flex items-center gap-2"
                >
                  <span>{icons.zap}</span>
                  {filter.name}
                  {#if filter.shortcut}
                    <span class="text-xs text-gray-500">({filter.shortcut})</span>
                  {/if}
                </Button>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Advanced Filters -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-lg font-medium">Расширенные фильтры</h3>
            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                on:click={() => showSaveDialog = true}
                disabled={$filterGroup.filters.length === 0}
                class="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
              >
                <span>{icons.save}</span>
                Сохранить
              </Button>
              <Button
                variant="destructive"
                size="sm"
                on:click={clearAllFilters}
                class="flex items-center gap-2"
              >
                <span>{icons.x}</span>
                Очистить
              </Button>
            </div>
          </div>

          <!-- Add new filter -->
          <Card class="bg-gray-50 p-4 mb-4">
            <div class="grid grid-cols-5 gap-3 mb-3">
              <Select
                bind:value={$newFilter.field}
                on:change={(e) => handleFieldChange(e.detail.value)}
                options={[
                  { value: '', label: 'Выберите поле' },
                  ...availableFields.map(field => ({ value: field.field, label: field.label }))
                ]}
              />

              <Select
                bind:value={$newFilter.operator}
                on:change={(e) => newFilter.update(nf => ({ ...nf, operator: e.detail.value as FilterOperator }))}
                options={getOperatorsForDataType($newFilter.dataType || 'string').map(op => ({
                  value: op,
                  label: getOperatorLabel(op)
                }))}
              />

              <Input
                type={$newFilter.dataType === 'number' ? 'number' : $newFilter.dataType === 'date' ? 'date' : 'text'}
                bind:value={$newFilter.value}
                placeholder="Значение"
              />

              <Select
                bind:value={$filterGroup.logic}
                on:change={(e) => filterGroup.update(fg => ({ ...fg, logic: e.detail.value as 'AND' | 'OR' }))}
                options={[
                  { value: 'AND', label: 'И (AND)' },
                  { value: 'OR', label: 'ИЛИ (OR)' }
                ]}
              />

              <Button
                variant="default"
                on:click={addFilter}
                class="flex items-center justify-center"
              >
                <span>{icons.plus}</span>
              </Button>
            </div>
          </Card>

          <!-- Current filters -->
          {#if $filterGroup.filters.length > 0}
            <div class="space-y-2">
              {#each $filterGroup.filters as filter, index}
                <div class="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  {#if index > 0}
                    <span class="text-sm font-medium text-blue-600">
                      {$filterGroup.logic}
                    </span>
                  {/if}
                  
                  <span class="text-sm font-medium">
                    {getFieldLabel(filter.field)}
                  </span>
                  
                  <span class="text-sm text-gray-600">
                    {getOperatorLabel(filter.operator)}
                  </span>
                  
                  <Input
                    type="text"
                    bind:value={filter.value}
                    on:input={(e) => updateFilterValue(filter.id, e.target.value)}
                    class="border rounded px-2 py-1 text-sm"
                  />
                  
                  <button
                    on:click={() => removeFilter(filter.id)}
                    class="text-red-600 hover:text-red-800"
                  >
                    <span>{icons.minus}</span>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Saved Filters -->
        {#if savedFilters.length > 0}
          <div>
            <h3 class="text-lg font-medium mb-3">Сохраненные фильтры</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each savedFilters as filter}
                <Card
                  class="p-3 hover:bg-gray-50 cursor-pointer"
                  on:click={() => applySavedFilter(filter.id)}
                >
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="font-medium">{filter.name}</h4>
                    <div class="flex items-center gap-1">
                      {#if filter.isPublic}
                        <span class="text-yellow-500">{icons.star}</span>
                      {/if}
                      <span class="text-gray-400">{icons.clock}</span>
                    </div>
                  </div>
                  {#if filter.description}
                    <p class="text-sm text-gray-600 mb-2">{filter.description}</p>
                  {/if}
                  <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>Использований: {filter.usageCount}</span>
                    <span>{new Date(filter.createdAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Save Filter Dialog -->
<Modal
  title="Сохранить фильтр"
  open={showSaveDialog}
  on:close={() => showSaveDialog = false}
>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2">Название</label>
      <Input
        bind:value={saveDialogData.name}
        placeholder="Название фильтра"
      />
    </div>
    
    <div>
      <label class="block text-sm font-medium mb-2">Описание</label>
      <textarea
        bind:value={saveDialogData.description}
        class="w-full border rounded-lg px-3 py-2"
        rows="3"
        placeholder="Описание фильтра"
      ></textarea>
    </div>
    
    <label class="flex items-center space-x-2">
      <input
        type="checkbox"
        bind:checked={saveDialogData.isPublic}
      />
      <span>Публичный фильтр</span>
    </label>
  </div>
  
  <div class="flex justify-end space-x-3" slot="footer">
    <Button
      variant="secondary"
      on:click={() => showSaveDialog = false}
    >
      Отмена
    </Button>
    <Button
      variant="default"
      on:click={saveCurrentFilter}
      disabled={!saveDialogData.name.trim()}
    >
      Сохранить
    </Button>
  </div>
</Modal>