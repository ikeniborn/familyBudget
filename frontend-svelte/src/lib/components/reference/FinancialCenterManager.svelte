<script lang="ts">
  import { onMount } from 'svelte';
  // TODO: Replace with SimpleDataTable when needed
  // import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { financialCentersService, type CreateFinancialCenterData, type UpdateFinancialCenterData } from '$lib/services/financialCenters.service';
  import type { FinancialCenter } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let financialCenters: FinancialCenter[] = [];
  let loading = true;
  let showModal = false;
  let editingFinancialCenter: FinancialCenter | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    financial_center_name: '',
    financial_center_order: 1,
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  // Define table columns for CRUDTable
  const columns = [
    {
      key: 'financial_center_name',
      header: 'Название ЦФО',
      sortable: true
    },
    {
      key: 'financial_center_order',
      header: 'Порядок',
      sortable: true
    },
    {
      key: 'is_active',
      header: 'Статус',
      render: (item: FinancialCenter) => item.is_active ? 'Активен' : 'Неактивен'
    },
    {
      key: 'created_at',
      header: 'Дата создания',
      sortable: true,
      render: (item: FinancialCenter) => {
        if (!item.created_at) return '-';
        return new Date(item.created_at).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
  ];

  // Load financial centers
  async function fetchFinancialCenters() {
    if (!$currentUser?.user_id) return;
    
    try {
      loading = true;
      financialCenters = await financialCentersService.getByUserId($currentUser.user_id);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить финансовые центры');
      console.error('Error fetching financial centers:', error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchFinancialCenters();
  });

  // Form validation
  function validateForm(): boolean {
    formErrors = {};

    if (!formData.financial_center_name || formData.financial_center_name.trim().length < 3) {
      formErrors.financial_center_name = 'Название должно содержать минимум 3 символа';
    }

    if (formData.financial_center_name && formData.financial_center_name.trim().length > 100) {
      formErrors.financial_center_name = 'Название не должно превышать 100 символов';
    }

    if (formData.financial_center_order < 1) {
      formErrors.financial_center_order = 'Порядок должен быть больше 0';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingFinancialCenter = null;
    formData = {
      financial_center_name: '',
      financial_center_order: Math.max(...financialCenters.map(fc => fc.financial_center_order), 0) + 1,
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    isEditing = true;
    editingFinancialCenter = item;
    formData = {
      financial_center_name: item.financial_center_name,
      financial_center_order: item.financial_center_order,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id } = event.detail;
    
    try {
      await financialCentersService.delete(id);
      await fetchFinancialCenters();
      toast.success('Успешно', 'Финансовый центр удален');
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить финансовый центр');
    }
  }

  // Handle bulk delete
  async function handleBulkDelete(event: CustomEvent) {
    const { ids } = event.detail;
    
    try {
      await financialCentersService.bulkDelete(ids);
      await fetchFinancialCenters();
      toast.success('Успешно', `Удалено финансовых центров: ${ids.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить финансовые центры');
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
      if (isEditing && editingFinancialCenter) {
        const updateData: UpdateFinancialCenterData = { ...formData };
        await financialCentersService.update(editingFinancialCenter.financial_center_id, updateData);
        toast.success('Успешно', 'Финансовый центр обновлен');
      } else {
        const createData: CreateFinancialCenterData = {
          ...formData,
          user_id: $currentUser.user_id
        };
        await financialCentersService.create(createData);
        toast.success('Успешно', 'Финансовый центр создан');
      }
      
      await fetchFinancialCenters();
      showModal = false;
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось сохранить финансовый центр');
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const csvContent = await financialCentersService.exportToCsv(financialCenters);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial_centers_${new Date().toISOString().split('T')[0]}.csv`;
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
      const importData = await financialCentersService.importFromCsv(text, $currentUser.user_id);
      
      // Import each financial center
      for (const fcData of importData) {
        await financialCentersService.create(fcData);
      }
      
      await fetchFinancialCenters();
      toast.success('Успешно', `Импортировано финансовых центров: ${importData.length}`);
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
  title="Центры финансовой ответственности (ЦФО)"
  data={financialCenters}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={true}
  addButtonText="Добавить ЦФО"
  emptyMessage="Нет добавленных финансовых центров. Нажмите 'Добавить ЦФО' для создания нового."
  on:add={handleAdd}
  on:edit={handleEdit}
  on:delete={handleDelete}
  on:bulkDelete={handleBulkDelete}
  on:export={handleExport}
  on:import={handleImport}
/>

<Modal 
  bind:open={showModal}
  title={isEditing ? 'Редактировать ЦФО' : 'Добавить ЦФО'}
  on:close={handleCloseModal}
>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="financial_center_name" class="block text-sm font-medium text-gray-700 mb-1">
        Название ЦФО *
      </label>
      <Input
        id="financial_center_name"
        bind:value={formData.financial_center_name}
        placeholder="Введите название финансового центра"
        maxlength="100"
        class={formErrors.financial_center_name ? 'border-red-500' : ''}
      />
      {#if formErrors.financial_center_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.financial_center_name}</p>
      {/if}
    </div>

    <div>
      <label for="financial_center_order" class="block text-sm font-medium text-gray-700 mb-1">
        Порядок *
      </label>
      <Input
        id="financial_center_order"
        type="number"
        min="1"
        bind:value={formData.financial_center_order}
        class={formErrors.financial_center_order ? 'border-red-500' : ''}
      />
      {#if formErrors.financial_center_order}
        <p class="text-red-500 text-xs mt-1">{formErrors.financial_center_order}</p>
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