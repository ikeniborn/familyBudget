<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ChevronUp, ChevronDown, ChevronsUpDown, Edit2, Trash2, MoreVertical, Copy } from 'lucide-svelte';
  import { clsx } from 'clsx';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Table from './Table.svelte';
  import TableBody from './TableBody.svelte';
  import TableCell from './TableCell.svelte';
  import TableHead from './TableHead.svelte';
  import TableHeader from './TableHeader.svelte';
  import TableRow from './TableRow.svelte';

  type T = $$Generic;

  interface Column<T> {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
    component?: string;
  }
  
  interface CustomAction {
    label: string;
    icon?: any;
    action: string;
  }

  const dispatch = createEventDispatcher<{
    rowClick: T;
    cellClick: { item: T; column: Column<T> };
    edit: { item: T };
    delete: { item: T };
    customAction: { action: string; item: T };
    selectionChange: { selectedIds: any[] };
  }>();

  // Props
  export let data: T[] = [];
  export let columns: Column<T>[] = [];
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;
  export let showPagination = true;
  export let showSearch = true;
  export let searchKeys: (keyof T)[] = [];
  export let selectable = false;
  export let customActions: CustomAction[] = [];

  // State
  let searchQuery = '';
  let sortColumn: keyof T | string | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';
  let currentPage = 0;
  let selectedItems = new Set<any>();
  let showActionsMenu: any = null;

  // Computed values
  $: filteredData = data.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const searchText = searchQuery.toLowerCase();
    const keysToSearch = searchKeys.length > 0 ? searchKeys : columns.filter(col => !col.component).map(col => col.key);
    
    return keysToSearch.some(key => {
      const value = item[key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(searchText);
    });
  });

  $: sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn || typeof sortColumn === 'string' && sortColumn.startsWith('_')) return 0;
    
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    
    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;
    
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal);
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }
    
    return sortDirection === 'desc' ? -comparison : comparison;
  });

  $: totalPages = Math.ceil(sortedData.length / pageSize);
  $: paginatedData = showPagination 
    ? sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedData;

  // Methods
  function handleSort(column: Column<T>) {
    if (!column.sortable) return;
    
    if (sortColumn === column.key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column.key;
      sortDirection = 'asc';
    }
  }

  function handleRowClick(item: T) {
    dispatch('rowClick', item);
  }

  function handleCellClick(item: T, column: Column<T>) {
    const id = getItemId(item);
    
    if (column.key === '_selection') {
      toggleSelection(id);
    } else if (column.key === '_actions') {
      // Don't dispatch, just toggle menu
      showActionsMenu = showActionsMenu === id ? null : id;
    } else {
      dispatch('cellClick', { item, column });
    }
  }

  function nextPage() {
    if (currentPage < totalPages - 1) {
      currentPage++;
    }
  }

  function previousPage() {
    if (currentPage > 0) {
      currentPage--;
    }
  }

  function getSortIcon(column: Column<T>) {
    if (!column.sortable) return null;
    
    if (sortColumn === column.key) {
      return sortDirection === 'asc' ? ChevronUp : ChevronDown;
    }
    return ChevronsUpDown;
  }

  function getItemId(item: T): any {
    return (item as any).id || 
           (item as any).user_id || 
           (item as any).period_id || 
           (item as any).financial_center_id || 
           (item as any).cost_center_id || 
           (item as any).nomenclature_id || 
           (item as any)._id ||
           item;
  }

  function toggleSelection(id: any) {
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
    } else {
      selectedItems.add(id);
    }
    selectedItems = new Set(selectedItems);
    dispatch('selectionChange', { selectedIds: Array.from(selectedItems) });
  }

  function toggleSelectAll() {
    if (selectedItems.size === paginatedData.length) {
      paginatedData.forEach(item => selectedItems.delete(getItemId(item)));
    } else {
      paginatedData.forEach(item => selectedItems.add(getItemId(item)));
    }
    selectedItems = new Set(selectedItems);
    dispatch('selectionChange', { selectedIds: Array.from(selectedItems) });
  }
  
  function handleEdit(item: T) {
    showActionsMenu = null;
    dispatch('edit', { item });
  }
  
  function handleDelete(item: T) {
    showActionsMenu = null;
    dispatch('delete', { item });
  }
  
  function handleCustomAction(action: string, item: T) {
    showActionsMenu = null;
    dispatch('customAction', { action, item });
  }

  // Reset page when search changes
  $: if (searchQuery) {
    currentPage = 0;
  }
  
  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.actions-menu')) {
      showActionsMenu = null;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="space-y-4">
  {#if showSearch}
    <div class="max-w-sm">
      <Input
        placeholder={searchPlaceholder}
        bind:value={searchQuery}
      />
    </div>
  {/if}

  <div class="rounded-md border" data-testid="enhanced-data-table">
    <Table>
      <TableHeader>
        <TableRow>
          {#each columns as column (column.key)}
            <TableHead style={column.width ? `width: ${column.width}` : undefined}>
              {#if column.key === '_selection' && selectable}
                <input
                  type="checkbox"
                  checked={selectedItems.size === paginatedData.length && paginatedData.length > 0}
                  indeterminate={selectedItems.size > 0 && selectedItems.size < paginatedData.length}
                  on:change={toggleSelectAll}
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              {:else if column.sortable}
                <div
                  class="cursor-pointer select-none flex items-center gap-1 hover:text-gray-900"
                  on:click={() => handleSort(column)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && handleSort(column)}
                >
                  {column.header}
                  {#if getSortIcon(column)}
                    <svelte:component this={getSortIcon(column)} class="h-4 w-4 {sortColumn === column.key ? '' : 'opacity-50'}" />
                  {/if}
                </div>
              {:else}
                {column.header}
              {/if}
            </TableHead>
          {/each}
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if paginatedData.length > 0}
          {#each paginatedData as item, index (getItemId(item))}
            <TableRow 
              class="cursor-pointer hover:bg-gray-50"
              on:click={() => handleRowClick(item)}
            >
              {#each columns as column (column.key)}
                <TableCell
                  on:click={(e) => {
                    e.stopPropagation();
                    handleCellClick(item, column);
                  }}
                >
                  {#if column.key === '_selection' && selectable}
                    <input
                      type="checkbox"
                      checked={selectedItems.has(getItemId(item))}
                      on:change={() => toggleSelection(getItemId(item))}
                      on:click|stopPropagation
                      class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  {:else if column.key === '_actions'}
                    <div class="relative actions-menu">
                      <button
                        on:click|stopPropagation={() => {
                          showActionsMenu = showActionsMenu === getItemId(item) ? null : getItemId(item);
                        }}
                        class="p-1 rounded-md hover:bg-gray-100"
                      >
                        <MoreVertical class="h-4 w-4" />
                      </button>
                      {#if showActionsMenu === getItemId(item)}
                        <div class="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                          <div class="py-1" role="menu">
                            <button
                              on:click|stopPropagation={() => handleEdit(item)}
                              class="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Edit2 class="mr-3 h-4 w-4" />
                              Редактировать
                            </button>
                            {#each customActions as action}
                              <button
                                on:click|stopPropagation={() => handleCustomAction(action.action, item)}
                                class="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                {#if action.icon}
                                  <svelte:component this={action.icon} class="mr-3 h-4 w-4" />
                                {/if}
                                {action.label}
                              </button>
                            {/each}
                            <button
                              on:click|stopPropagation={() => handleDelete(item)}
                              class="flex w-full items-center px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                            >
                              <Trash2 class="mr-3 h-4 w-4" />
                              Удалить
                            </button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {:else if column.render}
                    {@html column.render(item)}
                  {:else}
                    {item[column.key] ?? ''}
                  {/if}
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        {:else}
          <TableRow>
            <TableCell colspan={columns.length} class="h-24 text-center">
              {searchQuery ? 'Ничего не найдено' : 'Нет данных'}
            </TableCell>
          </TableRow>
        {/if}
      </TableBody>
    </Table>
  </div>

  {#if showPagination && totalPages > 1}
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-600">
        Показано {currentPage * pageSize + 1} -{' '}
        {Math.min((currentPage + 1) * pageSize, sortedData.length)}{' '}
        из {sortedData.length}
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          on:click={previousPage}
          disabled={currentPage === 0}
        >
          Назад
        </Button>
        <div class="flex items-center px-2 text-sm text-gray-600">
          {currentPage + 1} из {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          on:click={nextPage}
          disabled={currentPage >= totalPages - 1}
        >
          Вперед
        </Button>
      </div>
    </div>
  {/if}
</div>