<script lang="ts">
  import { clsx } from 'clsx';
  import { twMerge } from 'tailwind-merge';
  import { createEventDispatcher, tick } from 'svelte';
  import { ChevronDown, ChevronRight } from 'lucide-svelte';

  interface MenuItem {
    id: string;
    label: string;
    icon?: any; // Lucide icon component
    disabled?: boolean;
    separator?: boolean;
    action?: () => void;
    children?: MenuItem[];
  }

  export let items: MenuItem[] = [];
  export let disabled: boolean = false;
  export let placement: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' = 'bottom-start';
  export let offset: number = 4;
  export let closeOnClick: boolean = true;
  export let trigger: 'click' | 'hover' = 'click';

  let className = '';
  export { className as class };

  const dispatch = createEventDispatcher<{
    select: { item: MenuItem };
    open: void;
    close: void;
  }>();

  let isOpen = false;
  let dropdownElement: HTMLDivElement;
  let triggerElement: HTMLElement;
  let activeIndex = -1;
  let activeSubmenu: string | null = null;
  let submenuTimeouts: Map<string, number> = new Map();

  const placementClasses = {
    'bottom-start': 'top-full left-0',
    'bottom-end': 'top-full right-0',
    'top-start': 'bottom-full left-0',
    'top-end': 'bottom-full right-0'
  };

  function toggleDropdown() {
    if (disabled) return;
    
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  async function openDropdown() {
    isOpen = true;
    activeIndex = -1;
    dispatch('open');
    
    await tick();
    positionDropdown();
  }

  function closeDropdown() {
    isOpen = false;
    activeIndex = -1;
    activeSubmenu = null;
    clearAllSubmenuTimeouts();
    dispatch('close');
  }

  function positionDropdown() {
    if (!dropdownElement || !triggerElement) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const dropdownRect = dropdownElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Reset position classes
    dropdownElement.className = dropdownElement.className.replace(
      /(?:top|bottom|left|right)-\w+/g, ''
    );

    let finalPlacement = placement;

    // Check if dropdown fits in the viewport and adjust if needed
    if (placement.includes('bottom') && triggerRect.bottom + dropdownRect.height + offset > viewport.height) {
      finalPlacement = placement.replace('bottom', 'top') as typeof placement;
    }
    
    if (placement.includes('top') && triggerRect.top - dropdownRect.height - offset < 0) {
      finalPlacement = placement.replace('top', 'bottom') as typeof placement;
    }

    if (placement.includes('end') && triggerRect.right - dropdownRect.width < 0) {
      finalPlacement = finalPlacement.replace('end', 'start') as typeof placement;
    }

    if (placement.includes('start') && triggerRect.left + dropdownRect.width > viewport.width) {
      finalPlacement = finalPlacement.replace('start', 'end') as typeof placement;
    }

    dropdownElement.classList.add(...placementClasses[finalPlacement].split(' '));
  }

  function selectItem(item: MenuItem, event?: Event) {
    if (item.disabled || item.separator) return;

    if (item.action) {
      item.action();
    }

    dispatch('select', { item });

    if (closeOnClick && !item.children?.length) {
      closeDropdown();
    }

    event?.stopPropagation();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen || disabled) return;

    const focusableItems = items.filter(item => !item.disabled && !item.separator);

    switch (event.key) {
      case 'Escape':
        closeDropdown();
        event.preventDefault();
        break;
      case 'ArrowDown':
        activeIndex = activeIndex < focusableItems.length - 1 ? activeIndex + 1 : 0;
        event.preventDefault();
        break;
      case 'ArrowUp':
        activeIndex = activeIndex > 0 ? activeIndex - 1 : focusableItems.length - 1;
        event.preventDefault();
        break;
      case 'Enter':
      case ' ':
        if (activeIndex >= 0 && activeIndex < focusableItems.length) {
          selectItem(focusableItems[activeIndex]);
        }
        event.preventDefault();
        break;
      case 'ArrowRight':
        if (activeIndex >= 0 && focusableItems[activeIndex]?.children) {
          activeSubmenu = focusableItems[activeIndex].id;
        }
        event.preventDefault();
        break;
      case 'ArrowLeft':
        activeSubmenu = null;
        event.preventDefault();
        break;
    }
  }

  function handleMouseEnter(item: MenuItem) {
    if (trigger === 'hover' && !isOpen) {
      openDropdown();
    }

    if (item.children) {
      // Clear any existing timeout for this item
      const existingTimeout = submenuTimeouts.get(item.id);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        submenuTimeouts.delete(item.id);
      }

      // Set submenu active after a short delay
      const timeout = setTimeout(() => {
        activeSubmenu = item.id;
      }, 150);
      submenuTimeouts.set(item.id, timeout);
    } else {
      activeSubmenu = null;
      clearAllSubmenuTimeouts();
    }
  }

  function handleMouseLeave() {
    if (trigger === 'hover') {
      setTimeout(() => {
        if (!dropdownElement?.matches(':hover')) {
          closeDropdown();
        }
      }, 150);
    }

    clearAllSubmenuTimeouts();
  }

  function clearAllSubmenuTimeouts() {
    submenuTimeouts.forEach(timeout => clearTimeout(timeout));
    submenuTimeouts.clear();
  }

  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      closeDropdown();
    }
  }

  $: containerClass = twMerge(
    clsx(
      'relative inline-block',
      className
    )
  );

  $: triggerClass = twMerge(
    clsx(
      'inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
      'border border-gray-300 bg-white hover:bg-gray-50',
      'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      isOpen && 'bg-gray-50'
    )
  );

  $: dropdownClass = twMerge(
    clsx(
      'absolute z-50 min-w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg',
      'transform transition-all duration-200 origin-top',
      isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none',
      placementClasses[placement]
    )
  );

  $: submenuClass = twMerge(
    clsx(
      'absolute left-full top-0 z-10 min-w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg ml-1'
    )
  );
