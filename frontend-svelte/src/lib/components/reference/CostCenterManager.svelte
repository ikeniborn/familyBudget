<script lang="ts">
  import { onMount } from 'svelte';
  import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { costCentersService, type CreateCostCenterData, type UpdateCostCenterData } from '$lib/services/costCenters.service';
  import type { CostCenter } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let costCenters: CostCenter[] = [];
  let loading = true;
  let showModal = false;
  let editingCostCenter: CostCenter | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    cost_center_name: '',
    cost_center_order: 1,
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  // Column helper
  const columnHelper = createColumnHelper<CostCenter>();

  // Define table columns
  const columns: ColumnDef<CostCenter>[] = [
    columnHelper.accessor('cost_center_name', {
      header: 'Название МВЗ',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('cost_center_order', {
      header: 'Порядок',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('is_active', {
      header: 'Статус',
      cell: (info) => {
        const isActive = info.getValue();
        return isActive 
          ? { component: Badge, props: { variant: 'default', text: 'Активен' }}
          : { component: Badge, props: { variant: 'secondary', text: 'Неактивен' }};
      },
    }),
    columnHelper.accessor('created_at', {
      header: 'Дата создания',
      cell: (info) => {
        const date = info.getValue();
        if (!date) return '-';
        return new Date(date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    }),
  ];

  // Load cost centers
  async function fetchCostCenters() {
    if (!$currentUser?.user_id) return;
    
    try {
      loading = true;
      costCenters = await costCentersService.getByUserId($currentUser.user_id);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить места возникновения затрат');
      console.error('Error fetching cost centers:', error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchCostCenters();
  });

  // Form validation
  function validateForm(): boolean {
    formErrors = {};

    if (!formData.cost_center_name || formData.cost_center_name.trim().length < 3) {
      formErrors.cost_center_name = 'Название должно содержать минимум 3 символа';
    }

    if (formData.cost_center_name && formData.cost_center_name.trim().length > 100) {
      formErrors.cost_center_name = 'Название не должно превышать 100 символов';
    }

    if (formData.cost_center_order < 1) {
      formErrors.cost_center_order = 'Порядок должен быть больше 0';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingCostCenter = null;
    formData = {
      cost_center_name: '',
      cost_center_order: Math.max(...costCenters.map(cc => cc.cost_center_order), 0) + 1,
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    isEditing = true;
    editingCostCenter = item;
    formData = {
      cost_center_name: item.cost_center_name,
      cost_center_order: item.cost_center_order,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id } = event.detail;
    
    try {
      await costCentersService.delete(id);
      await fetchCostCenters();
      toast.success('Успешно', 'Место возникновения затрат удалено');
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить место возникновения затрат');
    }
  }

  // Handle bulk delete
  async function handleBulkDelete(event: CustomEvent) {
    const { ids } = event.detail;
    
    try {
      await costCentersService.bulkDelete(ids);
      await fetchCostCenters();
      toast.success('Успешно', `Удалено мест возникновения затрат: ${ids.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить места возникновения затрат');
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
      if (isEditing && editingCostCenter) {
        const updateData: UpdateCostCenterData = { ...formData };
        await costCentersService.update(editingCostCenter.cost_center_id, updateData);
        toast.success('Успешно', 'Место возникновения затрат обновлено');
      } else {
        const createData: CreateCostCenterData = {
          ...formData,
          user_id: $currentUser.user_id
        };
        await costCentersService.create(createData);
        toast.success('Успешно', 'Место возникновения затрат создано');
      }
      
      await fetchCostCenters();
      showModal = false;
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось сохранить место возникновения затрат');
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const csvContent = await costCentersService.exportToCsv(costCenters);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `cost_centers_${new Date().toISOString().split('T')[0]}.csv`;
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
      const importData = await costCentersService.importFromCsv(text, $currentUser.user_id);
      
      // Import each cost center
      for (const ccData of importData) {
        await costCentersService.create(ccData);
      }
      
      await fetchCostCenters();
      toast.success('Успешно', `Импортировано мест возникновения затрат: ${importData.length}`);
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
  title="Места возникновения затрат (МВЗ)"
  data={costCenters}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={true}
  addButtonText="Добавить МВЗ"
  emptyMessage="Нет добавленных мест возникновения затрат. Нажмите 'Добавить МВЗ' для создания нового."
  on:add={handleAdd}
  on:edit={handleEdit}
  on:delete={handleDelete}
  on:bulkDelete={handleBulkDelete}
  on:export={handleExport}
  on:import={handleImport}
/>

<Modal 
  bind:open={showModal}
  title={isEditing ? 'Редактировать МВЗ' : 'Добавить МВЗ'}
  on:close={handleCloseModal}
>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="cost_center_name" class="block text-sm font-medium text-gray-700 mb-1">
        Название МВЗ *
      </label>
      <Input
        id="cost_center_name"
        bind:value={formData.cost_center_name}
        placeholder="Введите название места возникновения затрат"
        maxlength="100"
        class={formErrors.cost_center_name ? 'border-red-500' : ''}
      />
      {#if formErrors.cost_center_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.cost_center_name}</p>
      {/if}
    </div>

    <div>
      <label for="cost_center_order" class="block text-sm font-medium text-gray-700 mb-1">
        Порядок *
      </label>
      <Input
        id="cost_center_order"
        type="number"
        min="1"
        bind:value={formData.cost_center_order}
        class={formErrors.cost_center_order ? 'border-red-500' : ''}
      />
      {#if formErrors.cost_center_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.cost_center_order}</p>
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