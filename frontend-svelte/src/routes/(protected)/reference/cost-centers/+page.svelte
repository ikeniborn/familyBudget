<script lang="ts">
  import CostCenterManager from '$lib/components/reference/CostCenterManager.svelte';
</script>

<svelte:head>
  <title>Управление МВЗ - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Места возникновения затрат</h1>
    <p class="text-slate-600">
      Управление местами возникновения затрат (МВЗ)
    </p>
  </div>

  <CostCenterManager />
</div>