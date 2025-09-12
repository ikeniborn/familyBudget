<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Briefcase, Plus, Edit, Trash2, FileText } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  
  const toast = useToast();
  
  interface CostCenter {
    id: number;
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
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

  onMount(() => {
    loadCostCenters();
  });

  async function loadCostCenters() {
    try {
      loading = true;
      const response = await api.get('/cost_centers') as any;
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

  function handleAddCC() {
    selectedCC = null;
    showAddModal = true;
  }

  function handleEditCC(cc: CostCenter) {
    selectedCC = cc;
    showAddModal = true;
  }

  function handleDeleteCC(cc: CostCenter) {
    ccToDelete = cc;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!ccToDelete) return;
    
    try {
      deleting = true;
      const response = await api.delete(`/cost_centers/${ccToDelete.id}`) as any;
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
        <p class="text-slate-600">Места возникновения затрат</p>
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
            {#if loading}
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
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <span class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                      {cc.code}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="font-medium">{cc.name}</div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="text-sm text-gray-600 max-w-xs truncate">
                      {cc.description || 'Нет описания'}
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

<!-- Add/Edit Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">
          {selectedCC ? 'Изменить МВЗ' : 'Добавить МВЗ'}
        </h3>
        <p class="text-gray-600">Функция добавления/редактирования МВЗ будет реализована в следующей итерации.</p>
        <div class="flex justify-end gap-2 mt-4">
          <Button variant="outline" on:click={() => showAddModal = false}>
            Закрыть
          </Button>
        </div>
      </div>
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