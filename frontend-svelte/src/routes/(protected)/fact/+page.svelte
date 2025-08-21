<script lang="ts">
  import FactForm from '$lib/components/fact/FactForm.svelte';
  import FactList from '$lib/components/fact/FactList.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { CreditCard, Plus, BarChart3, Calculator } from 'lucide-svelte';

  let showForm = false;
  let refreshList = 0;

  function handleFormSuccess() {
    showForm = false;
    refreshList++;
  }

  function toggleForm() {
    showForm = !showForm;
  }
</script>

<svelte:head>
  <title>Факт - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div class="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <CreditCard class="h-6 w-6 text-blue-600" />
          </div>
          Фактические операции
        </h1>
        <p class="text-slate-600 mt-2 ml-15">Управление фактическими доходами и расходами</p>
      </div>
      <div class="flex items-center gap-3">
        <Button
          on:click={toggleForm}
          class="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {showForm ? 'Скрыть форму' : 'Добавить операцию'}
        </Button>
        <Button
          href="/budget"
          variant="outline"
          class="flex items-center gap-2"
        >
          <Calculator class="h-4 w-4" />
          План
        </Button>
        <Button
          href="/reports"
          variant="outline"
          class="flex items-center gap-2"
        >
          <BarChart3 class="h-4 w-4" />
          Отчеты
        </Button>
      </div>
    </div>

    <!-- Form Section -->
    {#if showForm}
      <div class="transition-all duration-300 ease-in-out">
        <FactForm onSuccess={handleFormSuccess} />
      </div>
    {/if}

    <!-- List Section -->
    <div class="transition-all duration-300 ease-in-out">
      <FactList key={refreshList} />
    </div>
  </div>
</div>