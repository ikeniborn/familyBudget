<script lang="ts">
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { useToast } from '$lib/stores/toast.store';
  import { registryService, type UpdateRegistryData } from '$lib/services/registry.service';
  import { referenceDataStore } from '$lib/stores/referenceData.store';
  import type { Registry } from '$lib/types';
  import { X, Save } from 'lucide-svelte';

  interface Props {
    fact: Registry | null;
    onSuccess: () => void;
    onCancel: () => void;
  }

  let { fact = null, onSuccess = () => {}, onCancel = () => {} }: Props = $props();
  
  const toast = useToast();
  const { periods, financialCenters, costCenters, nomenclatures } = referenceDataStore;
  
  let isSubmitting = $state(false);
  let formData = $state({
    operation_dttm: '',
    period_id: 0,
    financial_center_id: 0,
    cost_center_id: null as number | null,
    nomenclature_id: 0,
    cost_sum: 0,
    comment_description: ''
  });

  $effect(() => {
    if (fact) {
      formData.operation_dttm = fact.operation_dttm ? new Date(fact.operation_dttm).toISOString().split('T')[0] : '';
      formData.period_id = fact.period_id;
      formData.financial_center_id = fact.financial_center_id;
      formData.cost_center_id = fact.cost_center_id;
      formData.nomenclature_id = fact.nomenclature_id;
      formData.cost_sum = fact.cost_sum;
      formData.comment_description = fact.comment_description || '';
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!fact) return;
    
    isSubmitting = true;
    
    try {
      const updateData: UpdateRegistryData = {
        operation_dttm: formData.operation_dttm,
        period_id: formData.period_id,
        financial_center_id: formData.financial_center_id,
        cost_center_id: formData.cost_center_id || undefined,
        nomenclature_id: formData.nomenclature_id,
        cost_sum: formData.cost_sum,
        comment_description: formData.comment_description || undefined
      };
      
      await registryService.update(fact.id, updateData);
      toast.success('Успех', 'Операция обновлена');
      onSuccess();
    } catch (error: any) {
      console.error('Ошибка обновления:', error);
      toast.error('Ошибка', error.message || 'Не удалось обновить операцию');
    } finally {
      isSubmitting = false;
    }
  }
</script>

{#if fact}
  <Modal show={true} onClose={onCancel}>
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-semibold text-gray-900">Редактирование операции</h2>
        <button
          type="button"
          on:click={onCancel}
          class="text-gray-400 hover:text-gray-500"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <form on:submit={handleSubmit} class="space-y-4">
        <div>
          <label for="operation_date" class="block text-sm font-medium text-gray-700 mb-1">
            Дата операции
          </label>
          <Input
            id="operation_date"
            type="date"
            bind:value={formData.operation_dttm}
            required
            class="w-full"
          />
        </div>

        <div>
          <label for="period" class="block text-sm font-medium text-gray-700 mb-1">
            Период
          </label>
          <select
            id="period"
            bind:value={formData.period_id}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Выберите период</option>
            {#each $periods as period}
              <option value={period.period_id}>{period.period_name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="financial_center" class="block text-sm font-medium text-gray-700 mb-1">
            Финансовый центр (ЦФО)
          </label>
          <select
            id="financial_center"
            bind:value={formData.financial_center_id}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Выберите ЦФО</option>
            {#each $financialCenters as fc}
              <option value={fc.financial_center_id}>{fc.financial_center_name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="cost_center" class="block text-sm font-medium text-gray-700 mb-1">
            МВЗ (необязательно)
          </label>
          <select
            id="cost_center"
            bind:value={formData.cost_center_id}
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={null}>Не указано</option>
            {#each $costCenters as cc}
              <option value={cc.cost_center_id}>{cc.cost_center_name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="nomenclature" class="block text-sm font-medium text-gray-700 mb-1">
            Номенклатура
          </label>
          <select
            id="nomenclature"
            bind:value={formData.nomenclature_id}
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Выберите категорию</option>
            {#each $nomenclatures as nom}
              <option value={nom.nomenclature_id}>{nom.nomenclature_name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="amount" class="block text-sm font-medium text-gray-700 mb-1">
            Сумма (положительная - расход, отрицательная - доход)
          </label>
          <Input
            id="amount"
            type="number"
            bind:value={formData.cost_sum}
            required
            step="0.01"
            class="w-full"
          />
        </div>

        <div>
          <label for="comment" class="block text-sm font-medium text-gray-700 mb-1">
            Комментарий (необязательно)
          </label>
          <textarea
            id="comment"
            bind:value={formData.comment_description}
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          ></textarea>
        </div>

        <div class="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            on:click={onCancel}
            disabled={isSubmitting}
          >
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            class="flex items-center gap-2"
          >
            <Save class="h-4 w-4" />
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </div>
  </Modal>
{/if}
</script>