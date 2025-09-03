<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { 
    Plus, 
    Edit, 
    Trash2, 
    Download, 
    Upload, 
    MoreHorizontal,
    CheckSquare,
    Square,
    MoreVertical
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import EnhancedDataTable from '$lib/components/ui/EnhancedDataTable.svelte';
  import Loading from './Loading.svelte';
  import { useToast } from '$lib/stores/toast.store';

  type T = $$Generic;

  interface Column<T> {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    render?: (item: T) => string | number;
    width?: string;
    component?: any;
  }
  
  interface CustomAction {
    label: string;
    icon?: any;
    action: string;
  }

  export let title: string;
  export let data: T[];
  export let columns: Column<T>[];
  export let loading = false;
  export let searchable = true;
  export let exportable = false;
  export let importable = false;
  export let selectable = false;
  export let addButtonText = 'Добавить';
  export let emptyMessage = 'Нет данных для отображения';
  export let searchPlaceholder = 'Поиск...';
  export let pageSize = 10;
  export let customActions: CustomAction[] = [];

  const dispatch = createEventDispatcher<{
    add: void;
    edit: { id: string | number; item: T };
    delete: { id: string | number; item: T };
    bulkDelete: { ids: (string | number)[] };
    export: void;
    import: { file: File };
    selectionChange: { selectedIds: (string | number)[] };
    customAction: { action: string; item: T };
  }>();

  const toast = useToast();
  let fileInput: HTMLInputElement;
  let selectedItems = new Set<string | number>();
  let showActionsMenu: string | number | null = null;

  // Add selection and actions columns to the provided columns
  $: enhancedColumns = [
    ...(selectable ? [{
      key: '_selection' as keyof T,
      header: '',
      sortable: false,
      width: '50px',
      component: 'checkbox'
    }] : []),
    ...columns,
    {
      key: '_actions' as keyof T,
      header: 'Действия',
      sortable: false,
      width: '120px',
      component: 'actions'
    }
  ];
  
  // Enhanced data with selection state
  $: enhancedData = data.map(item => ({
    ...item,
    _selected: selectedItems.has(getItemId(item)),
    _id: getItemId(item)
  }));

  function handleAdd() {
    dispatch('add');
  }

  function handleEdit(item: T) {
    const id = getItemId(item);
    dispatch('edit', { id, item });
  }

  function handleDelete(item: T) {
    const id = getItemId(item);
    if (confirm('Удалить запись?')) {
      dispatch('delete', { id, item });
    }
  }
  
  function handleBulkDelete() {
    if (selectedItems.size === 0) {
      toast.error('Ошибка', 'Выберите элементы для удаления');
      return;
    }
    if (confirm(`Удалить ${selectedItems.size} записей?`)) {
      dispatch('bulkDelete', { ids: Array.from(selectedItems) });
      selectedItems.clear();
      selectedItems = selectedItems;
    }
  }
  
  function toggleSelection(id: string | number) {
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
    } else {
      selectedItems.add(id);
    }
    selectedItems = selectedItems;
    dispatch('selectionChange', { selectedIds: Array.from(selectedItems) });
  }
  
  function toggleSelectAll() {
    if (selectedItems.size === data.length) {
      selectedItems.clear();
    } else {
      data.forEach(item => selectedItems.add(getItemId(item)));
    }
    selectedItems = selectedItems;
    dispatch('selectionChange', { selectedIds: Array.from(selectedItems) });
  }
  
  function handleCustomAction(action: string, item: T) {
    dispatch('customAction', { action, item });
    showActionsMenu = null;
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
    const id = getItemId(item);
    
    if (column.key === '_selection') {
      toggleSelection(id);
    } else if (column.key === '_actions') {
      showActionsMenu = showActionsMenu === id ? null : id;
    }
  }

  // Helper to get item ID (assumes 'id' field exists)
  function getItemId(item: T): string | number {
    const id = (item as any).id || (item as any).user_id || (item as any).period_id || 
               (item as any).financial_center_id || (item as any).cost_center_id || 
               (item as any).nomenclature_id || (item as any)._id;
    return id || 'unknown';
  }
  
  function renderCellContent(item: any, column: Column<T>) {
    const id = getItemId(item);
    
    if (column.component === 'checkbox') {
      return { type: 'checkbox', checked: item._selected || false };
    } else if (column.component === 'actions') {
      return { type: 'actions', id, showMenu: showActionsMenu === id };
    } else if (column.render) {
      return { type: 'text', value: String(column.render(item)) };
    } else {
      const value = item[column.key as keyof typeof item];
      return { type: 'text', value: value !== null && value !== undefined ? String(value) : '' };
    }
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
      <div class="flex items-center gap-4">
        {#if title}
          <h2 class="text-xl font-semibold">{title}</h2>
        {/if}
        {#if selectable && selectedItems.size > 0}
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-600">
              Выбрано: {selectedItems.size}
            </span>
            <Button variant="outline" size="sm" onclick={handleBulkDelete}>
              <Trash2 class="h-4 w-4 mr-1" />
              Удалить
            </Button>
          </div>
        {/if}
      </div>
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
      <EnhancedDataTable
        data={enhancedData}
        columns={enhancedColumns}
        showSearch={searchable}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        selectable={selectable}
        customActions={customActions}
        on:cellClick={handleCellClick}
        on:edit={(e) => handleEdit(e.detail.item)}
        on:delete={(e) => handleDelete(e.detail.item)}
        on:customAction={(e) => handleCustomAction(e.detail.action, e.detail.item)}
        on:selectionChange={(e) => {
          selectedItems = new Set(e.detail.selectedIds);
          dispatch('selectionChange', e.detail);
        }}
      />
    {/if}
  </div>
</Card>