<script lang="ts">
  import { onMount } from 'svelte';
  import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { nomenclaturesService, type CreateNomenclatureData, type UpdateNomenclatureData } from '$lib/services/nomenclatures.service';
  import type { Nomenclature } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let nomenclatures: Nomenclature[] = [];
  let loading = true;
  let showModal = false;
  let editingNomenclature: Nomenclature | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    nomenclature_name: '',
    bill_name: '',
    account_name: '',
    operation_name: '',
    is_fact: false,
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  // Column helper
  const columnHelper = createColumnHelper<Nomenclature>();

  // Define table columns
  const columns: ColumnDef<Nomenclature>[] = [
    columnHelper.accessor('nomenclature_name', {
      header: 'Номенклатура',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('bill_name', {
      header: 'Статья бюджета',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('account_name', {
      header: 'Название счета',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('operation_name', {
      header: 'Название операции',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('is_fact', {
      header: 'Факт',
      cell: (info) => {
        const isFact = info.getValue();
        return isFact 
          ? { component: Badge, props: { variant: 'default', text: 'Да' }}
          : { component: Badge, props: { variant: 'secondary', text: 'Нет' }};
      },
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

  // Load nomenclatures
  async function fetchNomenclatures() {
    if (!$currentUser?.user_id) return;
    
    try {
      loading = true;
      nomenclatures = await nomenclaturesService.getByUserId($currentUser.user_id);
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить номенклатуры');
      console.error('Error fetching nomenclatures:', error);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchNomenclatures();
  });

  // Form validation
  function validateForm(): boolean {
    formErrors = {};

    if (!formData.nomenclature_name || formData.nomenclature_name.trim().length < 3) {
      formErrors.nomenclature_name = 'Название номенклатуры должно содержать минимум 3 символа';
    }

    if (!formData.bill_name || formData.bill_name.trim().length < 3) {
      formErrors.bill_name = 'Статья бюджета должна содержать минимум 3 символа';
    }

    if (!formData.account_name || formData.account_name.trim().length < 3) {
      formErrors.account_name = 'Название счета должно содержать минимум 3 символа';
    }

    if (!formData.operation_name || formData.operation_name.trim().length < 3) {
      formErrors.operation_name = 'Название операции должно содержать минимум 3 символа';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingNomenclature = null;
    formData = {
      nomenclature_name: '',
      bill_name: '',
      account_name: '',
      operation_name: '',
      is_fact: false,
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    isEditing = true;
    editingNomenclature = item;
    formData = {
      nomenclature_name: item.nomenclature_name,
      bill_name: item.bill_name,
      account_name: item.account_name,
      operation_name: item.operation_name,
      is_fact: item.is_fact,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id } = event.detail;
    
    try {
      await nomenclaturesService.delete(id);
      await fetchNomenclatures();
      toast.success('Успешно', 'Номенклатура удалена');
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить номенклатуру');
    }
  }

  // Handle bulk delete
  async function handleBulkDelete(event: CustomEvent) {
    const { ids } = event.detail;
    
    try {
      await nomenclaturesService.bulkDelete(ids);
      await fetchNomenclatures();
      toast.success('Успешно', `Удалено номенклатур: ${ids.length}`);
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось удалить номенклатуры');
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
      if (isEditing && editingNomenclature) {
        const updateData: UpdateNomenclatureData = { ...formData };
        await nomenclaturesService.update(editingNomenclature.nomenclature_id, updateData);
        toast.success('Успешно', 'Номенклатура обновлена');
      } else {
        const createData: CreateNomenclatureData = {
          ...formData,
          user_id: $currentUser.user_id
        };
        await nomenclaturesService.create(createData);
        toast.success('Успешно', 'Номенклатура создана');
      }
      
      await fetchNomenclatures();
      showModal = false;
    } catch (error: any) {
      toast.error('Ошибка', error.message || 'Не удалось сохранить номенклатуру');
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const csvContent = await nomenclaturesService.exportToCsv(nomenclatures);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `nomenclatures_${new Date().toISOString().split('T')[0]}.csv`;
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
      const importData = await nomenclaturesService.importFromCsv(text, $currentUser.user_id);
      
      // Import each nomenclature
      for (const nData of importData) {
        await nomenclaturesService.create(nData);
      }
      
      await fetchNomenclatures();
      toast.success('Успешно', `Импортировано номенклатур: ${importData.length}`);
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
  title="Номенклатуры"
  data={nomenclatures}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={true}
  addButtonText="Добавить номенклатуру"
  emptyMessage="Нет добавленных номенклатур. Нажмите 'Добавить номенклатуру' для создания новой."
  on:add={handleAdd}
  on:edit={handleEdit}
  on:delete={handleDelete}
  on:bulkDelete={handleBulkDelete}
  on:export={handleExport}
  on:import={handleImport}
/>

<Modal 
  bind:open={showModal}
  title={isEditing ? 'Редактировать номенклатуру' : 'Добавить номенклатуру'}
  on:close={handleCloseModal}
>
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <div>
      <label for="nomenclature_name" class="block text-sm font-medium text-gray-700 mb-1">
        Номенклатура *
      </label>
      <Input
        id="nomenclature_name"
        bind:value={formData.nomenclature_name}
        placeholder="Введите название номенклатуры"
        class={formErrors.nomenclature_name ? 'border-red-500' : ''}
      />
      {#if formErrors.nomenclature_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.nomenclature_name}</p>
      {/if}
    </div>

    <div>
      <label for="bill_name" class="block text-sm font-medium text-gray-700 mb-1">
        Статья бюджета *
      </label>
      <Input
        id="bill_name"
        bind:value={formData.bill_name}
        placeholder="Введите статью бюджета"
        class={formErrors.bill_name ? 'border-red-500' : ''}
      />
      {#if formErrors.bill_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.bill_name}</p>
      {/if}
    </div>

    <div>
      <label for="account_name" class="block text-sm font-medium text-gray-700 mb-1">
        Название счета *
      </label>
      <Input
        id="account_name"
        bind:value={formData.account_name}
        placeholder="Введите название счета"
        class={formErrors.account_name ? 'border-red-500' : ''}
      />
      {#if formErrors.account_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.account_name}</p>
      {/if}
    </div>

    <div>
      <label for="operation_name" class="block text-sm font-medium text-gray-700 mb-1">
        Название операции *
      </label>
      <Input
        id="operation_name"
        bind:value={formData.operation_name}
        placeholder="Введите название операции"
        class={formErrors.operation_name ? 'border-red-500' : ''}
      />
      {#if formErrors.operation_name}
        <p class="text-red-500 text-xs mt-1">{formErrors.operation_name}</p>
      {/if}
    </div>

    <div class="flex items-center space-x-4">
      <div class="flex items-center">
        <input
          id="is_fact"
          type="checkbox"
          bind:checked={formData.is_fact}
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="is_fact" class="ml-2 block text-sm text-gray-900">
          Это факт
        </label>
      </div>

      <div class="flex items-center">
        <input
          id="is_active"
          type="checkbox"
          bind:checked={formData.is_active}
          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label for="is_active" class="ml-2 block text-sm text-gray-900">
          Активна
        </label>
      </div>
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