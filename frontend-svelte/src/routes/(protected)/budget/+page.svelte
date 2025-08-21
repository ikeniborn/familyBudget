<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Calculator, Plus } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Бюджет - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Планирование бюджета</h1>
      <p class="text-gray-600 mt-1">Создание и управление планами расходов</p>
    </div>
    <Button>
      <Plus class="h-4 w-4 mr-2" />
      Создать план
    </Button>
  </div>

  <Card class="p-6">
    <div class="text-center py-12">
      <Calculator class="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        Страница в разработке
      </h3>
      <p class="text-gray-600">
        Компонент планирования бюджета будет портирован из React версии
      </p>
    </div>
  </Card>
</div>