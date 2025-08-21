<!--
  Label component - компонент метки для форм
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  // Props
  export let htmlFor = '';
  export let className = '';
  export let required = false;
  export let disabled = false;

  // Вычисляемые классы
  $: labelClasses = cn(
    'text-sm font-medium leading-none',
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    {
      'cursor-pointer': !disabled,
      'opacity-50 cursor-not-allowed': disabled
    },
    className
  );
</script>

<label
  for={htmlFor}
  class={labelClasses}
  class:disabled
>
  <slot />
  {#if required}
    <span class="text-destructive ml-1" aria-hidden="true">*</span>
  {/if}
</label>