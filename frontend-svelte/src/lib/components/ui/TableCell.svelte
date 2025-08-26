<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  interface Props {
    class?: string;
    [key: string]: any;
  }

  let className: string = '';
  export { className as class };

  $: cellClass = twMerge(
    clsx('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)
  );
</script>

<td class={cellClass} {...$$restProps}>
  <slot></slot>
</td>