<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

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
      'flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors duration-200',
      // Size variants
      {
        'h-8 text-xs px-2': size === 'sm',
        'h-10 text-sm px-3': size === 'md',
        'h-12 text-base px-4': size === 'lg',
      },
      // Error/normal states
      {
        'border-gray-300 focus-visible:ring-blue-600 focus-visible:border-blue-500': !hasError,
        'border-red-300 focus-visible:ring-red-600 focus-visible:border-red-500 bg-red-50': hasError,
      },
      className
    )
  );
</script>

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