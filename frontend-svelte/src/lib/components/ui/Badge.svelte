<script lang="ts">
  import { cn } from '$lib/utils/cn';
  
  interface Props {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: any; // For rest props
  }

  export let variant: Props['variant'] = 'default';
  let className: string = '';
  export { className as class };
  
  $: badgeClasses = cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
    {
      'bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
      'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary', 
      'bg-destructive text-destructive-foreground hover:bg-destructive/80': variant === 'destructive',
      'text-foreground': variant === 'outline'
    },
    className
  );
</script>

<div class={badgeClasses} {...$$restProps}>
  <slot></slot>
</div>