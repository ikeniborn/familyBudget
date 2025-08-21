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
    Briefcase, 
    Building2, 
    DollarSign, 
    History, 
    Copy, 
    AlertCircle,
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
  import { costCenterService, financialCenterService, registryService } from '$lib/services';
  import type { CostCenter, CostCenterHistory, FinancialCenter } from '$lib/types';

  // Component state
  let costCenters: CostCenter[] = [];
  let financialCenters: FinancialCenter[] = [];
  let loading = true;
  let showHistory = false;
  let selectedForCopy: number[] = [];
  let editingItem: CostCenter | null = null;
  let addDialogOpen = false;
  let fileInput: HTMLInputElement;

  // Table state
  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');
  const rowSelection = writable({});

  // Form state
  let formData: Partial<CostCenter> = {};
  let formErrors: Record<string, string> = {};

  // Fetch financial centers for dropdown
  async function fetchFinancialCenters() {
    if (!$authStore.user?.user_id) return;
    
    try {
      const response = await financialCenterService.getAll({ user_id: $authStore.user.user_id });
      financialCenters = response;
    } catch (error) {
      console.error('Failed to fetch financial centers:', error);
    }
  }

  // Define table columns
  const columns: ColumnDef<CostCenter>[] = [
    {
      accessorKey: 'cost_center_name',
      header: 'Название МВЗ',
      cell: ({ row }) => {
        const item = row.original;
        return {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            { component: Briefcase, props: { class: 'h-4 w-4 text-gray-500' } },
            { component: 'span', props: { class: 'font-medium' }, children: item.cost_center_name },
            item.is_active ? {
              component: Badge,
              props: { variant: 'default', class: 'ml-2' },
              children: 'Активный'
            } : null,
            item.budget_limit && item.usage_percentage !== undefined ? {
              component: Badge,
              props: { 
                variant: item.usage_percentage > 90 ? "destructive" : item.usage_percentage > 70 ? "secondary" : "default",
                class: 'ml-2'
              },
              children: `${item.usage_percentage.toFixed(0)}%`
            } : null
          ].filter(Boolean)
        };
      },
    },
    {
      accessorKey: 'cost_center_description',
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
      accessorKey: 'financial_center_id',
      header: 'Финансовый центр',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        if (!value) return { component: 'span', props: { class: 'text-gray-500' }, children: 'Не назначен' };
        const fc = financialCenters.find(f => f.financial_center_id === value);
        return fc ? {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            { component: Building2, props: { class: 'h-4 w-4 text-gray-500' } },
            { component: 'span', props: { class: 'text-sm' }, children: fc.financial_center_name }
          ]
        } : '-';
      },
    },
    {
      accessorKey: 'budget_limit',
      header: 'Бюджетный лимит',
      cell: ({ getValue, row }) => {
        const value = getValue() as number;
        if (!value) return { component: 'span', props: { class: 'text-gray-500' }, children: 'Не установлен' };
        
        const item = row.original;
        const periodText = item.budget_period === 'monthly' ? 'мес.' : 
                          item.budget_period === 'quarterly' ? 'кв.' : 'год';
        
        return {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            { component: DollarSign, props: { class: 'h-4 w-4 text-gray-500' } },
            {
              component: 'span',
              props: { class: 'font-medium' },
              children: `${value.toLocaleString('ru-RU')} ₽/${periodText}`
            }
          ]
        };
      },
    },
    {
      accessorKey: 'budget_period',
      header: 'Период',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        const labels: Record<string, string> = {
          monthly: 'Месячный',
          quarterly: 'Квартальный',
          yearly: 'Годовой',
        };
        return value ? labels[value] || value : '-';
      },
    },
    {
      accessorKey: 'current_usage',
      header: 'Использовано',
      cell: ({ getValue, row }) => {
        const value = getValue() as number;
        if (!value && value !== 0) return '-';
        
        const item = row.original;
        return {
          component: 'div',
          props: { class: 'text-sm' },
          children: [
            { 
              component: 'div', 
              props: { class: 'font-medium' }, 
              children: `${value.toLocaleString('ru-RU')} ₽` 
            },
            item.budget_limit ? {
              component: 'div',
              props: { class: 'text-xs text-gray-500' },
              children: `из ${item.budget_limit.toLocaleString('ru-RU')} ₽`
            } : null
          ].filter(Boolean)
        };
      },
      enableSorting: true,
    },
    {
      accessorKey: 'cost_center_order',
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
        });
      },
      enableSorting: true,
    },
  ];

  // Table options
  $: options = {
    data: costCenters,
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

  // Fetch cost centers
  async function fetchCostCenters() {
    if (!$authStore.user?.user_id) return;
    
    try {
      loading = true;
      
      // Fetch financial centers first
      await fetchFinancialCenters();
      
      const response = await costCenterService.getAll({ user_id: $authStore.user.user_id });
      const data = response.map((cc: any) => ({
        ...cc,
        id: cc.cost_center_id, // Map cost_center_id to id for table
      }));
      
      // Fetch usage data for each cost center
      await fetchUsageData(data);
      
      costCenters = data;
    } catch (error) {
      toastStore.error('Ошибка', 'Не удалось загрузить центры затрат');
    } finally {
      loading = false;
    }
  }

  // Fetch usage data
  async function fetchUsageData(centers: CostCenter[]) {
    try {
      const usageMap: Record<number, number> = {};
      
      for (const center of centers) {
        try {
          const registryData = await registryService.getAll({
            user_id: $authStore.user?.user_id,
            cost_center_id: center.cost_center_id
          });
          
          const totalUsage = registryData.reduce((sum: number, tx: any) => 
            sum + (tx.amount || 0), 0
          );
          
          usageMap[center.cost_center_id] = totalUsage;
        } catch (error) {
          usageMap[center.cost_center_id] = 0;
        }
      }
      
      // Update cost centers with usage data
      costCenters = costCenters.map(cc => {
        const usage = usageMap[cc.cost_center_id] || 0;
        const percentage = cc.budget_limit ? (usage / cc.budget_limit) * 100 : 0;
        
        return {
          ...cc,
          current_usage: usage,
          usage_percentage: percentage,
        };
      });
    } catch (error) {
      console.error('Failed to fetch usage data:', error);
    }
  }

  // Add cost center
  async function handleAdd() {
    if (!$authStore.user?.user_id) return;
    
    if (!validateForm()) return;
    
    const newCostCenter = {
      ...formData,
      user_id: $authStore.user.user_id,
      is_active: formData.is_active !== false,
      financial_center_id: formData.financial_center_id ? Number(formData.financial_center_id) : null,
      budget_limit: formData.budget_limit ? Number(formData.budget_limit) : null,
    };

    try {
      await costCenterService.create(newCostCenter);
      await fetchCostCenters();
      
      toastStore.success('Успешно', 'Центр затрат создан');
      resetForm();
      addDialogOpen = false;
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось добавить центр затрат');
    }
  }

  // Update cost center
  async function handleUpdate() {
    if (!editingItem || !$authStore.user?.user_id) return;
    
    if (!validateForm()) return;

    const updateData: any = {
      ...formData,
      financial_center_id: formData.financial_center_id !== undefined ? 
        (formData.financial_center_id ? Number(formData.financial_center_id) : null) : undefined,
      budget_limit: formData.budget_limit !== undefined ? 
        (formData.budget_limit ? Number(formData.budget_limit) : null) : undefined,
    };

    try {
      await costCenterService.update(editingItem.cost_center_id, updateData);
      await fetchCostCenters();
      
      toastStore.success('Успешно', 'Центр затрат обновлен');
      resetForm();
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось обновить центр затрат');
    }
  }

  // Delete cost center
  async function handleDelete(item: CostCenter) {
    if (item.current_usage && item.current_usage > 0) {
      const confirmed = confirm(
        `Центр затрат "${item.cost_center_name}" имеет транзакции на сумму ${item.current_usage.toLocaleString('ru-RU')} ₽. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) return;
    }

    try {
      await costCenterService.delete(item.cost_center_id);
      await fetchCostCenters();
      
      toastStore.success('Успешно', 'Центр затрат удален');
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить центр затрат');
    }
  }

  // Bulk delete cost centers
  async function handleBulkDelete() {
    const selectedRows = $table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const ids = selectedRows.map(row => row.original.cost_center_id);
    const centersWithUsage = costCenters.filter(
      cc => ids.includes(cc.cost_center_id) && cc.current_usage && cc.current_usage > 0
    );
    
    if (centersWithUsage.length > 0) {
      const totalUsage = centersWithUsage.reduce(
        (sum, cc) => sum + (cc.current_usage || 0), 0
      );
      
      const confirmed = confirm(
        `${centersWithUsage.length} из выбранных центров затрат имеют транзакции на общую сумму ${totalUsage.toLocaleString('ru-RU')} ₽. Вы уверены, что хотите удалить их?`
      );
      
      if (!confirmed) return;
    }

    try {
      await Promise.all(ids.map(id => costCenterService.delete(id)));
      await fetchCostCenters();
      
      toastStore.success('Успешно', `Удалено центров затрат: ${ids.length}`);
      rowSelection.set({});
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить центры затрат');
    }
  }

  // Bulk copy cost centers
  async function handleBulkCopy() {
    if (selectedForCopy.length === 0) {
      toastStore.error('Ошибка', 'Выберите центры затрат для копирования');
      return;
    }

    try {
      for (const id of selectedForCopy) {
        const original = costCenters.find(cc => cc.cost_center_id === id);
        if (!original) continue;
        
        const copyData = {
          ...original,
          cost_center_name: `${original.cost_center_name} (копия)`,
          is_active: false, // Deactivate copies by default
        };
        
        // Remove fields that shouldn't be copied
        delete (copyData as any).id;
        delete (copyData as any).cost_center_id;
        delete (copyData as any).current_usage;
        delete (copyData as any).usage_percentage;
        delete (copyData as any).created_at;
        delete (copyData as any).updated_at;
        
        await costCenterService.create(copyData);
      }
      
      selectedForCopy = [];
      await fetchCostCenters();
      
      toastStore.success('Успешно', `Скопировано центров затрат: ${selectedForCopy.length}`);
    } catch (error) {
      toastStore.error('Ошибка', 'Не удалось скопировать центры затрат');
    }
  }

  // Enhanced export
  function handleExport() {
    const csvContent = [
      ['ID', 'Название МВЗ', 'Описание', 'Финансовый центр', 'Бюджетный лимит', 'Период', 'Использовано', 'Процент', 'Порядок', 'Статус', 'Дата создания'].join(','),
      ...costCenters.map(cc => {
        const fc = cc.financial_center_id ? 
          financialCenters.find(f => f.financial_center_id === cc.financial_center_id)?.financial_center_name || '' : '';
        
        const periodText = cc.budget_period === 'monthly' ? 'Месяц' : 
                          cc.budget_period === 'quarterly' ? 'Квартал' : 
                          cc.budget_period === 'yearly' ? 'Год' : '';
        
        return [
          cc.cost_center_id,
          `"${cc.cost_center_name}"`,
          `"${cc.cost_center_description || ''}"`,
          `"${fc}"`,
          cc.budget_limit || '',
          periodText,
          cc.current_usage || 0,
          cc.usage_percentage ? `${cc.usage_percentage.toFixed(0)}%` : '',
          cc.cost_center_order,
          cc.is_active ? 'Активен' : 'Неактивен',
          cc.created_at ? new Date(cc.created_at).toLocaleDateString('ru-RU') : '',
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cost_centers_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  // Enhanced import
  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newCostCenters: Omit<CostCenter, 'id'>[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [, name, description, fcName, limit, period, , , order, status] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      // Find financial center ID
      let fcId = null;
      if (fcName) {
        const fc = financialCenters.find(f => f.financial_center_name === fcName);
        fcId = fc ? fc.financial_center_id : null;
      }
      
      // Map period
      const periodMap: Record<string, string> = {
        'Месяц': 'monthly',
        'Квартал': 'quarterly',
        'Год': 'yearly',
      };
      
      newCostCenters.push({
        cost_center_name: name,
        cost_center_description: description || undefined,
        financial_center_id: fcId,
        budget_limit: limit ? Number(limit) : undefined,
        budget_period: periodMap[period] as any || 'monthly',
        cost_center_order: Number(order),
        is_active: status === 'Активен',
        user_id: $authStore.user!.user_id,
      } as Omit<CostCenter, 'id'>);
    }

    // Add cost centers one by one
    for (const cc of newCostCenters) {
      await costCenterService.create(cc);
    }
    
    await fetchCostCenters();
    toastStore.success('Импорт завершен', `Добавлено центров затрат: ${newCostCenters.length}`);
  }

  // Toggle copy selection
  function toggleCopySelection(id: number) {
    if (selectedForCopy.includes(id)) {
      selectedForCopy = selectedForCopy.filter(i => i !== id);
    } else {
      selectedForCopy = [...selectedForCopy, id];
    }
  }

  // Form validation
  function validateForm(): boolean {
    formErrors = {};
    
    if (!formData.cost_center_name || formData.cost_center_name.trim().length < 3) {
      formErrors.cost_center_name = 'Название должно содержать минимум 3 символа';
    }
    if (formData.cost_center_name && formData.cost_center_name.trim().length > 100) {
      formErrors.cost_center_name = 'Название не должно превышать 100 символов';
    }
    if (formData.budget_limit && Number(formData.budget_limit) < 0) {
      formErrors.budget_limit = 'Лимит не может быть отрицательным';
    }
    if (!formData.cost_center_order || Number(formData.cost_center_order) < 1) {
      formErrors.cost_center_order = 'Порядок должен быть больше 0';
    }
    
    return Object.keys(formErrors).length === 0;
  }

  // Reset form
  function resetForm() {
    formData = {
      cost_center_order: 1,
      is_active: true,
      budget_period: 'monthly'
    };
    formErrors = {};
    editingItem = null;
  }

  // Start editing
  function startEdit(item: CostCenter) {
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

  // Initialize
  onMount(() => {
    fetchCostCenters();
    resetForm();
  });
</script>

<div class="space-y-4">
  <!-- Info and actions -->
  <Card class="p-4">
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-3">
        <AlertCircle class="h-5 w-5 text-blue-600 mt-0.5" />
        <div class="text-sm text-gray-700">
          <p class="font-medium mb-1">Управление центрами затрат</p>
          <p>
            Центры затрат (МВЗ) привязываются к финансовым центрам (ЦФО) и могут иметь бюджетные лимиты.
            Система автоматически отслеживает использование бюджета.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        {#if selectedForCopy.length > 0}
          <Button
            variant="secondary"
            size="sm"
            on:click={handleBulkCopy}
          >
            <Copy class="h-4 w-4 mr-2" />
            Копировать ({selectedForCopy.length})
          </Button>
        {/if}
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={showHistory}
            class="rounded"
          />
          <span class="text-sm">История</span>
        </label>
      </div>
    </div>
  </Card>
  
  <!-- Table -->
  <Card class="p-6">
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Места возникновения затрат (МВЗ)</h2>
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
            Добавить МВЗ
          </Button>
        </div>
      </div>

      <!-- Search -->
      <div class="max-w-sm">
        <Input
          placeholder="Поиск МВЗ..."
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
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              on:click={() => toggleCopySelection(row.original.cost_center_id)}
                              title="Копировать"
                            >
                              <Copy class="h-4 w-4 {selectedForCopy.includes(row.original.cost_center_id) ? 'text-blue-600' : 'text-gray-500'}" />
                            </Button>
                            {#if showHistory}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                on:click={() => toastStore.info('История изменений', 'Функция в разработке')}
                                title="История"
                              >
                                <History class="h-4 w-4 text-gray-500" />
                              </Button>
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
                    Нет добавленных центров затрат. Нажмите 'Добавить МВЗ' для создания нового.
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
              costCenters.length
            )}{' '}
            из {costCenters.length}
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
      {editingItem ? 'Редактировать МВЗ' : 'Добавить МВЗ'}
    </div>
    
    <!-- Name -->
    <div>
      <label class="text-sm font-medium">
        Название МВЗ <span class="text-red-500">*</span>
      </label>
      <Input
        bind:value={formData.cost_center_name}
        placeholder="Введите название МВЗ"
        class="mt-1"
        error={formErrors.cost_center_name}
      />
      {#if formErrors.cost_center_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.cost_center_name}</p>
      {/if}
    </div>

    <!-- Description -->
    <div>
      <label class="text-sm font-medium">Описание</label>
      <Input
        bind:value={formData.cost_center_description}
        placeholder="Введите описание (необязательно)"
        class="mt-1"
      />
    </div>

    <!-- Financial Center -->
    <div>
      <label class="text-sm font-medium">Финансовый центр</label>
      <Select bind:value={formData.financial_center_id} class="mt-1">
        <option value="">Не назначен</option>
        {#each financialCenters as fc}
          <option value={fc.financial_center_id}>{fc.financial_center_name}</option>
        {/each}
      </Select>
    </div>

    <!-- Budget Limit -->
    <div>
      <label class="text-sm font-medium">Бюджетный лимит</label>
      <Input
        type="number"
        bind:value={formData.budget_limit}
        min="0"
        placeholder="Введите лимит (необязательно)"
        class="mt-1"
        error={formErrors.budget_limit}
      />
      {#if formErrors.budget_limit}
        <p class="text-red-500 text-xs mt-1">{formErrors.budget_limit}</p>
      {/if}
    </div>

    <!-- Budget Period -->
    <div>
      <label class="text-sm font-medium">Период бюджета</label>
      <Select bind:value={formData.budget_period} class="mt-1">
        <option value="monthly">Месяц</option>
        <option value="quarterly">Квартал</option>
        <option value="yearly">Год</option>
      </Select>
    </div>

    <!-- Order -->
    <div>
      <label class="text-sm font-medium">
        Порядок <span class="text-red-500">*</span>
      </label>
      <Input
        type="number"
        bind:value={formData.cost_center_order}
        min="1"
        class="mt-1"
        error={formErrors.cost_center_order}
      />
      {#if formErrors.cost_center_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.cost_center_order}</p>
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
      <label for="is_active" class="text-sm cursor-pointer">Активный МВЗ</label>
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