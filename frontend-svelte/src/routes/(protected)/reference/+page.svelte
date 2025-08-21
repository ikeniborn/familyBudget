<script lang="ts">
  import { Calendar, Building, Package, List } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
</script>

<svelte:head>
  <title>Справочники - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Справочники</h1>
    <p class="text-slate-600">
      Управление справочными данными для бюджетного планирования
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    <!-- Periods -->
    <Card class="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-blue-100 rounded-full">
            <Calendar class="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Периоды</h3>
            <p class="text-sm text-gray-600">Временные периоды</p>
          </div>
        </div>
        <p class="text-sm text-gray-700">
          Управление периодами для бюджетного планирования по годам и месяцам
        </p>
        <Button href="/reference/periods" class="w-full">
          Управлять периодами
        </Button>
      </div>
    </Card>

    <!-- Financial Centers -->
    <Card class="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-green-100 rounded-full">
            <Building class="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">ЦФО</h3>
            <p class="text-sm text-gray-600">Финансовые центры</p>
          </div>
        </div>
        <p class="text-sm text-gray-700">
          Центры финансовой ответственности для структурирования бюджета
        </p>
        <Button href="/reference/financial-centers" class="w-full">
          Управлять ЦФО
        </Button>
      </div>
    </Card>

    <!-- Cost Centers -->
    <Card class="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-purple-100 rounded-full">
            <Package class="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">МВЗ</h3>
            <p class="text-sm text-gray-600">Места затрат</p>
          </div>
        </div>
        <p class="text-sm text-gray-700">
          Места возникновения затрат для детального учета расходов
        </p>
        <Button href="/reference/cost-centers" class="w-full">
          Управлять МВЗ
        </Button>
      </div>
    </Card>

    <!-- Nomenclatures -->
    <Card class="p-6 hover:shadow-lg transition-shadow border-l-4 border-l-red-500">
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <div class="p-3 bg-red-100 rounded-full">
            <List class="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Номенклатуры</h3>
            <p class="text-sm text-gray-600">Статьи бюджета</p>
          </div>
        </div>
        <p class="text-sm text-gray-700">
          Номенклатуры и статьи бюджета для категоризации доходов и расходов
        </p>
        <Button href="/reference/nomenclatures" class="w-full">
          Управлять номенклатурами
        </Button>
      </div>
    </Card>
  </div>

  <div class="mt-8">
    <Card class="p-6">
      <h2 class="text-xl font-semibold mb-4">Справка по использованию</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <div>
          <h3 class="font-semibold mb-2">Периоды</h3>
          <p class="text-gray-600">
            Создавайте периоды для планирования бюджета по годам и месяцам. 
            Каждый период имеет свой порядковый номер и может быть активным или неактивным.
          </p>
        </div>
        <div>
          <h3 class="font-semibold mb-2">ЦФО (Центры финансовой ответственности)</h3>
          <p class="text-gray-600">
            Используются для структурирования бюджета по подразделениям или 
            направлениям деятельности семьи/организации.
          </p>
        </div>
        <div>
          <h3 class="font-semibold mb-2">МВЗ (Места возникновения затрат)</h3>
          <p class="text-gray-600">
            Позволяют детализировать учет расходов по конкретным местам или 
            видам деятельности внутри ЦФО.
          </p>
        </div>
        <div>
          <h3 class="font-semibold mb-2">Номенклатуры</h3>
          <p class="text-gray-600">
            Статьи бюджета для категоризации доходов и расходов. 
            Могут быть плановыми или фактическими.
          </p>
        </div>
      </div>
    </Card>
  </div>
</div>