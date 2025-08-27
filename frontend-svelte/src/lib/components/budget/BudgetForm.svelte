<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser } from '$lib/stores/auth.store';
  import { 
    periodStore, 
    financialCenterStore, 
    costCenterStore, 
    nomenclatureStore 
  } from '$lib/stores/referenceData.store';
  import { useToast } from '$lib/stores/toast.store';
  import { registryService, type CreateRegistryData } from '$lib/services/registry.service';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import { 
    Target, 
    Calendar, 
    Building, 
    Tag, 
    DollarSign, 
    MessageSquare, 
    Check,
    RotateCcw,
    TrendingUp,
    TrendingDown
  } from 'lucide-svelte';

  export let onSuccess: (() => void) | undefined = undefined;

  let isSubmitting = false;
  let loading = true;
  let showCostCenter = false;

  // Form data
  let formData = {
    operation_dttm: new Date().toISOString().split('T')[0],
    period_id: '',
    financial_center_id: '',
    cost_center_id: '',
    nomenclature_id: '',
    cost_sum: '',
    comment_description: '',
    operation_type: 'expense' as 'expense' | 'income'
  };

  // Form errors
  let errors: Record<string, string> = {};

  const toast = useToast();

  onMount(async () => {
    try {
      // Load reference data if not already loaded
      if ($periodStore.items.length === 0) {
        await periodStore.load($currentUser?.user_id || 0);
      }
      if ($financialCenterStore.items.length === 0) {
        await financialCenterStore.load($currentUser?.user_id || 0);
      }
      if ($costCenterStore.items.length === 0) {
        await costCenterStore.load($currentUser?.user_id || 0);
      }
      if ($nomenclatureStore.items.length === 0) {
        await nomenclatureStore.load($currentUser?.user_id || 0);
      }
    } catch (error: any) {
      console.error('Ошибка загрузки данных:', error);
      toast.error('Ошибка', 'Не удалось загрузить справочники');
    } finally {
      loading = false;
    }
  });

  function validateForm(): boolean {
    errors = {};

    if (!formData.operation_dttm) {
      errors.operation_dttm = 'Дата операции обязательна';
    }

    if (!formData.period_id) {
      errors.period_id = 'Выберите период';
    }

    if (!formData.financial_center_id) {
      errors.financial_center_id = 'Выберите финансовый центр';
    }

    if (!formData.nomenclature_id) {
      errors.nomenclature_id = 'Выберите номенклатуру';
    }

    if (!formData.cost_sum) {
      errors.cost_sum = 'Сумма обязательна';
    } else {
      const amount = parseFloat(formData.cost_sum);
      if (isNaN(amount) || amount <= 0) {
        errors.cost_sum = 'Сумма должна быть больше 0';
      }
    }

    if (showCostCenter && !formData.cost_center_id) {
      errors.cost_center_id = 'Выберите МВЗ';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    isSubmitting = true;

    try {
      const payload: CreateRegistryData = {
        operation_dttm: formData.operation_dttm,
        period_id: parseInt(formData.period_id),
        financial_center_id: parseInt(formData.financial_center_id),
        cost_center_id: showCostCenter ? parseInt(formData.cost_center_id) : undefined,
        nomenclature_id: parseInt(formData.nomenclature_id),
        cost_sum: formData.operation_type === 'expense' 
          ? parseFloat(formData.cost_sum) 
          : -parseFloat(formData.cost_sum), // Доходы отрицательные в системе
        comment_description: formData.comment_description || undefined,
        row_type_id: 2, // Бюджет/План
      };

      await registryService.create(payload);
      toast.success('Успешно', `${formData.operation_type === 'expense' ? 'Расход' : 'Доход'} запланирован`);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      console.error('Ошибка при добавлении записи:', error);
      toast.error('Ошибка', error.message || 'Не удалось добавить запись');
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    formData = {
      operation_dttm: new Date().toISOString().split('T')[0],
      period_id: '',
      financial_center_id: '',
      cost_center_id: '',
      nomenclature_id: '',
      cost_sum: '',
      comment_description: '',
      operation_type: 'expense'
    };
    showCostCenter = false;
    errors = {};
  }
</script>

{#if loading}
  <div class="flex justify-center items-center min-h-[400px]">
    <Loading size="large" text="Загрузка формы..." />
  </div>
{:else}
  <Card class="border-l-4 border-l-blue-500 max-w-2xl mx-auto">
    <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-6 border-b">
      <div class="flex items-center gap-3 mb-2">
        <div class="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
          <Target class="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-900">Планирование бюджета</h2>
          <p class="text-sm text-slate-600">Создайте план доходов и расходов</p>
        </div>
      </div>
    </div>

    <div class="p-6">
      <form on:submit|preventDefault={handleSubmit} class="space-y-6">
        <!-- Date and Period -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="space-y-2">
            <label for="operation_dttm" class="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Calendar class="h-4 w-4" />
              Дата операции
            </label>
            <Input
              id="operation_dttm"
              type="date"
              bind:value={formData.operation_dttm}
              class={errors.operation_dttm ? 'border-red-300' : ''}
            />
            {#if errors.operation_dttm}
              <p class="text-sm text-red-600">{errors.operation_dttm}</p>
            {/if}
          </div>

          <div class="space-y-2">
            <label for="period_id" class="text-sm font-medium text-slate-700">Период</label>
            <select
              id="period_id"
              bind:value={formData.period_id}
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent {errors.period_id ? 'border-red-300' : ''}"
            >
              <option value="">Выберите период</option>
              {#each $periodStore.items as period}
                <option value={period.period_id.toString()}>{period.period_ru_name}</option>
              {/each}
            </select>
            {#if errors.period_id}
              <p class="text-sm text-red-600">{errors.period_id}</p>
            {/if}
          </div>
        </div>

        <!-- Operation Type -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700">Тип операции</label>
          <div class="flex gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                bind:group={formData.operation_type}
                value="expense"
                class="text-red-600 focus:ring-red-500"
              />
              <div class="flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-700">
                <TrendingDown class="h-4 w-4" />
                <span class="text-sm font-medium">Расход</span>
              </div>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                bind:group={formData.operation_type}
                value="income"
                class="text-green-600 focus:ring-green-500"
              />
              <div class="flex items-center gap-1 px-3 py-1 rounded-full bg-green-50 text-green-700">
                <TrendingUp class="h-4 w-4" />
                <span class="text-sm font-medium">Доход</span>
              </div>
            </label>
          </div>
        </div>

        <!-- Financial Center -->
        <div class="space-y-2">
          <label for="financial_center_id" class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Building class="h-4 w-4" />
            Финансовый центр
          </label>
          <select
            id="financial_center_id"
            bind:value={formData.financial_center_id}
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent {errors.financial_center_id ? 'border-red-300' : ''}"
          >
            <option value="">Выберите финансовый центр</option>
            {#each $financialCenterStore.items as fc}
              <option value={fc.financial_center_id.toString()}>{fc.financial_center_name}</option>
            {/each}
          </select>
          {#if errors.financial_center_id}
            <p class="text-sm text-red-600">{errors.financial_center_id}</p>
          {/if}
        </div>

        <!-- Nomenclature -->
        <div class="space-y-2">
          <label for="nomenclature_id" class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Tag class="h-4 w-4" />
            Номенклатура
          </label>
          <select
            id="nomenclature_id"
            bind:value={formData.nomenclature_id}
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent {errors.nomenclature_id ? 'border-red-300' : ''}"
          >
            <option value="">Выберите номенклатуру</option>
            {#each $nomenclatureStore.items as nom}
              <option value={nom.nomenclature_id.toString()}>{nom.nomenclature_name}</option>
            {/each}
          </select>
          {#if errors.nomenclature_id}
            <p class="text-sm text-red-600">{errors.nomenclature_id}</p>
          {/if}
        </div>

        <!-- Cost Center Toggle -->
        <div class="flex items-center space-x-3 p-4 border rounded-md bg-slate-50">
          <input
            type="checkbox"
            id="showCostCenter"
            bind:checked={showCostCenter}
            class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <label for="showCostCenter" class="text-sm font-medium text-slate-700 cursor-pointer">
            Использовать МВЗ
          </label>
          <span class="text-xs text-slate-500">Добавить место возникновения затрат</span>
        </div>

        <!-- Cost Center -->
        {#if showCostCenter}
          <div class="space-y-2">
            <label for="cost_center_id" class="text-sm font-medium text-slate-700">
              Место возникновения затрат (МВЗ)
            </label>
            <select
              id="cost_center_id"
              bind:value={formData.cost_center_id}
              class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent {errors.cost_center_id ? 'border-red-300' : ''}"
            >
              <option value="">Выберите МВЗ</option>
              {#each $costCenterStore.items as cc}
                <option value={cc.cost_center_id.toString()}>{cc.cost_center_name}</option>
              {/each}
            </select>
            {#if errors.cost_center_id}
              <p class="text-sm text-red-600">{errors.cost_center_id}</p>
            {/if}
          </div>
        {/if}

        <!-- Amount -->
        <div class="space-y-2">
          <label for="cost_sum" class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <DollarSign class="h-4 w-4" />
            Сумма {formData.operation_type === 'expense' ? 'расхода' : 'дохода'}
          </label>
          <Input
            id="cost_sum"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            bind:value={formData.cost_sum}
            class={errors.cost_sum ? 'border-red-300' : ''}
          />
          <p class="text-xs text-slate-500">Введите сумму в рублях</p>
          {#if errors.cost_sum}
            <p class="text-sm text-red-600">{errors.cost_sum}</p>
          {/if}
        </div>

        <!-- Comment -->
        <div class="space-y-2">
          <label for="comment_description" class="flex items-center gap-2 text-sm font-medium text-slate-700">
            <MessageSquare class="h-4 w-4" />
            Комментарий
          </label>
          <textarea
            id="comment_description"
            rows="3"
            bind:value={formData.comment_description}
            placeholder="Дополнительная информация о планируемой операции..."
            class="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
          <p class="text-xs text-slate-500">Опциональное описание операции</p>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            class="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
          >
            {#if isSubmitting}
              <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Добавление...
            {:else}
              <Check class="h-4 w-4" />
              Добавить {formData.operation_type === 'expense' ? 'расход' : 'доход'}
            {/if}
          </Button>
          <Button
            type="button"
            on:click={resetForm}
            disabled={isSubmitting}
            class="bg-slate-500 hover:bg-slate-600 text-white flex items-center justify-center gap-2"
          >
            <RotateCcw class="h-4 w-4" />
            Очистить
          </Button>
        </div>
      </form>
    </div>
  </Card>
{/if}