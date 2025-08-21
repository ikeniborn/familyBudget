<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-svelte';
  import type { TourStep, Position } from '$lib/types/help';

  export let step: TourStep;
  export let stepIndex: number;
  export let totalSteps: number;
  export let canGoBack: boolean;
  export let canGoNext: boolean;

  const dispatch = createEventDispatcher();

  let position: Position | null = null;
  let overlayElement: HTMLDivElement;
  let targetElement: Element | null = null;
  let originalStyles: { [key: string]: string } = {};

  // Calculate position relative to target element
  function calculatePosition() {
    const target = document.querySelector(step.target);
    if (!target || !overlayElement) return;

    const targetRect = target.getBoundingClientRect();
    const overlayRect = overlayElement.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let x = 0;
    let y = 0;
    let pos = step.position || 'bottom';

    // Apply custom offset
    const offset = step.offset || { x: 0, y: 0 };

    switch (pos) {
      case 'top':
        x = targetRect.left + targetRect.width / 2 - overlayRect.width / 2;
        y = targetRect.top - overlayRect.height - 20;
        break;
      case 'bottom':
        x = targetRect.left + targetRect.width / 2 - overlayRect.width / 2;
        y = targetRect.bottom + 20;
        break;
      case 'left':
        x = targetRect.left - overlayRect.width - 20;
        y = targetRect.top + targetRect.height / 2 - overlayRect.height / 2;
        break;
      case 'right':
        x = targetRect.right + 20;
        y = targetRect.top + targetRect.height / 2 - overlayRect.height / 2;
        break;
      case 'center':
        x = viewport.width / 2 - overlayRect.width / 2;
        y = viewport.height / 2 - overlayRect.height / 2;
        break;
    }

    // Apply offset
    x += offset.x;
    y += offset.y;

    // Keep within viewport
    x = Math.max(10, Math.min(x, viewport.width - overlayRect.width - 10));
    y = Math.max(10, Math.min(y, viewport.height - overlayRect.height - 10));

    position = { x, y, position: pos };
  }

  // Highlight target element
  function highlightTarget() {
    const target = document.querySelector(step.target);
    if (!target) return;

    targetElement = target;
    const htmlElement = target as HTMLElement;

    // Store original styles
    originalStyles = {
      position: htmlElement.style.position,
      zIndex: htmlElement.style.zIndex,
      boxShadow: htmlElement.style.boxShadow
    };

    // Apply highlight styles
    htmlElement.style.position = 'relative';
    htmlElement.style.zIndex = '1001';
    htmlElement.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2)';

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Remove highlight from target element
  function removeHighlight() {
    if (!targetElement) return;

    const htmlElement = targetElement as HTMLElement;

    // Restore original styles
    htmlElement.style.position = originalStyles.position || '';
    htmlElement.style.zIndex = originalStyles.zIndex || '';
    htmlElement.style.boxShadow = originalStyles.boxShadow || '';

    targetElement = null;
    originalStyles = {};
  }

  // Handle resize and scroll
  function handleResize() {
    calculatePosition();
  }

  function handleNext() {
    dispatch('next');
  }

  function handlePrevious() {
    dispatch('previous');
  }

  function handleSkip() {
    dispatch('skip');
  }

  function handleClose() {
    dispatch('close');
  }

  onMount(() => {
    highlightTarget();
    calculatePosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
  });

  onDestroy(() => {
    removeHighlight();
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('scroll', handleResize);
  });

  // Reactively update position when step changes
  $: if (step) {
    removeHighlight();
    highlightTarget();
    calculatePosition();
  }
</script>

<!-- Backdrop -->
<div class="fixed inset-0 bg-black bg-opacity-50 z-[1000]" />

<!-- Tour popup -->
{#if position}
  <div
    bind:this={overlayElement}
    class="fixed z-[1002] bg-white rounded-lg shadow-xl max-w-sm w-full"
    style="left: {position.x}px; top: {position.y}px;"
  >
    <div class="p-4">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <div class="text-sm font-medium text-blue-600">
            Шаг {stepIndex + 1} из {totalSteps}
          </div>
          <div class="w-24 bg-gray-200 rounded-full h-1">
            <div
              class="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style="width: {((stepIndex + 1) / totalSteps) * 100}%"
            />
          </div>
        </div>
        <button
          on:click={handleClose}
          class="text-gray-400 hover:text-gray-600 p-1"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <!-- Content -->
      <div class="mb-4">
        <h3 class="text-lg font-semibold mb-2">{step.title}</h3>
        <p class="text-gray-600 text-sm leading-relaxed">{step.content}</p>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if canGoBack}
            <button
              on:click={handlePrevious}
              class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <ChevronLeft class="h-4 w-4" />
              Назад
            </button>
          {/if}
        </div>

        <div class="flex items-center gap-2">
          {#if step.showSkip !== false}
            <button
              on:click={handleSkip}
              class="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              <SkipForward class="h-4 w-4" />
              Пропустить
            </button>
          {/if}

          <button
            on:click={handleNext}
            disabled={!canGoNext}
            class="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {step.nextButtonText || (stepIndex + 1 === totalSteps ? 'Завершить' : 'Далее')}
            {#if stepIndex + 1 < totalSteps}
              <ChevronRight class="h-4 w-4" />
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Arrow -->
    {#if position.position !== 'center'}
      <div
        class="absolute w-3 h-3 bg-white transform rotate-45 {
          position.position === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2' :
          position.position === 'bottom' ? 'top-[-6px] left-1/2 -translate-x-1/2' :
          position.position === 'left' ? 'right-[-6px] top-1/2 -translate-y-1/2' :
          'left-[-6px] top-1/2 -translate-y-1/2'
        }"
      />
    {/if}
  </div>
{/if}