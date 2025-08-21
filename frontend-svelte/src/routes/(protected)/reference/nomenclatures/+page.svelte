<script lang="ts">
  import NomenclatureManager from '$lib/components/reference/NomenclatureManager.svelte';
</script>

<svelte:head>
  <title>Управление номенклатурами - Family Budget</title>
</svelte:head>

<div class="space-y-6">
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-slate-900 mb-2">Номенклатуры</h1>
    <p class="text-slate-600">
      Управление номенклатурами и статьями бюджета
    </p>
  </div>

  <NomenclatureManager />
</div>