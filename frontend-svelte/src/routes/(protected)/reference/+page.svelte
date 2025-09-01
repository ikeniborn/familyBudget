<script lang="ts">
  import { Calendar, Building, Package, List, Database } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Справочники | Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    <!-- Заголовок страницы -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <Database class="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 class="page-title">
            Справочники
          </h1>
          <p class="page-subtitle">
            Управление справочными данными для бюджетного планирования
          </p>
        </div>
      </div>
    </div>

    <!-- Основной контент -->
    <div class="main-content">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Periods -->
        <div class="reference-card">
          <div class="reference-icon bg-gradient-to-br from-blue-500 to-indigo-500">
            <Calendar class="h-6 w-6 text-white" />
          </div>
          <h3 class="reference-title">Периоды</h3>
          <p class="reference-subtitle">Временные периоды</p>
          <p class="reference-description">
            Управление периодами для бюджетного планирования по годам и месяцам
          </p>
          <a href="/reference/periods" class="reference-btn">
            Управлять периодами
          </a>
        </div>

        <!-- Financial Centers -->
        <div class="reference-card">
          <div class="reference-icon bg-gradient-to-br from-green-500 to-teal-500">
            <Building class="h-6 w-6 text-white" />
          </div>
          <h3 class="reference-title">ЦФО</h3>
          <p class="reference-subtitle">Финансовые центры</p>
          <p class="reference-description">
            Центры финансовой ответственности для структурирования бюджета
          </p>
          <a href="/reference/financial-centers" class="reference-btn">
            Управлять ЦФО
          </a>
        </div>

        <!-- Cost Centers -->
        <div class="reference-card">
          <div class="reference-icon bg-gradient-to-br from-purple-500 to-pink-500">
            <Package class="h-6 w-6 text-white" />
          </div>
          <h3 class="reference-title">МВЗ</h3>
          <p class="reference-subtitle">Места затрат</p>
          <p class="reference-description">
            Места возникновения затрат для детального учета расходов
          </p>
          <a href="/reference/cost-centers" class="reference-btn">
            Управлять МВЗ
          </a>
        </div>

        <!-- Nomenclatures -->
        <div class="reference-card">
          <div class="reference-icon bg-gradient-to-br from-orange-500 to-red-500">
            <List class="h-6 w-6 text-white" />
          </div>
          <h3 class="reference-title">Номенклатуры</h3>
          <p class="reference-subtitle">Статьи бюджета</p>
          <p class="reference-description">
            Номенклатуры и статьи бюджета для категоризации доходов и расходов
          </p>
          <a href="/reference/nomenclatures" class="reference-btn">
            Управлять номенклатурами
          </a>
        </div>
      </div>

      <!-- Справка по использованию -->
      <div class="info-card">
        <h2 class="info-title">Справка по использованию</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="info-section">
            <h3 class="info-subtitle">Периоды</h3>
            <p class="info-text">
              Создавайте периоды для планирования бюджета по годам и месяцам. 
              Каждый период имеет свой порядковый номер и может быть активным или неактивным.
            </p>
          </div>
          <div class="info-section">
            <h3 class="info-subtitle">ЦФО (Центры финансовой ответственности)</h3>
            <p class="info-text">
              Используются для структурирования бюджета по подразделениям или 
              направлениям деятельности семьи/организации.
            </p>
          </div>
          <div class="info-section">
            <h3 class="info-subtitle">МВЗ (Места возникновения затрат)</h3>
            <p class="info-text">
              Позволяют детализировать учет расходов по конкретным местам или 
              видам деятельности внутри ЦФО.
            </p>
          </div>
          <div class="info-section">
            <h3 class="info-subtitle">Номенклатуры</h3>
            <p class="info-text">
              Статьи бюджета для категоризации доходов и расходов. 
              Могут быть плановыми или фактическими.
            </p>
          </div>
        </div>
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

  .main-content {
    @apply space-y-8;
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

  .reference-card {
    @apply bg-white/90 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-200;
    @apply flex flex-col h-full;
    backdrop-filter: blur(10px);
    @apply hover:-translate-y-1;
  }

  .reference-icon {
    @apply w-14 h-14 rounded-xl flex items-center justify-center mb-4;
  }

  .reference-title {
    @apply text-lg font-semibold text-gray-900 mb-1;
  }

  .reference-subtitle {
    @apply text-sm text-gray-600 mb-3;
  }

  .reference-description {
    @apply text-sm text-gray-700 flex-grow mb-4;
  }

  .reference-btn {
    @apply block w-full text-center px-4 py-2 rounded-lg font-medium;
    @apply bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700;
    @apply hover:from-purple-100 hover:to-pink-100;
    @apply transition-all duration-200 border border-purple-200/50;
  }

  .info-card {
    @apply bg-white/90 rounded-xl p-8 shadow-lg;
    backdrop-filter: blur(10px);
  }

  .info-title {
    @apply text-xl font-semibold mb-6 text-gray-900;
  }

  .info-section {
    @apply space-y-2;
  }

  .info-subtitle {
    @apply font-semibold text-gray-800;
  }

  .info-text {
    @apply text-sm text-gray-600;
  }
</style>