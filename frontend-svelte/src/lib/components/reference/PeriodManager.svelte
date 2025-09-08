<script lang="ts">
  import { onMount } from 'svelte';
  // TODO: Replace with SimpleDataTable when needed
  // import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser, isAdmin } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { periodsService, type CreatePeriodData, type UpdatePeriodData } from '$lib/services/periods.service';
  import type { Period, AdminPeriod } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let periods: Period[] = [];
  let adminPeriods: AdminPeriod[] = [];
  let loading = true;
  let showModal = false;
  let editingPeriod: Period | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    period_name: '',
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    period_order: 1,
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  const monthNames = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  // Define table columns for CRUDTable
  $: columns = [
    {
      key: 'period_name',
      header: 'Название периода',
      sortable: true
    },
    {
      key: 'period_year',
      header: 'Год',
      sortable: true
    },
    {
      key: 'period_month',
      header: 'Месяц',
      sortable: true,
      render: (item: Period | AdminPeriod) => monthNames[item.period_month - 1] || '-'
    },
    {
      key: 'period_order',
      header: 'Порядок',
      sortable: true
    },
    ...($isAdmin ? [
      {
        key: 'user_name',
        header: 'Пользователь',
        sortable: true,
        render: (item: AdminPeriod) => {
          const tooltip = [
            item.user_email && `Email: ${item.user_email}`,
            item.username && `Username: ${item.username}`,
            item.telegram_id && `Telegram ID: ${item.telegram_id}`
          ].filter(Boolean).join('\n');
          
          return `<span title="${tooltip}">${item.user_name}</span>`;
        }
      }
    ] : []),
    {
      key: 'is_active',
      header: 'Статус',
      render: (item: Period | AdminPeriod) => item.is_active ? 'Активен' : 'Неактивен'
    },
    {
      key: 'created_at',
      header: 'Создан',
      sortable: true,
      render: (item: Period | AdminPeriod) => {
        if (!item.created_at) return '-';
        return new Date(item.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    }
  ];

  // Load periods
  async function fetchPeriods() {
    if (!$currentUser?.user_id) return;
    
    try {
      loading = true;
      if ($isAdmin) {
        adminPeriods = await periodsService.getAllWithUsers();
        periods = adminPeriods; // For compatibility with existing logic
      } else {
        periods = await periodsService.getByUserId($currentUser.user_id);
      }
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
    formData = {
      period_name: '',
      period_year: new Date().getFullYear(),
      period_month: new Date().getMonth() + 1,
      period_order: Math.max(...periods.map(p => p.period_order), 0) + 1,
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    
    // Check if admin can edit this period
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут редактировать только свои периоды');
      return;
    }
    
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
    const { id, item } = event.detail;
    
    // Check if admin can delete this period
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут удалять только свои периоды');
      return;
    }
    
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
    
    // For admins, filter out periods that don't belong to them
    let allowedIds = ids;
    if ($isAdmin) {
      const currentPeriods = $isAdmin ? adminPeriods : periods;
      allowedIds = ids.filter(id => {
        const period = currentPeriods.find(p => p.id === id);
        return period && period.user_id === $currentUser?.user_id;
      });
      
      if (allowedIds.length === 0) {
        toast.error('Ошибка', 'Администраторы могут удалять только свои периоды');
        return;
      }
      
      if (allowedIds.length < ids.length) {
        toast.warning('Внимание', `Будут удалены только ваши периоды (${allowedIds.length} из ${ids.length})`);
      }
    }
    
    try {
      await periodsService.bulkDelete(allowedIds);
      await fetchPeriods();
      toast.success('Успешно', `Удалено периодов: ${allowedIds.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить периоды');
    }
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
      const dataToExport = $isAdmin ? adminPeriods : periods;
      const csvContent = await periodsService.exportToCsv(dataToExport, $isAdmin);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const filename = $isAdmin ? 'admin_periods' : 'periods';
      link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Успешно', 'Данные экспортированы');
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
      
      // Import each period
      for (const periodData of importData) {
        await periodsService.create(periodData);
      }
      
      await fetchPeriods();
      toast.success('Успешно', `Импортировано периодов: ${importData.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось импортировать данные');
    }
  }

  function handleCloseModal() {
    showModal = false;
    formErrors = {};
  }
</script>

<CRUDTable
  title={$isAdmin ? "Управление периодами (Администратор)" : "Управление периодами"}
  data={periods}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={!$isAdmin}
  addButtonText="Добавить период"
  emptyMessage="Нет добавленных периодов. Нажмите 'Добавить период' для создания нового."
  on:add={handleAdd}
  on:edit={handleEdit}
  on:delete={handleDelete}
  on:bulkDelete={handleBulkDelete}
  on:export={handleExport}
  on:import={handleImport}
/>

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
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {#each monthNames as month, index}
            <option value={index + 1}>{month}</option>
          {/each}
        </select>
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