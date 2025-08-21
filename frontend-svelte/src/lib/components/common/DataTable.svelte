<script lang="ts">
  import SimpleDataTable from '$lib/components/ui/SimpleDataTable.svelte';
  import { createEventDispatcher } from 'svelte';

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
  
  export let data: T[];
  export let columns: Column<T>[];
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;
  export let showPagination = true;
  export let showSearch = true;
  export let searchKeys: (keyof T)[] = [];

  function handleRowClick(event: CustomEvent<T>) {
    dispatch('rowClick', event.detail);
  }

  function handleCellClick(event: CustomEvent<{ item: T; column: Column<T> }>) {
    dispatch('cellClick', event.detail);
  }
</script>

<SimpleDataTable
  {data}
  {columns}
  {searchPlaceholder}
  {pageSize}
  {showPagination}
  {showSearch}
  {searchKeys}
  on:rowClick={handleRowClick}
  on:cellClick={handleCellClick}
/>