import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Play, SkipForward } from 'lucide-react';

// Types for guided tour
export interface TourStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  offset?: { x: number; y: number };
  action?: () => void;
  beforeStep?: () => Promise<void> | void;
  afterStep?: () => Promise<void> | void;
  nextButtonText?: string;
  showSkip?: boolean;
  allowBackwards?: boolean;
}

export interface Tour {
  id: string;
  name: string;
  description: string;
  steps: TourStep[];
  category?: string;
  prerequisites?: string[];
}

export interface TourState {
  activeTour: Tour | null;
  currentStepIndex: number;
  isActive: boolean;
  completedTours: string[];
  userProgress: Record<string, number>;
}

export interface GuidedTourProps {
  tours: Tour[];
  onTourComplete?: (tour: Tour) => void;
  onTourSkip?: (tour: Tour, stepIndex: number) => void;
  onStepComplete?: (tour: Tour, step: TourStep, stepIndex: number) => void;
  showOnMount?: boolean;
  autoStart?: string; // Tour ID to auto-start
}

// Tour overlay component
const TourOverlay: React.FC<{
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onClose: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
}> = ({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onClose,
  canGoBack,
  canGoNext
}) => {
  const [position, setPosition] = useState<{ x: number; y: number; position: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate position relative to target element
  useEffect(() => {
    const calculatePosition = () => {
      const target = document.querySelector(step.target);
      if (!target || !overlayRef.current) return;

      const targetRect = target.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();
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

      setPosition({ x, y, position: pos });
    };

    calculatePosition();

    const handleResize = () => calculatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [step]);

  // Highlight target element
  useEffect(() => {
    const target = document.querySelector(step.target);
    if (!target) return;

    const originalStyle = {
      position: (target as HTMLElement).style.position,
      zIndex: (target as HTMLElement).style.zIndex,
      boxShadow: (target as HTMLElement).style.boxShadow
    };

    // Highlight the target
    (target as HTMLElement).style.position = 'relative';
    (target as HTMLElement).style.zIndex = '1001';
    (target as HTMLElement).style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2)';

    // Scroll target into view
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return () => {
      // Restore original styles
      (target as HTMLElement).style.position = originalStyle.position;
      (target as HTMLElement).style.zIndex = originalStyle.zIndex;
      (target as HTMLElement).style.boxShadow = originalStyle.boxShadow;
    };
  }, [step.target]);

  if (!position) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-1000" />
      
      {/* Tour popup */}
      <div
        ref={overlayRef}
        className="fixed z-1002 bg-white rounded-lg shadow-xl max-w-sm w-full"
        style={{ left: position.x, top: position.y }}
      >
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-blue-600">
                Шаг {stepIndex + 1} из {totalSteps}
              </div>
              <div className="w-24 bg-gray-200 rounded-full h-1">
                <div
                  className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
                />
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{step.content}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <button
                  onClick={onPrevious}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {step.showSkip !== false && (
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  <SkipForward className="h-4 w-4" />
                  Пропустить
                </button>
              )}

              <button
                onClick={onNext}
                disabled={!canGoNext}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {step.nextButtonText || (stepIndex + 1 === totalSteps ? 'Завершить' : 'Далее')}
                {stepIndex + 1 < totalSteps && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Arrow */}
        {position.position !== 'center' && (
          <div
            className={`absolute w-3 h-3 bg-white transform rotate-45 ${
              position.position === 'top' ? 'bottom-[-6px] left-1/2 -translate-x-1/2' :
              position.position === 'bottom' ? 'top-[-6px] left-1/2 -translate-x-1/2' :
              position.position === 'left' ? 'right-[-6px] top-1/2 -translate-y-1/2' :
              'left-[-6px] top-1/2 -translate-y-1/2'
            }`}
          />
        )}
      </div>
    </>,
    document.body
  );
};

