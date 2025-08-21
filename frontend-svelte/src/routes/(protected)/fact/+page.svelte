<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { CreditCard, Plus } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Факт - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Фактические расходы</h1>
      <p class="text-gray-600 mt-1">Управление фактическими тратами</p>
    </div>
    <Button>
      <Plus class="h-4 w-4 mr-2" />
      Добавить расход
    </Button>
  </div>

  <Card class="p-6">
    <div class="text-center py-12">
      <CreditCard class="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        Страница в разработке
      </h3>
      <p class="text-gray-600">
        Компонент управления фактическими расходами будет портирован из React версии
      </p>
    </div>
  </Card>
</div>