<script lang="ts">
  import { cn } from '$lib/utils/cn';
  
  export let variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' = 'default';
  let className = '';
  export { className as class };
  
  $: badgeClasses = cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
      'bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
      'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary', 
      'bg-destructive text-destructive-foreground hover:bg-destructive/80': variant === 'destructive',
      'text-foreground': variant === 'outline',
      'bg-green-500 text-white hover:bg-green-600': variant === 'success',
      'bg-yellow-500 text-white hover:bg-yellow-600': variant === 'warning'
    },
    className
  );
</script>

<div class={badgeClasses} {...$$restProps}>
  <slot />
</div>