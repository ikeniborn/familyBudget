<script lang="ts">
  import { writable } from 'svelte/store';
  import { 
    createSvelteTable, 
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type ColumnDef,
    type TableOptions
  } from '@tanstack/svelte-table';
  import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-svelte';
  import { clsx } from 'clsx';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Table from '$lib/components/ui/Table.svelte';
  import TableBody from '$lib/components/ui/TableBody.svelte';
  import TableCell from '$lib/components/ui/TableCell.svelte';
  import TableHead from '$lib/components/ui/TableHead.svelte';
  import TableHeader from '$lib/components/ui/TableHeader.svelte';
  import TableRow from '$lib/components/ui/TableRow.svelte';

  type T = $$Generic;
  
  export let data: T[];
  export let columns: ColumnDef<T>[];
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;
  export let showPagination = true;
  export let showSearch = true;

  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');

  $: options = {
    data,
    columns,
    state: {
      sorting: $sorting,
      columnFilters: $columnFilters,
      globalFilter: $globalFilter,
    },
    onSortingChange: (updater) => sorting.update(updater),
    onColumnFiltersChange: (updater) => columnFilters.update(updater),
    onGlobalFilterChange: (updater) => globalFilter.update(updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  } satisfies TableOptions<T>;

  const table = createSvelteTable(options);
</script>

<div class="space-y-4">
  {#if showSearch}
    <div class="max-w-sm">
      <Input
        placeholder={searchPlaceholder}
        bind:value={$globalFilter}
      />
    </div>
  {/if}

  <div class="rounded-md border" data-testid="data-table">
    <Table>
      <TableHeader>
        {#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
          <TableRow>
            {#each headerGroup.headers as header (header.id)}
              <TableHead>
                {#if !header.isPlaceholder}
                  <div
                    class={clsx(
                      header.column.getCanSort() &&
                        'cursor-pointer select-none flex items-center gap-1'
                    )}
                    on:click={header.column.getToggleSortingHandler()}
                    on:keydown={(e) => e.key === 'Enter' && header.column.getToggleSortingHandler()?.(e)}
                    role="button"
                    tabindex="0"
                  >
                    <svelte:component 
                      this={flexRender(header.column.columnDef.header, header.getContext())}
                    />
                    {#if header.column.getCanSort()}
                      {#if header.column.getIsSorted() === 'asc'}
                        <ChevronUp class="h-4 w-4" />
                      {:else if header.column.getIsSorted() === 'desc'}
                        <ChevronDown class="h-4 w-4" />
                      {:else}
                        <ChevronsUpDown class="h-4 w-4 opacity-50" />
                      {/if}
                    {/if}
                  </div>
                {/if}
              </TableHead>
            {/each}
          </TableRow>
        {/each}
      </TableHeader>
      <TableBody>
        {#if $table.getRowModel().rows.length > 0}
          {#each $table.getRowModel().rows as row (row.id)}
            <TableRow>
              {#each row.getVisibleCells() as cell (cell.id)}
                <TableCell>
                  <svelte:component 
                    this={flexRender(cell.column.columnDef.cell, cell.getContext())}
                  />
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        {:else}
          <TableRow>
            <TableCell colSpan={columns.length} class="h-24 text-center">
              Нет данных
            </TableCell>
          </TableRow>
        {/if}
      </TableBody>
    </Table>
  </div>

  {#if showPagination && $table.getPageCount() > 1}
    <div class="flex items-center justify-between">
      <div class="text-sm text-gray-600">
        Показано {$table.getState().pagination.pageIndex * pageSize + 1} -{' '}
        {Math.min(
          ($table.getState().pagination.pageIndex + 1) * pageSize,
          data.length
        )}{' '}
        из {data.length}
      </div>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          on:click={() => $table.previousPage()}
          disabled={!$table.getCanPreviousPage()}
        >
          Назад
        </Button>
        <Button
          variant="outline"
          size="sm"
          on:click={() => $table.nextPage()}
          disabled={!$table.getCanNextPage()}
        >
          Вперед
        </Button>
      </div>
    </div>
  {/if}
</div>