<script lang="ts">
  /**
   * Simple example demonstrating the validation system usage
   * This is a minimal example for reference and testing
   */
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import FormField from '$lib/components/ui/FormField.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import { AlertCircle, CheckCircle } from 'lucide-svelte';
  import { toastStore } from '$lib/stores/toast.store';
  
  // Import validation system
  import useFormValidation, { createFieldValidator, handleFormSubmissionError } from '$lib/hooks/useFormValidation';
  import { nomenclatureSchema, type NomenclatureFormData } from '$lib/validation/schemas';

  const dispatch = createEventDispatcher<{
    submit: { data: NomenclatureFormData };
    cancel: void;
  }>();

  // Form validation setup
  const initialFormValues: NomenclatureFormData = {
    nomenclature_name: '',
    nomenclature_type: 'EXPENSE',
    parent_id: null,
    nomenclature_order: 1,
    color: '#3B82F6',
    icon: 'shopping-cart',
    is_active: true,
  };

  // Mock async validation
  const asyncValidationRules = [
    {
      field: 'nomenclature_name' as keyof NomenclatureFormData,
      validator: async (value: string) => {
        if (!value || value.length < 3) return null;
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock validation - reject names starting with "error"
        if (value.toLowerCase().startsWith('error')) {
          return 'Название не может начинаться с "error"';
        }
        
        // Mock uniqueness check
        const existingNames = ['Продукты', 'Транспорт', 'Развлечения'];
        if (existingNames.includes(value)) {
          return 'Категория с таким названием уже существует';
        }
        
        return null;
      },
      debounceMs: 800,
    },
  ];

  // Form validation instance
  const formValidation = useFormValidation({
    schema: nomenclatureSchema,
    initialValues: initialFormValues,
    onSubmit: handleSubmit,
    validateOnChange: true,
    validateOnBlur: true,
  }, asyncValidationRules);

  // Field validator utilities
  const fieldValidator = createFieldValidator(formValidation);

  // Form state destructuring
  const { form, isValid, hasErrors, canSubmit, isSubmitting, isValidating } = formValidation;

  // Type options
  const typeOptions = [
    { value: 'INCOME', label: 'Доход' },
    { value: 'EXPENSE', label: 'Расход' }
  ];

  // Color options
  const colorOptions = [
    { value: '#3B82F6', label: 'Синий' },
    { value: '#10B981', label: 'Зеленый' },
    { value: '#EF4444', label: 'Красный' },
    { value: '#F59E0B', label: 'Оранжевый' },
    { value: '#8B5CF6', label: 'Фиолетовый' },
  ];

  // Icon options  
  const iconOptions = [
    { value: 'shopping-cart', label: 'Покупки' },
    { value: 'home', label: 'Дом' },
    { value: 'car', label: 'Транспорт' },
    { value: 'utensils', label: 'Еда' },
    { value: 'briefcase', label: 'Работа' },
  ];

  // Submit handler
  async function handleSubmit(formData: NomenclatureFormData) {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate random errors for demonstration
      if (Math.random() < 0.3) {
        throw new Error('Случайная ошибка сервера для демонстрации');
      }

      // Success
      toastStore.success('Успешно', 'Категория создана');
      dispatch('submit', { data: formData });
      
      // Reset form
      formValidation.resetForm();
    } catch (error: any) {
      // This will handle both validation errors and server errors
      handleFormSubmissionError(formValidation, error, 'nomenclature');
    }
  }

  // Cancel handler
  function handleCancel() {
    formValidation.resetForm();
    dispatch('cancel');
  }
</script>

