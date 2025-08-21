<script lang="ts">
  import { Settings } from 'lucide-svelte';
  import SettingsNavigation from '$lib/components/settings/SettingsNavigation.svelte';
</script>

<svelte:head>
  <title>Настройки системы - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="border-b pb-4">
    <div class="flex items-center gap-3">
      <Settings class="h-8 w-8 text-slate-600" />
      <div>
        <h1 class="text-3xl font-bold text-slate-900">
          Настройки системы
        </h1>
        <p class="text-slate-600 mt-1">
          Управление справочниками и настройками приложения
        </p>
      </div>
    </div>
  </div>

  <!-- Navigation Cards -->
  <SettingsNavigation />

  <!-- Quick Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">12</div>
      <div class="text-sm text-gray-600">Активных периодов</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">5</div>
      <div class="text-sm text-gray-600">Финансовых центров</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">23</div>
      <div class="text-sm text-gray-600">Категорий</div>
    </div>
    <div class="bg-white rounded-lg border p-4">
      <div class="text-2xl font-bold text-gray-900">156</div>
      <div class="text-sm text-gray-600">Продуктов</div>
    </div>
  </div>
</div>