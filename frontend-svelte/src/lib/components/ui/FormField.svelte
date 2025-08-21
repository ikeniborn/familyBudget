<script lang="ts">
  import { AlertCircle, Info, Loader2 } from 'lucide-svelte';
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
  // Props
  export let label: string = '';
  export let name: string = '';
  export let required: boolean = false;
  export let error: string | null = null;
  export let helpText: string = '';
  export let isValidating: boolean = false;
  export let variant: 'default' | 'inline' = 'default';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled: boolean = false;
  export let labelPosition: 'top' | 'left' | 'inside' = 'top';
  export let showOptional: boolean = true;
  
  // CSS classes
  let className = '';
  export { className as class };

  // Computed classes
  $: containerClass = twMerge(
    clsx(
      'form-field',
      {
        'space-y-1': variant === 'default' && labelPosition === 'top',
        'flex items-center gap-3': variant === 'inline' || labelPosition === 'left',
        'relative': labelPosition === 'inside',
        'opacity-50 pointer-events-none': disabled,
      },
      className
    )
  );

  $: labelClass = twMerge(
    clsx(
      'form-field__label',
      'font-medium text-gray-700',
      {
        'text-sm': size === 'sm',
        'text-base': size === 'md',
        'text-lg': size === 'lg',
        'block mb-1': labelPosition === 'top',
        'flex-shrink-0 w-24': labelPosition === 'left',
        'absolute left-3 top-3 bg-white px-1 text-xs text-gray-500 transition-all duration-200 pointer-events-none':
          labelPosition === 'inside',
      }
    )
  );

  $: contentClass = twMerge(
    clsx(
      'form-field__content',
      {
        'flex-1': labelPosition === 'left',
      }
    )
  );

  $: errorClass = twMerge(
    clsx(
      'form-field__error',
      'flex items-center gap-1 text-red-600 text-xs mt-1'
    )
  );

  $: helpClass = twMerge(
    clsx(
      'form-field__help',
      'flex items-center gap-1 text-gray-500 text-xs mt-1'
    )
  );

  $: validatingClass = twMerge(
    clsx(
      'form-field__validating',
      'flex items-center gap-1 text-blue-600 text-xs mt-1'
    )
  );

  // Generate unique ID for accessibility
  const fieldId = name || Math.random().toString(36).substring(2, 15);
  const errorId = `${fieldId}-error`;
  const helpId = `${fieldId}-help`;
</script>

<div class={containerClass}>
  <!-- Label -->
  {#if label}
    <label 
      for={fieldId} 
      class={labelClass}
      class:text-red-700={error}
    >
      {label}
      {#if required}
        <span class="text-red-500 ml-1" aria-label="обязательное поле">*</span>
      {:else if showOptional && labelPosition === 'top'}
        <span class="text-gray-400 ml-1 text-xs font-normal">(необязательно)</span>
      {/if}
    </label>
  {/if}

  <!-- Content container -->
  <div class={contentClass}>
    <!-- Field content slot -->
    <div class="form-field__input-container relative">
      <slot 
        {fieldId}
        {errorId}
        {helpId}
        {error}
        hasError={!!error}
        {isValidating}
      />
      
      <!-- Validation spinner -->
      {#if isValidating}
        <div class="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <Loader2 class="h-4 w-4 animate-spin text-blue-500" />
        </div>
      {/if}
    </div>

    <!-- Error message -->
    {#if error}
      <div 
        id={errorId}
        class={errorClass}
        role="alert"
        aria-live="polite"
      >
        <AlertCircle class="h-3 w-3 flex-shrink-0" />
        <span>{error}</span>
      </div>
    {/if}

    <!-- Validating message -->
    {#if isValidating && !error}
      <div class={validatingClass}>
        <Loader2 class="h-3 w-3 animate-spin flex-shrink-0" />
        <span>Проверка...</span>
      </div>
    {/if}

    <!-- Help text -->
    {#if helpText && !error}
      <div 
        id={helpId}
        class={helpClass}
      >
        <Info class="h-3 w-3 flex-shrink-0" />
        <span>{helpText}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .form-field {
    --form-field-border-color: theme('colors.gray.300');
    --form-field-focus-color: theme('colors.blue.500');
    --form-field-error-color: theme('colors.red.500');
  }

  /* Focus-within styles for better accessibility */
  .form-field:focus-within .form-field__label {
    color: var(--form-field-focus-color);
  }

  /* Error state styles */
  .form-field:has([aria-invalid="true"]) .form-field__label {
    color: var(--form-field-error-color);
  }

  /* Inside label styles */
  .form-field:has(.form-field__input-container input:focus) 
  .form-field__label[class*="inside"] {
    transform: translateY(-100%) scale(0.85);
    color: var(--form-field-focus-color);
  }

  .form-field:has(.form-field__input-container input:not(:placeholder-shown)) 
  .form-field__label[class*="inside"] {
    transform: translateY(-100%) scale(0.85);
  }

  /* Animation for inside labels */
  .form-field__label[class*="inside"] {
    transition: transform 0.2s ease-in-out, color 0.2s ease-in-out;
  }
</style>