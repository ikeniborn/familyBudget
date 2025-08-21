<script lang="ts">
  import FinancialCenterManager from '$lib/components/reference/FinancialCenterManager.svelte';
</script>

<svelte:head>
  <title>Управление ЦФО - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Центры финансовой ответственности</h1>
    <p class="text-slate-600">
      Управление центрами финансовой ответственности (ЦФО)
    </p>
  </div>

  <FinancialCenterManager />
</div>