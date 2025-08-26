<script lang="ts">
  import SimpleDataTable from '$lib/components/ui/SimpleDataTable.svelte';
  type T = $$Generic;

  interface Column<T> {
    key: keyof T;
    header: string;
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
  }

  interface Props<T> {
    data: T[];
    columns: Column<T>[];
    searchPlaceholder?: string;
    pageSize?: number;
    showPagination?: boolean;
    showSearch?: boolean;
    searchKeys?: (keyof T)[];
    onrowclick?: (item: T) => void;
    oncellclick?: (event: { item: T; column: Column<T> }) => void;
  }

  export let data: T[];
  export let columns: Column<T>[];
  export let searchPlaceholder: string = 'Поиск...';
  export let pageSize: number = 10;
  export let showPagination: boolean = true;
  export let showSearch: boolean = true;
  export let searchKeys: (keyof T)[] = [];
  export let onrowclick: ((item: T) => void) | undefined = undefined;
  export let oncellclick: ((event: { item: T; column: Column<T> }) => void) | undefined = undefined;

  function handleRowClick(item: T) {
    onrowclick?.(item);
  }

  function handleCellClick(event: { item: T; column: Column<T> }) {
    oncellclick?.(event);
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
  onrowclick={(event) => handleRowClick(event.detail)}
  oncellclick={(event) => handleCellClick(event.detail)}
/>