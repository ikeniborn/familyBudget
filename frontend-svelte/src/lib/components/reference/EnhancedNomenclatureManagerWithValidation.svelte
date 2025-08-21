<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import { AlertCircle } from 'lucide-svelte';
</script>

<Card>
  <div class="flex items-center justify-center p-8 text-center">
    <div class="max-w-md">
      <AlertCircle class="mx-auto h-12 w-12 text-yellow-500 mb-4" />
      <h3 class="text-lg font-semibold text-gray-900 mb-2">
        Компонент временно недоступен
      </h3>
      <p class="text-gray-600 mb-4">
        EnhancedNomenclatureManagerWithValidation использует библиотеку @tanstack/svelte-table, которая была удалена. 
        Компонент требует рефакторинга для использования SimpleDataTable.
      </p>
      <p class="text-sm text-gray-500">
        Используйте базовый NomenclatureManager для управления номенклатурой.
      </p>
    </div>
  </div>
</Card>