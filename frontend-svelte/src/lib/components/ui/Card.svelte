<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
  export let variant: 'default' | 'blue' | 'green' | 'red' | 'purple' = 'default';
  
  let className = '';
  export { className as class };
  
  const variants = {
    default: '',
    blue: 'border-l-4 border-l-blue-500',
    green: 'border-l-4 border-l-green-500',
    red: 'border-l-4 border-l-red-500',
    purple: 'border-l-4 border-l-purple-500'
  };
  
  $: cardClass = twMerge(
    clsx(
      'rounded-lg bg-white shadow-lg',
      variants[variant],
      className
    )
  );
</script>

<div class={cardClass} {...$$restProps}>
  <slot />
</div>