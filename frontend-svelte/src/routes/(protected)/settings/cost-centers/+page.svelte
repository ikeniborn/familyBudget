<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Briefcase, Plus, Edit, Trash2, FileText, Shield } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  import { isAdmin } from '$lib/stores/auth.store';
  import type { CostCenter } from '$lib/types';
  
  const toast = useToast();

  // Admin check - redirect non-admins
  let userIsAdmin = false;
  let adminCheckComplete = false;

  // Subscribe to admin status
  $: userIsAdmin = $isAdmin;

  // Check admin access on mount
  onMount(() => {
    // Wait a moment for auth state to settle
    setTimeout(() => {
      adminCheckComplete = true;
      if (!userIsAdmin) {
        goto('/access-denied');
        return;
      }
    }, 100);
  });

  // Don't render anything until admin check is complete
  $: if (adminCheckComplete && !userIsAdmin) {
    goto('/access-denied');
  }

  interface CostCenterStats {
    total: number;
    active: number;
    inactive: number;
  }

  let costCenters: CostCenter[] = [];
  let ccStats: CostCenterStats = {
    total: 0,
    active: 0,
    inactive: 0
  };
  let loading = true;
  let showAddModal = false;
  let selectedCC: CostCenter | null = null;
  let showDeleteModal = false;
  let ccToDelete: CostCenter | null = null;
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
    // Only load data if admin check passes
    if (adminCheckComplete && userIsAdmin) {
      loadCostCenters();
    }
  });

  // Load data when admin status is confirmed
  $: if (adminCheckComplete && userIsAdmin && costCenters.length === 0) {
    loadCostCenters();
  }

  async function loadCostCenters() {
    try {
      loading = true;
      const response = await api.get('/cost_centers/') as any;
      if (response.success) {
        costCenters = response.data || [];
        loadCCStats();
      } else {
        throw new Error(response.error || 'Не удалось загрузить центры затрат');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при загрузке центров затрат',
        error.message
      );
      costCenters = [];
    } finally {
      loading = false;
    }
  }

  function loadCCStats() {
    // Вычисляем статистику на основе загруженных данных
    const total = costCenters.length;
    const active = costCenters.filter(cc => cc.is_active !== false).length;
    const inactive = total - active;
    
    ccStats = { total, active, inactive };
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  }

  function getStatusBadge(cc: CostCenter) {
    if (cc.is_active !== false) {
      return { class: 'bg-green-100 text-green-800', text: 'Активен' };
    } else {
      return { class: 'bg-gray-100 text-gray-800', text: 'Неактивен' };
    }
  }


  function canEditCC(cc: CostCenter): boolean {
    // Users can edit all their own cost centers
    return true;
  }

  function handleAddCC() {
    selectedCC = null;
    formData = {
      code: '',
      name: '',
      description: '',
      is_active: true
    };
    showAddModal = true;
  }

  function handleEditCC(cc: CostCenter) {
    selectedCC = cc;
    formData = {
      code: cc.code || '',
      name: cc.name || '',
      description: cc.description || '',
      is_active: cc.is_active !== false
    };
    showAddModal = true;
  }

  function handleCloseModal() {
    showAddModal = false;
    selectedCC = null;
    formData = {
      code: '',
      name: '',
      description: '',
      is_active: true
    };
  }

  async function handleSubmitCC() {
    if (!formData.name) {
      toast.error('Заполните обязательные поля', 'Название обязательно');
      return;
    }

    if (!formData.code) {
      toast.error('Заполните обязательные поля', 'Код МВЗ обязателен');
      return;
    }

    try {
      saving = true;
      
      const requestData = {
        code: formData.code,
        name: formData.name,
        description: formData.description || null,
        is_active: formData.is_active
      };

      let response;
      if (selectedCC) {
        // Update existing cost center - include all fields
        response = await api.put(`/cost_centers/${selectedCC.id}/`, {
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          is_active: formData.is_active
        });
      } else {
        // Create new cost center
        response = await api.post('/cost_centers/', requestData);
      }

      if ((response as any).success) {
        toast.success(
          selectedCC ? 'МВЗ успешно обновлен' : 'МВЗ успешно создан'
        );
        handleCloseModal();
        await loadCostCenters();
      } else {
        throw new Error((response as any).error || 'Ошибка при сохранении МВЗ');
      }
    } catch (error: any) {
      // Улучшенная обработка ошибок от API
      let errorMessage = 'Неизвестная ошибка';

      if (error.response) {
        if (error.response.status === 422) {
          // Handle FastAPI validation errors
          const details = error.response.data?.details || error.response.data?.detail;
          if (Array.isArray(details)) {
            // Extract field errors from FastAPI validation detail array
            const fieldErrors = details.map((detail: any) => {
              const fieldName = detail.loc ? detail.loc[detail.loc.length - 1] : 'field';
              return `${fieldName}: ${detail.msg}`;
            }).join(', ');
            errorMessage = `Ошибка валидации: ${fieldErrors}`;
          } else if (typeof details === 'string') {
            errorMessage = `Ошибка валидации: ${details}`;
          } else {
            errorMessage = 'Ошибка валидации данных';
          }
        } else if (error.response.status === 409) {
          errorMessage = error.response.data?.error || error.response.data?.detail || 'МВЗ с таким кодом уже существует';
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = `Ошибка сервера: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = 'Сервер не отвечает';
      } else {
        errorMessage = error.message || 'Произошла ошибка';
      }

      toast.error(
        `Ошибка при ${selectedCC ? 'обновлении' : 'создании'} МВЗ`,
        errorMessage
      );
    } finally {
      saving = false;
    }
  }

  function handleDeleteCC(cc: CostCenter) {
    ccToDelete = cc;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!ccToDelete) return;
    
    try {
      deleting = true;
      const response = await api.delete(`/cost_centers/${ccToDelete.id}/`) as any;
      if (response.success || response.message) {
        toast.success('Центр затрат успешно удален');
        
        showDeleteModal = false;
        ccToDelete = null;
        await loadCostCenters();
      } else {
        throw new Error(response.error || 'Не удалось удалить центр затрат');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при удалении центра затрат',
        error.message
      );
    } finally {
      deleting = false;
    }
  }

  function handleCloseDeleteModal() {
    showDeleteModal = false;
    ccToDelete = null;
  }
</script>

<svelte:head>
  <title>Управление МВЗ - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Briefcase class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Управление МВЗ</h1>
        <p class="text-slate-600">Места возникновения затрат (только администраторы)</p>
        <div class="flex items-center gap-2 mt-1">
          <Shield class="h-4 w-4 text-amber-600" />
          <span class="text-sm text-amber-600 font-medium">Административный доступ</span>
        </div>
      </div>
    </div>
    <Button on:click={handleAddCC}>
      <Plus class="h-4 w-4 mr-2" />
      Добавить МВЗ
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{ccStats.total}</p>
            <p class="text-sm text-gray-600">Всего МВЗ</p>
          </div>
          <Briefcase class="h-8 w-8 text-gray-400" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{ccStats.active}</p>
            <p class="text-sm text-gray-600">Активных</p>
          </div>
          <Briefcase class="h-8 w-8 text-green-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{ccStats.inactive}</p>
            <p class="text-sm text-gray-600">Неактивных</p>
          </div>
          <Briefcase class="h-8 w-8 text-gray-500" />
        </div>
      </div>
    </Card>
  </div>

  <!-- Cost Centers Table -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Список центров затрат</h2>
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
            {#if !adminCheckComplete}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Проверка прав доступа...
                </td>
              </tr>
            {:else if loading}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Загрузка центров затрат...
                </td>
              </tr>
            {:else if costCenters.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Центры затрат не найдены
                </td>
              </tr>
            {:else}
              {#each costCenters as cc}
                {@const statusBadge = getStatusBadge(cc)}
                {@const canEdit = canEditCC(cc)}
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {cc.code}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="font-medium">{cc.name || cc.cost_center_name}</div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="text-sm text-gray-600 max-w-xs truncate">
                      {cc.description || cc.cost_center_description || 'Нет описания'}
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                      {statusBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {formatDate(cc.created_at)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      {#if canEdit}
                        <Button size="sm" variant="outline" on:click={() => handleEditCC(cc)}>
                          <Edit class="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          class="text-red-600 hover:text-red-700 hover:bg-red-50"
                          on:click={() => handleDeleteCC(cc)}
                          title="Удалить центр затрат"
                        >
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      {:else}
                        <span class="text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded">
                          Только для чтения
                        </span>
                      {/if}
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
        О местах возникновения затрат
      </h2>
      <div class="space-y-3 text-sm text-gray-600">
        <p>
          <strong>Места возникновения затрат (МВЗ)</strong> - это структурные подразделения предприятия, 
          по которым организован планируемый учет затрат на производство для контроля и управления издержками производства.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1">Примеры МВЗ:</h4>
            <ul class="text-sm space-y-1">
              <li>• Цех основного производства</li>
              <li>• Склад готовой продукции</li>
              <li>• Отдел логистики</li>
              <li>• Административное здание</li>
            </ul>
          </div>
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1">Назначение:</h4>
            <ul class="text-sm space-y-1">
              <li>• Детализация затрат по подразделениям</li>
              <li>• Калькулирование себестоимости</li>
              <li>• Контроль бюджета подразделений</li>
              <li>• Анализ эффективности затрат</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Card>
</div>

<!-- Add/Edit Cost Center Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <form on:submit|preventDefault={handleSubmitCC}>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {selectedCC ? 'Изменить МВЗ' : 'Добавить МВЗ'}
          </h3>
          
          <div class="space-y-4">
            <!-- Code -->
            <div>
              <label for="cc-code" class="block text-sm font-medium text-gray-700 mb-1">
                Код МВЗ *
              </label>
              <input
                id="cc-code"
                type="text"
                bind:value={formData.code}
                placeholder="Например: П001, С002"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Name -->
            <div>
              <label for="cc-name" class="block text-sm font-medium text-gray-700 mb-1">
                Название МВЗ *
              </label>
              <input
                id="cc-name"
                type="text"
                bind:value={formData.name}
                placeholder="Например: Цех основного производства"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Description -->
            <div>
              <label for="cc-description" class="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                id="cc-description"
                bind:value={formData.description}
                placeholder="Описание места возникновения затрат"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <!-- Active Status -->
            <div class="flex items-center">
              <input
                id="cc-active"
                type="checkbox"
                bind:checked={formData.is_active}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="cc-active" class="ml-2 block text-sm text-gray-900">
                Активен
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" on:click={handleCloseModal}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : selectedCC ? 'Сохранить' : 'Создать'}
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
          Вы действительно хотите удалить центр затрат "{ccToDelete?.name}"?
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