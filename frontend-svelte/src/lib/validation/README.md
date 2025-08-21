# Form Validation System

Comprehensive form validation system for the SvelteKit frontend using **zod** for schema validation and **svelte-forms-lib** for form state management.

## Features

- ✅ **Client-side validation** with Zod schemas
- ✅ **Async validation** with debounced API calls
- ✅ **Real-time field validation** on change/blur
- ✅ **Server error mapping** to form fields
- ✅ **Russian error messages** by default
- ✅ **Type-safe** form data with TypeScript
- ✅ **Accessible** form components with ARIA support
- ✅ **Loading states** and visual feedback
- ✅ **Retry logic** for network errors

## Quick Start

### 1. Import Validation Components

```typescript
import useFormValidation, { createFieldValidator } from '$lib/hooks/useFormValidation';
import { nomenclatureSchema, type NomenclatureFormData } from '$lib/validation/schemas';
import FormField from '$lib/components/ui/FormField.svelte';
```

### 2. Set Up Form Validation

```typescript
const initialValues: NomenclatureFormData = {
  nomenclature_name: '',
  nomenclature_type: 'EXPENSE',
  parent_id: null,
  nomenclature_order: 1,
  is_active: true,
};

// Optional async validation rules
const asyncValidationRules = [
  {
    field: 'nomenclature_name' as keyof NomenclatureFormData,
    validator: async (value: string, values: NomenclatureFormData) => {
      if (!value || value.length < 3) return null;
      
      const isUnique = await checkUniqueName(value);
      return isUnique ? null : 'Название уже используется';
    },
    debounceMs: 800,
  },
];

const formValidation = useFormValidation({
  schema: nomenclatureSchema,
  initialValues,
  onSubmit: handleSubmit,
  validateOnChange: true,
  validateOnBlur: true,
}, asyncValidationRules);

const fieldValidator = createFieldValidator(formValidation);
const { form, isValid, canSubmit, isSubmitting, isValidating } = formValidation;
```

### 3. Create Form with Validation

```svelte
<form on:submit|preventDefault={formValidation.submitForm}>
  <!-- Name Field -->
  <FormField
    label="Название категории"
    name="nomenclature_name"
    required={true}
    error={fieldValidator.getFieldError('nomenclature_name')}
    isValidating={$isValidating}
    helpText="Введите уникальное название (минимум 3 символа)"
  >
    <Input
      bind:value={$form.nomenclature_name}
      placeholder="Введите название"
      hasError={fieldValidator.hasFieldError('nomenclature_name')}
      disabled={$isSubmitting}
      on:blur={() => formValidation.validateField('nomenclature_name')}
    />
  </FormField>

  <!-- Type Field -->
  <FormField
    label="Тип"
    name="nomenclature_type"
    required={true}
    error={fieldValidator.getFieldError('nomenclature_type')}
  >
    <Select
      bind:value={$form.nomenclature_type}
      options={[
        { value: 'INCOME', label: 'Доход' },
        { value: 'EXPENSE', label: 'Расход' }
      ]}
      placeholder="Выберите тип"
      hasError={fieldValidator.hasFieldError('nomenclature_type')}
      disabled={$isSubmitting}
    />
  </FormField>

  <!-- Submit Button -->
  <Button 
    type="submit"
    disabled={!$canSubmit}
  >
    {#if $isSubmitting}
      Сохранение...
    {:else}
      Сохранить
    {/if}
  </Button>
</form>
```

### 4. Handle Form Submission

```typescript
import { handleFormSubmissionError } from '$lib/hooks/useFormValidation';

async function handleSubmit(formData: NomenclatureFormData) {
  try {
    await nomenclatureService.create(formData);
    toastStore.success('Успешно', 'Категория создана');
    formValidation.resetForm();
  } catch (error: any) {
    handleFormSubmissionError(formValidation, error, 'nomenclature');
  }
}
```

## Available Schemas

### Core Entities

| Schema | Type | Description |
|--------|------|-------------|
| `nomenclatureSchema` | `NomenclatureFormData` | Budget categories |
| `financialCenterSchema` | `FinancialCenterFormData` | Financial centers (ЦФО) |
| `costCenterSchema` | `CostCenterFormData` | Cost centers (МВЗ) |
| `periodSchema` | `PeriodFormData` | Planning periods |
| `registrySchema` | `RegistryFormData` | Budget/fact entries |

### Support Schemas

| Schema | Type | Description |
|--------|------|-------------|
| `productSchema` | `ProductFormData` | Product catalog |
| `userSettingsSchema` | `UserSettingsFormData` | User preferences |
| `passwordSchema` | `PasswordFormData` | Password changes |
| `searchFilterSchema` | `SearchFilterFormData` | Search and filters |

## FormField Component

The `FormField` component provides a consistent wrapper for form inputs with built-in error handling, validation states, and accessibility features.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `''` | Field label |
| `name` | `string` | `''` | Field name for accessibility |
| `required` | `boolean` | `false` | Show required indicator |
| `error` | `string \| null` | `null` | Error message to display |
| `helpText` | `string` | `''` | Help text below field |
| `isValidating` | `boolean` | `false` | Show validation spinner |
| `variant` | `'default' \| 'inline'` | `'default'` | Layout variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `disabled` | `boolean` | `false` | Disable the field |
| `labelPosition` | `'top' \| 'left' \| 'inside'` | `'top'` | Label position |

