<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  interface Props {
    type?: string;
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    id?: string | undefined;
    name?: string | undefined;
    hasError?: boolean;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    [key: string]: any; // For rest props
  }

  export let type: string = 'text';
  export let placeholder: string = '';
  export let value: string = '';
  export let disabled: boolean = false;
  export let required: boolean = false;
  export let readonly: boolean = false;
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;
  export let hasError: boolean = false;
  export let size: Props['size'] = 'md';
  let className: string = '';
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

<input
  {type}
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
  {...$$restProps}
/>