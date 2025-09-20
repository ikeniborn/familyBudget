<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { Lock } from 'lucide-svelte';

  export let type: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search' | 'date' = 'text';
  export let placeholder = '';
  export let value: string | number = '';
  export let disabled = false;
  export let required = false;
  export let readonly = false;
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;
  export let hasError = false;
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let step: number | undefined = undefined;
  let className = '';
  export { className as class };

  $: inputClass = twMerge(
    clsx(
      'flex w-full rounded-md border text-sm ring-offset-background',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors duration-200',
      // Size variants with padding adjustment for readonly icon
      {
        'h-8 text-xs': size === 'sm',
        'h-10 text-sm': size === 'md',
        'h-12 text-base': size === 'lg',
      },
      // Padding variants (adjusted for readonly icon)
      {
        'px-2': size === 'sm' && !readonly,
        'pr-8 pl-2': size === 'sm' && readonly,
        'px-3': size === 'md' && !readonly,
        'pr-10 pl-3': size === 'md' && readonly,
        'px-4': size === 'lg' && !readonly,
        'pr-12 pl-4': size === 'lg' && readonly,
      },
      // State-specific styling
      {
        // Normal state
        'bg-white border-gray-300 focus-visible:ring-blue-600 focus-visible:border-blue-500': !hasError && !readonly && !disabled,
        // Error state
        'border-red-300 focus-visible:ring-red-600 focus-visible:border-red-500 bg-red-50': hasError && !readonly,
        // Readonly state - distinct from disabled
        'bg-gray-50 border-gray-200 text-gray-700 cursor-default focus-visible:ring-gray-400 focus-visible:border-gray-400': readonly && !disabled,
        // Disabled state
        'bg-gray-100 border-gray-200 text-gray-400': disabled,
        // Readonly + Error state
        'bg-red-25 border-red-200 text-gray-700': readonly && hasError,
      },
      className
    )
  );

  $: containerClass = twMerge(
    clsx(
      'relative w-full',
      className
    )
  );

  $: iconSize = size === 'sm' ? 14 : size === 'md' ? 16 : 18;
  $: iconPosition = size === 'sm' ? 'right-2' : size === 'md' ? 'right-3' : 'right-4';
</script>

<div class={containerClass}>
  {#if type === 'text'}
    <input
      type="text"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'password'}
    <input
      type="password"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'email'}
    <input
      type="email"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'number'}
    <input
      type="number"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      {step}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'tel'}
    <input
      type="tel"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'url'}
    <input
      type="url"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else if type === 'date'}
    <input
      type="date"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {:else}
    <input
      type="search"
      {placeholder}
      {disabled}
      {required}
      {readonly}
      {id}
      {name}
      bind:value
      class={inputClass}
      aria-invalid={hasError}
      aria-readonly={readonly}
      aria-describedby={hasError && id ? `${id}-error` : undefined}
      on:keydown
      on:keyup
      on:change
      on:input
      on:focus
      on:blur
      {...$$restProps}
    />
  {/if}

  <!-- Readonly indicator icon -->
  {#if readonly && !disabled}
    <div class="absolute {iconPosition} top-1/2 transform -translate-y-1/2 pointer-events-none">
      <Lock
        size={iconSize}
        class="text-gray-400"
        aria-hidden="true"
      />
    </div>
  {/if}
</div>