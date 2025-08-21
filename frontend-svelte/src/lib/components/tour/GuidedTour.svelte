<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { tourState, tourStore } from '$lib/stores/tourStore';
  import type { Tour } from '$lib/types/help';
  import TourOverlay from './TourOverlay.svelte';

  export let tours: Tour[];
  export let showOnMount: boolean = false;
  export let autoStart: string | undefined = undefined;

  const dispatch = createEventDispatcher();

  // Check if target exists for current step
  function currentStepTargetExists(): boolean {
    if (!$tourState.activeTour || !$tourState.isActive) return false;
    
    const currentStep = $tourState.activeTour.steps[$tourState.currentStepIndex];
    const target = document.querySelector(currentStep.target);
    return !!target;
  }

  // Handle tour events
  async function handleNext() {
    await tourStore.nextStep();
    
    // Dispatch completion event if tour finished
    if (!$tourState.activeTour) {
      dispatch('tourComplete', { tour: $tourState.activeTour });
    } else {
      const currentStep = $tourState.activeTour.steps[$tourState.currentStepIndex];
      dispatch('stepComplete', { 
        tour: $tourState.activeTour, 
        step: currentStep, 
        stepIndex: $tourState.currentStepIndex 
      });
    }
  }

  function handlePrevious() {
    tourStore.previousStep();
  }

  function handleSkip() {
    if ($tourState.activeTour) {
      dispatch('tourSkip', { 
        tour: $tourState.activeTour, 
        stepIndex: $tourState.currentStepIndex 
      });
    }
    tourStore.skipTour();
  }

  function handleClose() {
    tourStore.closeTour();
  }

  // Auto-start tour on mount
  onMount(() => {
    if (autoStart && !tourStore.isTourCompleted(autoStart)) {
      const tour = tours.find(t => t.id === autoStart);
      if (tour) {
        tourStore.startTour(tour);
      }
    }
  });

  $: currentStep = $tourState.activeTour?.steps[$tourState.currentStepIndex];
  $: canGoBack = $tourState.currentStepIndex > 0 && currentStep?.allowBackwards !== false;
  $: canGoNext = currentStepTargetExists();
</script>

{#if $tourState.isActive && currentStep}
  <TourOverlay
    step={currentStep}
    stepIndex={$tourState.currentStepIndex}
    totalSteps={$tourState.activeTour?.steps.length || 0}
    {canGoBack}
    {canGoNext}
    on:next={handleNext}
    on:previous={handlePrevious}
    on:skip={handleSkip}
    on:close={handleClose}
  />
{/if}