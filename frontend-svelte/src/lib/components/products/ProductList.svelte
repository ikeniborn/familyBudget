<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { productService, type Product } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import Loading from '$lib/components/common/Loading.svelte';
  import { 
    Search, 
    Filter, 
    Trash2, 
    Edit3, 
    Package,
    Tag,
    Ruler,
    Barcode as BarcodeIcon,
    FileText,
    CheckCircle,
    XCircle
  } from 'lucide-svelte';

  export let onEdit: ((product: Product) => void) | null = null;
  export let refreshKey = 0;

  const dispatch = createEventDispatcher<{
    edit: Product;
  }>();

  let products: Product[] = [];
  let isLoading = true;
  let selectedProducts = new Set<number>();
  let filters = {
    search: '',
    category: '',
    status: ''
  };

  // Фильтрованные продукты
  $: filteredProducts = products.filter(product => {
    if (filters.search && !product.product_name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.category && product.category_name !== filters.category) {
      return false;
    }
    if (filters.status) {
      if (filters.status === 'active' && !product.is_active) return false;
      if (filters.status === 'inactive' && product.is_active) return false;
    }
    return true;
  });

  // Получение уникальных категорий
  $: categories = [...new Set(products.map(p => p.category_name).filter(Boolean))];

  // Обновление при изменении refreshKey
  $: if (refreshKey) {
    loadProducts();
  }

  onMount(() => {
    loadProducts();
  });

  async function loadProducts() {
    try {
      isLoading = true;
      const data = await productService.getAll();
      products = data;
    } catch (error: any) {
      console.error('Ошибка загрузки продуктов:', error);
      toastStore.error(error.message || 'Не удалось загрузить список продуктов');
    } finally {
      isLoading = false;
    }
  }

  async function handleBulkDelete() {
    if (!confirm(`Вы уверены, что хотите удалить ${selectedProducts.size} продуктов?`)) {
      return;
    }

    try {
      await Promise.all(Array.from(selectedProducts).map(id => productService.delete(id)));
      toastStore.success(`Удалено ${selectedProducts.size} продуктов`);
      selectedProducts.clear();
      selectedProducts = selectedProducts; // Trigger reactivity
      await loadProducts();
    } catch (error: any) {
      console.error('Ошибка при удалении продуктов:', error);
      toastStore.error(error.message || 'Не удалось удалить продукты');
    }
  }

  async function handleDelete(productId: number) {
    if (!confirm('Вы уверены, что хотите удалить этот продукт?')) {
      return;
    }

    try {
      await productService.delete(productId);
      toastStore.success('Продукт удален');
      await loadProducts();
    } catch (error: any) {
      console.error('Ошибка при удалении продукта:', error);
      toastStore.error(error.message || 'Не удалось удалить продукт');
    }
  }

  function handleEdit(product: Product) {
    if (onEdit) {
      onEdit(product);
    } else {
      dispatch('edit', product);
    }
  }

  function clearFilters() {
    filters = { search: '', category: '', status: '' };
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      selectedProducts = new Set(filteredProducts.map(p => p.product_id!));
    } else {
      selectedProducts.clear();
    }
    selectedProducts = selectedProducts; // Trigger reactivity
  }

  function toggleSelect(productId: number) {
    if (selectedProducts.has(productId)) {
      selectedProducts.delete(productId);
    } else {
      selectedProducts.add(productId);
    }
    selectedProducts = selectedProducts; // Trigger reactivity
  }
</script>

