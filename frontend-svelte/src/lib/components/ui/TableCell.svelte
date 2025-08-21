<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: cellClass = twMerge(
    clsx('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)
  );
</script>

<td class={cellClass} {...$$restProps}>
  <slot />
</td>