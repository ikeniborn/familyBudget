<script lang="ts">
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Settings, User, Database, Download } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Настройки - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold text-gray-900">Настройки</h1>
    <p class="text-gray-600 mt-1">Управление настройками приложения</p>
  </div>

  <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    <Card class="p-6">
      <div class="flex items-center mb-4">
        <div class="p-3 bg-blue-100 rounded-full">
          <User class="h-6 w-6 text-blue-600" />
        </div>
        <h3 class="ml-3 text-lg font-medium text-gray-900">Профиль</h3>
      </div>
      <p class="text-gray-600 mb-4">
        Управление личными данными и настройками аккаунта
      </p>
      <Button variant="outline" class="w-full" disabled>
        Настроить профиль
      </Button>
    </Card>

    <Card class="p-6">
      <div class="flex items-center mb-4">
        <div class="p-3 bg-green-100 rounded-full">
          <Database class="h-6 w-6 text-green-600" />
        </div>
        <h3 class="ml-3 text-lg font-medium text-gray-900">Справочники</h3>
      </div>
      <p class="text-gray-600 mb-4">
        Управление периодами, центрами затрат и номенклатурой
      </p>
      <Button variant="outline" class="w-full" disabled>
        Управлять данными
      </Button>
    </Card>

    <Card class="p-6">
      <div class="flex items-center mb-4">
        <div class="p-3 bg-purple-100 rounded-full">
          <Download class="h-6 w-6 text-purple-600" />
        </div>
        <h3 class="ml-3 text-lg font-medium text-gray-900">Экспорт/Импорт</h3>
      </div>
      <p class="text-gray-600 mb-4">
        Экспорт данных и импорт из внешних источников
      </p>
      <Button variant="outline" class="w-full" disabled>
        Импорт/Экспорт
      </Button>
    </Card>
  </div>

  <Card class="p-6">
    <div class="text-center py-8">
      <Settings class="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        Страница в разработке
      </h3>
      <p class="text-gray-600">
        Детальные настройки будут портированы из React версии
      </p>
    </div>
  </Card>
</div>