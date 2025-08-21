<!--
  TextArea component - многострочное текстовое поле
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { cn } from '$lib/utils/cn';

  // Props
  export let value = '';
  export let placeholder = '';
  export let rows = 3;
  export let cols: number | undefined = undefined;
  export let disabled = false;
  export let readonly = false;
  export let required = false;
  export let maxlength: number | undefined = undefined;
  export let minlength: number | undefined = undefined;
  export let resize: 'none' | 'vertical' | 'horizontal' | 'both' = 'vertical';
  export let className = '';
  export let id = '';
  export let name = '';
  export let autocomplete = '';
  export let spellcheck = true;

  // Styling props
  export let error = false;
  export let success = false;

  const dispatch = createEventDispatcher<{
    input: { value: string };
    change: { value: string };
    focus: FocusEvent;
    blur: FocusEvent;
    keydown: KeyboardEvent;
    keyup: KeyboardEvent;
  }>();

  let textareaElement: HTMLTextAreaElement;

  // Обработчики событий
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    value = target.value;
    dispatch('input', { value });
  }

  function handleChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    dispatch('change', { value: target.value });
  }

  function handleFocus(event: FocusEvent) {
    dispatch('focus', event);
  }

  function handleBlur(event: FocusEvent) {
    dispatch('blur', event);
  }

  function handleKeydown(event: KeyboardEvent) {
    dispatch('keydown', event);
  }

  function handleKeyup(event: KeyboardEvent) {
    dispatch('keyup', event);
  }

  // Автоматическое изменение высоты (опционально)
  export function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = textareaElement.scrollHeight + 'px';
    }
  }

  // Методы для внешнего управления
  export function focus() {
    textareaElement?.focus();
  }

  export function blur() {
    textareaElement?.blur();
  }

  export function select() {
    textareaElement?.select();
  }

  // Вычисляемые классы
  $: textareaClasses = cn(
    'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'transition-colors duration-200',
    {
      'border-destructive focus-visible:ring-destructive': error,
      'border-green-500 focus-visible:ring-green-500': success && !error,
      'resize-none': resize === 'none',
      'resize-y': resize === 'vertical',
      'resize-x': resize === 'horizontal',
      'resize': resize === 'both'
    },
    className
  );
</script>

<textarea
  bind:this={textareaElement}
  bind:value
  {placeholder}
  {rows}
  {cols}
  {disabled}
  {readonly}
  {required}
  {maxlength}
  {minlength}
  {id}
  {name}
  {autocomplete}
  {spellcheck}
  class={textareaClasses}
  on:input={handleInput}
  on:change={handleChange}
  on:focus={handleFocus}
  on:blur={handleBlur}
  on:keydown={handleKeydown}
  on:keyup={handleKeyup}
/>

<style>
  textarea {
    field-sizing: content;
  }
</style>