<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    Plus, 
    Edit, 
    Trash2, 
    Download, 
    Upload, 
    MoreHorizontal
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import SimpleDataTable from '$lib/components/ui/SimpleDataTable.svelte';
  import Loading from './Loading.svelte';
  import { useToast } from '$lib/stores/toast.store';

  type T = $$Generic;

  interface Column<T> {
    key: keyof T;
    header: string;
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
  }

  export let title: string;
  export let data: T[];
  export let columns: Column<T>[];
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
  let fileInput: HTMLInputElement;

  // Add actions column to the provided columns
  $: enhancedColumns = [
    ...columns,
    {
      key: 'actions' as keyof T,
      header: 'Действия',
      sortable: false,
      width: '120px',
      render: () => '' // We'll handle actions in the cell click handler
    }
  ];

  function handleAdd() {
    dispatch('add');
  }

  function handleEdit(item: T) {
    const id = getItemId(item);
    dispatch('edit', { id, item });
  }

  function handleDelete(item: T) {
    const id = getItemId(item);
    dispatch('delete', { id, item });
  }

  function handleExport() {
    dispatch('export');
  }

  function handleImport() {
    fileInput?.click();
  }

  function handleFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      dispatch('import', { file });
      target.value = ''; // Reset file input
    }
  }

  function handleCellClick(event: CustomEvent<{ item: T; column: Column<T> }>) {
    const { item, column } = event.detail;
    
    if (column.key === 'actions') {
      // For now, we'll just trigger edit on action column click
      // In a real implementation, you might want to show a dropdown menu
      handleEdit(item);
    }
  }

  // Helper to get item ID (assumes 'id' field exists)
  function getItemId(item: T): string | number {
    const id = (item as any).id || (item as any).user_id || (item as any).period_id || 
               (item as any).financial_center_id || (item as any).cost_center_id || 
               (item as any).nomenclature_id;
    return id || 'unknown';
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".xlsx,.xls,.csv"
  on:change={handleFileChange}
  style="display: none"
/>

<Card class="p-6">
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">{title}</h2>
      <div class="flex items-center gap-2">
        {#if exportable}
          <Button variant="outline" size="sm" onclick={handleExport}>
            <Download class="h-4 w-4 mr-1" />
            Экспорт
          </Button>
        {/if}
        {#if importable}
          <Button variant="outline" size="sm" onclick={handleImport}>
            <Upload class="h-4 w-4 mr-1" />
            Импорт
          </Button>
        {/if}
        <Button onclick={handleAdd}>
          <Plus class="h-4 w-4 mr-1" />
          {addButtonText}
        </Button>
      </div>
    </div>

    <!-- Loading state -->
    {#if loading}
      <Loading />
    {:else}
      <!-- Data Table -->
      <SimpleDataTable
        data={data}
        columns={enhancedColumns}
        showSearch={searchable}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        on:cellClick={handleCellClick}
      />
    {/if}
  </div>
</Card>