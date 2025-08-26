<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  
  interface Props {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'accent' | 'warm' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: any; // For additional props passed via {...$$restProps}
  }

  export let variant: Props['variant'] = 'default';
  export let size: Props['size'] = 'default';
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let type: Props['type'] = 'button';
  export let href: string | undefined = undefined;
  let className: string = '';
  export { className as class };
  
  const variants = {
    default: 'bg-primary text-primary-foreground hover:opacity-90 focus-visible:ring-accent shadow-lg font-semibold',
    destructive: 'bg-destructive text-destructive-foreground hover:opacity-90 focus-visible:ring-destructive shadow-lg font-semibold',
    outline: 'border-2 border-primary bg-transparent hover:bg-primary hover:text-primary-foreground text-primary font-semibold',
    secondary: 'bg-secondary text-secondary-foreground hover:opacity-80 focus-visible:ring-accent shadow-md font-medium',
    accent: 'bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-primary shadow-lg font-semibold',
    warm: 'bg-warm-accent text-warm-accent-foreground hover:opacity-80 focus-visible:ring-accent shadow-md font-medium',
    ghost: 'hover:bg-secondary hover:text-secondary-foreground font-medium',
    link: 'text-accent underline-offset-4 hover:underline font-medium'
  };
  
  const sizes = {
    default: 'h-12 px-6 py-3',
    sm: 'h-10 px-4 py-2',
    lg: 'h-14 px-8 py-4',
    icon: 'h-12 w-12'
  };
  
  $: buttonClass = twMerge(
    clsx(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      variants[variant!],
      sizes[size!],
      className
    )
  );
</script>

{#if href && !disabled}
  <a {href} class={buttonClass} {...$$restProps}>
    {#if loading}
      <svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot></slot>
  </a>
{:else}
  <button {type} {disabled} class={buttonClass} {...$$restProps}>
    {#if loading}
      <svg class="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot></slot>
  </button>
{/if}