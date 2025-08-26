<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  interface Props {
    class?: string;
    [key: string]: any;
  }

  let className: string = '';
  export { className as class };

  $: headerClass = twMerge(
    clsx('[&_tr]:border-b', className)
  );
</script>

<thead class={headerClass} {...$$restProps}>
  <slot></slot>
</thead>