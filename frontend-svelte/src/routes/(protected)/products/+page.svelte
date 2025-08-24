<script lang="ts">
  import { type Product } from '$lib/services/product.service';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
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
  
  // Модальные окна
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

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
  <div class="container mx-auto px-4 py-8">
    <!-- Заголовок страницы -->
    <div class="mb-8">
      <div class="flex items-center mb-2">
        <Package class="h-8 w-8 text-blue-600 mr-3" />
        <h1 class="text-3xl font-bold text-gray-900">
          Управление продуктами
        </h1>
      </div>
      <p class="text-gray-600">
        Создавайте, редактируйте и анализируйте продукты вашего бюджета
      </p>
    </div>

    <!-- Панель действий -->
    {#if activeView === 'list'}
      <Card class="mb-6">
        <div class="flex flex-wrap gap-3">
          <Button on:click={handleAddProduct}>
            <Plus class="h-4 w-4 mr-2" />
            Добавить продукт
          </Button>
          <Button variant="secondary" on:click={openImportModal}>
            <Upload class="h-4 w-4 mr-2" />
            Импорт
          </Button>
          <Button variant="secondary" on:click={openAnalyticsModal}>
            <BarChart3 class="h-4 w-4 mr-2" />
            Аналитика
          </Button>
          <Button variant="secondary" on:click={openLinkModal}>
            <LinkIcon class="h-4 w-4 mr-2" />
            Привязка к номенклатуре
          </Button>
        </div>
      </Card>
    {/if}

    <!-- Основной контент -->
    <div class="space-y-6">
      {#if activeView === 'form'}
        <Card>
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-gray-900">
              {selectedProduct ? 'Редактировать продукт' : 'Добавить продукт'}
            </h2>
            <Button variant="secondary" on:click={handleFormCancel}>
              ← Назад к списку
            </Button>
          </div>
          <ProductForm 
            product={selectedProduct}
            onCancel={handleFormCancel}
            on:success={handleFormSuccess}
          />
        </Card>
      {:else}
        <ProductList 
          onEdit={handleEditProduct}
          {refreshKey}
          on:edit={({ detail: product }) => handleEditProduct(product)}
        />
      {/if}
    </div>

    <!-- Модальные окна -->
    <ProductImport 
      bind:isOpen={showImportModal}
      on:close={() => showImportModal = false}
      on:success={handleImportSuccess}
    />

    <ProductAnalytics 
      bind:isOpen={showAnalyticsModal}
      on:close={() => showAnalyticsModal = false}
    />

    <ProductNomenclatureLink 
      bind:isOpen={showLinkModal}
      on:close={() => showLinkModal = false}
      on:success={handleLinkSuccess}
    />
  </div>
</div>

<style>
  :global(.container) {
    max-width: 1200px;
  }
</style>