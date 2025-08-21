<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { productService, type Product, type CreateProductData, type UpdateProductData } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  export let product: Product | null = null;
  export let onCancel: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    success: void;
  }>();

  let isSubmitting = false;
  
  // Форма данных
  let formData = {
    product_name: product?.product_name || '',
    category_name: product?.category_name || '',
    unit_measure: product?.unit_measure || '',
    barcode: product?.barcode || '',
    description: product?.description || '',
    is_active: product?.is_active ?? true
  };

  // Ошибки валидации
  let errors: { [key: string]: string } = {};

  const categoryOptions = [
    { value: 'Продукты питания', label: 'Продукты питания' },
    { value: 'Напитки', label: 'Напитки' },
    { value: 'Бытовая химия', label: 'Бытовая химия' },
    { value: 'Косметика', label: 'Косметика' },
    { value: 'Одежда', label: 'Одежда' },
    { value: 'Электроника', label: 'Электроника' },
    { value: 'Другое', label: 'Другое' },
  ];

  const unitOptions = [
    { value: 'шт', label: 'штуки' },
    { value: 'кг', label: 'килограммы' },
    { value: 'г', label: 'граммы' },
    { value: 'л', label: 'литры' },
    { value: 'мл', label: 'миллилитры' },
    { value: 'упак', label: 'упаковки' },
    { value: 'м', label: 'метры' },
    { value: 'см', label: 'сантиметры' },
  ];

  function validateForm() {
    errors = {};
    
    if (!formData.product_name.trim()) {
      errors.product_name = 'Наименование обязательно';
    }
    
    if (!formData.category_name) {
      errors.category_name = 'Выберите категорию';
    }
    
    if (!formData.unit_measure) {
      errors.unit_measure = 'Выберите единицу измерения';
    }

    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    isSubmitting = true;
    
    try {
      if (product) {
        // Обновление существующего продукта
        const updateData: UpdateProductData = {
          product_name: formData.product_name,
          category_name: formData.category_name,
          unit_measure: formData.unit_measure,
          barcode: formData.barcode || undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        };
        await productService.update(product.product_id!, updateData);
        toastStore.success('Продукт обновлен');
      } else {
        // Создание нового продукта
        const createData: CreateProductData = {
          product_name: formData.product_name,
          category_name: formData.category_name,
          unit_measure: formData.unit_measure,
          barcode: formData.barcode || undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        };
        await productService.create(createData);
        toastStore.success('Продукт добавлен');
      }
      
      resetForm();
      dispatch('success');
    } catch (error: any) {
      console.error('Ошибка при сохранении продукта:', error);
      toastStore.error(error.message || 'Не удалось сохранить продукт');
    } finally {
      isSubmitting = false;
    }
  }

  function resetForm() {
    if (!product) {
      formData = {
        product_name: '',
        category_name: '',
        unit_measure: '',
        barcode: '',
        description: '',
        is_active: true
      };
    }
    errors = {};
  }

  function handleCancel() {
    if (onCancel) {
      onCancel();
    } else {
      resetForm();
    }
  }
</script>

<Card title={product ? 'Редактировать продукт' : 'Добавить продукт'}>
  <form on:submit|preventDefault={handleSubmit} class="space-y-6">
    <Input
      label="Наименование продукта"
      bind:value={formData.product_name}
      error={errors.product_name}
      required
    />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label for="category" class="block text-sm font-medium text-gray-700 mb-1">
          Категория <span class="text-red-500">*</span>
        </label>
        <select
          id="category"
          bind:value={formData.category_name}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          class:border-red-500={errors.category_name}
        >
          <option value="">Выберите категорию</option>
          {#each categoryOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#if errors.category_name}
          <p class="mt-1 text-sm text-red-600">{errors.category_name}</p>
        {/if}
      </div>

      <div>
        <label for="unit_measure" class="block text-sm font-medium text-gray-700 mb-1">
          Единица измерения <span class="text-red-500">*</span>
        </label>
        <select
          id="unit_measure"
          bind:value={formData.unit_measure}
          class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          class:border-red-500={errors.unit_measure}
        >
          <option value="">Выберите единицу</option>
          {#each unitOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
        {#if errors.unit_measure}
          <p class="mt-1 text-sm text-red-600">{errors.unit_measure}</p>
        {/if}
      </div>
    </div>

    <Input
      label="Штрихкод"
      bind:value={formData.barcode}
      error={errors.barcode}
    />

    <div>
      <label for="description" class="block text-sm font-medium text-gray-700 mb-1">
        Описание
      </label>
      <textarea
        id="description"
        bind:value={formData.description}
        rows="3"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        class:border-red-500={errors.description}
      />
      {#if errors.description}
        <p class="mt-1 text-sm text-red-600">{errors.description}</p>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <input
        type="checkbox"
        id="is_active"
        bind:checked={formData.is_active}
        class="rounded border-gray-300"
      />
      <label for="is_active" class="text-sm font-medium text-gray-700">
        Активный продукт
      </label>
    </div>

    <div class="flex gap-3">
      <Button
        type="submit"
        disabled={isSubmitting}
        class="flex-1"
      >
        {isSubmitting 
          ? 'Сохранение...' 
          : product ? 'Обновить' : 'Добавить'
        }
      </Button>
      <Button
        type="button"
        variant="secondary"
        on:click={handleCancel}
        disabled={isSubmitting}
      >
        {onCancel ? 'Отмена' : 'Очистить'}
      </Button>
    </div>
  </form>
</Card>