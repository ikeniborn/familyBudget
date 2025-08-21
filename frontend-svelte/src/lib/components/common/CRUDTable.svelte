<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import { 
    createSvelteTable, 
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    type ColumnDef
  } from '@tanstack/svelte-table';
  import { 
    Plus, 
    Edit, 
    Trash2, 
    Download, 
    Upload, 
    MoreHorizontal,
    ChevronUp, 
    ChevronDown, 
    ChevronsUpDown
  } from 'lucide-svelte';
  import { clsx } from 'clsx';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Table from '$lib/components/ui/Table.svelte';
  import TableBody from '$lib/components/ui/TableBody.svelte';
  import TableCell from '$lib/components/ui/TableCell.svelte';
  import TableHead from '$lib/components/ui/TableHead.svelte';
  import TableHeader from '$lib/components/ui/TableHeader.svelte';
  import TableRow from '$lib/components/ui/TableRow.svelte';
  import Loading from './Loading.svelte';
  import { useToast } from '$lib/stores/toast.store';

  type T = $$Generic;

  export let title: string;
  export let data: T[];
  export let columns: ColumnDef<T>[];
  export let loading = false;
  export let searchable = true;
  export let exportable = false;
  export let importable = false;
  export let addButtonText = 'Добавить';
  export let emptyMessage = 'Нет данных для отображения';
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;

  const dispatch = createEventDispatcher<{
    add: void;
    edit: { id: string | number; item: T };
    delete: { id: string | number; item: T };
    bulkDelete: { ids: (string | number)[]; items: T[] };
    export: void;
    import: { file: File };
  }>();

  const toast = useToast();
  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');
  const rowSelection = writable({});

  let fileInput: HTMLInputElement;

  // Add selection column and actions column to the provided columns
  $: enhancedColumns = [
    {
      id: 'select',
      header: ({ table }) => {
        return {
          component: 'input',
          props: {
            type: 'checkbox',
            checked: table.getIsAllPageRowsSelected(),
            indeterminate: table.getIsSomePageRowsSelected(),
            onChange: (e: Event) => table.toggleAllPageRowsSelected((e.target as HTMLInputElement).checked)
          }
        };
      },
      cell: ({ row }) => {
        return {
          component: 'input',
          props: {
            type: 'checkbox',
            checked: row.getIsSelected(),
            disabled: !row.getCanSelect(),
            onChange: (e: Event) => row.toggleSelected((e.target as HTMLInputElement).checked)
          }
        };
      },
      enableSorting: false,
      enableHiding: false,
    },
    ...columns,
    {
      id: 'actions',
      header: 'Действия',
      cell: ({ row }) => {
        const item = row.original;
        return {
          component: 'actions',
          props: { item }
        };
      },
      enableSorting: false,
    }
  ] as ColumnDef<T>[];

  $: options = {
    data,
    columns: enhancedColumns,
    state: {
      sorting: $sorting,
      columnFilters: $columnFilters,
      globalFilter: $globalFilter,
      rowSelection: $rowSelection,
    },
    onSortingChange: (updater: any) => sorting.update(updater),
    onColumnFiltersChange: (updater: any) => columnFilters.update(updater),
    onGlobalFilterChange: (updater: any) => globalFilter.update(updater),
    onRowSelectionChange: (updater: any) => rowSelection.update(updater),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
    initialState: {
      pagination: {
        pageSize,
      },
    },
  };

  const table = createSvelteTable(options);

  function handleAdd() {
    dispatch('add');
  }

  function handleEdit(item: T) {
    const id = (item as any).id || (item as any).period_id || (item as any).financial_center_id || (item as any).cost_center_id || (item as any).nomenclature_id;
    dispatch('edit', { id, item });
  }

  function handleDelete(item: T) {
    const id = (item as any).id || (item as any).period_id || (item as any).financial_center_id || (item as any).cost_center_id || (item as any).nomenclature_id;
    if (confirm('Вы уверены, что хотите удалить эту запись?')) {
      dispatch('delete', { id, item });
    }
  }

  function handleBulkDelete() {
    const selectedRows = $table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error('Ошибка', 'Выберите записи для удаления');
      return;
    }

    if (confirm(`Вы уверены, что хотите удалить ${selectedRows.length} записей?`)) {
      const ids = selectedRows.map(row => {
        const item = row.original;
        return (item as any).id || (item as any).period_id || (item as any).financial_center_id || (item as any).cost_center_id || (item as any).nomenclature_id;
      });
      const items = selectedRows.map(row => row.original);
      dispatch('bulkDelete', { ids, items });
      
      // Clear selection after bulk delete
      rowSelection.set({});
    }
  }

  function handleExport() {
    dispatch('export');
  }

  function handleImport() {
    fileInput.click();
  }

  function handleFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      dispatch('import', { file });
      // Clear file input
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  $: selectedRowsCount = Object.keys($rowSelection).length;
</script>

