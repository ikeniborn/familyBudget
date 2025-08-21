<script lang="ts" generics="T">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';

  // Generic type for items
  type Item = T;

  // Props
  export let items: Item[] = [];
  export let itemHeight: number = 50;
  export let containerHeight: number = 400;
  export let overscan: number = 5; // Number of items to render outside visible area
  export let scrollToIndex: number | undefined = undefined;
  export let scrollToAlignment: 'start' | 'center' | 'end' | 'auto' = 'auto';
  
  // Container element
  let containerElement: HTMLDivElement;
  let scrollTop = 0;
  let mounted = false;

  // Calculated values
  $: totalHeight = items.length * itemHeight;
  $: visibleItemsCount = Math.ceil(containerHeight / itemHeight);
  $: startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  $: endIndex = Math.min(items.length - 1, startIndex + visibleItemsCount + 2 * overscan);
  $: visibleItems = items.slice(startIndex, endIndex + 1);
  $: offsetY = startIndex * itemHeight;

  // Scroll to specific index
  $: if (mounted && scrollToIndex !== undefined && containerElement) {
    scrollToItem(scrollToIndex, scrollToAlignment);
  }

  onMount(() => {
    mounted = true;
    
    if (scrollToIndex !== undefined) {
      scrollToItem(scrollToIndex, scrollToAlignment);
    }
  });

  function handleScroll(event: Event) {
    const target = event.target as HTMLDivElement;
    scrollTop = target.scrollTop;
  }

  function scrollToItem(index: number, alignment: 'start' | 'center' | 'end' | 'auto' = 'auto') {
    if (!containerElement || index < 0 || index >= items.length) return;

    const itemTop = index * itemHeight;
    const itemBottom = itemTop + itemHeight;
    const containerTop = containerElement.scrollTop;
    const containerBottom = containerTop + containerHeight;

    let targetScrollTop = containerTop;

    switch (alignment) {
      case 'start':
        targetScrollTop = itemTop;
        break;
      case 'center':
        targetScrollTop = itemTop - (containerHeight - itemHeight) / 2;
        break;
      case 'end':
        targetScrollTop = itemBottom - containerHeight;
        break;
      case 'auto':
        if (itemTop < containerTop) {
          targetScrollTop = itemTop;
        } else if (itemBottom > containerBottom) {
          targetScrollTop = itemBottom - containerHeight;
        }
        break;
    }

    // Clamp to valid range
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));

    if (targetScrollTop !== containerTop) {
      containerElement.scrollTop = targetScrollTop;
    }
  }

  // Exposed methods
  export function scrollToTop() {
    if (containerElement) {
      containerElement.scrollTop = 0;
    }
  }

  export function scrollToBottom() {
    if (containerElement) {
      containerElement.scrollTop = totalHeight - containerHeight;
    }
  }

  export function getVisibleRange() {
    return { startIndex, endIndex };
  }
</script>

<div
  bind:this={containerElement}
  on:scroll={handleScroll}
  class="virtual-list-container"
  style="height: {containerHeight}px; overflow-y: auto; position: relative;"
>
  <!-- Total height placeholder -->
  <div style="height: {totalHeight}px; position: relative;">
    <!-- Visible items container -->
    <div style="transform: translateY({offsetY}px); position: absolute; top: 0; left: 0; right: 0;">
      {#each visibleItems as item, localIndex (startIndex + localIndex)}
        <div
          class="virtual-list-item"
          style="height: {itemHeight}px; position: relative;"
          data-index={startIndex + localIndex}
        >
          <slot {item} index={startIndex + localIndex} />
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .virtual-list-container {
    /* Smooth scrolling on supported browsers */
    scroll-behavior: smooth;
    
    /* Better scrolling performance */
    -webkit-overflow-scrolling: touch;
    
    /* Hide scrollbar on webkit browsers (optional) */
    scrollbar-width: thin;
  }

  .virtual-list-container::-webkit-scrollbar {
    width: 8px;
  }

  .virtual-list-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }

  .virtual-list-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }

  .virtual-list-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .virtual-list-item {
    /* Ensure items don't collapse */
    min-height: inherit;
    
    /* Better rendering performance */
    contain: layout style paint;
  }
</style>