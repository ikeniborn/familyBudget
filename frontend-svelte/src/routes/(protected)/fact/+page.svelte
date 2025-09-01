<script lang="ts">
  import FactForm from '$lib/components/fact/FactForm.svelte';
  import FactList from '$lib/components/fact/FactList.svelte';
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
  <title>Фактические операции | Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    <!-- Заголовок страницы -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <CreditCard class="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 class="page-title">
            Фактические операции
          </h1>
          <p class="page-subtitle">
            Управляйте фактическими доходами и расходами вашего бюджета
          </p>
        </div>
      </div>
    </div>

    <!-- Панель действий -->
    <div class="action-panel">
      <button on:click={toggleForm} class="action-btn action-btn-primary">
        <Plus class="h-5 w-5" />
        {showForm ? 'Скрыть форму' : 'Добавить операцию'}
      </button>
      <a href="/budget" class="action-btn action-btn-secondary">
        <Calculator class="h-5 w-5" />
        План
      </a>
      <a href="/reports" class="action-btn action-btn-secondary">
        <BarChart3 class="h-5 w-5" />
        Отчеты
      </a>
    </div>

    <!-- Основной контент -->
    <div class="main-content">
      <!-- Form Section -->
      {#if showForm}
        <div class="form-wrapper">
          <FactForm onSuccess={handleFormSuccess} />
        </div>
      {/if}

      <!-- List Section -->
      <div class="list-wrapper">
        {#key refreshList}
          <FactList />
        {/key}
      </div>
    </div>
  </div>
</div>

<style>
  :global(.container) {
    max-width: 1200px;
  }

  .page-header {
    @apply mb-8 p-8 rounded-2xl;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.4);
  }

  .header-content {
    @apply flex items-center gap-4;
  }

  .header-icon-wrapper {
    @apply flex items-center justify-center w-16 h-16 rounded-xl;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    backdrop-filter: blur(10px);
  }

  .page-title {
    @apply text-3xl font-bold text-white mb-1;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .page-subtitle {
    @apply text-white/80;
  }

  .action-panel {
    @apply flex flex-wrap gap-4 mb-6;
  }

  .action-btn {
    @apply flex items-center gap-2 px-6 py-3 rounded-xl font-semibold;
    @apply transition-all duration-200 transform hover:-translate-y-1;
    @apply shadow-lg hover:shadow-xl;
  }

  .action-btn-primary {
    @apply text-white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .action-btn-primary:hover {
    background: linear-gradient(135deg, #5a67d8 0%, #6b5b95 100%);
  }

  .action-btn-secondary {
    @apply bg-white/90 text-gray-700 hover:bg-white;
    backdrop-filter: blur(10px);
  }

  .main-content {
    @apply space-y-6;
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .form-wrapper {
    @apply transition-all duration-300 ease-in-out;
  }

  .list-wrapper {
    @apply transition-all duration-300 ease-in-out;
  }
</style>