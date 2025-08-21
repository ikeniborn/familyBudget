<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
  export let variant: 'default' | 'navy' | 'sky' | 'beige' | 'steel' | 'elevated' = 'default';
  export let bordered: boolean = false;
  
  let className = '';
  export { className as class };
  
  const variants = {
    default: 'bg-card border-border',
    navy: 'border-l-4 border-l-navy bg-card',
    sky: 'border-l-4 border-l-sky bg-card',
    beige: 'border-l-4 border-l-beige bg-card',
    steel: 'border-l-4 border-l-steel bg-card',
    elevated: 'bg-card border-border shadow-xl'
  };
  
  $: cardClass = twMerge(
    clsx(
      'rounded-lg',
      bordered ? 'border' : '',
      variants[variant],
      variant === 'elevated' ? 'design-card elevated' : 'design-card',
      className
    )
  );
</script>

<div class={cardClass} {...$$restProps}>
  <slot />
</div>