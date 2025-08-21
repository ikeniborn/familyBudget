<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { productService, type Product } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import DataTable from '$lib/components/common/DataTable.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import { Search, Filter, Trash2 } from 'lucide-svelte';

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

  // Колонки для таблицы
  const columns = [
    {
      key: 'select',
      title: '',
      width: '40px'
    },
    {
      key: 'product_name',
      title: 'Наименование',
      sortable: true
    },
    {
      key: 'category_name',
      title: 'Категория',
      sortable: true
    },
    {
      key: 'unit_measure',
      title: 'Единица',
      sortable: true
    },
    {
      key: 'barcode',
      title: 'Штрихкод'
    },
    {
      key: 'is_active',
      title: 'Статус',
      width: '100px'
    },
    {
      key: 'description',
      title: 'Описание'
    },
    {
      key: 'actions',
      title: 'Действия',
      width: '150px'
    }
  ];
</script>

<div class="space-y-6">
  <!-- Фильтры и действия -->
  <Card title="Управление продуктами">
    <div class="space-y-4">
      <!-- Строка поиска и фильтров -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Поиск продуктов..."
            bind:value={filters.search}
            class="pl-10"
          />
        </div>
        
        <select
          bind:value={filters.category}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="">Все категории</option>
          {#each categories as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
        
        <select
          bind:value={filters.status}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>

        <div class="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            on:click={clearFilters}
          >
            <Filter class="h-4 w-4 mr-1" />
            Сбросить
          </Button>
        </div>
      </div>

      <!-- Действия -->
      {#if selectedProducts.size > 0}
        <div class="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            on:click={handleBulkDelete}
            class="text-red-600 hover:text-red-700"
          >
            <Trash2 class="h-4 w-4 mr-1" />
            Удалить выбранные ({selectedProducts.size})
          </Button>
        </div>
      {/if}
    </div>
  </Card>

  <!-- Таблица продуктов -->
  <Card title={`Список продуктов (${filteredProducts.length})`}>
    {#if isLoading}
      <Loading />
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length}
                  on:change={(e) => toggleSelectAll(e.currentTarget.checked)}
                  class="rounded border-gray-300"
                />
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Наименование
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Категория
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Единица
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Штрихкод
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Описание
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredProducts as product (product.product_id)}
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedProducts.has(product.product_id!)}
                    on:change={() => toggleSelect(product.product_id!)}
                    class="rounded border-gray-300"
                  />
                </td>
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                  {product.product_name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.category_name || '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.unit_measure || '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.barcode || '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 rounded-full text-xs font-medium {
                    product.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }">
                    {product.is_active ? 'Активный' : 'Неактивный'}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                  {#if product.description}
                    <span title={product.description}>
                      {product.description.length > 30 ? `${product.description.substring(0, 30)}...` : product.description}
                    </span>
                  {:else}
                    <span class="text-gray-400">—</span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      on:click={() => handleEdit(product)}
                    >
                      Изменить
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      on:click={() => handleDelete(product.product_id!)}
                      class="text-red-600 hover:text-red-700"
                    >
                      Удалить
                    </Button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>

        {#if filteredProducts.length === 0}
          <div class="text-center py-12">
            <div class="text-gray-500">Нет продуктов, соответствующих фильтрам</div>
          </div>
        {/if}
      </div>
    {/if}
  </Card>
</div>