<div class="products-container">
  <!-- Фильтры -->
  <div class="filters-section">
    <div class="filters-grid">
      <!-- Поиск -->
      <div class="search-container">
        <Search class="search-icon" />
        <input
          type="text"
          placeholder="Поиск продуктов..."
          bind:value={filters.search}
          class="search-input"
        />
        {#if filters.search}
          <button
            type="button"
            onclick={() => filters.search = ''}
            class="clear-icon"
            title="Очистить"
          >
            <XCircle class="h-5 w-5" />
          </button>
        {/if}
      </div>
      
      <!-- Категория -->
      <div class="filter-select-wrapper">
        <Tag class="select-icon" />
        <select
          bind:value={filters.category}
          class="filter-select"
        >
          <option value="">Все категории</option>
          {#each categories as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
        {#if filters.category}
          <button
            type="button"
            onclick={() => filters.category = ''}
            class="clear-icon"
            title="Очистить"
          >
            <XCircle class="h-5 w-5" />
          </button>
        {/if}
      </div>
      
      <!-- Статус -->
      <div class="filter-select-wrapper">
        <CheckCircle class="select-icon" />
        <select
          bind:value={filters.status}
          class="filter-select"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
        {#if filters.status}
          <button
            type="button"
            onclick={() => filters.status = ''}
            class="clear-icon"
            title="Очистить"
          >
            <XCircle class="h-5 w-5" />
          </button>
        {/if}
      </div>

      <!-- Кнопка сброса -->
      <button
        onclick={clearFilters}
        class="btn-reset"
      >
        <Filter class="h-4 w-4" />
        Сбросить
      </button>
    </div>

    <!-- Массовые действия -->
    {#if selectedProducts.size > 0}
      <div class="bulk-actions">
        <button
          onclick={handleBulkDelete}
          class="btn-bulk-delete"
        >
          <Trash2 class="h-4 w-4" />
          Удалить выбранные ({selectedProducts.size})
        </button>
      </div>
    {/if}
  </div>

  <!-- Таблица продуктов -->
  <div class="products-table-container">
    {#if isLoading}
      <div class="loading-container">
        <Loading />
      </div>
    {:else if filteredProducts.length === 0}
      <div class="empty-state">
        <Package class="empty-icon" />
        <h3 class="empty-title">Нет продуктов</h3>
        <p class="empty-description">
          {filters.search || filters.category || filters.status
            ? 'Нет продуктов, соответствующих фильтрам'
            : 'Добавьте первый продукт в каталог'}
        </p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="products-table">
          <thead>
            <tr>
              <th class="th-checkbox">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                  onchange={(e) => toggleSelectAll(e.currentTarget.checked)}
                  class="checkbox-all"
                />
              </th>
              <th class="th-name">НАИМЕНОВАНИЕ</th>
              <th class="th-category">КАТЕГОРИЯ</th>
              <th class="th-unit">ЕДИНИЦА</th>
              <th class="th-barcode">ШТРИХКОД</th>
              <th class="th-status">СТАТУС</th>
              <th class="th-description">ОПИСАНИЕ</th>
              <th class="th-actions">ДЕЙСТВИЯ</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredProducts as product, index (product.product_id)}
              <tr class="table-row" style="animation-delay: {index * 0.05}s">
                <td class="td-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.product_id!)}
                    onchange={() => toggleSelect(product.product_id!)}
                    class="checkbox-item"
                  />
                </td>
                <td class="td-name">
                  <div class="product-name">
                    <Package class="product-icon" />
                    <span>{product.product_name}</span>
                  </div>
                </td>
                <td class="td-category">
                  <span class="category-badge">
                    <Tag class="h-3 w-3" />
                    {product.category_name || '—'}
                  </span>
                </td>
                <td class="td-unit">
                  <span class="unit-badge">
                    <Ruler class="h-3 w-3" />
                    {product.unit_measure || '—'}
                  </span>
                </td>
                <td class="td-barcode">
                  {#if product.barcode}
                    <span class="barcode-badge">
                      <BarcodeIcon class="h-3 w-3" />
                      {product.barcode}
                    </span>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
                <td class="td-status">
                  <span class="status-badge {product.is_active ? 'status-active' : 'status-inactive'}">
                    {#if product.is_active}
                      <CheckCircle class="h-3 w-3" />
                      Активный
                    {:else}
                      <XCircle class="h-3 w-3" />
                      Неактивный
                    {/if}
                  </span>
                </td>
                <td class="td-description">
                  {#if product.description}
                    <span class="description-text" title={product.description}>
                      <FileText class="h-3 w-3" />
                      {product.description.length > 30 
                        ? `${product.description.substring(0, 30)}...` 
                        : product.description}
                    </span>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
                <td class="td-actions">
                  <div class="action-buttons">
                    <button
                      onclick={() => handleEdit(product)}
                      class="btn-edit"
                      title="Редактировать"
                    >
                      <Edit3 class="h-4 w-4" />
                    </button>
                    <button
                      onclick={() => handleDelete(product.product_id!)}
                      class="btn-delete"
                      title="Удалить"
                    >
                      <Trash2 class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .products-container {
    @apply space-y-6;
  }

  .filters-section {
    @apply bg-white rounded-2xl p-6 shadow-lg;
    background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(249,250,251,0.95) 100%);
    backdrop-filter: blur(10px);
  }

  .filters-grid {
    @apply grid grid-cols-1 md:grid-cols-4 gap-4 items-center;
  }

  .search-container {
    @apply relative flex items-center;
  }

  .search-icon {
    @apply absolute left-4 h-5 w-5 pointer-events-none z-10;
    color: #9ca3af;
  }

  .search-input {
    @apply w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200;
    @apply focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 focus:outline-none;
    @apply transition-all duration-200 hover:border-gray-300;
    @apply font-medium text-gray-700 placeholder-gray-400;
    background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%);
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  }
  
  .search-input:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  .search-input:focus {
    background: white;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .filter-select-wrapper {
    @apply relative flex items-center;
  }

  .select-icon {
    @apply absolute left-4 h-5 w-5 pointer-events-none z-10;
    color: #9ca3af;
  }

  .filter-select {
    @apply w-full pl-12 pr-12 py-3 rounded-xl border-2 border-gray-200;
    @apply focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 focus:outline-none;
    @apply transition-all duration-200 hover:border-gray-300 appearance-none;
    @apply bg-white font-medium text-gray-700;
    background: linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(249,250,251,0.98) 100%);
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
  }
  
  .filter-select:hover {
    background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  
  .filter-select:focus {
    background: white;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
  }

  .clear-icon {
    @apply absolute right-3 z-10 p-1 rounded-full;
    @apply text-gray-400 hover:text-gray-600;
    @apply transition-all duration-200;
    @apply hover:bg-gray-100;
  }

  .clear-icon:focus {
    @apply outline-none ring-2 ring-purple-500/20;
  }

  .btn-reset {
    @apply flex items-center justify-center gap-2 px-6 py-3 rounded-xl;
    @apply font-medium transition-all duration-200;
    @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
    @apply hover:transform hover:-translate-y-0.5;
  }

  .bulk-actions {
    @apply mt-4 pt-4 border-t border-gray-200;
  }

  .btn-bulk-delete {
    @apply flex items-center gap-2 px-4 py-2 rounded-lg;
    @apply font-medium text-sm transition-all duration-200;
    @apply bg-red-50 text-red-600 hover:bg-red-100;
  }

  .products-table-container {
    @apply bg-white rounded-2xl shadow-lg overflow-hidden;
    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
  }

  .loading-container {
    @apply p-12;
  }

  .empty-state {
    @apply py-16 px-8 text-center;
  }

  .empty-icon {
    @apply w-16 h-16 mx-auto mb-4 text-gray-300;
  }

  .empty-title {
    @apply text-xl font-semibold text-gray-900 mb-2;
  }

  .empty-description {
    @apply text-gray-500;
  }

  .table-wrapper {
    @apply overflow-x-auto;
  }

  .products-table {
    @apply w-full;
  }

  .products-table thead {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .products-table thead tr th {
    @apply px-6 py-4 text-left text-xs font-bold tracking-wider text-white;
  }

  .th-checkbox {
    @apply w-12;
  }

  .th-actions {
    @apply w-32 text-center;
  }

  .checkbox-all,
  .checkbox-item {
    @apply w-5 h-5 rounded border-2 border-gray-300 text-purple-600;
    @apply focus:ring-4 focus:ring-purple-500/20;
  }

  .table-row {
    @apply border-b border-gray-100 transition-all duration-200;
    @apply hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50;
    animation: fadeIn 0.3s ease-out forwards;
    opacity: 0;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  .products-table tbody tr td {
    @apply px-6 py-4;
  }

  .product-name {
    @apply flex items-center gap-2 font-medium text-gray-900;
  }

  .product-icon {
    @apply h-4 w-4 text-purple-500;
  }

  .category-badge,
  .unit-badge {
    @apply inline-flex items-center gap-1 px-2 py-1 rounded-lg;
    @apply text-xs font-medium bg-gray-100 text-gray-700;
  }

  .barcode-badge {
    @apply inline-flex items-center gap-1 px-2 py-1 rounded-lg;
    @apply text-xs font-medium bg-blue-50 text-blue-700;
  }

  .status-badge {
    @apply inline-flex items-center gap-1 px-3 py-1 rounded-full;
    @apply text-xs font-semibold;
  }

  .status-active {
    @apply bg-green-100 text-green-700;
  }

  .status-inactive {
    @apply bg-red-100 text-red-700;
  }

  .description-text {
    @apply inline-flex items-center gap-1 text-sm text-gray-600;
  }

  .text-muted {
    @apply text-gray-400;
  }

  .action-buttons {
    @apply flex items-center justify-center gap-2;
  }

  .btn-edit,
  .btn-delete {
    @apply p-2 rounded-lg transition-all duration-200;
    @apply hover:transform hover:scale-110;
  }

  .btn-edit {
    @apply bg-blue-50 text-blue-600 hover:bg-blue-100;
  }

  .btn-delete {
    @apply bg-red-50 text-red-600 hover:bg-red-100;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .th-description,
    .td-description {
      @apply hidden;
    }
    
    .th-barcode,
    .td-barcode {
      @apply hidden;
    }
  }
</style>