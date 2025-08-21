<script lang="ts">
  import PeriodManager from '$lib/components/reference/PeriodManager.svelte';
</script>

<svelte:head>
  <title>Управление периодами - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Управление периодами</h1>
    <p class="text-slate-600">
      Создание и управление периодами для бюджетного планирования
    </p>
  </div>

  <PeriodManager />
</div>