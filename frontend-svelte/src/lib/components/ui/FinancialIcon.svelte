<script lang="ts">
  export let icon: string = '$';
  export let variant: 'navy' | 'sky' | 'beige' | 'steel' = 'sky';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  
  let className = '';
  export { className as class };
  
  const sizes = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-xl',
    lg: 'w-20 h-20 text-2xl'
  };
</script>

<div class="financial-icon {variant} {sizes[size]} {className}" {...$$restProps}>
  {icon}
</div>