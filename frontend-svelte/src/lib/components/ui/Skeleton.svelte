<!--
  Skeleton component - плейсхолдер для загружающегося контента
  Адаптировано из React версии для использования в Svelte
-->
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  // Props
  export let className = '';
  export let width = '';
  export let height = '';
  export let circle = false;
  export let rounded = true;

  // Вычисляемые классы и стили
  $: skeletonClasses = cn(
    'animate-pulse bg-muted',
    {
      'rounded-md': rounded && !circle,
      'rounded-full': circle,
      'aspect-square': circle
    },
    className
  );

  $: styles = [
    width ? `width: ${width}` : '',
    height ? `height: ${height}` : '',
    circle && width ? `height: ${width}` : ''
  ].filter(Boolean).join('; ');
</script>

<div
  class={skeletonClasses}
  style={styles}
  aria-hidden="true"
  role="presentation"
/>

<style>
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>