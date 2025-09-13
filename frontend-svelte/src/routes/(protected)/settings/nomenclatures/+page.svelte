<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Tags, Plus, Edit, Trash2, FileText, TrendingUp, TrendingDown } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  
  const toast = useToast();
  
  interface Nomenclature {
    id: number;
    code: string;
    name: string;
    category?: string;
    type?: 'income' | 'expense';
    description?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
  }

  interface NomenclatureStats {
    total: number;
    active: number;
    inactive: number;
    income: number;
    expense: number;
  }

  let nomenclatures: Nomenclature[] = [];
  let nomenclatureStats: NomenclatureStats = {
    total: 0,
    active: 0,
    inactive: 0,
    income: 0,
    expense: 0
  };
  let loading = true;
  let showAddModal = false;
  let selectedNomenclature: Nomenclature | null = null;
  let showDeleteModal = false;
  let nomenclatureToDelete: Nomenclature | null = null;
  let deleting = false;
  let saving = false;

  // Form data
  let formData = {
    code: '',
    name: '',
    category: '',
    type: 'expense' as 'income' | 'expense',
    description: '',
    is_active: true
  };

  onMount(() => {
    loadNomenclatures();
  });

  async function loadNomenclatures() {
    try {
      loading = true;
      const response = await api.get('/nomenclatures/') as any;
      if (response.success) {
        nomenclatures = response.data || [];
        loadNomenclatureStats();
      } else {
        throw new Error(response.error || 'Не удалось загрузить номенклатуры');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при загрузке номенклатур',
        error.message
      );
      nomenclatures = [];
    } finally {
      loading = false;
    }
  }

  function loadNomenclatureStats() {
    // Вычисляем статистику на основе загруженных данных
    const total = nomenclatures.length;
    const active = nomenclatures.filter(n => n.is_active !== false).length;
    const inactive = total - active;
    const income = nomenclatures.filter(n => n.type === 'income').length;
    const expense = nomenclatures.filter(n => n.type === 'expense' || !n.type).length;
    
    nomenclatureStats = { total, active, inactive, income, expense };
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  }

  function getStatusBadge(nomenclature: Nomenclature) {
    if (nomenclature.is_active !== false) {
      return { class: 'bg-green-100 text-green-800', text: 'Активна' };
    } else {
      return { class: 'bg-gray-100 text-gray-800', text: 'Неактивна' };
    }
  }

  function getTypeBadge(nomenclature: Nomenclature) {
    if (nomenclature.type === 'income') {
      return { class: 'bg-green-100 text-green-800', text: 'Доходы', icon: TrendingUp };
    } else {
      return { class: 'bg-red-100 text-red-800', text: 'Расходы', icon: TrendingDown };
    }
  }

  function handleAddNomenclature() {
    selectedNomenclature = null;
    formData = {
      code: '',
      name: '',
      category: '',
      type: 'expense' as 'income' | 'expense',
      description: '',
      is_active: true
    };
    showAddModal = true;
  }

  function handleEditNomenclature(nomenclature: Nomenclature) {
    selectedNomenclature = nomenclature;
    formData = {
      code: nomenclature.code || '',
      name: nomenclature.name || '',
      category: nomenclature.category || '',
      type: (nomenclature.type as 'income' | 'expense') || 'expense',
      description: nomenclature.description || '',
      is_active: nomenclature.is_active !== false
    };
    showAddModal = true;
  }

  function handleCloseModal() {
    showAddModal = false;
    selectedNomenclature = null;
    formData = {
      code: '',
      name: '',
      category: '',
      type: 'expense' as 'income' | 'expense',
      description: '',
      is_active: true
    };
  }

  async function handleSubmitNomenclature() {
    if (!formData.name) {
      toast.error('Заполните обязательные поля', 'Название обязательно');
      return;
    }

    try {
      saving = true;
      
      const requestData = {
        nomenclature_name: formData.name,
        nomenclature_type: formData.type,
        account_name: formData.name,
        bill_name: formData.name,
        operation_name: formData.name,
        is_budget: true,
        is_fact: true,
        is_active: formData.is_active,
        user_id: 1 // Will be set by backend from current user
      };

      let response;
      if (selectedNomenclature) {
        // Update existing nomenclature
        response = await api.put(`/nomenclatures/${selectedNomenclature.id}/`, {
          nomenclature_name: formData.name,
          nomenclature_type: formData.type,
          account_name: formData.name,
          bill_name: formData.name,
          operation_name: formData.name,
          is_active: formData.is_active
        });
      } else {
        // Create new nomenclature
        response = await api.post('/nomenclatures/', requestData);
      }

      if ((response as any).success) {
        toast.success(
          selectedNomenclature ? 'Номенклатура успешно обновлена' : 'Номенклатура успешно создана'
        );
        handleCloseModal();
        await loadNomenclatures();
      } else {
        throw new Error((response as any).error || 'Ошибка при сохранении номенклатуры');
      }
    } catch (error: any) {
      // Улучшенная обработка ошибок от API
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.response) {
        // Ошибка от сервера
        if (error.response.status === 409) {
          errorMessage = error.response.data?.detail || 'Номенклатура с таким кодом уже существует';
        } else if (error.response.data?.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = `Ошибка сервера: ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = 'Сервер не отвечает';
      } else {
        errorMessage = error.message || 'Произошла ошибка';
      }
      
      toast.error(
        `Ошибка при ${selectedNomenclature ? 'обновлении' : 'создании'} номенклатуры`,
        errorMessage
      );
    } finally {
      saving = false;
    }
  }

  function handleDeleteNomenclature(nomenclature: Nomenclature) {
    nomenclatureToDelete = nomenclature;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!nomenclatureToDelete) return;
    
    try {
      deleting = true;
      const response = await api.delete(`/nomenclatures/${nomenclatureToDelete.id}/`) as any;
      if (response.success || response.message) {
        toast.success('Номенклатура успешно удалена');
        
        showDeleteModal = false;
        nomenclatureToDelete = null;
        await loadNomenclatures();
      } else {
        throw new Error(response.error || 'Не удалось удалить номенклатуру');
      }
    } catch (error: any) {
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.response) {
        errorMessage = error.response.data?.detail || error.response.data?.error || `Ошибка сервера: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Сервер не отвечает';
      } else {
        errorMessage = error.message || 'Произошла ошибка';
      }
      
      toast.error(
        'Ошибка при удалении номенклатуры',
        errorMessage
      );
    } finally {
      deleting = false;
    }
  }

  function handleCloseDeleteModal() {
    showDeleteModal = false;
    nomenclatureToDelete = null;
  }
