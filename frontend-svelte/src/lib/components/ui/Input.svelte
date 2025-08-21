<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  export let type: string = 'text';
  export let placeholder: string = '';
  export let value: string = '';
  export let disabled: boolean = false;
  export let required: boolean = false;
  export let readonly: boolean = false;
  export let id: string | undefined = undefined;
  export let name: string | undefined = undefined;

  let className = '';
  export { className as class };

  $: inputClass = twMerge(
    clsx(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'border-gray-300 focus-visible:ring-blue-600',
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
  on:blur
  on:change
  on:click
  on:focus
  on:input
  on:keydown
  on:keypress
  on:keyup
  on:mouseenter
  on:mouseleave
  {...$$restProps}
/>