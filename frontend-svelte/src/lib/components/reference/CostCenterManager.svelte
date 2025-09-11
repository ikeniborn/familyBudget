<script lang="ts">
  import { onMount } from 'svelte';
  // TODO: Replace with SimpleDataTable when needed
  // import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser, isAdmin, isAuthLoading, isAuthenticated } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { costCentersService, type CreateCostCenterData, type UpdateCostCenterData } from '$lib/services/costCenters.service';
  import type { CostCenter, AdminCostCenter } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';

  let costCenters: CostCenter[] = [];
  let adminCostCenters: AdminCostCenter[] = [];
  let loading = true;
  let showModal = false;
  let editingCostCenter: CostCenter | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    cost_center_name: '',
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  // Define table columns for CRUDTable
  $: columns = [
    {
      key: 'cost_center_name',
      header: 'Название МВЗ',
      sortable: true
    },
    ...($isAdmin ? [
      {
        key: 'user_name',
        header: 'Пользователь',
        sortable: true,
        render: (item: AdminCostCenter) => {
          console.log('🔍 Rendering user cell for item:', item);
          
          // Check if user_name exists in the item
          const userName = item.user_name || 'Неизвестный пользователь';
          const userEmail = item.user_email || '';
          const username = item.username || '';
          const telegramId = item.telegram_id || '';
          
          // Build tooltip information
          const tooltipParts = [];
          if (userEmail) tooltipParts.push(`Email: ${userEmail}`);
          if (username) tooltipParts.push(`Username: ${username}`);
          if (telegramId) tooltipParts.push(`Telegram ID: ${telegramId}`);
          
          const tooltip = tooltipParts.join('\n');
          
          // Return the rendered HTML
          if (tooltip) {
            return `<span title="${tooltip}" class="cursor-help">${userName}</span>`;
          } else {
            return `<span>${userName}</span>`;
          }
        }
      }
    ] : []),
    {
      key: 'is_active',
      header: 'Статус',
      render: (item: CostCenter | AdminCostCenter) => item.is_active ? 'Активен' : 'Неактивен'
    },
    {
      key: 'created_at',
      header: 'Дата создания',
      sortable: true,
      render: (item: CostCenter | AdminCostCenter) => {
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

  // Load cost centers
  async function fetchCostCenters() {
    console.log('🚀 fetchCostCenters called. Current user:', $currentUser);
    console.log('🔐 Is admin?', $isAdmin);
    console.log('🔑 User role:', $currentUser?.role);
    console.log('📝 Full user object:', JSON.stringify($currentUser, null, 2));
    
    // Additional debugging for isAdmin derivation
    console.log('🔍 Auth store $auth.user?.role:', $currentUser?.role);
    console.log('🔍 Auth store comparison result:', $currentUser?.role === 'admin');
    console.log('🔍 isAdmin derived value:', $isAdmin);
    
    if (!$currentUser?.user_id) {
      console.warn('⚠️ No user_id found, skipping fetch');
      return;
    }
    
    try {
      loading = true;
      if ($isAdmin) {
        console.log('👑 Fetching admin cost centers...');
        adminCostCenters = await costCentersService.getAllWithUsers();
        console.log(`✅ Admin view: loaded ${adminCostCenters.length} cost centers with user information`);
        console.log('📊 Admin cost centers data:', adminCostCenters);
        
        // Clear regular cost centers for admin view
        costCenters = [];
      } else {
        console.log('👤 Fetching user cost centers...');
        costCenters = await costCentersService.getByUserId($currentUser.user_id);
        console.log(`✅ User view: loaded ${costCenters.length} cost centers`);
        
        // Clear admin cost centers for user view
        adminCostCenters = [];
      }
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить места возникновения затрат');
      console.error('❌ Error fetching cost centers:', error);
      console.error('Stack trace:', error.stack);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Wait for auth to be fully loaded before fetching cost centers
    console.log('🔧 CostCenterManager mounted. Auth loading state:', $isAuthLoading);
    console.log('🔧 Current auth state - user:', $currentUser, 'isAuthenticated:', $isAuthenticated);
    
    if (!$isAuthLoading) {
      // Auth is already loaded
      fetchCostCenters();
    } else {
      // Wait for auth to load
      console.log('⏳ Waiting for auth to complete...');
      const unsubscribe = isAuthLoading.subscribe((loading) => {
        if (!loading && $isAuthenticated) {
          console.log('✅ Auth loading completed, fetching cost centers');
          fetchCostCenters();
          unsubscribe();
        } else if (!loading && !$isAuthenticated) {
          console.log('❌ Auth loading completed but user not authenticated');
          unsubscribe();
        }
      });
    }
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

    // Check for duplicate name
    const duplicate = costCenters.find(
      cc => cc.cost_center_name.toLowerCase() === formData.cost_center_name.trim().toLowerCase() &&
            cc.cost_center_id !== editingCostCenter?.cost_center_id
    );
    
    if (duplicate) {
      formErrors.cost_center_name = 'МВЗ с таким названием уже существует';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingCostCenter = null;
    formData = {
      cost_center_name: '',
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    
    // Check if admin can edit this cost center
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут редактировать только свои места возникновения затрат');
      return;
    }
    
    isEditing = true;
    editingCostCenter = item;
    formData = {
      cost_center_name: item.cost_center_name,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id, item } = event.detail;
    
    // Check if admin can delete this cost center
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут удалять только свои места возникновения затрат');
      return;
    }
    
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
    
    // For admins, filter out cost centers that don't belong to them
    let allowedIds = ids;
    if ($isAdmin) {
      const currentCostCenters = $isAdmin ? adminCostCenters : costCenters;
      allowedIds = ids.filter((id: number) => {
        const cc = currentCostCenters.find(c => c.id === id);
        return cc && cc.user_id === $currentUser?.user_id;
      });
      
      if (allowedIds.length === 0) {
        toast.error('Ошибка', 'Администраторы могут удалять только свои места возникновения затрат');
        return;
      }
      
      if (allowedIds.length < ids.length) {
        toast.warning('Внимание', `Будут удалены только ваши места возникновения затрат (${allowedIds.length} из ${ids.length})`);
      }
    }
    
    try {
      await costCentersService.bulkDelete(allowedIds);
      await fetchCostCenters();
      toast.success('Успешно', `Удалено мест возникновения затрат: ${allowedIds.length}`);
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
      // Handle unique constraint violation
      if (error.message?.includes('уже существует')) {
        formErrors.cost_center_name = 'МВЗ с таким названием уже существует';
      } else {
        toast.error('Ошибка', error.message || 'Не удалось сохранить место возникновения затрат');
      }
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const dataToExport = $isAdmin ? adminCostCenters : costCenters;
      const csvContent = await costCentersService.exportToCsv(dataToExport, $isAdmin);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const filename = $isAdmin ? 'admin_cost_centers' : 'cost_centers';
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
  title={$isAdmin ? "Места возникновения затрат (МВЗ) - Администратор" : "Места возникновения затрат (МВЗ)"}
  data={$isAdmin ? adminCostCenters : costCenters}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={!$isAdmin}
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


    {#if isEditing}
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
    {/if}
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