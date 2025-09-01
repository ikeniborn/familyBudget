<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { productService, type Product } from '$lib/services/product.service';
  import { nomenclaturesService, type CreateNomenclatureData } from '$lib/services/nomenclatures.service';
  import { toastStore } from '$lib/stores/toast.store';
  import { authStore } from '$lib/stores/auth.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Loading from '$lib/components/common/Loading.svelte';
  import { Link, Unlink, Plus, Search } from 'lucide-svelte';
  import type { Nomenclature } from '$types';

  export let isOpen = false;

  const dispatch = createEventDispatcher<{
    close: void;
    success: void;
  }>();

  interface ProductNomenclature {
    product_id: number;
    product_name: string;
    category_name?: string;
    nomenclature_id?: number;
    nomenclature_name?: string;
  }

  let products: ProductNomenclature[] = [];
  let nomenclatures: Nomenclature[] = [];
  let filteredProducts: ProductNomenclature[] = [];
  let isLoading = false;
  let searchTerm = '';
  let filterLinked: 'all' | 'linked' | 'unlinked' = 'all';
  let selectedNomenclature: { [key: number]: number } = {};
  let isUpdating = false;
  let dataLoaded = false;

  // Загружаем данные только когда диалог действительно открывается
  $: if (isOpen && !dataLoaded) {
    loadData();
    dataLoaded = true;
  }

  // Сбрасываем данные при закрытии
  $: if (!isOpen && dataLoaded) {
    dataLoaded = false;
    products = [];
    nomenclatures = [];
    filteredProducts = [];
    searchTerm = '';
    filterLinked = 'all';
    selectedNomenclature = {};
  }

  // Применение фильтров
  $: {
    let filtered = [...products];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.product_name.toLowerCase().includes(searchLower) ||
        product.category_name?.toLowerCase().includes(searchLower) ||
        product.nomenclature_name?.toLowerCase().includes(searchLower)
      );
    }

    if (filterLinked === 'linked') {
      filtered = filtered.filter(product => product.nomenclature_id);
    } else if (filterLinked === 'unlinked') {
      filtered = filtered.filter(product => !product.nomenclature_id);
    }

    filteredProducts = filtered;
  }

  async function loadData() {
    try {
      isLoading = true;
      
      const [productsData, nomenclaturesData] = await Promise.all([
        productService.getAll(),
        nomenclaturesService.getByUserId($authStore.user?.user_id || 0)
      ]);

      // Получаем связи продуктов с номенклатурой
      const productsWithLinks: ProductNomenclature[] = await Promise.all(
        productsData.map(async (product) => {
          try {
            // TODO: Реализовать API endpoint для получения связи продукт-номенклатура
            // const links = await productService.getLinkedNomenclatures(product.product_id!);
            return {
              product_id: product.product_id!,
              product_name: product.product_name,
              category_name: product.category_name,
              nomenclature_id: undefined, // links[0]?.nomenclature_id
              nomenclature_name: undefined, // links[0]?.nomenclature_name
            };
          } catch (error) {
            return {
              product_id: product.product_id!,
              product_name: product.product_name,
              category_name: product.category_name,
            };
          }
        })
      );

      products = productsWithLinks;
      nomenclatures = nomenclaturesData;
    } catch (error: any) {
      console.error('Ошибка загрузки данных:', error);
      toastStore.error(error.message || 'Не удалось загрузить данные');
    } finally {
      isLoading = false;
    }
  }

  async function handleLinkProduct(productId: number, nomenclatureId: number) {
    try {
      isUpdating = true;
      
      // TODO: Реализовать API endpoint для создания связи
      // await productService.linkToNomenclature(productId, nomenclatureId);
      
      // Обновляем локальное состояние
      products = products.map(product => {
        if (product.product_id === productId) {
          const nomenclature = nomenclatures.find(n => n.nomenclature_id === nomenclatureId);
          return {
            ...product,
            nomenclature_id: nomenclatureId,
            nomenclature_name: nomenclature?.nomenclature_name
          };
        }
        return product;
      });
      
      toastStore.success('Продукт привязан к номенклатуре');
    } catch (error: any) {
      console.error('Ошибка привязки:', error);
      toastStore.error(error.message || 'Не удалось привязать продукт');
    } finally {
      isUpdating = false;
    }
  }

  async function handleUnlinkProduct(productId: number) {
    try {
      isUpdating = true;
      
      // TODO: Реализовать API endpoint для удаления связи
      // await productService.unlinkFromNomenclature(productId);
      
      // Обновляем локальное состояние
      products = products.map(product => {
        if (product.product_id === productId) {
          return {
            ...product,
            nomenclature_id: undefined,
            nomenclature_name: undefined
          };
        }
        return product;
      });
      
      toastStore.success('Привязка к номенклатуре удалена');
    } catch (error: any) {
      console.error('Ошибка отвязки:', error);
      toastStore.error(error.message || 'Не удалось отвязать продукт');
    } finally {
      isUpdating = false;
    }
  }

  async function handleCreateNomenclature(productId: number) {
    const product = products.find(p => p.product_id === productId);
    if (!product || !$authStore.user) return;

    try {
      isUpdating = true;
      
      // Создаем новую номенклатуру на основе продукта
      const newNomenclatureData: CreateNomenclatureData = {
        nomenclature_name: product.product_name,
        bill_name: product.category_name || 'Прочие расходы',
        account_name: product.category_name || 'Прочие',
        operation_name: 'Расход',
        is_fact: true,
        user_id: $authStore.user.user_id
      };
      
      const created = await nomenclaturesService.create(newNomenclatureData);
      
      // Добавляем новую номенклатуру в список
      nomenclatures = [...nomenclatures, created];
      
      // Автоматически привязываем продукт к созданной номенклатуре
      await handleLinkProduct(productId, created.nomenclature_id);
      
      toastStore.success('Создана новая номенклатура и привязан продукт');
    } catch (error: any) {
      console.error('Ошибка создания номенклатуры:', error);
      toastStore.error(error.message || 'Не удалось создать номенклатуру');
    } finally {
      isUpdating = false;
    }
  }

  async function handleBatchLink() {
    const linksToCreate = Object.entries(selectedNomenclature)
      .filter(([_, nomenclatureId]) => nomenclatureId > 0);
    
    if (linksToCreate.length === 0) {
      toastStore.error('Выберите номенклатуру для привязки');
      return;
    }

    try {
      isUpdating = true;
      
      await Promise.all(
        linksToCreate.map(([productId, nomenclatureId]) => 
          handleLinkProduct(parseInt(productId), nomenclatureId)
        )
      );
      
      selectedNomenclature = {};
      toastStore.success(`Привязано ${linksToCreate.length} продуктов`);
    } catch (error: any) {
      console.error('Ошибка массовой привязки:', error);
      toastStore.error(error.message || 'Не удалось выполнить массовую привязку');
    } finally {
      isUpdating = false;
    }
  }

  function handleClose() {
    selectedNomenclature = {};
    searchTerm = '';
    filterLinked = 'all';
    dataLoaded = false;
    dispatch('close');
  }
