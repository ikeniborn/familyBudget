<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-svelte';
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
    key: keyof T;
    header: string;
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
  }

  const dispatch = createEventDispatcher<{
    rowClick: T;
    cellClick: { item: T; column: Column<T> };
  }>();

  // Props
  export let data: T[] = [];
  export let columns: Column<T>[] = [];
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;
  export let showPagination = true;
  export let showSearch = true;
  export let searchKeys: (keyof T)[] = [];

  // State
  let searchQuery = '';
  let sortColumn: keyof T | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';
  let currentPage = 0;

  // Computed values
  $: filteredData = data.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const searchText = searchQuery.toLowerCase();
    const keysToSearch = searchKeys.length > 0 ? searchKeys : columns.map(col => col.key);
    
    return keysToSearch.some(key => {
      const value = item[key];
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(searchText);
    });
  });

  $: sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    
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
    dispatch('cellClick', { item, column });
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

  function renderCell(item: T, column: Column<T>): string {
    if (column.render) {
      return String(column.render(item));
    }
    const value = item[column.key];
    return value !== null && value !== undefined ? String(value) : '';
  }

  function getSortIcon(column: Column<T>) {
    if (!column.sortable) return null;
    
    if (sortColumn === column.key) {
      return sortDirection === 'asc' ? ChevronUp : ChevronDown;
    }
    return ChevronsUpDown;
  }

  // Reset page when search changes
  $: if (searchQuery) {
    currentPage = 0;
  }
</script>

<div class="space-y-4">
  {#if showSearch}
    <div class="max-w-sm">
      <Input
        placeholder={searchPlaceholder}
        bind:value={searchQuery}
      />
    </div>
  {/if}

  <div class="rounded-md border" data-testid="simple-data-table">
    <Table>
      <TableHeader>
        <TableRow>
          {#each columns as column (column.key)}
            <TableHead style={column.width ? `width: ${column.width}` : undefined}>
              {#if column.sortable}
                <div
                  class="cursor-pointer select-none flex items-center gap-1 hover:text-gray-900"
                  on:click={() => handleSort(column)}
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && handleSort(column)}
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
          {#each paginatedData as item, index (index)}
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
                  {renderCell(item, column)}
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