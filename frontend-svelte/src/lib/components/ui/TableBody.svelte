<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: bodyClass = twMerge(
    clsx('[&_tr:last-child]:border-0', className)
  );
</script>

<tbody class={bodyClass} {...$$restProps}>
  <slot />
</tbody>