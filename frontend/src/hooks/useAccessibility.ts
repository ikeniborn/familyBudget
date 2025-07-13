import { useEffect, useRef, useCallback, useState } from 'react';

// Types for accessibility
export interface AriaAttributes {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-expanded'?: boolean;
  'aria-selected'?: boolean;
  'aria-checked'?: boolean | 'mixed';
  'aria-disabled'?: boolean;
  'aria-hidden'?: boolean;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean | 'grammar' | 'spelling';
  'aria-live'?: 'off' | 'polite' | 'assertive';
  'aria-atomic'?: boolean;
  'aria-busy'?: boolean;
  'aria-controls'?: string;
  'aria-owns'?: string;
  'aria-activedescendant'?: string;
  'aria-level'?: number;
  'aria-setsize'?: number;
  'aria-posinset'?: number;
  'aria-rowcount'?: number;
  'aria-colcount'?: number;
  'aria-rowindex'?: number;
  'aria-colindex'?: number;
  'aria-rowspan'?: number;
  'aria-colspan'?: number;
  role?: string;
  tabIndex?: number;
}

export interface FocusOptions {
  preventScroll?: boolean;
  restoreFocus?: boolean;
  trap?: boolean;
  autoFocus?: boolean;
}

export interface KeyboardNavigationOptions {
  direction?: 'horizontal' | 'vertical' | 'both' | 'grid';
  loop?: boolean;
  disabled?: boolean;
  onNavigate?: (direction: string, currentIndex: number) => void;
  skipDisabled?: boolean;
}

// Hook for managing ARIA attributes
export const useAriaAttributes = (
  initialAttributes: AriaAttributes = {}
): [AriaAttributes, (attributes: Partial<AriaAttributes>) => void] => {
  const [attributes, setAttributes] = useState<AriaAttributes>(initialAttributes);

  const updateAttributes = useCallback((newAttributes: Partial<AriaAttributes>) => {
    setAttributes(prev => ({ ...prev, ...newAttributes }));
  }, []);

  return [attributes, updateAttributes];
};

// Hook for focus management
export const useFocusManagement = (options: FocusOptions = {}) => {
  const { preventScroll = false, restoreFocus = true, trap = false, autoFocus = false } = options;
  
  const focusableRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const focusTrapRef = useRef<HTMLElement>(null);

  // Store previous focus when component mounts
  useEffect(() => {
    if (restoreFocus) {
      previousFocusRef.current = document.activeElement as HTMLElement;
    }

    // Auto focus if enabled
    if (autoFocus && focusableRef.current) {
      focusableRef.current.focus({ preventScroll });
    }

    return () => {
      // Restore focus when component unmounts
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus({ preventScroll });
      }
    };
  }, [restoreFocus, autoFocus, preventScroll]);

  // Focus trap implementation
  useEffect(() => {
    if (!trap || !focusTrapRef.current) return;

    const trapElement = focusTrapRef.current;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = trapElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    trapElement.addEventListener('keydown', handleKeyDown);
    
    return () => {
      trapElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [trap]);

  const focus = useCallback((element?: HTMLElement) => {
    const targetElement = element || focusableRef.current;
    if (targetElement) {
      targetElement.focus({ preventScroll });
    }
  }, [preventScroll]);

  const blur = useCallback(() => {
    if (focusableRef.current) {
      focusableRef.current.blur();
    }
  }, []);

  return {
    focusableRef,
    focusTrapRef,
    focus,
    blur,
    previousFocus: previousFocusRef.current
  };
};

// Hook for keyboard navigation
export const useKeyboardNavigation = (
  items: HTMLElement[] | (() => HTMLElement[]),
  options: KeyboardNavigationOptions = {}
) => {
  const {
    direction = 'vertical',
    loop = true,
    disabled = false,
    onNavigate,
    skipDisabled = true
  } = options;

  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLElement>(null);

  const getItems = useCallback(() => {
    return typeof items === 'function' ? items() : items;
  }, [items]);

  const isElementDisabled = useCallback((element: HTMLElement) => {
    return element.hasAttribute('disabled') || 
           element.getAttribute('aria-disabled') === 'true' ||
           element.tabIndex === -1;
  }, []);

  const getNextValidIndex = useCallback((startIndex: number, delta: number) => {
    const itemList = getItems();
    let newIndex = startIndex;
    
    do {
      newIndex = (newIndex + delta + itemList.length) % itemList.length;
      
      if (!loop && (newIndex === 0 && delta < 0) || (newIndex === itemList.length - 1 && delta > 0)) {
        return startIndex;
      }
      
      if (!skipDisabled || !isElementDisabled(itemList[newIndex])) {
        return newIndex;
      }
    } while (newIndex !== startIndex);
    
    return startIndex;
  }, [getItems, loop, skipDisabled, isElementDisabled]);

  const navigate = useCallback((direction: string) => {
    if (disabled) return;

    const itemList = getItems();
    if (itemList.length === 0) return;

    let delta = 0;
    
    switch (direction) {
      case 'next':
      case 'down':
      case 'right':
        delta = 1;
        break;
      case 'previous':
      case 'up':
      case 'left':
        delta = -1;
        break;
      case 'first':
        setCurrentIndex(0);
        itemList[0]?.focus();
        onNavigate?.(direction, 0);
        return;
      case 'last':
        const lastIndex = itemList.length - 1;
        setCurrentIndex(lastIndex);
        itemList[lastIndex]?.focus();
        onNavigate?.(direction, lastIndex);
        return;
    }

    if (delta !== 0) {
      const newIndex = getNextValidIndex(currentIndex, delta);
      setCurrentIndex(newIndex);
      itemList[newIndex]?.focus();
      onNavigate?.(direction, newIndex);
    }
  }, [disabled, getItems, currentIndex, getNextValidIndex, onNavigate]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (disabled) return;

    const { key, ctrlKey, metaKey } = event;
    let handled = false;

    switch (direction) {
      case 'horizontal':
        if (key === 'ArrowLeft') {
          navigate('left');
          handled = true;
        } else if (key === 'ArrowRight') {
          navigate('right');
          handled = true;
        }
        break;
        
      case 'vertical':
        if (key === 'ArrowUp') {
          navigate('up');
          handled = true;
        } else if (key === 'ArrowDown') {
          navigate('down');
          handled = true;
        }
        break;
        
      case 'both':
        if (key === 'ArrowUp' || key === 'ArrowLeft') {
          navigate('previous');
          handled = true;
        } else if (key === 'ArrowDown' || key === 'ArrowRight') {
          navigate('next');
          handled = true;
        }
        break;
        
      case 'grid':
        // Grid navigation logic would go here
        break;
    }

    // Common navigation keys
    if (key === 'Home' || (key === 'ArrowUp' && (ctrlKey || metaKey))) {
      navigate('first');
      handled = true;
    } else if (key === 'End' || (key === 'ArrowDown' && (ctrlKey || metaKey))) {
      navigate('last');
      handled = true;
    }

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [disabled, direction, navigate]);

  // Attach keyboard listeners
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [handleKeyDown]);

  return {
    containerRef,
    currentIndex,
    setCurrentIndex,
    navigate,
    handleKeyDown
  };
};