### Usage Examples

```svelte
<!-- Basic field -->
<FormField label="Name" name="name" required>
  <Input bind:value={name} />
</FormField>

<!-- Field with error -->
<FormField 
  label="Email" 
  name="email" 
  error={emailError}
  helpText="We'll never share your email"
>
  <Input type="email" bind:value={email} hasError={!!emailError} />
</FormField>

<!-- Inline checkbox -->
<FormField label="Active" name="is_active" variant="inline">
  <input type="checkbox" bind:checked={isActive} />
</FormField>

<!-- Field with async validation -->
<FormField 
  label="Username" 
  name="username"
  isValidating={$isValidating}
  error={usernameError}
>
  <Input bind:value={username} hasError={!!usernameError} />
</FormField>
```

## Async Validation

Async validation allows you to validate fields against server data (e.g., checking uniqueness).

```typescript
const asyncValidationRules = [
  {
    field: 'nomenclature_name' as keyof NomenclatureFormData,
    validator: async (value: string, values: NomenclatureFormData) => {
      // Skip validation for short values
      if (!value || value.length < 3) return null;
      
      try {
        const isUnique = await nomenclatureService.checkUniqueName(
          value,
          editingItem?.id, // Exclude current item when editing
          authStore.user?.user_id
        );
        
        return isUnique ? null : 'Категория с таким названием уже существует';
      } catch (error) {
        return 'Ошибка проверки уникальности';
      }
    },
    debounceMs: 800, // Wait 800ms after user stops typing
  },
];
```

## Server Error Handling

The system automatically maps server validation errors to form fields and displays appropriate user feedback.

### Supported Error Formats

```typescript
// Field-specific errors
{
  "detail": {
    "nomenclature_name": "Название обязательно",
    "nomenclature_type": "Выберите тип"
  }
}

// General error message  
{
  "detail": "Категория с таким названием уже существует"
}

// Array of errors
{
  "errors": [
    {
      "field": "nomenclature_name",
      "message": "Название обязательно"
    }
  ]
}
```

### Error Mapping

Server field names are automatically mapped to form field names:

```typescript
const fieldMappings = {
  nomenclature: {
    'name': 'nomenclature_name',
    'type': 'nomenclature_type',
    'parent': 'parent_id',
    // ...
  }
};
```

## Validation Schema Examples

### Custom Validation Rules

```typescript
const customSchema = z.object({
  email: z.string()
    .email('Некорректный email')
    .refine(async (email) => {
      const exists = await checkEmailExists(email);
      return !exists;
    }, 'Email уже используется'),
    
  password: z.string()
    .min(8, 'Минимум 8 символов')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 
      'Должен содержать строчные, заглавные буквы и цифры'),
      
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});
```

### Conditional Validation

```typescript
const registrySchema = z.object({
  amount: z.number().positive(),
  row_type: z.enum(['plan', 'fact']),
  description: z.string().optional(),
}).refine((data) => {
  // Description required for large amounts
  if (data.amount > 100000 && !data.description) {
    return false;
  }
  return true;
}, {
  message: 'Описание обязательно для сумм свыше 100,000 ₽',
  path: ['description'],
});
```

## Best Practices

### 1. Form Structure

```svelte
<script>
  // Setup validation
  const formValidation = useFormValidation(config);
  const fieldValidator = createFieldValidator(formValidation);
  const { form, canSubmit, isSubmitting } = formValidation;

  // Submit handler
  async function handleSubmit(data) {
    try {
      await service.create(data);
      // Success handling
    } catch (error) {
      handleFormSubmissionError(formValidation, error, 'entity_type');
    }
  }
</script>

<form on:submit|preventDefault={formValidation.submitForm}>
  <!-- Form fields here -->
  
  <!-- Submit button -->
  <Button type="submit" disabled={!$canSubmit}>
    {#if $isSubmitting}Loading...{:else}Submit{/if}
  </Button>
</form>
```

### 2. Error Handling

- Use `handleFormSubmissionError` for automatic error mapping
- Always provide user-friendly error messages
- Show loading states during validation and submission
- Use toast notifications for server errors

### 3. Accessibility

- Always provide labels for form fields
- Use `FormField` component for consistent ARIA attributes
- Mark required fields clearly
- Provide helpful error messages and hints

### 4. Performance

- Use debounced async validation (500-1000ms)
- Only validate fields that need server checks
- Cache validation results when possible
- Use `validateOnBlur` for expensive validations

## Migration Guide

### From Manual Validation

**Before:**
```typescript
let formErrors = {};

function validateForm() {
  formErrors = {};
  
  if (!name) {
    formErrors.name = 'Name is required';
  }
  
  return Object.keys(formErrors).length === 0;
}

async function handleSubmit() {
  if (!validateForm()) return;
  
  try {
    await api.save(formData);
  } catch (error) {
    // Manual error handling
  }
}
```

**After:**
```typescript
const formValidation = useFormValidation({
  schema: mySchema,
  initialValues: initialData,
  onSubmit: handleSubmit,
});

async function handleSubmit(data) {
  try {
    await api.save(data);
  } catch (error) {
    handleFormSubmissionError(formValidation, error, 'my_entity');
  }
}
```

### Benefits

- ✅ Automatic client-side validation
- ✅ Type safety with TypeScript
- ✅ Consistent error handling
- ✅ Better user experience
- ✅ Less boilerplate code
- ✅ Built-in accessibility support