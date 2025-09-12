<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Building2, BuildingIcon, Plus, Edit, Trash2, FileText } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  
  const toast = useToast();
  
  interface FinancialCenter {
    id: number;
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
  }

  interface FinancialCenterStats {
    total: number;
    active: number;
    inactive: number;
  }

  let financialCenters: FinancialCenter[] = [];
  let fcStats: FinancialCenterStats = {
    total: 0,
    active: 0,
    inactive: 0
  };
  let loading = true;
  let showAddModal = false;
  let selectedFC: FinancialCenter | null = null;
  let showDeleteModal = false;
  let fcToDelete: FinancialCenter | null = null;
  let deleting = false;
  let saving = false;

  // Form data
  let formData = {
    code: '',
    name: '',
    description: '',
    is_active: true
  };

  onMount(() => {
    loadFinancialCenters();
  });

  async function loadFinancialCenters() {
    try {
      loading = true;
      const response = await api.get('/financial_centers') as any;
      if (response.success) {
        financialCenters = response.data || [];
        loadFCStats();
      } else {
        throw new Error(response.error || 'Не удалось загрузить финансовые центры');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при загрузке финансовых центров',
        error.message
      );
      financialCenters = [];
    } finally {
      loading = false;
    }
  }

  function loadFCStats() {
    // Вычисляем статистику на основе загруженных данных
    const total = financialCenters.length;
    const active = financialCenters.filter(fc => fc.is_active !== false).length;
    const inactive = total - active;
    
    fcStats = { total, active, inactive };
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  }

  function getStatusBadge(fc: FinancialCenter) {
    if (fc.is_active !== false) {
      return { class: 'bg-green-100 text-green-800', text: 'Активен' };
    } else {
      return { class: 'bg-gray-100 text-gray-800', text: 'Неактивен' };
    }
  }

  function handleAddFC() {
    selectedFC = null;
    formData = {
      code: '',
      name: '',
      description: '',
      is_active: true
    };
    showAddModal = true;
  }

  function handleEditFC(fc: FinancialCenter) {
    selectedFC = fc;
    formData = {
      code: fc.code || '',
      name: fc.name || '',
      description: fc.description || '',
      is_active: fc.is_active !== false
    };
    showAddModal = true;
  }

  function handleCloseModal() {
    showAddModal = false;
    selectedFC = null;
    formData = {
      code: '',
      name: '',
      description: '',
      is_active: true
    };
  }

  async function handleSubmitFC() {
    if (!formData.name) {
      toast.error('Заполните обязательные поля', 'Название обязательно');
      return;
    }

    try {
      saving = true;
      
      const requestData = {
        financial_center_name: formData.name,
        is_active: formData.is_active,
        user_id: 1 // Will be set by backend from current user
      };

      let response;
      if (selectedFC) {
        // Update existing financial center
        response = await api.put(`/financial_centers/${selectedFC.id}`, {
          financial_center_name: formData.name,
          is_active: formData.is_active
        });
      } else {
        // Create new financial center
        response = await api.post('/financial_centers', requestData);
      }

      if ((response as any).success) {
        toast.success(
          selectedFC ? 'ЦФО успешно обновлен' : 'ЦФО успешно создан'
        );
        handleCloseModal();
        await loadFinancialCenters();
      } else {
        throw new Error((response as any).error || 'Ошибка при сохранении ЦФО');
      }
    } catch (error: any) {
      toast.error(
        `Ошибка при ${selectedFC ? 'обновлении' : 'создании'} ЦФО`,
        error.message
      );
    } finally {
      saving = false;
    }
  }

  function handleDeleteFC(fc: FinancialCenter) {
    fcToDelete = fc;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!fcToDelete) return;
    
    try {
      deleting = true;
      const response = await api.delete(`/financial_centers/${fcToDelete.id}`) as any;
      if (response.success || response.message) {
        toast.success('Финансовый центр успешно удален');
        
        showDeleteModal = false;
        fcToDelete = null;
        await loadFinancialCenters();
      } else {
        throw new Error(response.error || 'Не удалось удалить финансовый центр');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при удалении финансового центра',
        error.message
      );
    } finally {
      deleting = false;
    }
  }

  function handleCloseDeleteModal() {
    showDeleteModal = false;
    fcToDelete = null;
  }
</script>

