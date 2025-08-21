<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { createEventDispatcher, tick, onMount } from 'svelte';

  export let content: string = '';
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay: number = 300;
  export let hideDelay: number = 100;
  export let disabled: boolean = false;
  export let arrow: boolean = true;
  export let maxWidth: string = 'max-w-xs';
  export let offset: number = 8;
  export let trigger: 'hover' | 'click' | 'focus' = 'hover';
  export let interactive: boolean = false;

  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{
    show: void;
    hide: void;
  }>();

  let isVisible = false;
  let tooltipElement: HTMLDivElement;
  let triggerElement: HTMLElement;
  let showTimeout: number;
  let hideTimeout: number;
  let computedPosition = position;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2',
    bottom: 'top-full left-1/2 -translate-x-1/2',
    left: 'right-full top-1/2 -translate-y-1/2',
    right: 'left-full top-1/2 -translate-y-1/2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent'
  };

  const offsetClasses = {
    top: { marginBottom: `${offset}px` },
    bottom: { marginTop: `${offset}px` },
    left: { marginRight: `${offset}px` },
    right: { marginLeft: `${offset}px` }
  };

  function showTooltip() {
    if (disabled || !content) return;

    clearTimeout(hideTimeout);
    showTimeout = setTimeout(async () => {
      isVisible = true;
      dispatch('show');
      
      await tick();
      positionTooltip();
    }, delay);
  }

  function hideTooltip() {
    clearTimeout(showTimeout);
    hideTimeout = setTimeout(() => {
      isVisible = false;
      dispatch('hide');
    }, hideDelay);
  }

  function positionTooltip() {
    if (!tooltipElement || !triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const tooltipRect = tooltipElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };

    let finalPosition = position;

    // Check if tooltip fits in viewport and adjust position if needed
    switch (position) {
      case 'top':
        if (triggerRect.top - tooltipRect.height - offset < 0) {
          finalPosition = 'bottom';
        }
        break;
      case 'bottom':
        if (triggerRect.bottom + tooltipRect.height + offset > viewport.height) {
          finalPosition = 'top';
        }
        break;
      case 'left':
        if (triggerRect.left - tooltipRect.width - offset < 0) {
          finalPosition = 'right';
        }
        break;
      case 'right':
        if (triggerRect.right + tooltipRect.width + offset > viewport.width) {
          finalPosition = 'left';
        }
        break;
    }

    // Additional check for horizontal centering
    if ((finalPosition === 'top' || finalPosition === 'bottom')) {
      const tooltipLeft = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
      
      if (tooltipLeft < 0) {
        // Tooltip would be cut off on the left
        tooltipElement.style.left = '0px';
        tooltipElement.style.transform = 'translateX(0)';
      } else if (tooltipLeft + tooltipRect.width > viewport.width) {
        // Tooltip would be cut off on the right
        tooltipElement.style.left = 'auto';
        tooltipElement.style.right = '0px';
        tooltipElement.style.transform = 'translateX(0)';
      }
    }

    computedPosition = finalPosition;
  }

  function handleMouseEnter() {
    if (trigger === 'hover') {
      showTooltip();
    }
  }

  function handleMouseLeave() {
    if (trigger === 'hover' && !interactive) {
      hideTooltip();
    }
  }

  function handleClick() {
    if (trigger === 'click') {
      if (isVisible) {
        hideTooltip();
      } else {
        showTooltip();
      }
    }
  }

  function handleFocus() {
    if (trigger === 'focus') {
      showTooltip();
    }
  }

  function handleBlur() {
    if (trigger === 'focus') {
      hideTooltip();
    }
  }

  function handleTooltipMouseEnter() {
    if (interactive) {
      clearTimeout(hideTimeout);
    }
  }

  function handleTooltipMouseLeave() {
    if (interactive) {
      hideTooltip();
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (trigger === 'click' && isVisible) {
      if (tooltipElement && !tooltipElement.contains(event.target as Node) &&
          triggerElement && !triggerElement.contains(event.target as Node)) {
        hideTooltip();
      }
    }
  }

  function handleEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && isVisible) {
      hideTooltip();
    }
  }

  onMount(() => {
    // Find the trigger element (first child)
    triggerElement = tooltipElement?.parentElement?.firstElementChild as HTMLElement;
    
    if (triggerElement) {
      triggerElement.addEventListener('mouseenter', handleMouseEnter);
      triggerElement.addEventListener('mouseleave', handleMouseLeave);
      triggerElement.addEventListener('click', handleClick);
      triggerElement.addEventListener('focus', handleFocus);
      triggerElement.addEventListener('blur', handleBlur);
    }

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      if (triggerElement) {
        triggerElement.removeEventListener('mouseenter', handleMouseEnter);
        triggerElement.removeEventListener('mouseleave', handleMouseLeave);
        triggerElement.removeEventListener('click', handleClick);
        triggerElement.removeEventListener('focus', handleFocus);
        triggerElement.removeEventListener('blur', handleBlur);
      }
      
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  });

  $: tooltipClass = twMerge(
    clsx(
      'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md shadow-lg',
      'pointer-events-none',
      'transition-opacity duration-200',
      isVisible ? 'opacity-100' : 'opacity-0',
      positionClasses[computedPosition],
      maxWidth,
      interactive && 'pointer-events-auto',
      className
    )
  );

  $: arrowClass = twMerge(
    clsx(
      'absolute w-0 h-0 border-4',
      'border-gray-900',
      arrowClasses[computedPosition]
    )
  );
</script>

<svelte:window on:resize={positionTooltip} on:scroll={positionTooltip} />

<div class="relative inline-block">
  <slot />
  
  {#if content && !disabled}
    <div
      bind:this={tooltipElement}
      class={tooltipClass}
      style={offsetClasses[computedPosition]}
      role="tooltip"
      aria-hidden={!isVisible}
      on:mouseenter={handleTooltipMouseEnter}
      on:mouseleave={handleTooltipMouseLeave}
    >
      {content}
      
      {#if arrow}
        <div class={arrowClass}></div>
      {/if}
    </div>
  {/if}
</div>