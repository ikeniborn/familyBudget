<script lang="ts">
  import BudgetForm from '$lib/components/budget/BudgetForm.svelte';
  import BudgetList from '$lib/components/budget/BudgetList.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { Calculator, Plus, BarChart3 } from 'lucide-svelte';

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
  <title>Бюджет - Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <div class="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Calculator class="h-6 w-6 text-blue-600" />
          </div>
          Планирование бюджета
        </h1>
        <p class="text-slate-600 mt-2 ml-15">Создание и управление планами доходов и расходов</p>
      </div>
      <div class="flex items-center gap-3">
        <Button
          on:click={toggleForm}
          class="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {showForm ? 'Скрыть форму' : 'Создать план'}
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
        <BudgetForm onSuccess={handleFormSuccess} />
      </div>
    {/if}

    <!-- List Section -->
    <div class="transition-all duration-300 ease-in-out">
      {#key refreshList}
        <BudgetList />
      {/key}
    </div>
  </div>
</div>