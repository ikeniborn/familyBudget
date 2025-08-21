<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
  export let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  
  let className = '';
  export { className as class };
  
  const variants = {
    default: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'text-foreground border border-gray-300'
  };
  
  $: badgeClass = twMerge(
    clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      variants[variant],
      className
    )
  );
</script>

<div class={badgeClass} {...$$restProps}>
  <slot />
</div>