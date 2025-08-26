<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  interface Props {
    class?: string;
    [key: string]: any;
  }

  let className: string = '';
  export { className as class };

  $: bodyClass = twMerge(
    clsx('[&_tr:last-child]:border-0', className)
  ));
</script>

<tbody class={bodyClass} {...$$restProps}>
  <slot></slot>
</tbody>