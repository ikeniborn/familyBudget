<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';

  let className = '';
  export { className as class };

  $: headClass = twMerge(
    clsx(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className
    )
  );
</script>

<th class={headClass} {...$$restProps}>
  <slot />
</th>