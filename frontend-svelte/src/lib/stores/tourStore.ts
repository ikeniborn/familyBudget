import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { Tour, TourState } from '$lib/types/help';

// Initialize tour state from localStorage if in browser
const getInitialState = (): TourState => {
  if (!browser) {
    return {
      activeTour: null,
      currentStepIndex: 0,
      isActive: false,
      completedTours: [],
      userProgress: {}
    };
  }

  return {
    activeTour: null,
    currentStepIndex: 0,
    isActive: false,
    completedTours: JSON.parse(localStorage.getItem('completedTours') || '[]'),
    userProgress: JSON.parse(localStorage.getItem('tourProgress') || '{}')
  };
};

// Tour state store
export const tourState = writable<TourState>(getInitialState());

// Tour store actions
export const tourStore = {
  // Start a tour
  startTour: async (tour: Tour) => {
    let currentState: TourState;
    tourState.subscribe(state => currentState = state)();

    // Check prerequisites
    if (tour.prerequisites) {
      const missingPrereqs = tour.prerequisites.filter(
        prereq => !currentState!.completedTours.includes(prereq)
      );
      if (missingPrereqs.length > 0) {
        console.warn(`Tour ${tour.id} has unmet prerequisites:`, missingPrereqs);
        return;
      }
    }

    tourState.update(state => ({
      ...state,
      activeTour: tour,
      currentStepIndex: 0,
      isActive: true
    }));

    // Execute before step action for first step
    const firstStep = tour.steps[0];
    if (firstStep?.beforeStep) {
      await firstStep.beforeStep();
    }
  },

  // Go to next step
  nextStep: async () => {
    let currentState: TourState;
    tourState.subscribe(state => currentState = state)();

    if (!currentState!.activeTour) return;

    const currentStep = currentState!.activeTour.steps[currentState!.currentStepIndex];
    
    // Execute step action
    if (currentStep.action) {
      currentStep.action();
    }

    // Execute after step action
    if (currentStep.afterStep) {
      await currentStep.afterStep();
    }

    const nextIndex = currentState!.currentStepIndex + 1;

    if (nextIndex >= currentState!.activeTour.steps.length) {
      // Tour completed
      tourStore.completeTour();
    } else {
      // Move to next step
      const nextStep = currentState!.activeTour.steps[nextIndex];
      
      // Execute before step action
      if (nextStep.beforeStep) {
        await nextStep.beforeStep();
      }

      tourState.update(state => ({
        ...state,
        currentStepIndex: nextIndex
      }));
    }
  },

  // Go to previous step
  previousStep: () => {
    tourState.update(state => {
      if (!state.activeTour || state.currentStepIndex === 0) return state;
      
      return {
        ...state,
        currentStepIndex: state.currentStepIndex - 1
      };
    });
  },

  // Skip tour
  skipTour: () => {
    tourStore.closeTour();
  },

  // Complete tour
  completeTour: () => {
    let currentState: TourState;
    tourState.subscribe(state => currentState = state)();

    if (!currentState!.activeTour) return;

    const completedTours = [...currentState!.completedTours, currentState!.activeTour.id];
    
    tourState.update(state => ({
      ...state,
      isActive: false,
      activeTour: null,
      currentStepIndex: 0,
      completedTours
    }));

    // Persist to localStorage
    if (browser) {
      localStorage.setItem('completedTours', JSON.stringify(completedTours));
    }
  },

  // Close tour without completing
  closeTour: () => {
    tourState.update(state => ({
      ...state,
      isActive: false,
      activeTour: null,
      currentStepIndex: 0
    }));
  },

  // Mark tour as completed
  markTourCompleted: (tourId: string) => {
    tourState.update(state => {
      const completedTours = [...state.completedTours, tourId];
      
      if (browser) {
        localStorage.setItem('completedTours', JSON.stringify(completedTours));
      }
      
      return {
        ...state,
        completedTours
      };
    });
  },

  // Reset all tours
  resetTours: () => {
    tourState.update(state => ({
      ...state,
      completedTours: [],
      userProgress: {}
    }));

    if (browser) {
      localStorage.removeItem('completedTours');
      localStorage.removeItem('tourProgress');
    }
  },

  // Check if tour is completed
  isTourCompleted: (tourId: string): boolean => {
    let isCompleted = false;
    tourState.subscribe(state => {
      isCompleted = state.completedTours.includes(tourId);
    })();
    return isCompleted;
  },

  // Get available tours (not completed)
  getAvailableTours: (tours: Tour[]): Tour[] => {
    let completedTours: string[] = [];
    tourState.subscribe(state => {
      completedTours = state.completedTours;
    })();
    
    return tours.filter(tour => !completedTours.includes(tour.id));
  }
};