// Hook for screen reader announcements
export const useScreenReader = () => {
  const announcementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    
    document.body.appendChild(liveRegion);
    announcementRef.current = liveRegion;

    return () => {
      if (liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announcementRef.current) {
      announcementRef.current.setAttribute('aria-live', priority);
      announcementRef.current.textContent = message;
      
      // Clear after announcement
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return { announce };
};

// Hook for high contrast mode detection and management
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [userPreference, setUserPreference] = useState<boolean | null>(null);

  useEffect(() => {
    // Check system preference
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      if (userPreference === null) {
        setIsHighContrast(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    
    // Load user preference
    const stored = localStorage.getItem('highContrastMode');
    if (stored !== null) {
      const preference = JSON.parse(stored);
      setUserPreference(preference);
      setIsHighContrast(preference);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [userPreference]);

  const toggleHighContrast = useCallback(() => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    setUserPreference(newValue);
    localStorage.setItem('highContrastMode', JSON.stringify(newValue));
    
    // Apply CSS class to document
    if (newValue) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isHighContrast]);

  const resetHighContrast = useCallback(() => {
    setUserPreference(null);
    localStorage.removeItem('highContrastMode');
    
    // Reset to system preference
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);
    
    if (mediaQuery.matches) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, []);

  // Apply class on mount
  useEffect(() => {
    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [isHighContrast]);

  return {
    isHighContrast,
    toggleHighContrast,
    resetHighContrast,
    isSystemPreference: userPreference === null
  };
};

// Utility function to generate accessible IDs
export const useAccessibleId = (prefix = 'accessible') => {
  const idRef = useRef<string>();

  if (!idRef.current) {
    idRef.current = `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
  }

  return idRef.current;
};

// Hook for managing reduced motion preference
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
};

// Comprehensive accessibility hook
export const useAccessibility = (options: {
  autoFocus?: boolean;
  trapFocus?: boolean;
  announceChanges?: boolean;
  keyboardNavigation?: KeyboardNavigationOptions;
  ariaLabel?: string;
} = {}) => {
  const {
    autoFocus = false,
    trapFocus = false,
    announceChanges = true,
    keyboardNavigation,
    ariaLabel
  } = options;

  const id = useAccessibleId();
  const { announce } = useScreenReader();
  const { isHighContrast } = useHighContrast();
  const prefersReducedMotion = useReducedMotion();
  
  const [ariaAttributes, updateAriaAttributes] = useAriaAttributes({
    'aria-label': ariaLabel,
    id
  });

  const focusManagement = useFocusManagement({
    autoFocus,
    trap: trapFocus,
    restoreFocus: true
  });

  const announceChange = useCallback((message: string, priority?: 'polite' | 'assertive') => {
    if (announceChanges) {
      announce(message, priority);
    }
  }, [announce, announceChanges]);

  return {
    id,
    ariaAttributes,
    updateAriaAttributes,
    focusManagement,
    announce: announceChange,
    isHighContrast,
    prefersReducedMotion,
    keyboardNavigation: keyboardNavigation ? useKeyboardNavigation([], keyboardNavigation) : null
  };
};