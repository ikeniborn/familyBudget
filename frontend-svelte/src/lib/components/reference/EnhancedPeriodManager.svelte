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
    Calendar, 
    AlertCircle, 
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
  
  // Advanced components
  import BulkOperationsPanel from '$lib/components/advanced/BulkOperationsPanel.svelte';
  import AuditHistoryViewer from '$lib/components/advanced/AuditHistoryViewer.svelte';
  
  import { authStore } from '$lib/stores/auth.store';
  import { toastStore } from '$lib/stores/toast.store';
  import { periodsService as periodService, registryService } from '$lib/services';
  import type { Period } from '$lib/types';

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Component state
  let periods: Period[] = [];
  let loading = true;
  let transactionCounts: Record<number, number> = {};
  let customAddDialogOpen = false;
  let editingItem: Period | null = null;
  let fileInput: HTMLInputElement;

  // Table state
  const sorting = writable([]);
  const columnFilters = writable([]);
  const globalFilter = writable('');
  const rowSelection = writable({});

  // Form state for new period
  let newPeriodData = {
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    period_start_date: '',
    period_end_date: ''
  };

  // Form state for editing
  let formData: Partial<Period> = {};
  let formErrors: Record<string, string> = {};

  // Динамически генерируем название периода
  $: dynamicPeriodName = newPeriodData.period_year && newPeriodData.period_month ? 
    generatePeriodName(newPeriodData.period_year, newPeriodData.period_month) : '';

  // Check for period overlap
  function checkPeriodOverlap(year: number, month: number, excludeId?: number): boolean {
    return periods.some(p => 
      p.period_id !== excludeId && 
      p.period_year === year && 
      p.period_month === month
    );
  }

  // Generate date range for period
  function generatePeriodDates(year: number, month: number): { start: string; end: string } {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // Last day of month
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }

  // Auto-generate period name
  function generatePeriodName(year: number, month: number): string {
    return `${monthNames[month - 1]} ${year}`;
  }

  // Define table columns
  const columns: ColumnDef<Period>[] = [
    {
      accessorKey: 'period_name',
      header: 'Название периода',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        return {
          component: 'div',
          props: { class: 'flex items-center gap-2' },
          children: [
            { component: Calendar, props: { class: 'h-4 w-4 text-gray-500' } },
            { component: 'span', children: value }
          ]
        };
      },
    },
    {
      accessorKey: 'period_year',
      header: 'Год',
      cell: ({ getValue }) => getValue() || '-',
    },
    {
      accessorKey: 'period_month',
      header: 'Месяц',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return {
          component: 'span',
          props: { class: 'font-medium' },
          children: monthNames[value - 1] || '-'
        };
      },
    },
    {
      accessorKey: 'period_start_date',
      header: 'Начало',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
    },
    {
      accessorKey: 'period_end_date',
      header: 'Конец',
      cell: ({ getValue }) => {
        const value = getValue() as string;
        if (!value) return '-';
        return new Date(value).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
    },
    {
      accessorKey: 'transaction_count',
      header: 'Транзакций',
      cell: ({ getValue }) => {
        const value = getValue() as number;
        return value || 0;
      },
      enableSorting: true,
    },
  ];

  // Table options
  $: options = {
    data: periods,
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

  // Watch for year/month changes in new period form
  $: if (newPeriodData.period_year && newPeriodData.period_month) {
    const dates = generatePeriodDates(newPeriodData.period_year, newPeriodData.period_month);
    newPeriodData.period_start_date = dates.start;
    newPeriodData.period_end_date = dates.end;
  }

  // Fetch periods
  async function fetchPeriods() {
    if (!$authStore.user?.user_id) return;
    
    try {
      loading = true;
      const response = await periodService.getAll({ user_id: $authStore.user.user_id });
      const periodsData = response.map((p: any) => {
        // Use existing dates if available, otherwise generate defaults
        const dates = generatePeriodDates(p.period_year, p.period_month);
        return {
          ...p,
          id: p.period_id, // Map period_id to id for table
          period_start_date: p.period_start_date || dates.start,
          period_end_date: p.period_end_date || dates.end,
        };
      });
      periods = periodsData;
      
      // Fetch transaction counts for each period
      await fetchTransactionCounts(periodsData);
    } catch (error) {
      toastStore.error('Ошибка', 'Не удалось загрузить периоды');
    } finally {
      loading = false;
    }
  }

  // Fetch transaction counts
  async function fetchTransactionCounts(periodsData: Period[]) {
    try {
      const counts: Record<number, number> = {};
      
      for (const period of periodsData) {
        try {
          const registryData = await registryService.getAll({
            user_id: $authStore.user?.user_id,
            period_id: period.period_id
          });
          counts[period.period_id] = registryData.length || 0;
        } catch (error) {
          counts[period.period_id] = 0;
        }
      }
      
      transactionCounts = counts;
      
      // Update periods with transaction counts
      periods = periods.map(p => ({
        ...p,
        transaction_count: counts[p.period_id] || 0
      }));
    } catch (error) {
      console.error('Failed to fetch transaction counts:', error);
    }
  }

  // Add period with validation
  async function handleAdd() {
    if (!$authStore.user?.user_id) return;
    
    const year = Number(newPeriodData.period_year);
    const month = Number(newPeriodData.period_month);
    
    // Check for overlap
    if (checkPeriodOverlap(year, month)) {
      toastStore.error('Ошибка', `Период ${monthNames[month - 1]} ${year} уже существует`);
      return;
    }
    
    // Auto-generate period name
    const periodName = generatePeriodName(year, month);
    
    // Use provided dates or generate defaults
    const startDate = newPeriodData.period_start_date || generatePeriodDates(year, month).start;
    const endDate = newPeriodData.period_end_date || generatePeriodDates(year, month).end;
    
    const newPeriod = {
      period_name: periodName,
      period_year: year,
      period_month: month,
      period_start_date: startDate,
      period_end_date: endDate,
      user_id: $authStore.user.user_id,
    };

    try {
      await periodService.create(newPeriod);
      await fetchPeriods();
      
      toastStore.success('Успешно', `Период ${periodName} создан`);
      customAddDialogOpen = false;
      resetNewPeriodForm();
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось добавить период');
    }
  }

  // Update period with validation
  async function handleUpdate() {
    if (!editingItem || !$authStore.user?.user_id) return;
    
    const year = formData.period_year ? Number(formData.period_year) : undefined;
    const month = formData.period_month ? Number(formData.period_month) : undefined;
    
    // Check for overlap if year or month changed
    if (year && month) {
      if (checkPeriodOverlap(year, month, editingItem.period_id)) {
        toastStore.error('Ошибка', `Период ${monthNames[month - 1]} ${year} уже существует`);
        return;
      }
    }
    
    const updateData: any = {
      ...formData,
      period_month: month,
      period_year: year,
    };
    
    // Update name if year or month changed
    if (year && month) {
      const expectedName = generatePeriodName(editingItem.period_year, editingItem.period_month);
      if (editingItem.period_name === expectedName) {
        updateData.period_name = generatePeriodName(year, month);
      }
    }

    try {
      await periodService.update(editingItem.period_id, updateData);
      await fetchPeriods();
      
      toastStore.success('Успешно', 'Период обновлен');
      resetForm();
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось обновить период');
    }
  }

  // Delete period with transaction check
  async function handleDelete(item: Period) {
    if (item.transaction_count && item.transaction_count > 0) {
      const confirmed = confirm(
        `Период "${item.period_name}" содержит ${item.transaction_count} транзакций. Вы уверены, что хотите удалить его?`
      );
      
      if (!confirmed) return;
    }

    try {
      await periodService.delete(item.period_id);
      await fetchPeriods();
      
      toastStore.success('Успешно', 'Период удален');
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить период');
    }
  }

  // Bulk delete periods
  async function handleBulkDelete() {
    const selectedRows = $table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;

    const ids = selectedRows.map(row => row.original.period_id);
    const periodsWithTransactions = periods.filter(
      p => ids.includes(p.period_id) && p.transaction_count && p.transaction_count > 0
    );
    
    if (periodsWithTransactions.length > 0) {
      const totalTransactions = periodsWithTransactions.reduce(
        (sum, p) => sum + (p.transaction_count || 0), 0
      );
      
      const confirmed = confirm(
        `${periodsWithTransactions.length} из выбранных периодов содержат транзакции (всего ${totalTransactions}). Вы уверены, что хотите удалить их?`
      );
      
      if (!confirmed) return;
    }

    try {
      await Promise.all(ids.map(id => periodService.delete(id)));
      await fetchPeriods();
      
      toastStore.success('Успешно', `Удалено периодов: ${ids.length}`);
      rowSelection.set({});
    } catch (error: any) {
      toastStore.error('Ошибка', error.response?.data?.detail || 'Не удалось удалить периоды');
    }
  }

  // Enhanced export with additional fields
  function handleExport() {
    const csvContent = [
      ['ID', 'Название', 'Год', 'Месяц', 'Начало', 'Конец', 'Транзакций', 'Создан'].join(','),
      ...periods.map(p => [
        p.period_id,
        `"${p.period_name}"`,
        p.period_year,
        p.period_month,
        p.period_start_date || '',
        p.period_end_date || '',
        p.transaction_count || 0,
        p.created_at ? new Date(p.created_at).toLocaleDateString('ru-RU') : '',
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `periods_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  // Enhanced import with validation
  async function handleImport(file: File) {
    const text = await file.text();
    const lines = text.split('\n').slice(1); // Skip header
    
    const newPeriods: Omit<Period, 'id'>[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      
      const [, name, year, month] = line.split(',').map(v => v.replace(/"/g, '').trim());
      
      const periodYear = Number(year);
      const periodMonth = Number(month);
      
      // Validate data
      if (checkPeriodOverlap(periodYear, periodMonth)) {
        errors.push(`Строка ${i + 2}: Период ${monthNames[periodMonth - 1]} ${periodYear} уже существует`);
        continue;
      }
      
      newPeriods.push({
        period_name: generatePeriodName(periodYear, periodMonth),
        period_year: periodYear,
        period_month: periodMonth,
        user_id: $authStore.user!.user_id,
      } as Omit<Period, 'id'>);
    }
    
    if (errors.length > 0) {
      toastStore.error('Ошибки при импорте', errors.join('\n'));
    }

    // Add valid periods
    for (const period of newPeriods) {
      await periodService.create(period);
    }
    
    await fetchPeriods();
    
    if (newPeriods.length > 0) {
      toastStore.success('Импорт завершен', `Добавлено периодов: ${newPeriods.length}`);
    }
  }

  // Handle custom add button click
  function handleCustomAddClick() {
    // Reset form data with defaults
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = generatePeriodDates(year, month);
    
    newPeriodData = {
      period_year: year,
      period_month: month,
      period_start_date: dates.start,
      period_end_date: dates.end
    };
    customAddDialogOpen = true;
  }

  // Form validation for date ranges
  function validateDateRange(): boolean {
    if (newPeriodData.period_start_date && newPeriodData.period_end_date) {
      const startDate = new Date(newPeriodData.period_start_date);
      const endDate = new Date(newPeriodData.period_end_date);
      if (endDate < startDate) {
        toastStore.error('Ошибка', 'Дата окончания должна быть позже даты начала');
        return false;
      }
    }
    return true;
  }

  // Reset new period form
  function resetNewPeriodForm() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const dates = generatePeriodDates(year, month);
    
    newPeriodData = {
      period_year: year,
      period_month: month,
      period_start_date: dates.start,
      period_end_date: dates.end
    };
  }

  // Reset form
  function resetForm() {
    formData = {};
    formErrors = {};
    editingItem = null;
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
    fetchPeriods();
    resetNewPeriodForm();
  });
</script>

<div class="space-y-4">
  <!-- Warning about overlapping periods -->
  {#if periods.length > 0}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
      <AlertCircle class="h-5 w-5 text-blue-600 mt-0.5" />
      <div class="text-sm text-blue-800">
        <p class="font-medium">Информация о периодах</p>
        <p class="mt-1">
          Каждый период должен быть уникальным. Система автоматически проверяет пересечения периодов
          и генерирует даты начала и конца на основе выбранного месяца и года.
        </p>
      </div>
    </div>
  {/if}
  
  <!-- Table -->
  <Card class="p-6">
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Управление периодами</h2>
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
          
          <Button on:click={handleCustomAddClick}>
            <Plus class="h-4 w-4 mr-2" />
            Добавить период
          </Button>
          
          <!-- Advanced Operations -->
          <BulkOperationsPanel
            entityType="periods"
            selectedItems={$table.getFilteredSelectedRowModel().rows.map(row => row.original.period_id)}
            data={periods}
            userId={$authStore.user?.user_id || 0}
            on:dataChange={fetchPeriods}
          />
        </div>
      </div>

      <!-- Search -->
      <div class="max-w-sm">
        <Input
          placeholder="Поиск периодов..."
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
                              on:click={() => handleDelete(row.original)}
                            >
                              <Trash2 class="h-4 w-4" />
                            </Button>
                            {#if row.original.transaction_count && row.original.transaction_count > 0}
                              <div class="text-xs text-gray-500 px-2 py-1">
                                {row.original.transaction_count} транз.
                              </div>
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
                    Нет добавленных периодов. Нажмите 'Добавить период' для создания нового.
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
              periods.length
            )}{' '}
            из {periods.length}
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

<!-- Custom Add Dialog -->
<Dialog bind:open={customAddDialogOpen}>
  <div class="space-y-4">
    <div class="text-lg font-semibold">Добавить период</div>
    <p class="text-sm text-gray-600">Заполните поля для создания нового периода</p>
    
    <!-- Dynamic Period Name -->
    <div>
      <label class="text-sm font-medium">Название периода</label>
      <div class="mt-1 flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
        <Calendar class="h-4 w-4 text-gray-400" />
        <span class="text-gray-600 font-medium">
          {dynamicPeriodName || 'Выберите год и месяц'}
        </span>
      </div>
    </div>

    <!-- Year -->
    <div>
      <label class="text-sm font-medium">
        Год <span class="text-red-500">*</span>
      </label>
      <Select bind:value={newPeriodData.period_year} class="mt-1">
        {#each Array.from({ length: 11 }, (_, i) => 2020 + i) as year}
          <option value={year}>{year}</option>
        {/each}
      </Select>
    </div>

    <!-- Month -->
    <div>
      <label class="text-sm font-medium">
        Месяц <span class="text-red-500">*</span>
      </label>
      <Select bind:value={newPeriodData.period_month} class="mt-1">
        {#each monthNames as name, index}
          <option value={index + 1}>{name}</option>
        {/each}
      </Select>
    </div>

    <!-- Start Date -->
    <div>
      <label class="text-sm font-medium">
        Начало <span class="text-red-500">*</span>
      </label>
      <Input
        type="date"
        bind:value={newPeriodData.period_start_date}
        class="mt-1"
      />
    </div>

    <!-- End Date -->
    <div>
      <label class="text-sm font-medium">
        Конец <span class="text-red-500">*</span>
      </label>
      <Input
        type="date"
        bind:value={newPeriodData.period_end_date}
        class="mt-1"
      />
    </div>

    <!-- Dialog Actions -->
    <div class="flex justify-end gap-2 pt-4">
      <Button variant="outline" on:click={() => { customAddDialogOpen = false; resetNewPeriodForm(); }}>
        Отмена
      </Button>
      <Button on:click={() => { if (validateDateRange()) handleAdd(); }}>
        Добавить
      </Button>
    </div>
  </div>
</Dialog>

<!-- Audit History Viewer -->
<div class="mt-6">
  <AuditHistoryViewer
    entityType="periods"
    userId={$authStore.user?.user_id || 0}
  />
</div>

<style>
  .selected {
    @apply bg-blue-50;
  }
</style>