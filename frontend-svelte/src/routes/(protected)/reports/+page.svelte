<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { BarChart3, Download } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Отчеты - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Отчеты и аналитика</h1>
      <p class="text-gray-600 mt-1">Анализ расходов и доходов</p>
    </div>
    <Button variant="outline">
      <Download class="h-4 w-4 mr-2" />
      Экспорт
    </Button>
  </div>

  <Card class="p-6">
    <div class="text-center py-12">
      <BarChart3 class="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        Страница в разработке
      </h3>
      <p class="text-gray-600">
        Компонент отчетов и аналитики будет портирован из React версии с поддержкой графиков
      </p>
    </div>
  </Card>
</div>