<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Calendar, CalendarPlus, CalendarCheck, CalendarX, Edit, Trash2 } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { api } from '$lib/services/api';
  
  const toast = useToast();
  
  interface Period {
    id: number;
    date: string;
    ru_name: string;
    start_date?: string;
    end_date?: string;
    period_id: number;
    period_name: string;
    period_year: number;
    period_month: number;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    user_id?: number;
  }

  interface PeriodStats {
    total: number;
    active: number;
    inactive: number;
    current: number;
  }

  let periods: Period[] = [];
  let periodStats: PeriodStats = {
    total: 0,
    active: 0,
    inactive: 0,
    current: 0
  };
  let loading = true;
  let showAddModal = false;
  let selectedPeriod: Period | null = null;
  let showDeleteModal = false;
  let periodToDelete: Period | null = null;
  let deleting = false;
  let saving = false;

  // Form data
  let formData = {
    date: '',
    ru_name: '',
    start_date: '',
    end_date: ''
  };

  onMount(() => {
    loadPeriods();
    loadPeriodStats();
  });

  async function loadPeriods() {
    try {
      loading = true;
      const response = await api.get('/periods/') as any;
      if (response.success) {
        periods = response.data || [];
      } else {
        throw new Error(response.error || 'Не удалось загрузить периоды');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при загрузке периодов',
        error.message
      );
      periods = [];
    } finally {
      loading = false;
    }
  }

  async function loadPeriodStats() {
    try {
      // Вычисляем статистику на основе загруженных данных
      const total = periods.length;
      const active = periods.filter(p => p.is_active !== false).length;
      const inactive = total - active;
      const current = periods.filter(p => {
        const today = new Date();
        const periodDate = new Date(p.date);
        return periodDate.getMonth() === today.getMonth() && 
               periodDate.getFullYear() === today.getFullYear();
      }).length;
      
      periodStats = { total, active, inactive, current };
    } catch (error: any) {
      console.error('Failed to load period stats:', error);
    }
  }

  function formatDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long'
      });
    } catch {
      return 'Не указано';
    }
  }

  function formatShortDate(dateString: string | null | undefined) {
    if (!dateString) return 'Не указано';
    try {
      return new Date(dateString).toLocaleDateString('ru-RU');
    } catch {
      return 'Не указано';
    }
  }

  function getStatusBadge(period: Period) {
    const today = new Date();
    const periodDate = new Date(period.date);
    const isCurrent = periodDate.getMonth() === today.getMonth() && 
                     periodDate.getFullYear() === today.getFullYear();
    
    if (isCurrent) {
      return { class: 'bg-blue-100 text-blue-800', text: 'Текущий' };
    } else if (period.is_active !== false) {
      return { class: 'bg-green-100 text-green-800', text: 'Активен' };
    } else {
      return { class: 'bg-gray-100 text-gray-800', text: 'Неактивен' };
    }
  }

  function handleAddPeriod() {
    selectedPeriod = null;
    formData = {
      date: '',
      ru_name: '',
      start_date: '',
      end_date: ''
    };
    showAddModal = true;
  }

  function handleEditPeriod(period: Period) {
    selectedPeriod = period;
    // Convert date to YYYY-MM format for month input
    const periodDate = new Date(period.date);
    const yearMonth = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;
    
    formData = {
      date: yearMonth,
      ru_name: period.ru_name || '',
      start_date: period.start_date ? period.start_date.substring(0, 10) : '',
      end_date: period.end_date ? period.end_date.substring(0, 10) : ''
    };
    showAddModal = true;
  }

  function handleCloseModal() {
    showAddModal = false;
    selectedPeriod = null;
    formData = {
      date: '',
      ru_name: '',
      start_date: '',
      end_date: ''
    };
  }

  async function handleSubmitPeriod() {
    if (!formData.date || !formData.ru_name) {
      toast.error('Заполните обязательные поля', 'Дата периода и название обязательны');
      return;
    }

    try {
      saving = true;
      
      // Convert month input (YYYY-MM) to full date
      const [year, month] = formData.date.split('-');
      const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      
      const requestData = {
        date: periodDate.toISOString(),
        ru_name: formData.ru_name,
        start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        period_year: parseInt(year),
        period_month: parseInt(month),
        period_name: formData.ru_name
      };

      let response;
      if (selectedPeriod) {
        // Update existing period
        response = await api.put(`/periods/${selectedPeriod.id}/`, requestData);
      } else {
        // Create new period
        response = await api.post('/periods/', requestData);
      }

      if ((response as any).success) {
        toast.success(
          selectedPeriod ? 'Период успешно обновлен' : 'Период успешно создан'
        );
        handleCloseModal();
        await loadPeriods();
        await loadPeriodStats();
      } else {
        throw new Error((response as any).error || 'Ошибка при сохранении периода');
      }
    } catch (error: any) {
      // Улучшенная обработка ошибок от API
      let errorMessage = 'Неизвестная ошибка';
      
      if (error.response) {
        // Ошибка от сервера
        if (error.response.status === 409) {
          // Извлекаем сообщение об ошибке из ответа сервера
          errorMessage = error.response.data?.detail || 'Период с такой датой уже существует';
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
        `Ошибка при ${selectedPeriod ? 'обновлении' : 'создании'} периода`,
        errorMessage
      );
    } finally {
      saving = false;
    }
  }

  function handleDeletePeriod(period: Period) {
    periodToDelete = period;
    showDeleteModal = true;
  }

  async function handleConfirmDelete() {
    if (!periodToDelete) return;
    
    try {
      deleting = true;
      const response = await api.delete(`/periods/${periodToDelete.id}/`);
      if ((response as any).success || (response as any).message) {
        toast.success('Период успешно удален');
        
        showDeleteModal = false;
        periodToDelete = null;
        await loadPeriods();
        await loadPeriodStats();
      } else {
        throw new Error((response as any).error || 'Не удалось удалить период');
      }
    } catch (error: any) {
      toast.error(
        'Ошибка при удалении периода',
        error.message
      );
    } finally {
      deleting = false;
    }
  }

  function handleCloseDeleteModal() {
    showDeleteModal = false;
    periodToDelete = null;
  }

  // Пересчитываем статистику при изменении периодов
  $: if (periods.length >= 0) {
    loadPeriodStats();
  }
</script>

<svelte:head>
  <title>Управление периодами - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Calendar class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Управление периодами</h1>
        <p class="text-slate-600">Временные периоды для планирования бюджета</p>
      </div>
    </div>
    <Button on:click={handleAddPeriod}>
      <CalendarPlus class="h-4 w-4 mr-2" />
      Добавить период
    </Button>
  </div>

  <!-- Statistics -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{periodStats.total}</p>
            <p class="text-sm text-gray-600">Всего периодов</p>
          </div>
          <Calendar class="h-8 w-8 text-gray-400" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{periodStats.active}</p>
            <p class="text-sm text-gray-600">Активных</p>
          </div>
          <CalendarCheck class="h-8 w-8 text-green-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{periodStats.inactive}</p>
            <p class="text-sm text-gray-600">Неактивных</p>
          </div>
          <CalendarX class="h-8 w-8 text-gray-500" />
        </div>
      </div>
    </Card>
    
    <Card>
      <div class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-2xl font-bold">{periodStats.current}</p>
            <p class="text-sm text-gray-600">Текущих</p>
          </div>
          <Calendar class="h-8 w-8 text-blue-500" />
        </div>
      </div>
    </Card>
  </div>

  <!-- Periods Table -->
  <Card>
    <div class="p-6">
      <h2 class="text-xl font-semibold mb-4">Список периодов</h2>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left py-3 px-4">Период</th>
              <th class="text-left py-3 px-4">Название</th>
              <th class="text-left py-3 px-4">Статус</th>
              <th class="text-left py-3 px-4">Диапазон</th>
              <th class="text-left py-3 px-4">Создан</th>
              <th class="text-right py-3 px-4">Действия</th>
            </tr>
          </thead>
          <tbody>
            {#if loading}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Загрузка периодов...
                </td>
              </tr>
            {:else if periods.length === 0}
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-500">
                  Периоды не найдены
                </td>
              </tr>
            {:else}
              {#each periods as period}
                {@const statusBadge = getStatusBadge(period)}
                <tr class="border-b hover:bg-gray-50">
                  <td class="py-3 px-4">
                    <div class="font-medium">
                      {formatDate(period.date)}
                    </div>
                    <div class="text-sm text-gray-500">
                      {period.period_year}.{String(period.period_month).padStart(2, '0')}
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="font-medium">{period.ru_name}</span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold {statusBadge.class}">
                      {statusBadge.text}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <div class="text-sm text-gray-600">
                      {#if period.start_date && period.end_date}
                        {formatShortDate(period.start_date)} - {formatShortDate(period.end_date)}
                      {:else}
                        Весь месяц
                      {/if}
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="text-sm text-gray-600">
                      {formatShortDate(period.created_at)}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" on:click={() => handleEditPeriod(period)}>
                        <Edit class="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        class="text-red-600 hover:text-red-700 hover:bg-red-50"
                        on:click={() => handleDeletePeriod(period)}
                        title="Удалить период"
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
</div>

<!-- Add/Edit Period Modal -->
{#if showAddModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <form on:submit|preventDefault={handleSubmitPeriod}>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">
            {selectedPeriod ? 'Изменить период' : 'Добавить период'}
          </h3>
          
          <div class="space-y-4">
            <!-- Period Date -->
            <div>
              <label for="period-date" class="block text-sm font-medium text-gray-700 mb-1">
                Дата периода *
              </label>
              <input
                id="period-date"
                type="month"
                bind:value={formData.date}
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Period Name -->
            <div>
              <label for="period-name" class="block text-sm font-medium text-gray-700 mb-1">
                Название периода *
              </label>
              <input
                id="period-name"
                type="text"
                bind:value={formData.ru_name}
                placeholder="Например: Январь 2024"
                required
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Start Date (Optional) -->
            <div>
              <label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
                Дата начала (опционально)
              </label>
              <input
                id="start-date"
                type="date"
                bind:value={formData.start_date}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- End Date (Optional) -->
            <div>
              <label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
                Дата окончания (опционально)
              </label>
              <input
                id="end-date"
                type="date"
                bind:value={formData.end_date}
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <Button type="button" variant="outline" on:click={handleCloseModal}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Сохранение...' : selectedPeriod ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  </div>
{/if}

{#if showDeleteModal}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <Card class="w-full max-w-md">
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Подтвердите удаление</h3>
        <p class="text-gray-600 mb-4">
          Вы действительно хотите удалить период "{periodToDelete?.ru_name}"?
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