<Card class="p-6 max-w-2xl mx-auto">
  <div class="space-y-4">
    <!-- Header -->
    <div class="text-center">
      <h2 class="text-2xl font-bold text-gray-900">Пример валидации формы</h2>
      <p class="text-gray-600 mt-2">
        Демонстрация системы валидации с Zod и svelte-forms-lib
      </p>
    </div>

    <!-- Form Status Indicator -->
    <div class="flex items-center justify-center gap-4 text-sm">
      <div class="flex items-center gap-2">
        {#if $isValid}
          <CheckCircle class="h-4 w-4 text-green-500" />
          <span class="text-green-700">Форма валидна</span>
        {:else}
          <AlertCircle class="h-4 w-4 text-red-500" />
          <span class="text-red-700">Есть ошибки</span>
        {/if}
      </div>
      
      {#if $isValidating}
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-blue-700">Проверка...</span>
        </div>
      {/if}
    </div>

    <!-- Form -->
    <form on:submit|preventDefault={formValidation.submitForm} class="space-y-4">
      <!-- Name Field -->
      <FormField
        label="Название категории"
        name="nomenclature_name"
        required={true}
        error={fieldValidator.getFieldError('nomenclature_name')}
        isValidating={$isValidating}
        helpText="Введите уникальное название (минимум 3 символа). Попробуйте начать с 'error' для демонстрации ошибки."
      >
        <Input
          bind:value={$form.nomenclature_name}
          placeholder="Например: Продукты питания"
          hasError={fieldValidator.hasFieldError('nomenclature_name')}
          disabled={$isSubmitting}
          on:blur={() => formValidation.validateField('nomenclature_name')}
        />
      </FormField>

      <!-- Type Field -->
      <FormField
        label="Тип категории"
        name="nomenclature_type"
        required={true}
        error={fieldValidator.getFieldError('nomenclature_type')}
        helpText="Выберите тип категории: доход или расход"
      >
        <Select
          bind:value={$form.nomenclature_type}
          options={typeOptions}
          placeholder="Выберите тип"
          hasError={fieldValidator.hasFieldError('nomenclature_type')}
          disabled={$isSubmitting}
        />
      </FormField>

      <!-- Order Field -->
      <FormField
        label="Порядок сортировки"
        name="nomenclature_order"
        required={true}
        error={fieldValidator.getFieldError('nomenclature_order')}
        helpText="Число для определения порядка отображения"
      >
        <Input
          type="number"
          bind:value={$form.nomenclature_order}
          min="1"
          hasError={fieldValidator.hasFieldError('nomenclature_order')}
          disabled={$isSubmitting}
        />
      </FormField>

      <!-- Color Field -->
      <FormField
        label="Цвет категории"
        name="color"
        error={fieldValidator.getFieldError('color')}
        helpText="Выберите цвет для визуального выделения"
      >
        <div class="flex items-center gap-2">
          <Select
            bind:value={$form.color}
            options={colorOptions}
            placeholder="Выберите цвет"
            hasError={fieldValidator.hasFieldError('color')}
            disabled={$isSubmitting}
            class="flex-1"
          />
          <div 
            class="w-8 h-8 rounded border-2 border-gray-300"
            style="background-color: {$form.color}"
          ></div>
        </div>
      </FormField>

      <!-- Icon Field -->
      <FormField
        label="Иконка категории"
        name="icon"
        error={fieldValidator.getFieldError('icon')}
        helpText="Выберите иконку для категории"
      >
        <Select
          bind:value={$form.icon}
          options={iconOptions}
          placeholder="Выберите иконку"
          hasError={fieldValidator.hasFieldError('icon')}
          disabled={$isSubmitting}
        />
      </FormField>

      <!-- Active Status -->
      <FormField
        label="Активная категория"
        name="is_active"
        variant="inline"
        helpText="Неактивные категории не отображаются в списке для выбора"
      >
        <input
          type="checkbox"
          bind:checked={$form.is_active}
          class="rounded"
          disabled={$isSubmitting}
        />
      </FormField>

      <!-- Server Error Display -->
      {#if fieldValidator.getFieldError('_form')}
        <div class="bg-red-50 border border-red-200 rounded-md p-3">
          <div class="flex">
            <AlertCircle class="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">
                Ошибка формы
              </h3>
              <div class="mt-1 text-sm text-red-700">
                {fieldValidator.getFieldError('_form')}
              </div>
            </div>
          </div>
        </div>
      {/if}

      <!-- Form Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t">
        <Button 
          variant="outline" 
          type="button"
          disabled={$isSubmitting}
          on:click={handleCancel}
        >
          Отмена
        </Button>
        
        <Button 
          type="submit"
          disabled={!$canSubmit}
          class="min-w-[140px]"
        >
          {#if $isSubmitting}
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Сохранение...
            </div>
          {:else}
            Создать категорию
          {/if}
        </Button>
      </div>
    </form>

    <!-- Debug Info (remove in production) -->
    <details class="mt-6 text-xs text-gray-500">
      <summary class="cursor-pointer font-medium">Debug Info</summary>
      <pre class="mt-2 p-2 bg-gray-100 rounded overflow-auto">{JSON.stringify({
        formData: $form,
        isValid: $isValid,
        hasErrors: $hasErrors,
        canSubmit: $canSubmit,
        isSubmitting: $isSubmitting,
        isValidating: $isValidating,
        errors: fieldValidator
      }, null, 2)}</pre>
    </details>
  </div>
</Card>