<script lang="ts">
  import { onMount } from 'svelte';
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
    Building2, 
    ChevronRight, 
    BarChart3, 
    Users, 
    Activity,
    Plus,
    Edit,
    Trash2,
    Download,
    Upload,
    ChevronsUpDown,
    ChevronUp,
    ChevronDown
  } from 'lucide-svelte';
  
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Table from '$lib/components/ui/Table.svelte';
  import TableBody from '$lib/components/ui/TableBody.svelte';
  import TableCell from '$lib/components/ui/TableCell.svelte';
  import TableHead from '$lib/components/ui/TableHead.svelte';
  import TableHeader from '$lib/components/ui/TableHeader.svelte';
  import TableRow from '$lib/components/ui/TableRow.svelte';
  
  import { authStore } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/stores/toast.store';
  import { financialCenterService, costCenterService, registryService } from '$lib/services';
  import type { FinancialCenter } from '$lib/types';

  // Component state
  let financialCenters: FinancialCenter[] = [];
  let loading = true;
  let showStats = false;
  let editingItem: FinancialCenter | null = null;
  let addDialogOpen = false;
  let fileInput: HTMLInputElement;

  // Table state
  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');
  const rowSelection = writable({});

  // Form state
  let formData: Partial<FinancialCenter> = {};
  let formErrors: Record<string, string> = {};

  // Build hierarchy tree
  function buildHierarchy(items: FinancialCenter[]): FinancialCenter[] {
    const map = new Map<number, FinancialCenter>();
    const roots: FinancialCenter[] = [];

    // First pass: create map
    items.forEach(item => {
      map.set(item.financial_center_id, { ...item, children: [] });
    });

    // Second pass: build tree
    items.forEach(item => {
      const node = map.get(item.financial_center_id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // Flatten hierarchy for table display
  function flattenHierarchy(items: FinancialCenter[], level = 0): FinancialCenter[] {
    const result: FinancialCenter[] = [];
    
    items.forEach(item => {
      result.push({ ...item, level });
      if (item.children && item.children.length > 0) {
        result.push(...flattenHierarchy(item.children, level + 1));
      }
    });
    
    return result;
  }

  // Display data (flattened hierarchy)
  let displayData: FinancialCenter[] = [];

  // Refresh table data with hierarchy
  function refreshTableData() {
    const hierarchyData = buildHierarchy(financialCenters);
    displayData = flattenHierarchy(hierarchyData);
  }

  // Define table columns
  const columns: ColumnDef<FinancialCenter>[] = [
    {
      accessorKey: 'financial_center_name',
      header: 'Название ЦФО',
      cell: ({ row }) => {
        const item = row.original;
        return {
          component: 'div',
          props: {
            class: 'flex items-center gap-2',
            style: `padding-left: ${(item.level || 0) * 24}px`
          },
          children: [
            { component: Building2, props: { class: 'h-4 w-4 text-gray-500' } },
            { component: 'span', props: { class: 'font-medium' }, children: item.financial_center_name },
            item.children && item.children.length > 0 ? {
              component: Badge,
              props: { variant: 'secondary', class: 'ml-2' },
              children: `${item.children.length} подразд.`
            } : null,
            item.is_active ? {
              component: Badge,
              props: { variant: 'default', class: 'ml-2' },
              children: [
                { component: Activity, props: { class: 'h-3 w-3 mr-1' } },
                'Активный'
              ]
            } : null
          ].filter(Boolean)
        };
      },
    },
    {
      accessorKey: 'financial_center_description',
      header: 'Описание',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return {
          component: 'span',
          props: { class: 'text-gray-600 text-sm' },
          children: value || '-'
        };
      },
    },
    {
      accessorKey: 'parent_id',
      header: 'Родительский ЦФО',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        if (!value) return { component: 'span', props: { class: 'text-gray-500' }, children: '—' };
        const parent = financialCenters.find(fc => fc.financial_center_id === value);
        return parent ? {
          component: 'div',
          props: { class: 'flex items-center gap-1' },
          children: [
            { component: ChevronRight, props: { class: 'h-3 w-3 text-gray-400' } },
            { component: 'span', props: { class: 'text-sm' }, children: parent.financial_center_name }
          ]
        } : '-';
      },
    },
    {
      accessorKey: 'usage_stats',
      header: 'Статистика',
      cell: ({ getValue, row }) => {
        const value = getValue() as any;
        if (!showStats || !value) return '-';
        
        return {
          component: 'div',
          props: { class: 'flex items-center gap-4 text-sm' },
          children: [
            {
              component: 'div',
              props: { class: 'flex items-center gap-1' },
              children: [
                { component: Users, props: { class: 'h-3 w-3 text-gray-500' } },
                { component: 'span', children: `${value.cost_centers_count || 0} МВЗ` }
              ]
            },
            {
              component: 'div',
              props: { class: 'flex items-center gap-1' },
              children: [
                { component: BarChart3, props: { class: 'h-3 w-3 text-gray-500' } },
                { component: 'span', children: `${value.transactions_count || 0} транз.` }
              ]
            }
          ]
        };
      },
      enableSorting: false,
    },
    {
      accessorKey: 'financial_center_order',
      header: 'Порядок',
    },
    {
      accessorKey: 'is_active',
      header: 'Статус',
      cell: ({ getValue }) => {
        const value = getValue() as boolean;
        return value ? 
          { component: Badge, props: { variant: 'default' }, children: 'Активен' } :
          { component: Badge, props: { variant: 'secondary' }, children: 'Неактивен' };
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Дата создания',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
      enableSorting: true,
    },
  ];

  // Table options
  $: options = {
    data: displayData,
    columns,
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
        pageSize: 10,
      },
    },
  };

  const table = createSvelteTable(options);

  // Reactive statements
  $: selectedRowsCount = Object.keys($rowSelection).length;
  $: if (financialCenters.length > 0) refreshTableData();

  // Fetch financial centers
  async function fetchFinancialCenters() {
    if (!$authStore.user?.user_id) return;
    
    try {
      loading = true;
      const response = await financialCenterService.getAll({ user_id: $authStore.user.user_id });
      const data = response.map((fc: any) => ({
        ...fc,
        id: fc.financial_center_id, // Map financial_center_id to id for table
      }));
      
      financialCenters = data;
      
      // Fetch usage statistics if enabled
      if (showStats) {
        await fetchUsageStatistics(data);
      }
      
      refreshTableData();
    } catch (error) {
      toastStore.error('Ошибка', 'Не удалось загрузить финансовые центры');
    } finally {
      loading = false;
    }
  }

  // Fetch usage statistics
  async function fetchUsageStatistics(centers: FinancialCenter[]) {
    try {
      const statsMap: Record<number, any> = {};
      
      for (const center of centers) {
        try {
          // Fetch cost centers count
          const costCenters = await costCenterService.getAll({
            user_id: $authStore.user?.user_id,
            financial_center_id: center.financial_center_id
          });
          
          // Fetch transactions count and amount
          const transactions = await registryService.getAll({
            user_id: $authStore.user?.user_id,
            financial_center_id: center.financial_center_id
          });
          
          statsMap[center.financial_center_id] = {
            cost_centers_count: costCenters.length || 0,
            transactions_count: transactions.length || 0,
            total_amount: transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0),
          };
        } catch (error) {
          statsMap[center.financial_center_id] = {
            cost_centers_count: 0,
            transactions_count: 0,
            total_amount: 0,
          };
        }
      }
      
      // Update financial centers with stats
      financialCenters = financialCenters.map(fc => ({
        ...fc,
        usage_stats: statsMap[fc.financial_center_id] || {
          cost_centers_count: 0,
          transactions_count: 0,
          total_amount: 0,
        }
      }));
    } catch (error) {
      console.error('Failed to fetch usage statistics:', error);
    }
  }

  // Add financial center
  async function handleAdd() {
    if (!$authStore.user?.user_id) return;
    
    if (!validateForm()) return;
    
    const newFinancialCenter = {
      ...formData,
      user_id: $authStore.user.user_id,
      is_active: formData.is_active !== false,
      parent_id: formData.parent_id || null,
    };

    try {
      await financialCenterService.create(newFinancialCenter);
      await fetchFinancialCenters();
      
      toastStore.success('Успешно', 'Финансовый центр создан');
      resetForm();
      addDialogOpen = false;
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось добавить финансовый центр');
    }
  }

  // Update financial center
  async function handleUpdate() {
    if (!editingItem || !$authStore.user?.user_id) return;
    
    // Prevent circular references
    if (formData.parent_id === editingItem.financial_center_id) {
      toastStore.error('Ошибка', 'ЦФО не может быть родительским для самого себя');
      return;
    }

    if (!validateForm()) return;

    try {
      await financialCenterService.update(editingItem.financial_center_id, formData);
      await fetchFinancialCenters();
      
      toastStore.success('Успешно', 'Финансовый центр обновлен');
      resetForm();
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось обновить финансовый центр');
    }
  }

  // Delete financial center
  async function handleDelete(item: FinancialCenter) {
    // Check if has children
    if (item.children && item.children.length > 0) {
      toastStore.error('Ошибка', 'Нельзя удалить ЦФО с подразделениями. Сначала удалите или переместите подразделения.');
      return;
    }
    
    // Check usage
    if (item.usage_stats && item.usage_stats.cost_centers_count > 0) {
      const confirmed = confirm(
        `ЦФО "${item.financial_center_name}" используется в ${item.usage_stats.cost_centers_count} МВЗ. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) return;
    }

    try {
      await financialCenterService.delete(item.financial_center_id);
      await fetchFinancialCenters();
      
      toastStore.success('Успешно', 'Финансовый центр удален');
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить финансовый центр');
    }
  }

  // Bulk delete financial centers
  async function handleBulkDelete() {
    const selectedRows = $table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const ids = selectedRows.map(row => row.original.financial_center_id);
    
    // Check for parents in selection
    const hasParents = financialCenters.some(fc => 
      ids.includes(fc.financial_center_id) && fc.children && fc.children.length > 0
    );
    
    if (hasParents) {
      toastStore.error('Ошибка', 'В выборке есть ЦФО с подразделениями. Удалите сначала подразделения.');
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить ${ids.length} финансовых центров?`)) return;

    try {
      await Promise.all(ids.map(id => financialCenterService.delete(id)));
      await fetchFinancialCenters();
      
      toastStore.success('Успешно', `Удалено финансовых центров: ${ids.length}`);
      rowSelection.set({});
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить финансовые центры');
    }
  }

  // Enhanced export
  function handleExport() {
    const csvContent = [
      ['ID', 'Название ЦФО', 'Описание', 'Родительский ЦФО', 'Порядок', 'Статус', 'МВЗ', 'Транзакций', 'Дата создания'].join(','),
      ...financialCenters.map(fc => {
        const parent = fc.parent_id ? 
          financialCenters.find(p => p.financial_center_id === fc.parent_id)?.financial_center_name || '' : '';
        
        return [
          fc.financial_center_id,
          `"${fc.financial_center_name}"`,
          `"${fc.financial_center_description || ''}"`,
          `"${parent}"`,
          fc.financial_center_order,
          fc.is_active ? 'Активен' : 'Неактивен',
          fc.usage_stats?.cost_centers_count || 0,
          fc.usage_stats?.transactions_count || 0,
          fc.created_at ? new Date(fc.created_at).toLocaleDateString('ru-RU') : '',
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `financial_centers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  // Import financial centers
  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newFinancialCenters: Omit<FinancialCenter, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, description, parentName, order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Find parent ID if parent name is provided
      let parentId = null;
      if (parentName) {
        const parent = financialCenters.find(fc => fc.financial_center_name === parentName);
        parentId = parent ? parent.financial_center_id : null;
      }
      
      newFinancialCenters.push({
        financial_center_name: name,
        financial_center_description: description || undefined,
        parent_id: parentId,
        financial_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: $authStore.user!.user_id,
      } as Omit<FinancialCenter, 'id'>);
    }

    // Add financial centers one by one
    for (const fc of newFinancialCenters) {
      await financialCenterService.create(fc);
    }
    
    await fetchFinancialCenters();
    toastStore.success('Импорт завершен', `Добавлено финансовых центров: ${newFinancialCenters.length}`);
  }

  // Form validation
  function validateForm(): boolean {
    formErrors = {};
    
    if (!formData.financial_center_name || formData.financial_center_name.trim().length < 3) {
      formErrors.financial_center_name = 'Название должно содержать минимум 3 символа';
    }
    if (formData.financial_center_name && formData.financial_center_name.trim().length > 100) {
      formErrors.financial_center_name = 'Название не должно превышать 100 символов';
    }
    if (formData.financial_center_description && formData.financial_center_description.trim().length > 500) {
      formErrors.financial_center_description = 'Описание не должно превышать 500 символов';
    }
    if (!formData.financial_center_order || Number(formData.financial_center_order) < 1) {
      formErrors.financial_center_order = 'Порядок должен быть больше 0';
    }
    
    return Object.keys(formErrors).length === 0;
  }

  // Reset form
  function resetForm() {
    formData = {
      financial_center_order: 1,
      is_active: true
    };
    formErrors = {};
    editingItem = null;
  }

  // Start editing
  function startEdit(item: FinancialCenter) {
    editingItem = item;
    formData = { ...item };
    addDialogOpen = true;
  }

  // Handle file input
  function handleFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      handleImport(file);
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }

  // Watch showStats changes
  $: if (showStats && financialCenters.length > 0) {
    fetchUsageStatistics(financialCenters);
  }

  // Initialize
  onMount(() => {
    fetchFinancialCenters();
    resetForm();
  });
</script>

<div class="space-y-4">
  <!-- Statistics toggle -->
  <Card class="p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <BarChart3 class="h-5 w-5 text-gray-600" />
        <div>
          <h3 class="font-medium">Статистика использования</h3>
          <p class="text-sm text-gray-600">
            Показать количество МВЗ и транзакций для каждого ЦФО
          </p>
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={showStats}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </Card>
  
  <!-- Table -->
  <Card class="p-6">
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Центры финансовой ответственности (ЦФО)</h2>
        <div class="flex gap-2">
          {#if selectedRowsCount > 0}
            <Button variant="destructive" size="sm" on:click={handleBulkDelete}>
              <Trash2 class="h-4 w-4 mr-2" />
              Удалить ({selectedRowsCount})
            </Button>
          {/if}
          
          <Button variant="outline" size="sm" on:click={handleExport}>
            <Download class="h-4 w-4 mr-2" />
            Экспорт
          </Button>
          
          <Button variant="outline" size="sm" on:click={() => fileInput.click()}>
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
          
          <Button on:click={() => { resetForm(); addDialogOpen = true; }}>
            <Plus class="h-4 w-4 mr-2" />
            Добавить ЦФО
          </Button>
        </div>
      </div>

      <!-- Search -->
      <div class="max-w-sm">
        <Input
          placeholder="Поиск ЦФО..."
          bind:value={$globalFilter}
        />
      </div>

      <!-- Table -->
      {#if loading}
        <div class="flex justify-center items-center py-8">
          <div class="text-gray-600">Загрузка данных...</div>
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
                              on:click={() => startEdit(row.original)}
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
                        {:else if cell.column.id === 'financial_center_name'}
                          <div 
                            class="flex items-center gap-2"
                            style="padding-left: {(row.original.level || 0) * 24}px"
                          >
                            <Building2 class="h-4 w-4 text-gray-500" />
                            <span class="font-medium">{row.original.financial_center_name}</span>
                            {#if row.original.children && row.original.children.length > 0}
                              <Badge variant="secondary" class="ml-2">
                                {row.original.children.length} подразд.
                              </Badge>
                            {/if}
                            {#if row.original.is_active}
                              <Badge variant="default" class="ml-2">
                                <Activity class="h-3 w-3 mr-1" />
                                Активный
                              </Badge>
                            {/if}
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
                  <TableCell colSpan={columns.length + 2} class="h-24 text-center">
                    Нет добавленных финансовых центров. Нажмите 'Добавить ЦФО' для создания нового.
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
            Показано {$table.getState().pagination.pageIndex * 10 + 1} -{' '}
            {Math.min(
              ($table.getState().pagination.pageIndex + 1) * 10,
              displayData.length
            )}{' '}
            из {displayData.length}
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
</div>

<!-- Add/Edit Dialog -->
<Dialog bind:open={addDialogOpen}>
  <div class="space-y-4">
    <div class="text-lg font-semibold">
      {editingItem ? 'Редактировать ЦФО' : 'Добавить ЦФО'}
    </div>
    
    <!-- Name -->
    <div>
      <label class="text-sm font-medium">
        Название ЦФО <span class="text-red-500">*</span>
      </label>
      <Input
        bind:value={formData.financial_center_name}
        placeholder="Введите название ЦФО"
        class="mt-1"
        error={formErrors.financial_center_name}
      />
      {#if formErrors.financial_center_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.financial_center_name}</p>
      {/if}
    </div>

    <!-- Description -->
    <div>
      <label class="text-sm font-medium">Описание</label>
      <Input
        bind:value={formData.financial_center_description}
        placeholder="Введите описание (необязательно)"
        class="mt-1"
        error={formErrors.financial_center_description}
      />
      {#if formErrors.financial_center_description}
        <p class="text-red-500 text-xs mt-1">{formErrors.financial_center_description}</p>
      {/if}
    </div>

    <!-- Parent FinancialCenter -->
    <div>
      <label class="text-sm font-medium">Родительский ЦФО</label>
      <Select bind:value={formData.parent_id} class="mt-1">
        <option value="">Нет родительского ЦФО</option>
        {#each financialCenters.filter(fc => fc.financial_center_id !== editingItem?.financial_center_id) as parent}
          <option value={parent.financial_center_id}>{parent.financial_center_name}</option>
        {/each}
      </Select>
    </div>

    <!-- Order -->
    <div>
      <label class="text-sm font-medium">
        Порядок <span class="text-red-500">*</span>
      </label>
      <Input
        type="number"
        bind:value={formData.financial_center_order}
        min="1"
        class="mt-1"
        error={formErrors.financial_center_order}
      />
      {#if formErrors.financial_center_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.financial_center_order}</p>
      {/if}
    </div>

    <!-- Active Status -->
    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        bind:checked={formData.is_active}
        id="is_active"
        class="rounded"
      />
      <label for="is_active" class="text-sm cursor-pointer">Активный ЦФО</label>
    </div>

    <!-- Dialog Actions -->
    <div class="flex justify-end gap-2 pt-4">
      <Button variant="outline" on:click={() => { addDialogOpen = false; resetForm(); }}>
        Отмена
      </Button>
      <Button on:click={editingItem ? handleUpdate : handleAdd}>
        {editingItem ? 'Обновить' : 'Добавить'}
      </Button>
    </div>
  </div>
</Dialog>

<style>
  .selected {
    @apply bg-blue-50;
  }
</style>