<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { productService, type Product, type CreateProductData, type UpdateProductData } from '$lib/services/product.service';
  import { toastStore } from '$lib/stores/toast.store';
  import { Package, Tag, Ruler, ScanLine, FileText, Check, X } from 'lucide-svelte';

  export let product: Product | null = null;
  export let onCancel: (() => void) | null = null;

  const dispatch = createEventDispatcher<{
    success: void;
  }>();

  let isSubmitting = false;
  
  // Форма данных
  let formData = {
    name: product?.name || '',
    category: product?.category || '',
    unit: product?.unit || '',
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
    
    if (!formData.name.trim()) {
      errors.name = 'Наименование обязательно';
    }
    
    if (!formData.category) {
      errors.category = 'Выберите категорию';
    }
    
    if (!formData.unit) {
      errors.unit = 'Выберите единицу измерения';
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
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
          barcode: formData.barcode || undefined,
          description: formData.description || undefined,
          is_active: formData.is_active,
        };
        await productService.update(product.id, updateData);
        toastStore.success('Продукт обновлен');
      } else {
        // Создание нового продукта
        const createData: CreateProductData = {
          name: formData.name,
          category: formData.category,
          unit: formData.unit,
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
        name: '',
        category: '',
        unit: '',
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

<div class="product-form-container">
  <div class="form-header">
    <div class="header-icon">
      <Package class="h-8 w-8 text-white" />
    </div>
    <h2 class="form-title">
      {product ? 'Редактировать продукт' : 'Новый продукт'}
    </h2>
    <p class="form-subtitle">
      {product ? 'Измените информацию о продукте' : 'Заполните данные для добавления продукта'}
    </p>
  </div>

  <form on:submit={(e) => { e.preventDefault(); handleSubmit(); }} class="product-form">
    <div class="form-field">
      <div class="field-icon">
        <Package class="h-5 w-5" />
      </div>
      <div class="field-content">
        <label for="product_name" class="field-label">
          Наименование продукта <span class="required">*</span>
        </label>
        <input
          id="product_name"
          type="text"
          bind:value={formData.name}
          class="field-input"
          class:error={errors.name}
          placeholder="Например: Молоко 3.2%"
        />
        {#if errors.name}
          <p class="field-error">{errors.name}</p>
        {/if}
      </div>
    </div>

    <div class="form-row">
      <div class="form-field">
        <div class="field-icon">
          <Tag class="h-5 w-5" />
        </div>
        <div class="field-content">
          <label for="category" class="field-label">
            Категория <span class="required">*</span>
          </label>
          <select
            id="category"
            bind:value={formData.category}
            class="field-select"
            class:error={errors.category}
          >
            <option value="">Выберите категорию</option>
            {#each categoryOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if errors.category}
            <p class="field-error">{errors.category}</p>
          {/if}
        </div>
      </div>

      <div class="form-field">
        <div class="field-icon">
          <Ruler class="h-5 w-5" />
        </div>
        <div class="field-content">
          <label for="unit_measure" class="field-label">
            Единица измерения <span class="required">*</span>
          </label>
          <select
            id="unit_measure"
            bind:value={formData.unit}
            class="field-select"
            class:error={errors.unit}
          >
            <option value="">Выберите единицу</option>
            {#each unitOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
          {#if errors.unit}
            <p class="field-error">{errors.unit}</p>
          {/if}
        </div>
      </div>
    </div>

    <div class="form-field">
      <div class="field-icon">
        <ScanLine class="h-5 w-5" />
      </div>
      <div class="field-content">
        <label for="barcode" class="field-label">
          Штрихкод
        </label>
        <input
          id="barcode"
          type="text"
          bind:value={formData.barcode}
          class="field-input"
          placeholder="Введите штрихкод продукта"
        />
      </div>
    </div>

    <div class="form-field">
      <div class="field-icon">
        <FileText class="h-5 w-5" />
      </div>
      <div class="field-content">
        <label for="description" class="field-label">
          Описание
        </label>
        <textarea
          id="description"
          bind:value={formData.description}
          rows="3"
          class="field-textarea"
          placeholder="Добавьте описание продукта..."
        />
      </div>
    </div>

    <div class="form-checkbox">
      <input
        type="checkbox"
        id="is_active"
        bind:checked={formData.is_active}
        class="checkbox-input"
      />
      <label for="is_active" class="checkbox-label">
        <Check class="h-4 w-4" />
        Активный продукт
      </label>
    </div>

    <div class="form-actions">
      <button
        type="submit"
        disabled={isSubmitting}
        class="btn-primary"
      >
        {#if isSubmitting}
          <div class="spinner" />
          Сохранение...
        {:else}
          <Check class="h-5 w-5" />
          {product ? 'Обновить' : 'Добавить'}
        {/if}
      </button>
      <button
        type="button"
        on:click={handleCancel}
        disabled={isSubmitting}
        class="btn-secondary"
      >
        <X class="h-5 w-5" />
        {onCancel ? 'Отмена' : 'Очистить'}
      </button>
    </div>
  </form>
</div>

<style>
  .product-form-container {
    @apply relative overflow-hidden rounded-2xl;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  }

  .form-header {
    @apply relative p-8 text-center text-white;
    background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%);
  }

  .header-icon {
    @apply inline-flex items-center justify-center w-16 h-16 rounded-full mx-auto mb-4;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    backdrop-filter: blur(10px);
  }

  .form-title {
    @apply text-3xl font-bold mb-2;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .form-subtitle {
    @apply text-white/80;
  }

  .product-form {
    @apply bg-white p-8 space-y-6;
  }

  .form-row {
    @apply grid grid-cols-1 md:grid-cols-2 gap-6;
  }

  .form-field {
    @apply flex gap-4;
  }

  .field-icon {
    @apply flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center mt-6;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .field-content {
    @apply flex-1;
  }

  .field-label {
    @apply block text-sm font-semibold text-gray-700 mb-2;
  }

  .required {
    @apply text-red-500;
  }

  .field-input,
  .field-select,
  .field-textarea {
    @apply w-full px-4 py-3 rounded-lg border-2 border-gray-200 transition-all duration-200;
    @apply focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 focus:outline-none;
    @apply hover:border-gray-300;
  }

  .field-input::placeholder,
  .field-textarea::placeholder {
    @apply text-gray-400;
  }

  .field-input.error,
  .field-select.error {
    @apply border-red-300 focus:border-red-500 focus:ring-red-500/20;
  }

  .field-error {
    @apply mt-1 text-sm text-red-600 flex items-center gap-1;
  }

  .form-checkbox {
    @apply flex items-center gap-3 p-4 rounded-lg;
    background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  }

  .checkbox-input {
    @apply w-5 h-5 rounded border-2 border-gray-300 text-purple-600;
    @apply focus:ring-4 focus:ring-purple-500/20;
  }

  .checkbox-label {
    @apply flex items-center gap-2 text-gray-700 font-medium cursor-pointer;
  }

  .form-actions {
    @apply flex gap-4 pt-6 border-t border-gray-200;
  }

  .btn-primary,
  .btn-secondary {
    @apply flex-1 px-6 py-3 rounded-lg font-semibold transition-all duration-200;
    @apply flex items-center justify-center gap-2;
  }

  .btn-primary {
    @apply text-white;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  .btn-primary:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .btn-secondary {
    @apply bg-gray-100 text-gray-700 hover:bg-gray-200;
  }

  .btn-secondary:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .btn-secondary:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .spinner {
    @apply w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin;
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

  .form-field {
    animation: fadeIn 0.3s ease-out;
  }

  .form-field:nth-child(2) { animation-delay: 0.1s; }
  .form-field:nth-child(3) { animation-delay: 0.2s; }
  .form-field:nth-child(4) { animation-delay: 0.3s; }
  .form-field:nth-child(5) { animation-delay: 0.4s; }
</style>