</script>

<Modal isOpen={isOpen} title="Привязка продуктов к номенклатуре" size="extra-large" on:close={handleClose}>
  {#if isLoading}
    <div class="flex items-center justify-center py-12">
      <Loading />
      <span class="ml-2">Загрузка данных...</span>
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Фильтры -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Поиск продуктов..."
            bind:value={searchTerm}
            class="pl-10"
          />
        </div>
        
        <select
          bind:value={filterLinked}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          <option value="all">Все продукты</option>
          <option value="linked">Привязанные</option>
          <option value="unlinked">Не привязанные</option>
        </select>

        <div class="flex gap-2">
          <Button
            onclick={handleBatchLink}
            disabled={isUpdating || Object.keys(selectedNomenclature).length === 0}
            class="flex-1"
          >
            <Link class="h-4 w-4 mr-1" />
            Привязать выбранные
          </Button>
        </div>
      </div>

      <!-- Статистика -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg">
          <div class="text-2xl font-bold text-blue-600">{products.length}</div>
          <div class="text-sm text-blue-600">Всего продуктов</div>
        </div>
        <div class="bg-green-50 p-4 rounded-lg">
          <div class="text-2xl font-bold text-green-600">
            {products.filter(p => p.nomenclature_id).length}
          </div>
          <div class="text-sm text-green-600">Привязано</div>
        </div>
        <div class="bg-orange-50 p-4 rounded-lg">
          <div class="text-2xl font-bold text-orange-600">
            {products.filter(p => !p.nomenclature_id).length}
          </div>
          <div class="text-sm text-orange-600">Не привязано</div>
        </div>
      </div>

      <!-- Таблица продуктов -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Продукт
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Категория
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Текущая номенклатура
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Выбрать номенклатуру
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
                  <div class="font-medium text-gray-900">
                    {product.product_name}
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.category_name || '—'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  {#if product.nomenclature_name}
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <Link class="h-3 w-3 mr-1" />
                      {product.nomenclature_name}
                    </span>
                  {:else}
                    <span class="text-gray-400">Не привязан</span>
                  {/if}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <select
                    bind:value={selectedNomenclature[product.product_id]}
                    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm min-w-[200px]"
                  >
                    <option value={undefined}>Выберите номенклатуру</option>
                    {#each nomenclatures as nom}
                      <option value={nom.nomenclature_id}>
                        {nom.nomenclature_name}
                      </option>
                    {/each}
                  </select>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div class="flex space-x-2">
                    {#if product.nomenclature_id}
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => handleUnlinkProduct(product.product_id)}
                        disabled={isUpdating}
                        class="text-red-600 hover:text-red-700"
                      >
                        <Unlink class="h-4 w-4" />
                      </Button>
                    {:else}
                      {#if selectedNomenclature[product.product_id]}
                        <Button
                          variant="secondary"
                          size="sm"
                          onclick={() => handleLinkProduct(
                            product.product_id, 
                            selectedNomenclature[product.product_id]
                          )}
                          disabled={isUpdating}
                        >
                          <Link class="h-4 w-4" />
                        </Button>
                      {/if}
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => handleCreateNomenclature(product.product_id)}
                        disabled={isUpdating}
                        title="Создать новую номенклатуру"
                      >
                        <Plus class="h-4 w-4" />
                      </Button>
                    {/if}
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
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <div class="flex justify-end">
      <Button variant="secondary" onclick={handleClose}>
        Закрыть
      </Button>
    </div>
  </svelte:fragment>
</Modal>