</script>

<svelte:head>
  <title>Управление номенклатурами - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Tags class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Управление номенклатурами</h1>
        <p class="text-slate-600">Категории доходов и расходов</p>
      </div>
    </div>
    <Button on:click={handleAddNomenclature}>
      <Plus class="h-4 w-4 mr-2" />
      Добавить номенклатуру
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{nomenclatureStats.total}</p>
            <p class="text-sm text-gray-600">Всего</p>
          </div>
          <Tags class="h-8 w-8 text-gray-400" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{nomenclatureStats.active}</p>
            <p class="text-sm text-gray-600">Активных</p>
          </div>
          <Tags class="h-8 w-8 text-green-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{nomenclatureStats.inactive}</p>
            <p class="text-sm text-gray-600">Неактивных</p>
          </div>
          <Tags class="h-8 w-8 text-gray-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{nomenclatureStats.income}</p>
            <p class="text-sm text-gray-600">Доходы</p>
          </div>
          <TrendingUp class="h-8 w-8 text-green-600" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{nomenclatureStats.expense}</p>
            <p class="text-sm text-gray-600">Расходы</p>
          </div>
          <TrendingDown class="h-8 w-8 text-red-600" />
        </div>
      </div>
    </Card>
  </div>

  <!-- Nomenclatures Table -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Список номенклатур</h2>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left py-3 px-4">Код</th>
              <th class="text-left py-3 px-4">Название</th>
              <th class="text-left py-3 px-4">Категория</th>
              <th class="text-left py-3 px-4">Тип</th>
              <th class="text-left py-3 px-4">Статус</th>
              <th class="text-left py-3 px-4">Создана</th>
              <th class="text-right py-3 px-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {#if loading}
              <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                  Загрузка номенклатур...
                </td>
              </tr>
            {:else if nomenclatures.length === 0}
              <tr>
                <td colspan="7" class="py-8 text-center text-gray-500">
                  Номенклатуры не найдены
                </td>
              </tr>
            {:else}
              {#each nomenclatures as nomenclature}
                {@const statusBadge = getStatusBadge(nomenclature)}
                {@const typeBadge = getTypeBadge(nomenclature)}
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {nomenclature.code}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="font-medium">{nomenclature.name}</div>
                    {#if nomenclature.description}
                      <div class="text-xs text-gray-500 truncate max-w-xs">
                        {nomenclature.description}
                      </div>
                    {/if}
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {nomenclature.category || 'Без категории'}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {typeBadge.class}">
                      <svelte:component this={typeBadge.icon} class="h-3 w-3 mr-1" />
                      {typeBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                      {statusBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {formatDate(nomenclature.created_at)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" on:click={() => handleEditNomenclature(nomenclature)}>
                        <Edit class="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        class="text-red-600 hover:text-red-700 hover:bg-red-50"
                        on:click={() => handleDeleteNomenclature(nomenclature)}
                        title="Удалить номенклатуру"
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
        О номенклатурах
      </h2>
      <div class="space-y-3 text-sm text-gray-600">
        <p>
          <strong>Номенклатуры</strong> - это классификатор доходов и расходов, который позволяет 
          систематизировать и группировать финансовые операции по типам и категориям.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1 flex items-center gap-1">
              <TrendingUp class="h-4 w-4 text-green-600" />
              Доходы:
            </h4>
            <ul class="text-sm space-y-1">
              <li>• Заработная плата</li>
              <li>• Премии и бонусы</li>
              <li>• Инвестиционные доходы</li>
              <li>• Прочие поступления</li>
            </ul>
          </div>
          <div class="p-3 border rounded-lg">
            <h4 class="font-medium mb-1 flex items-center gap-1">
              <TrendingDown class="h-4 w-4 text-red-600" />
              Расходы:
            </h4>
            <ul class="text-sm space-y-1">
              <li>• Продукты питания</li>
              <li>• Коммунальные услуги</li>
              <li>• Транспорт</li>
              <li>• Развлечения</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Card>
</div>

<!-- Add/Edit Nomenclature Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <form on:submit|preventDefault={handleSubmitNomenclature}>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {selectedNomenclature ? 'Изменить номенклатуру' : 'Добавить номенклатуру'}
          </h3>
          
          <div class="space-y-4">
            <!-- Code ---->
            <div>
              <label for="nom-code" class="block text-sm font-medium text-gray-700 mb-1">
                Код номенклатуры
              </label>
              <input
                id="nom-code"
                type="text"
                bind:value={formData.code}
                placeholder="Например: Д001, Р002"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Name -->
            <div>
              <label for="nom-name" class="block text-sm font-medium text-gray-700 mb-1">
                Название номенклатуры *
              </label>
              <input
                id="nom-name"
                type="text"
                bind:value={formData.name}
                placeholder="Например: Продукты питания"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Category -->
            <div>
              <label for="nom-category" class="block text-sm font-medium text-gray-700 mb-1">
                Категория
              </label>
              <input
                id="nom-category"
                type="text"
                bind:value={formData.category}
                placeholder="Например: Основные расходы"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Type -->
            <div>
              <label for="nom-type" class="block text-sm font-medium text-gray-700 mb-1">
                Тип номенклатуры
              </label>
              <select
                id="nom-type"
                bind:value={formData.type}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="expense">Расходы</option>
                <option value="income">Доходы</option>
              </select>
            </div>

            <!-- Description -->
            <div>
              <label for="nom-description" class="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                id="nom-description"
                bind:value={formData.description}
                placeholder="Описание номенклатуры"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <!-- Active Status -->
            <div class="flex items-center">
              <input
                id="nom-active"
                type="checkbox"
                bind:checked={formData.is_active}
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label for="nom-active" class="ml-2 block text-sm text-gray-900">
                Активна
              </label>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" on:click={handleCloseModal}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : selectedNomenclature ? 'Сохранить' : 'Создать'}
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
          Вы действительно хотите удалить номенклатуру "{nomenclatureToDelete?.name}"?
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