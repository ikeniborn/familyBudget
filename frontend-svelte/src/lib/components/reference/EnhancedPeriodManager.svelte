<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { periodsService, type CreatePeriodData, type UpdatePeriodData } from '$lib/services/periods.service';
  import type { Period } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { Download, Upload, Plus, Edit2, Trash2, Filter, RefreshCw, Copy, CheckSquare, Square } from 'lucide-svelte';

  let periods: Period[] = [];
  let loading = true;
  let showModal = false;
  let showFilterModal = false;
  let editingPeriod: Period | null = null;
  let isEditing = false;
  let selectedItems = new Set<number>();

  // Form state
  let formData = {
    period_name: '',
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    period_order: 1,
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  // Filter state
  let filters = {
    year: null as number | null,
    month: null as number | null,
    isActive: null as boolean | null,
    searchQuery: ''
  };

  const toast = useToast();

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Enhanced data with selection status
  $: enhancedPeriods = periods.map(period => ({
    ...period,
    _selected: selectedItems.has(period.period_id)
  }));

  // Define table columns for CRUDTable
  const columns = [
    {
      key: '_selected',
      header: '',
      width: '50px',
      sortable: false,
      render: (item: Period & { _selected: boolean }) => {
        return `<input type="checkbox" ${item._selected ? 'checked' : ''} />`;
      }
    },
    {
      key: 'period_name',
      header: 'Название периода',
      sortable: true
    },
    {
      key: 'period_year',
      header: 'Год',
      sortable: true,
      width: '100px'
    },
    {
      key: 'period_month',
      header: 'Месяц',
      sortable: true,
      width: '120px',
      render: (item: Period) => monthNames[item.period_month - 1] || '-'
    },
    {
      key: 'period_order',
      header: 'Порядок',
      sortable: true,
      width: '100px'
    },
    {
      key: 'is_active',
      header: 'Статус',
      width: '120px',
      render: (item: Period) => item.is_active ? 'Активен' : 'Неактивен'
    },
    {
      key: 'created_at',
      header: 'Создан',
      sortable: true,
      width: '140px',
      render: (item: Period) => {
        if (!item.created_at) return '-';
        return new Date(item.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    }
  ];

  // Computed filtered data
  $: filteredPeriods = enhancedPeriods.filter(period => {
    if (filters.year !== null && period.period_year !== filters.year) return false;
    if (filters.month !== null && period.period_month !== filters.month) return false;
    if (filters.isActive !== null && period.is_active !== filters.isActive) return false;
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return period.period_name.toLowerCase().includes(query) ||
             period.period_year.toString().includes(query) ||
             monthNames[period.period_month - 1].toLowerCase().includes(query);
    }
    
    return true;
  });

  // Statistics
  $: statistics = {
    total: periods.length,
    active: periods.filter(p => p.is_active).length,
    inactive: periods.filter(p => !p.is_active).length,
    currentYear: periods.filter(p => p.period_year === new Date().getFullYear()).length
  };

  // Load periods
  async function fetchPeriods() {
    if (!$currentUser?.user_id) return;
    
    try {
      loading = true;
      periods = await periodsService.getByUserId($currentUser.user_id);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить периоды');
      console.error('Error fetching periods:', error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchPeriods();
  });

  // Form validation
  function validateForm(): boolean {
    formErrors = {};

    if (!formData.period_name || formData.period_name.trim().length < 3) {
      formErrors.period_name = 'Название должно содержать минимум 3 символа';
    }

    // Check for duplicate period
    const duplicate = periods.find(p => 
      p.period_year === formData.period_year && 
      p.period_month === formData.period_month &&
      (!isEditing || p.period_id !== editingPeriod?.period_id)
    );
    
    if (duplicate) {
      formErrors.period_month = 'Период для этого месяца уже существует';
    }

    if (formData.period_year < 2020 || formData.period_year > 2030) {
      formErrors.period_year = 'Год должен быть между 2020 и 2030';
    }

    if (formData.period_order < 1) {
      formErrors.period_order = 'Порядок должен быть больше 0';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingPeriod = null;
    
    // Auto-generate period name
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const monthName = monthNames[month - 1];
    
    formData = {
      period_name: `${year}.${String(month).padStart(2, '0')} - ${monthName}`,
      period_year: year,
      period_month: month,
      period_order: Math.max(...periods.map(p => p.period_order), 0) + 1,
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    isEditing = true;
    editingPeriod = item;
    formData = {
      period_name: item.period_name,
      period_year: item.period_year,
      period_month: item.period_month,
      period_order: item.period_order,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id } = event.detail;
    
    try {
      await periodsService.delete(id);
      await fetchPeriods();
      toast.success('Успешно', 'Период удален');
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить период');
    }
  }

  // Handle bulk delete
  async function handleBulkDelete(event: CustomEvent) {
    const { ids } = event.detail;
    
    try {
      await periodsService.bulkDelete(ids);
      selectedItems.clear();
      await fetchPeriods();
      toast.success('Успешно', `Удалено периодов: ${ids.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить периоды');
    }
  }

  // Handle duplicate
  async function handleDuplicate(item: Period) {
    const nextMonth = item.period_month === 12 ? 1 : item.period_month + 1;
    const nextYear = item.period_month === 12 ? item.period_year + 1 : item.period_year;
    const monthName = monthNames[nextMonth - 1];
    
    formData = {
      period_name: `${nextYear}.${String(nextMonth).padStart(2, '0')} - ${monthName}`,
      period_year: nextYear,
      period_month: nextMonth,
      period_order: item.period_order + 1,
      is_active: true
    };
    
    isEditing = false;
    editingPeriod = null;
    formErrors = {};
    showModal = true;
  }

  // Handle form submit
  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    if (!$currentUser?.user_id) {
      toast.error('Ошибка', 'Пользователь не авторизован');
      return;
    }

    try {
      if (isEditing && editingPeriod) {
        const updateData: UpdatePeriodData = { ...formData };
        await periodsService.update(editingPeriod.period_id, updateData);
        toast.success('Успешно', 'Период обновлен');
      } else {
        const createData: CreatePeriodData = {
          ...formData,
          user_id: $currentUser.user_id
        };
        await periodsService.create(createData);
        toast.success('Успешно', 'Период создан');
      }
      
      await fetchPeriods();
      showModal = false;
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось сохранить период');
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const dataToExport = selectedItems.size > 0 
        ? periods.filter(p => selectedItems.has(p.period_id))
        : filteredPeriods;
        
      const csvContent = await periodsService.exportToCsv(dataToExport);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `periods_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Успешно', `Экспортировано периодов: ${dataToExport.length}`);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось экспортировать данные');
    }
  }

  // Handle import
  async function handleImport(event: CustomEvent) {
    const { file } = event.detail;
    
    if (!$currentUser?.user_id) {
      toast.error('Ошибка', 'Пользователь не авторизован');
      return;
    }

    try {
      const text = await file.text();
      const importData = await periodsService.importFromCsv(text, $currentUser.user_id);
      
      let imported = 0;
      let skipped = 0;
      
      for (const periodData of importData) {
        // Check for duplicates
        const exists = periods.find(p => 
          p.period_year === periodData.period_year && 
          p.period_month === periodData.period_month
        );
        
        if (exists) {
          skipped++;
          continue;
        }
        
        await periodsService.create(periodData);
        imported++;
      }
      
      await fetchPeriods();
      
      if (imported > 0) {
        toast.success('Успешно', `Импортировано: ${imported}, пропущено: ${skipped}`);
      } else {
        toast.warning('Внимание', `Все записи уже существуют (пропущено: ${skipped})`);
      }
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось импортировать данные');
    }
  }

  // Handle mass activate/deactivate
  async function handleMassStatusChange(activate: boolean) {
    if (selectedItems.size === 0) {
      toast.warning('Внимание', 'Выберите периоды для изменения статуса');
      return;
    }

    try {
      for (const id of selectedItems) {
        await periodsService.update(id, { is_active: activate });
      }
      
      selectedItems.clear();
      await fetchPeriods();
      toast.success('Успешно', `Обновлено периодов: ${selectedItems.size}`);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось обновить статус');
    }
  }

  // Handle selection changes
  function handleSelectionChange(event: CustomEvent) {
    const { selectedIds } = event.detail;
    selectedItems = new Set(selectedIds);
  }

  // Handle custom action
  function handleCustomAction(event: CustomEvent) {
    const { action, item } = event.detail;
    if (action === 'duplicate') {
      handleDuplicate(item);
    }
  }

  // Reset filters
  function resetFilters(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    filters = {
      year: null,
      month: null,
      isActive: null,
      searchQuery: ''
    };
    showFilterModal = false;
  }

  // Apply filters and close modal
  function applyFilters(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    // Filters are already reactive and applied automatically via $: filteredPeriods
    showFilterModal = false;
  }

  // Handle filter modal close
  function handleCloseFilterModal() {
    showFilterModal = false;
  }

  // Auto-update period name when year/month changes
  $: if (formData.period_year && formData.period_month) {
    const monthName = monthNames[formData.period_month - 1];
    if (!isEditing || !formData.period_name.includes(monthName)) {
      formData.period_name = `${formData.period_year}.${String(formData.period_month).padStart(2, '0')} - ${monthName}`;
    }
  }

  function handleCloseModal() {
    showModal = false;
    formErrors = {};
  }

  // Custom actions for each row
  const customActions = [
    {
      label: 'Дублировать',
      icon: Copy,
      action: 'duplicate'
    }
  ];
</script>

<div class="space-y-6">
  <!-- Header with statistics -->
  <Card>
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Управление периодами</h2>
          <p class="text-gray-600 mt-1">Расширенное управление бюджетными периодами</p>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="outline" on:click={fetchPeriods}>
            <RefreshCw class="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button variant="outline" on:click={() => showFilterModal = true}>
            <Filter class="h-4 w-4 mr-2" />
            Фильтры
            {#if filters.year || filters.month || filters.isActive !== null}
              <Badge variant="primary" class="ml-2">
                {[filters.year, filters.month, filters.isActive !== null].filter(Boolean).length}
              </Badge>
            {/if}
          </Button>
        </div>
      </div>

      <!-- Statistics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-sm text-gray-600">Всего периодов</div>
          <div class="text-2xl font-semibold text-gray-900">{statistics.total}</div>
        </div>
        <div class="bg-green-50 rounded-lg p-3">
          <div class="text-sm text-green-600">Активные</div>
          <div class="text-2xl font-semibold text-green-900">{statistics.active}</div>
        </div>
        <div class="bg-gray-50 rounded-lg p-3">
          <div class="text-sm text-gray-600">Неактивные</div>
          <div class="text-2xl font-semibold text-gray-900">{statistics.inactive}</div>
        </div>
        <div class="bg-blue-50 rounded-lg p-3">
          <div class="text-sm text-blue-600">Текущий год</div>
          <div class="text-2xl font-semibold text-blue-900">{statistics.currentYear}</div>
        </div>
      </div>
    </div>
  </Card>

  <!-- Search bar -->
  {#if filters.searchQuery !== undefined}
    <Card>
      <div class="p-4">
        <Input
          placeholder="Поиск по названию, году или месяцу..."
          bind:value={filters.searchQuery}
          class="max-w-md"
        />
      </div>
    </Card>
  {/if}

  <!-- Bulk actions toolbar -->
  {#if selectedItems.size > 0}
    <Card>
      <div class="p-4">
        <div class="flex items-center gap-4">
          <Badge variant="secondary">
            Выбрано: {selectedItems.size}
          </Badge>
          <Button variant="outline" size="sm" on:click={() => handleMassStatusChange(true)}>
            Активировать
          </Button>
          <Button variant="outline" size="sm" on:click={() => handleMassStatusChange(false)}>
            Деактивировать
          </Button>
        </div>
      </div>
    </Card>
  {/if}

  <!-- Data table -->
  <CRUDTable
    title=""
    data={filteredPeriods}
    {columns}
    {loading}
    searchable={false}
    exportable={true}
    importable={true}
    selectable={true}
    addButtonText="Добавить период"
    emptyMessage="Нет добавленных периодов. Нажмите 'Добавить период' для создания нового."
    {customActions}
    on:add={handleAdd}
    on:edit={handleEdit}
    on:delete={handleDelete}
    on:bulkDelete={handleBulkDelete}
    on:export={handleExport}
    on:import={handleImport}
    on:selectionChange={handleSelectionChange}
    on:customAction={handleCustomAction}
  />
</div>

<!-- Edit/Create Modal -->
<Modal 
  bind:open={showModal}
  title={isEditing ? 'Редактировать период' : 'Добавить период'}
  on:close={handleCloseModal}
>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="period_name" class="block text-sm font-medium text-gray-700 mb-1">
        Название периода *
      </label>
      <Input
        id="period_name"
        bind:value={formData.period_name}
        placeholder="Введите название периода"
        class={formErrors.period_name ? 'border-red-500' : ''}
      />
      {#if formErrors.period_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.period_name}</p>
      {/if}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="period_year" class="block text-sm font-medium text-gray-700 mb-1">
          Год *
        </label>
        <Input
          id="period_year"
          type="number"
          min="2020"
          max="2030"
          bind:value={formData.period_year}
          class={formErrors.period_year ? 'border-red-500' : ''}
        />
        {#if formErrors.period_year}
          <p class="text-red-500 text-xs mt-1">{formErrors.period_year}</p>
        {/if}
      </div>

      <div>
        <label for="period_month" class="block text-sm font-medium text-gray-700 mb-1">
          Месяц *
        </label>
        <select
          id="period_month"
          bind:value={formData.period_month}
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 {formErrors.period_month ? 'border-red-500' : ''}"
        >
          {#each monthNames as month, index}
            <option value={index + 1}>{month}</option>
          {/each}
        </select>
        {#if formErrors.period_month}
          <p class="text-red-500 text-xs mt-1">{formErrors.period_month}</p>
        {/if}
      </div>
    </div>

    <div>
      <label for="period_order" class="block text-sm font-medium text-gray-700 mb-1">
        Порядок *
      </label>
      <Input
        id="period_order"
        type="number"
        min="1"
        bind:value={formData.period_order}
        class={formErrors.period_order ? 'border-red-500' : ''}
      />
      {#if formErrors.period_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.period_order}</p>
      {/if}
    </div>

    <div class="flex items-center">
      <input
        id="is_active"
        type="checkbox"
        bind:checked={formData.is_active}
        class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <label for="is_active" class="ml-2 block text-sm text-gray-900">
        Активен
      </label>
    </div>
  </form>

  <svelte:fragment slot="footer">
    <Button variant="outline" on:click={handleCloseModal}>
      Отмена
    </Button>
    <Button type="submit" on:click={handleSubmit}>
      {isEditing ? 'Обновить' : 'Создать'}
    </Button>
  </svelte:fragment>
</Modal>

<!-- Filter Modal -->
<Modal
  bind:open={showFilterModal}
  title="Фильтры"
  on:close={handleCloseFilterModal}
>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Год
      </label>
      <select
        bind:value={filters.year}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={null}>Все годы</option>
        {#each Array.from({length: 11}, (_, i) => 2020 + i) as year}
          <option value={year}>{year}</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Месяц
      </label>
      <select
        bind:value={filters.month}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={null}>Все месяцы</option>
        {#each monthNames as month, index}
          <option value={index + 1}>{month}</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1">
        Статус
      </label>
      <select
        bind:value={filters.isActive}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={null}>Все статусы</option>
        <option value={true}>Активные</option>
        <option value={false}>Неактивные</option>
      </select>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button type="button" variant="outline" on:click={(e) => resetFilters(e)}>
      Сбросить
    </Button>
    <Button type="button" on:click={(e) => applyFilters(e)}>
      Применить
    </Button>
  </svelte:fragment>
</Modal>