<!--
  Checkbox component - компонент чекбокса с кастомным стилем
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { cn } from '$lib/utils/cn';

  // Props
  export let checked = false;
  export let disabled = false;
  export let indeterminate = false;
  export let id = '';
  export let name = '';
  export let value = '';
  export let className = '';
  export let label = '';

  const dispatch = createEventDispatcher<{
    change: { checked: boolean; value: string };
  }>();

  // Обработчик изменения
  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    checked = target.checked;
    dispatch('change', { checked, value });
  }

  // Вычисляемые классы
  $: checkboxClasses = cn(
    'peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
    className
  );
</script>

<div class="flex items-center space-x-2">
  <div class="relative">
    <input
      type="checkbox"
      bind:checked
      {disabled}
      {id}
      {name}
      {value}
      class="sr-only"
      on:change={handleChange}
    />
    
    <div
      class={checkboxClasses}
      data-state={checked ? 'checked' : 'unchecked'}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      tabindex={disabled ? -1 : 0}
      on:click={() => !disabled && (checked = !checked)}
      on:keydown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !disabled) {
          e.preventDefault();
          checked = !checked;
        }
      }}
    >
      {#if checked && !indeterminate}
        <!-- Check icon -->
        <svg
          class="h-4 w-4 text-current"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      {:else if indeterminate}
        <!-- Indeterminate icon -->
        <div class="h-0.5 w-2 bg-current" />
      {/if}
    </div>
  </div>

  {#if label}
    <label
      for={id}
      class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      class:cursor-pointer={!disabled}
    >
      {label}
    </label>
  {/if}

  <!-- Slot для кастомной метки -->
  <slot />
</div>