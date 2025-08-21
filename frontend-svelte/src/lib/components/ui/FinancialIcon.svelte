<script lang="ts">
  import type { ComponentType } from 'svelte';
  
  export let icon: string | ComponentType = '$';
  export let variant: 'navy' | 'sky' | 'beige' | 'steel' = 'sky';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let geometric: boolean = false;
  
  let className = '';
  export { className as class };
  
  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16', 
    lg: 'w-20 h-20'
  };
  
  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };
  
  const variants = {
    navy: 'bg-gradient-to-br from-navy/10 to-navy/20 border border-navy/30 text-navy',
    sky: 'bg-gradient-to-br from-sky/10 to-sky/20 border border-sky/30 text-sky',
    beige: 'bg-gradient-to-br from-beige/10 to-beige/20 border border-beige/30 text-beige',
    steel: 'bg-gradient-to-br from-steel/10 to-steel/20 border border-steel/30 text-steel'
  };
  
  $: baseClasses = `${sizes[size]} ${variants[variant]} rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 ${geometric ? 'rotate-12' : ''} ${className}`;
</script>

<div class={baseClasses} {...$$restProps}>
  {#if typeof icon === 'string'}
    <span class="font-semibold">{icon}</span>
  {:else}
    <svelte:component this={icon} class={iconSizes[size]} />
  {/if}
  
  <!-- Geometric accent for special variants -->
  {#if geometric}
    <div class="absolute -top-1 -right-1 w-3 h-3 bg-{variant}/40 rounded-sm rotate-45"></div>
  {/if}
</div>

<style>
  .financial-icon {
    position: relative;
  }
</style>