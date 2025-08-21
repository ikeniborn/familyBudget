<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: rowClass = twMerge(
    clsx(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )
  );
</script>

<tr class={rowClass} {...$$restProps}>
  <slot />
</tr>