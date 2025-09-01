<script lang="ts">
  import { type Product } from '$lib/services/product.service';
  import ProductForm from '$lib/components/products/ProductForm.svelte';
  import ProductList from '$lib/components/products/ProductList.svelte';
  import ProductImport from '$lib/components/products/ProductImport.svelte';
  import ProductAnalytics from '$lib/components/products/ProductAnalytics.svelte';
  import ProductNomenclatureLink from '$lib/components/products/ProductNomenclatureLink.svelte';
  import { 
    Plus, 
    Upload, 
    BarChart3, 
    Link as LinkIcon,
    Package
  } from 'lucide-svelte';

  let activeView: 'list' | 'form' = 'list';
  let selectedProduct: Product | null = null;
  let refreshKey = 0;
  
  // Модальные окна - убедимся что все инициализированы как false
  let showImportModal = false;
  let showAnalyticsModal = false;
  let showLinkModal = false;

  function handleAddProduct() {
    selectedProduct = null;
    activeView = 'form';
  }

  function handleEditProduct(product: Product) {
    selectedProduct = product;
    activeView = 'form';
  }

  function handleFormSuccess() {
    activeView = 'list';
    selectedProduct = null;
    refreshList();
  }

  function handleFormCancel() {
    activeView = 'list';
    selectedProduct = null;
  }

  function handleImportSuccess() {
    showImportModal = false;
    refreshList();
  }

  function handleLinkSuccess() {
    showLinkModal = false;
    refreshList();
  }

  function refreshList() {
    refreshKey = Date.now();
  }

  function openImportModal() {
    showImportModal = true;
  }

  function openAnalyticsModal() {
    showAnalyticsModal = true;
  }

  function openLinkModal() {
    showLinkModal = true;
  }
</script>

<svelte:head>
  <title>Управление продуктами | Family Budget</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    <!-- Заголовок страницы -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <Package class="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 class="page-title">
            Управление продуктами
          </h1>
          <p class="page-subtitle">
            Создавайте, редактируйте и анализируйте продукты вашего бюджета
          </p>
        </div>
      </div>
    </div>

    <!-- Панель действий -->
    {#if activeView === 'list'}
      <div class="action-panel">
        <button onclick={handleAddProduct} class="action-btn action-btn-primary">
          <Plus class="h-5 w-5" />
          Добавить продукт
        </button>
        <button onclick={openImportModal} class="action-btn action-btn-secondary">
          <Upload class="h-5 w-5" />
          Импорт
        </button>
        <button onclick={openAnalyticsModal} class="action-btn action-btn-secondary">
          <BarChart3 class="h-5 w-5" />
          Аналитика
        </button>
        <button onclick={openLinkModal} class="action-btn action-btn-secondary">
          <LinkIcon class="h-5 w-5" />
          Привязка к номенклатуре
        </button>
      </div>
    {/if}

    <!-- Основной контент -->
    <div class="main-content">
      {#if activeView === 'form'}
        <div class="back-button-wrapper">
          <button onclick={handleFormCancel} class="back-button">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Назад к списку
          </button>
        </div>
        <ProductForm 
          product={selectedProduct}
          onCancel={handleFormCancel}
          on:success={handleFormSuccess}
        />
      {:else}
        <ProductList 
          onEdit={handleEditProduct}
          {refreshKey}
          on:edit={({ detail: product }) => handleEditProduct(product)}
        />
      {/if}
    </div>

    <!-- Модальные окна -->
    {#if showImportModal}
      <ProductImport 
        isOpen={showImportModal}
        on:close={() => showImportModal = false}
        on:success={handleImportSuccess}
      />
    {/if}

    {#if showAnalyticsModal}
      <ProductAnalytics 
        isOpen={showAnalyticsModal}
        on:close={() => showAnalyticsModal = false}
      />
    {/if}

    {#if showLinkModal}
      <ProductNomenclatureLink 
        isOpen={showLinkModal}
        on:close={() => showLinkModal = false}
        on:success={handleLinkSuccess}
      />
    {/if}
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

  .back-button-wrapper {
    @apply mb-4;
  }

  .back-button {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg;
    @apply bg-white/90 text-gray-700 hover:bg-white;
    @apply transition-all duration-200 transform hover:-translate-x-1;
    @apply shadow-md hover:shadow-lg;
    backdrop-filter: blur(10px);
  }
</style>