// Main Guided Tour Component
export const GuidedTour: React.FC<GuidedTourProps> = ({
  tours,
  onTourComplete,
  onTourSkip,
  onStepComplete,
  showOnMount = false,
  autoStart
}) => {
  const [tourState, setTourState] = useState<TourState>({
    activeTour: null,
    currentStepIndex: 0,
    isActive: false,
    completedTours: JSON.parse(localStorage.getItem('completedTours') || '[]'),
    userProgress: JSON.parse(localStorage.getItem('tourProgress') || '{}')
  });

  // Auto-start tour on mount
  useEffect(() => {
    if (autoStart && !tourState.completedTours.includes(autoStart)) {
      const tour = tours.find(t => t.id === autoStart);
      if (tour) {
        startTour(tour);
      }
    }
  }, [autoStart, tours]);

  // Start a tour
  const startTour = useCallback(async (tour: Tour) => {
    // Check prerequisites
    if (tour.prerequisites) {
      const missingPrereqs = tour.prerequisites.filter(
        prereq => !tourState.completedTours.includes(prereq)
      );
      if (missingPrereqs.length > 0) {
        console.warn(`Tour ${tour.id} has unmet prerequisites:`, missingPrereqs);
        return;
      }
    }

    setTourState(prev => ({
      ...prev,
      activeTour: tour,
      currentStepIndex: 0,
      isActive: true
    }));

    // Execute before step action for first step
    const firstStep = tour.steps[0];
    if (firstStep?.beforeStep) {
      await firstStep.beforeStep();
    }
  }, [tourState.completedTours]);

  // Go to next step
  const nextStep = useCallback(async () => {
    if (!tourState.activeTour) return;

    const currentStep = tourState.activeTour.steps[tourState.currentStepIndex];
    
    // Execute step action
    if (currentStep.action) {
      currentStep.action();
    }

    // Execute after step action
    if (currentStep.afterStep) {
      await currentStep.afterStep();
    }

    // Notify step completion
    onStepComplete?.(tourState.activeTour, currentStep, tourState.currentStepIndex);

    const nextIndex = tourState.currentStepIndex + 1;

    if (nextIndex >= tourState.activeTour.steps.length) {
      // Tour completed
      completeTour();
    } else {
      // Move to next step
      const nextStep = tourState.activeTour.steps[nextIndex];
      
      // Execute before step action
      if (nextStep.beforeStep) {
        await nextStep.beforeStep();
      }

      setTourState(prev => ({
        ...prev,
        currentStepIndex: nextIndex
      }));
    }
  }, [tourState, onStepComplete]);

  // Go to previous step
  const previousStep = useCallback(() => {
    if (!tourState.activeTour || tourState.currentStepIndex === 0) return;

    setTourState(prev => ({
      ...prev,
      currentStepIndex: prev.currentStepIndex - 1
    }));
  }, [tourState]);

  // Skip tour
  const skipTour = useCallback(() => {
    if (!tourState.activeTour) return;

    onTourSkip?.(tourState.activeTour, tourState.currentStepIndex);
    closeTour();
  }, [tourState, onTourSkip]);

  // Complete tour
  const completeTour = useCallback(() => {
    if (!tourState.activeTour) return;

    const completedTours = [...tourState.completedTours, tourState.activeTour.id];
    
    setTourState(prev => ({
      ...prev,
      isActive: false,
      activeTour: null,
      currentStepIndex: 0,
      completedTours
    }));

    // Persist to localStorage
    localStorage.setItem('completedTours', JSON.stringify(completedTours));

    onTourComplete?.(tourState.activeTour);
  }, [tourState, onTourComplete]);

  // Close tour without completing
  const closeTour = useCallback(() => {
    setTourState(prev => ({
      ...prev,
      isActive: false,
      activeTour: null,
      currentStepIndex: 0
    }));
  }, []);

  // Check if target exists for current step
  const currentStepTargetExists = useCallback(() => {
    if (!tourState.activeTour || !tourState.isActive) return false;
    
    const currentStep = tourState.activeTour.steps[tourState.currentStepIndex];
    const target = document.querySelector(currentStep.target);
    return !!target;
  }, [tourState]);

  const currentStep = tourState.activeTour?.steps[tourState.currentStepIndex];
  const canGoBack = tourState.currentStepIndex > 0 && currentStep?.allowBackwards !== false;
  const canGoNext = currentStepTargetExists();

  return (
    <>
      {tourState.isActive && currentStep && (
        <TourOverlay
          step={currentStep}
          stepIndex={tourState.currentStepIndex}
          totalSteps={tourState.activeTour!.steps.length}
          onNext={nextStep}
          onPrevious={previousStep}
          onSkip={skipTour}
          onClose={closeTour}
          canGoBack={canGoBack}
          canGoNext={canGoNext}
        />
      )}
    </>
  );
};

// Tour launcher component
export interface TourLauncherProps {
  tours: Tour[];
  onStartTour: (tour: Tour) => void;
  completedTours: string[];
  className?: string;
}

export const TourLauncher: React.FC<TourLauncherProps> = ({
  tours,
  onStartTour,
  completedTours,
  className = ''
}) => {
  const [showPanel, setShowPanel] = useState(false);

  const availableTours = tours.filter(tour => !completedTours.includes(tour.id));
  const completedToursData = tours.filter(tour => completedTours.includes(tour.id));

  return (
    <div className={className}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Play className="h-4 w-4" />
        Обучение ({availableTours.length})
      </button>

      {showPanel && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3">Интерактивные туры</h3>

            {availableTours.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-700">Доступные туры:</h4>
                {availableTours.map(tour => (
                  <div key={tour.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium">{tour.name}</h5>
                        <p className="text-sm text-gray-600 mt-1">{tour.description}</p>
                        <div className="text-xs text-gray-500 mt-2">
                          {tour.steps.length} шагов
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          onStartTour(tour);
                          setShowPanel(false);
                        }}
                        className="ml-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Начать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">Все доступные туры пройдены!</p>
            )}

            {completedToursData.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Пройденные туры:</h4>
                <div className="space-y-1">
                  {completedToursData.map(tour => (
                    <div key={tour.id} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      {tour.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Hook for managing tours
export const useTours = (tours: Tour[]) => {
  const [completedTours, setCompletedTours] = useState<string[]>(
    JSON.parse(localStorage.getItem('completedTours') || '[]')
  );

  const markTourCompleted = useCallback((tourId: string) => {
    const updated = [...completedTours, tourId];
    setCompletedTours(updated);
    localStorage.setItem('completedTours', JSON.stringify(updated));
  }, [completedTours]);

  const resetTours = useCallback(() => {
    setCompletedTours([]);
    localStorage.removeItem('completedTours');
    localStorage.removeItem('tourProgress');
  }, []);

  const isTourCompleted = useCallback((tourId: string) => {
    return completedTours.includes(tourId);
  }, [completedTours]);

  const getAvailableTours = useCallback(() => {
    return tours.filter(tour => !completedTours.includes(tour.id));
  }, [tours, completedTours]);

  return {
    completedTours,
    markTourCompleted,
    resetTours,
    isTourCompleted,
    getAvailableTours
  };
};