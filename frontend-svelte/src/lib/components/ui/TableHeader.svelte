<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: headerClass = twMerge(
    clsx('[&_tr]:border-b', className)
  );
</script>

<thead class={headerClass} {...$$restProps}>
  <slot />
</thead>