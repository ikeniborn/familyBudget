<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { productService, type Product, type ProductPrice } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import { TrendingUp, TrendingDown, Store, BarChart3 } from 'lucide-svelte';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  interface PriceHistory {
    date: string;
    price: number;
    supplier: string;
  }

  interface ProductStats {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    priceVariation: number;
    suppliersCount: number;
    lastUpdateDate: string;
  }

  let products: Product[] = [];
  let selectedProductId: number | null = null;
  let priceHistory: PriceHistory[] = [];
  let productStats: ProductStats | null = null;
  let dateRange: 'week' | 'month' | 'quarter' | 'year' = 'month';
  let searchTerm = '';
  let dataLoaded = false;

  // Загружаем данные только когда диалог действительно открывается
  $: if (isOpen && !dataLoaded) {
    loadProducts();
    dataLoaded = true;
  }

  // Сбрасываем флаг загрузки данных при закрытии
  $: if (!isOpen && dataLoaded) {
    dataLoaded = false;
    products = [];
    selectedProductId = null;
    priceHistory = [];
    productStats = null;
    searchTerm = '';
  }

  $: if (selectedProductId && isOpen) {
    loadProductAnalytics();
  }

  $: filteredProducts = products.filter(product => 
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  $: selectedProduct = products.find(p => p.product_id === selectedProductId);

  async function loadProducts() {
    try {
      const data = await productService.getActiveProducts();
      products = data;
    } catch (error: any) {
      console.error('Ошибка загрузки продуктов:', error);
      toastStore.error(error.message || 'Не удалось загрузить продукты');
    }
  }

  async function loadProductAnalytics() {
    if (!selectedProductId) return;

    try {
      // В реальном приложении здесь будет вызов API для получения аналитических данных
      // Пока используем моковые данные для демонстрации
      const mockPriceHistory: PriceHistory[] = [
        { date: '2024-01-01', price: 85.00, supplier: 'Пятерочка' },
        { date: '2024-01-15', price: 87.50, supplier: 'Магнит' },
        { date: '2024-02-01', price: 89.90, supplier: 'Пятерочка' },
        { date: '2024-02-15', price: 92.00, supplier: 'Ашан' },
        { date: '2024-03-01', price: 88.00, supplier: 'Магнит' },
        { date: '2024-03-15', price: 91.50, supplier: 'Пятерочка' },
      ];
      
      const mockStats: ProductStats = {
        averagePrice: 89.15,
        minPrice: 85.00,
        maxPrice: 92.00,
        priceVariation: 7.82,
        suppliersCount: 3,
        lastUpdateDate: '2024-03-15'
      };
      
      priceHistory = mockPriceHistory;
      productStats = mockStats;
    } catch (error: any) {
      console.error('Ошибка загрузки аналитики:', error);
      toastStore.error(error.message || 'Не удалось загрузить аналитику');
    }
  }

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ru-RU');
  }

  function handleClose() {
    isOpen = false;
    selectedProductId = null;
    priceHistory = [];
    productStats = null;
    searchTerm = '';
    dispatch('close');
  }
</script>

<Modal bind:isOpen title="Аналитика по продуктам" size="extra-large" onclose={handleClose}>
  <div class="space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="md:col-span-2">
        <label for="product-search" class="block text-sm font-medium text-gray-700 mb-1">
          Выберите продукт
        </label>
        <div class="space-y-2">
          <Input
            id="product-search"
            placeholder="Поиск продуктов..."
            bind:value={searchTerm}
          />
          <select
            bind:value={selectedProductId}
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value={null}>Выберите продукт</option>
            {#each filteredProducts as product}
              <option value={product.product_id}>
                {product.product_name} {product.category_name ? `(${product.category_name})` : ''}
              </option>
            {/each}
          </select>
        </div>
      </div>
      
      <div>
        <label for="date-range" class="block text-sm font-medium text-gray-700 mb-1">
          Период
        </label>
        <select
          id="date-range"
          bind:value={dateRange}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="week">Неделя</option>
          <option value="month">Месяц</option>
          <option value="quarter">Квартал</option>
          <option value="year">Год</option>
        </select>
      </div>
    </div>

    {#if selectedProduct && productStats}
      <Card title={`Анализ: ${selectedProduct.product_name}`}>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-blue-50 p-4 rounded-lg">
            <div class="flex items-center">
              <BarChart3 class="h-8 w-8 text-blue-600" />
              <div class="ml-3">
                <div class="text-sm font-medium text-blue-600">Средняя цена</div>
                <div class="text-2xl font-bold text-blue-900">
                  {formatPrice(productStats.averagePrice)}
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-green-50 p-4 rounded-lg">
            <div class="flex items-center">
              <TrendingDown class="h-8 w-8 text-green-600" />
              <div class="ml-3">
                <div class="text-sm font-medium text-green-600">Мин. цена</div>
                <div class="text-2xl font-bold text-green-900">
                  {formatPrice(productStats.minPrice)}
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-red-50 p-4 rounded-lg">
            <div class="flex items-center">
              <TrendingUp class="h-8 w-8 text-red-600" />
              <div class="ml-3">
                <div class="text-sm font-medium text-red-600">Макс. цена</div>
                <div class="text-2xl font-bold text-red-900">
                  {formatPrice(productStats.maxPrice)}
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-purple-50 p-4 rounded-lg">
            <div class="flex items-center">
              <Store class="h-8 w-8 text-purple-600" />
              <div class="ml-3">
                <div class="text-sm font-medium text-purple-600">Поставщиков</div>
                <div class="text-2xl font-bold text-purple-900">
                  {productStats.suppliersCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="История цен">
        <div class="space-y-4">
          <!-- Простая визуализация истории цен без Recharts -->
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm text-gray-600 mb-4">
              История изменения цен за выбранный период
            </div>
            
            <!-- Таблица с историей цен -->
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Дата
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Цена
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Поставщик
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Изменение
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each priceHistory as entry, index}
                    <tr>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.date)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatPrice(entry.price)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.supplier}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        {#if index > 0}
                          {@const prevPrice = priceHistory[index - 1].price}
                          {@const change = entry.price - prevPrice}
                          {@const changePercent = ((change / prevPrice) * 100).toFixed(1)}
                          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {
                            change > 0 ? 'bg-red-100 text-red-800' : 
                            change < 0 ? 'bg-green-100 text-green-800' : 
                            'bg-gray-100 text-gray-800'
                          }">
                            {change > 0 ? '+' : ''}{formatPrice(change)} ({changePercent}%)
                          </span>
                        {:else}
                          <span class="text-gray-400">—</span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    {/if}

    {#if !selectedProduct}
      <div class="text-center py-12">
        <BarChart3 class="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <div class="text-xl font-medium text-gray-900 mb-2">
          Выберите продукт для анализа
        </div>
        <div class="text-gray-500">
          Выберите продукт из списка выше, чтобы увидеть подробную аналитику по ценам
        </div>
      </div>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <div class="flex justify-end">
      <Button variant="secondary" onclick={handleClose}>
        Закрыть
      </Button>
    </div>
  </svelte:fragment>
</Modal>