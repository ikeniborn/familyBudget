<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: tableClass = twMerge(
    clsx('w-full caption-bottom text-sm', className)
  );
</script>

<div class="relative w-full overflow-auto">
  <table class={tableClass} {...$$restProps}>
    <slot />
  </table>
</div>