<svelte:head>
  <title>Управление ЦФО - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Building2 class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Управление ЦФО</h1>
        <p class="text-slate-600">Центры финансовой ответственности</p>
      </div>
    </div>
    <Button on:click={handleAddFC}>
      <Plus class="h-4 w-4 mr-2" />
      Добавить ЦФО
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{fcStats.total}</p>
            <p class="text-sm text-gray-600">Всего ЦФО</p>
          </div>
          <Building2 class="h-8 w-8 text-gray-400" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{fcStats.active}</p>
            <p class="text-sm text-gray-600">Активных</p>
          </div>
          <BuildingIcon class="h-8 w-8 text-green-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{fcStats.inactive}</p>
            <p class="text-sm text-gray-600">Неактивных</p>
          </div>
          <BuildingIcon class="h-8 w-8 text-gray-500" />
        </div>
      </div>
    </Card>
  </div>

  <!-- Financial Centers Table -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Список финансовых центров</h2>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left py-3 px-4">Код</th>
              <th class="text-left py-3 px-4">Название</th>
              <th class="text-left py-3 px-4">Описание</th>
              <th class="text-left py-3 px-4">Статус</th>
              <th class="text-left py-3 px-4">Создан</th>
              <th class="text-right py-3 px-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {#if loading}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Загрузка финансовых центров...
                </td>
              </tr>
            {:else if financialCenters.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Финансовые центры не найдены
                </td>
              </tr>
            {:else}
              {#each financialCenters as fc}
                {@const statusBadge = getStatusBadge(fc)}
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {fc.code}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="font-medium">{fc.name}</div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="text-sm text-gray-600 max-w-xs truncate">
                      {fc.description || 'Нет описания'}
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                      {statusBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {formatDate(fc.created_at)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" on:click={() => handleEditFC(fc)}>
                        <Edit class="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        class="text-red-600 hover:text-red-700 hover:bg-red-50"
                        on:click={() => handleDeleteFC(fc)}
                        title="Удалить финансовый центр"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </Card>

  <!-- Info Card -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
        <FileText class="h-5 w-5" />
        О финансовых центрах
      </h2>
      <div class="space-y-3 text-sm text-gray-600">
        <p>
          <strong>Центры финансовой ответственности (ЦФО)</strong> - это подразделения организации, 
          за которые ответственные лица несут ответственность за финансовые результаты.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1">Примеры ЦФО:</h4>
            <ul class="text-sm space-y-1">
              <li>• Отдел продаж</li>
              <li>• Производство</li>
              <li>• Маркетинг</li>
              <li>• IT-отдел</li>
            </ul>
          </div>
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1">Использование:</h4>
            <ul class="text-sm space-y-1">
              <li>• Группировка доходов и расходов</li>
              <li>• Анализ эффективности подразделений</li>
              <li>• Планирование бюджета по центрам</li>
              <li>• Отчетность по ответственности</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Card>
</div>

<!-- Add/Edit Financial Center Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <form on:submit|preventDefault={handleSubmitFC}>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {selectedFC ? 'Изменить ЦФО' : 'Добавить ЦФО'}
          </h3>
          
          <div class="space-y-4">
            <!-- Code -->
            <div>
              <label for="fc-code" class="block text-sm font-medium text-gray-700 mb-1">
                Код ЦФО
              </label>
              <input
                id="fc-code"
                type="text"
                bind:value={formData.code}
                placeholder="Например: СБ, МА, ИТ"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Name -->
            <div>
              <label for="fc-name" class="block text-sm font-medium text-gray-700 mb-1">
                Название ЦФО *
              </label>
              <input
                id="fc-name"
                type="text"
                bind:value={formData.name}
                placeholder="Например: Отдел продаж"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Description -->
            <div>
              <label for="fc-description" class="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                id="fc-description"
                bind:value={formData.description}
                placeholder="Описание центра финансовой ответственности"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <!-- Active Status -->
            <div class="flex items-center">
              <input
                id="fc-active"
                type="checkbox"
                bind:checked={formData.is_active}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="fc-active" class="ml-2 block text-sm text-gray-900">
                Активен
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" on:click={handleCloseModal}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : selectedFC ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Подтвердите удаление</h3>
        <p class="text-gray-600 mb-4">
          Вы действительно хотите удалить финансовый центр "{fcToDelete?.name}"?
          Это действие нельзя отменить.
        </p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" on:click={handleCloseDeleteModal}>
            Отмена
          </Button>
          <Button 
            variant="destructive" 
            on:click={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Удаление...' : 'Удалить'}
          </Button>
        </div>
      </div>
    </Card>
  </div>
{/if}