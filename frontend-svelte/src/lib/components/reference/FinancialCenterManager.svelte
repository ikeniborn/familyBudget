<script lang="ts">
  import { onMount } from 'svelte';
  // TODO: Replace with SimpleDataTable when needed
  // import { createColumnHelper, type ColumnDef } from '@tanstack/svelte-table';
  import { currentUser, isAdmin, isAuthLoading, isAuthenticated } from '$lib/stores/auth.store';
  import { useToast } from '$lib/stores/toast.store';
  import { financialCentersService, type CreateFinancialCenterData, type UpdateFinancialCenterData } from '$lib/services/financialCenters.service';
  import type { FinancialCenter, AdminFinancialCenter } from '$types';
  
  import CRUDTable from '$lib/components/common/CRUDTable.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let financialCenters: FinancialCenter[] = [];
  let adminFinancialCenters: AdminFinancialCenter[] = [];
  let loading = true;
  let showModal = false;
  let editingFinancialCenter: FinancialCenter | null = null;
  let isEditing = false;

  // Form state
  let formData = {
    financial_center_name: '',
    is_active: true
  };

  let formErrors: Record<string, string> = {};

  const toast = useToast();

  // Define table columns for CRUDTable
  $: columns = [
    {
      key: 'financial_center_name',
      header: 'Название ЦФО',
      sortable: true
    },
    ...($isAdmin ? [
      {
        key: 'user_name',
        header: 'Пользователь',
        sortable: true,
        render: (item: AdminFinancialCenter) => {
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
      render: (item: FinancialCenter | AdminFinancialCenter) => item.is_active ? 'Активен' : 'Неактивен'
    },
    {
      key: 'created_at',
      header: 'Дата создания',
      sortable: true,
      render: (item: FinancialCenter | AdminFinancialCenter) => {
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
    console.log('🚀 fetchFinancialCenters called. Current user:', $currentUser);
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
        console.log('👑 Fetching admin financial centers...');
        adminFinancialCenters = await financialCentersService.getAllWithUsers();
        console.log(`✅ Admin view: loaded ${adminFinancialCenters.length} financial centers with user information`);
        console.log('📊 Admin financial centers data:', adminFinancialCenters);
        
        // Clear regular financial centers for admin view
        financialCenters = [];
      } else {
        console.log('👤 Fetching user financial centers...');
        financialCenters = await financialCentersService.getByUserId($currentUser.user_id);
        console.log(`✅ User view: loaded ${financialCenters.length} financial centers`);
        
        // Clear admin financial centers for user view
        adminFinancialCenters = [];
      }
    } catch (error: any) {
      toast.error('Ошибка', 'Не удалось загрузить финансовые центры');
      console.error('❌ Error fetching financial centers:', error);
      console.error('Stack trace:', error.stack);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    // Wait for auth to be fully loaded before fetching financial centers
    console.log('🔧 FinancialCenterManager mounted. Auth loading state:', $isAuthLoading);
    console.log('🔧 Current auth state - user:', $currentUser, 'isAuthenticated:', $isAuthenticated);
    
    if (!$isAuthLoading) {
      // Auth is already loaded
      fetchFinancialCenters();
    } else {
      // Wait for auth to load
      console.log('⏳ Waiting for auth to complete...');
      const unsubscribe = isAuthLoading.subscribe((loading) => {
        if (!loading && $isAuthenticated) {
          console.log('✅ Auth loading completed, fetching financial centers');
          fetchFinancialCenters();
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

    if (!formData.financial_center_name || formData.financial_center_name.trim().length < 3) {
      formErrors.financial_center_name = 'Название должно содержать минимум 3 символа';
    }

    if (formData.financial_center_name && formData.financial_center_name.trim().length > 100) {
      formErrors.financial_center_name = 'Название не должно превышать 100 символов';
    }

    // Check for duplicate name
    const duplicate = financialCenters.find(
      fc => fc.financial_center_name.toLowerCase() === formData.financial_center_name.trim().toLowerCase() &&
            fc.financial_center_id !== editingFinancialCenter?.financial_center_id
    );
    
    if (duplicate) {
      formErrors.financial_center_name = 'ЦФО с таким названием уже существует';
    }

    return Object.keys(formErrors).length === 0;
  }

  // Handle add
  function handleAdd() {
    isEditing = false;
    editingFinancialCenter = null;
    formData = {
      financial_center_name: '',
      is_active: true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle edit
  function handleEdit(event: CustomEvent) {
    const { item } = event.detail;
    
    // Check if admin can edit this financial center
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут редактировать только свои финансовые центры');
      return;
    }
    
    isEditing = true;
    editingFinancialCenter = item;
    formData = {
      financial_center_name: item.financial_center_name,
      is_active: item.is_active ?? true
    };
    formErrors = {};
    showModal = true;
  }

  // Handle delete
  async function handleDelete(event: CustomEvent) {
    const { id, item } = event.detail;
    
    // Check if admin can delete this financial center
    if ($isAdmin && item.user_id !== $currentUser?.user_id) {
      toast.error('Ошибка', 'Администраторы могут удалять только свои финансовые центры');
      return;
    }
    
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
    
    // For admins, filter out financial centers that don't belong to them
    let allowedIds = ids;
    if ($isAdmin) {
      const currentFinancialCenters = $isAdmin ? adminFinancialCenters : financialCenters;
      allowedIds = ids.filter(id => {
        const fc = currentFinancialCenters.find(f => f.id === id);
        return fc && fc.user_id === $currentUser?.user_id;
      });
      
      if (allowedIds.length === 0) {
        toast.error('Ошибка', 'Администраторы могут удалять только свои финансовые центры');
        return;
      }
      
      if (allowedIds.length < ids.length) {
        toast.warning('Внимание', `Будут удалены только ваши финансовые центры (${allowedIds.length} из ${ids.length})`);
      }
    }
    
    try {
      await financialCentersService.bulkDelete(allowedIds);
      await fetchFinancialCenters();
      toast.success('Успешно', `Удалено финансовых центров: ${allowedIds.length}`);
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
      // Handle unique constraint violation
      if (error.message?.includes('уже существует')) {
        formErrors.financial_center_name = 'ЦФО с таким названием уже существует';
      } else {
        toast.error('Ошибка', error.message || 'Не удалось сохранить финансовый центр');
      }
    }
  }

  // Handle export
  async function handleExport() {
    try {
      const dataToExport = $isAdmin ? adminFinancialCenters : financialCenters;
      const csvContent = await financialCentersService.exportToCsv(dataToExport, $isAdmin);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const filename = $isAdmin ? 'admin_financial_centers' : 'financial_centers';
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
  title={$isAdmin ? "Центры финансовой ответственности (ЦФО) - Администратор" : "Центры финансовой ответственности (ЦФО)"}
  data={$isAdmin ? adminFinancialCenters : financialCenters}
  {columns}
  {loading}
  searchable={true}
  exportable={true}
  importable={!$isAdmin}
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