</script>

<svelte:window on:click={handleClickOutside} />

<div class={containerClass} on:keydown={handleKeydown}>
  <!-- Trigger -->
  <div class="relative">
    <button
      bind:this={triggerElement}
      type="button"
      class={triggerClass}
      {disabled}
      on:click={toggleDropdown}
      on:mouseenter={handleMouseEnter}
      on:mouseleave={handleMouseLeave}
    >
      <slot name="trigger">
        <span>Menu</span>
        <ChevronDown size={16} class={clsx('transition-transform duration-200', isOpen && 'rotate-180')} />
      </slot>
    </button>
  </div>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div 
      bind:this={dropdownElement}
      class={dropdownClass}
      style="margin-top: {offset}px;"
      role="menu"
      aria-orientation="vertical"
    >
      {#each items as item, index}
        {#if item.separator}
          <div class="my-1 h-px bg-gray-200" role="separator"></div>
        {:else}
          <div class="relative" on:mouseenter={() => handleMouseEnter(item)}>
            <button
              type="button"
              class={clsx(
                'flex w-full items-center gap-2 px-4 py-2 text-left text-sm',
                'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                item.disabled && 'cursor-not-allowed opacity-50',
                activeIndex === index && 'bg-gray-50'
              )}
              disabled={item.disabled}
              role="menuitem"
              on:click={(e) => selectItem(item, e)}
            >
              {#if item.icon}
                <svelte:component this={item.icon} size={16} />
              {/if}
              
              <span class="flex-1">{item.label}</span>
              
              {#if item.children}
                <ChevronRight size={16} class="text-gray-400" />
              {/if}
            </button>

            <!-- Submenu -->
            {#if item.children && activeSubmenu === item.id}
              <div class={submenuClass}>
                {#each item.children as childItem}
                  {#if childItem.separator}
                    <div class="my-1 h-px bg-gray-200" role="separator"></div>
                  {:else}
                    <button
                      type="button"
                      class={clsx(
                        'flex w-full items-center gap-2 px-4 py-2 text-left text-sm',
                        'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                        childItem.disabled && 'cursor-not-allowed opacity-50'
                      )}
                      disabled={childItem.disabled}
                      role="menuitem"
                      on:click={(e) => selectItem(childItem, e)}
                    >
                      {#if childItem.icon}
                        <svelte:component this={childItem.icon} size={16} />
                      {/if}
                      <span>{childItem.label}</span>
                    </button>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>