<Card class="p-6">
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h2 class="text-2xl font-bold">{title}</h2>
      <div class="flex gap-2">
        {#if selectedRowsCount > 0}
          <Button variant="destructive" size="sm" on:click={handleBulkDelete}>
            <Trash2 class="h-4 w-4 mr-2" />
            Удалить ({selectedRowsCount})
          </Button>
        {/if}
        
        {#if exportable}
          <Button variant="outline" size="sm" on:click={handleExport}>
            <Download class="h-4 w-4 mr-2" />
            Экспорт
          </Button>
        {/if}
        
        {#if importable}
          <Button variant="outline" size="sm" on:click={handleImport}>
            <Upload class="h-4 w-4 mr-2" />
            Импорт
          </Button>
          <input
            bind:this={fileInput}
            type="file"
            accept=".csv"
            class="hidden"
            on:change={handleFileSelected}
          />
        {/if}
        
        <Button on:click={handleAdd}>
          <Plus class="h-4 w-4 mr-2" />
          {addButtonText}
        </Button>
      </div>
    </div>

    <!-- Search -->
    {#if searchable}
      <div class="max-w-sm">
        <Input
          placeholder={searchPlaceholder}
          bind:value={$globalFilter}
        />
      </div>
    {/if}

    <!-- Table -->
    {#if loading}
      <div class="flex justify-center items-center py-8">
        <Loading text="Загрузка данных..." />
      </div>
    {:else}
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            {#each $table.getHeaderGroups() as headerGroup (headerGroup.id)}
              <TableRow>
                {#each headerGroup.headers as header (header.id)}
                  <TableHead>
                    {#if !header.isPlaceholder}
                      {#if header.id === 'select'}
                        <input
                          type="checkbox"
                          checked={$table.getIsAllPageRowsSelected()}
                          on:change={(e) => $table.toggleAllPageRowsSelected(e.target.checked)}
                        />
                      {:else if header.column.getCanSort()}
                        <div
                          class="cursor-pointer select-none flex items-center gap-1"
                          on:click={header.column.getToggleSortingHandler()}
                          on:keydown={(e) => e.key === 'Enter' && header.column.getToggleSortingHandler()?.(e)}
                          role="button"
                          tabindex="0"
                        >
                          <svelte:component 
                            this={flexRender(header.column.columnDef.header, header.getContext())}
                          />
                          {#if header.column.getIsSorted() === 'asc'}
                            <ChevronUp class="h-4 w-4" />
                          {:else if header.column.getIsSorted() === 'desc'}
                            <ChevronDown class="h-4 w-4" />
                          {:else}
                            <ChevronsUpDown class="h-4 w-4 opacity-50" />
                          {/if}
                        </div>
                      {:else}
                        <svelte:component 
                          this={flexRender(header.column.columnDef.header, header.getContext())}
                        />
                      {/if}
                    {/if}
                  </TableHead>
                {/each}
              </TableRow>
            {/each}
          </TableHeader>
          <TableBody>
            {#if $table.getRowModel().rows.length > 0}
              {#each $table.getRowModel().rows as row (row.id)}
                <TableRow class:selected={row.getIsSelected()}>
                  {#each row.getVisibleCells() as cell (cell.id)}
                    <TableCell>
                      {#if cell.column.id === 'select'}
                        <input
                          type="checkbox"
                          checked={row.getIsSelected()}
                          disabled={!row.getCanSelect()}
                          on:change={(e) => row.toggleSelected(e.target.checked)}
                        />
                      {:else if cell.column.id === 'actions'}
                        <div class="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            on:click={() => handleEdit(row.original)}
                          >
                            <Edit class="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            on:click={() => handleDelete(row.original)}
                          >
                            <Trash2 class="h-4 w-4" />
                          </Button>
                        </div>
                      {:else}
                        <svelte:component 
                          this={flexRender(cell.column.columnDef.cell, cell.getContext())}
                        />
                      {/if}
                    </TableCell>
                  {/each}
                </TableRow>
              {/each}
            {:else}
              <TableRow>
                <TableCell colSpan={enhancedColumns.length} class="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            {/if}
          </TableBody>
        </Table>
      </div>
    {/if}

    <!-- Pagination -->
    {#if !loading && $table.getPageCount() > 1}
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
</Card>

<style>
  .selected {
    @apply bg-blue-50;
  }
</style>