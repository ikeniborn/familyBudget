import { browser } from '$app/environment';

export interface SwipeEvent {
  direction: 'left' | 'right' | 'up' | 'down';
  distance: number;
  duration: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface TapEvent {
  x: number;
  y: number;
  target: EventTarget | null;
}

export interface PinchEvent {
  scale: number;
  center: { x: number; y: number };
  deltaScale: number;
}

export interface GestureOptions {
  swipeThreshold?: number;
  tapThreshold?: number;
  doubleTapDelay?: number;
  longPressDelay?: number;
}

class GestureHandler {
  private element: HTMLElement;
  private options: Required<GestureOptions>;
  
  // Touch tracking
  private startTouch: Touch | null = null;
  private lastTap: number = 0;
  private tapTimer: NodeJS.Timeout | null = null;
  private longPressTimer: NodeJS.Timeout | null = null;
  
  // Pinch tracking
  private initialDistance: number = 0;
  private lastScale: number = 1;
  
  // Callbacks
  private callbacks: {
    swipe?: (event: SwipeEvent) => void;
    tap?: (event: TapEvent) => void;
    doubleTap?: (event: TapEvent) => void;
    longPress?: (event: TapEvent) => void;
    pinch?: (event: PinchEvent) => void;
  } = {};

  constructor(element: HTMLElement, options: GestureOptions = {}) {
    this.element = element;
    this.options = {
      swipeThreshold: options.swipeThreshold ?? 50,
      tapThreshold: options.tapThreshold ?? 10,
      doubleTapDelay: options.doubleTapDelay ?? 300,
      longPressDelay: options.longPressDelay ?? 500
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Prevent default touch behaviors
    this.element.style.touchAction = 'pan-y pinch-zoom';
    
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
  }

  private handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.startTouch = touch;
    
    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this.startTouch && this.callbacks.longPress) {
        this.callbacks.longPress({
          x: this.startTouch.clientX,
          y: this.startTouch.clientY,
          target: event.target
        });
      }
    }, this.options.longPressDelay);

    // Handle pinch start
    if (event.touches.length === 2) {
      this.initialDistance = this.getDistance(event.touches[0], event.touches[1]);
      this.lastScale = 1;
      this.clearTimers();
    }
  }

  private handleTouchMove(event: TouchEvent): void {
    if (!this.startTouch) return;

    // Clear long press timer on movement
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Handle pinch
    if (event.touches.length === 2 && this.callbacks.pinch) {
      const currentDistance = this.getDistance(event.touches[0], event.touches[1]);
      const scale = currentDistance / this.initialDistance;
      const deltaScale = scale - this.lastScale;
      
      const center = {
        x: (event.touches[0].clientX + event.touches[1].clientX) / 2,
        y: (event.touches[0].clientY + event.touches[1].clientY) / 2
      };

      this.callbacks.pinch({
        scale,
        center,
        deltaScale
      });

      this.lastScale = scale;
      return;
    }

    // Prevent scrolling for horizontal swipes
    const currentTouch = event.touches[0];
    const deltaX = Math.abs(currentTouch.clientX - this.startTouch.clientX);
    const deltaY = Math.abs(currentTouch.clientY - this.startTouch.clientY);
    
    if (deltaX > deltaY && deltaX > this.options.swipeThreshold) {
      event.preventDefault();
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    if (!this.startTouch) return;

    this.clearTimers();

    const endTouch = event.changedTouches[0];
    const deltaX = endTouch.clientX - this.startTouch.clientX;
    const deltaY = endTouch.clientY - this.startTouch.clientY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const duration = Date.now() - this.startTouch.identifier;

    // Handle swipe
    if (distance > this.options.swipeThreshold && this.callbacks.swipe) {
      const swipeEvent: SwipeEvent = {
        direction: this.getSwipeDirection(deltaX, deltaY),
        distance,
        duration,
        startX: this.startTouch.clientX,
        startY: this.startTouch.clientY,
        endX: endTouch.clientX,
        endY: endTouch.clientY
      };
      this.callbacks.swipe(swipeEvent);
    }
    // Handle tap
    else if (distance < this.options.tapThreshold) {
      this.handleTap({
        x: endTouch.clientX,
        y: endTouch.clientY,
        target: event.target
      });
    }

    this.startTouch = null;
  }

  private handleTouchCancel(): void {
    this.clearTimers();
    this.startTouch = null;
  }

  private handleTap(tapEvent: TapEvent): void {
    const now = Date.now();
    const timeSinceLastTap = now - this.lastTap;

    if (timeSinceLastTap < this.options.doubleTapDelay && this.callbacks.doubleTap) {
      // Double tap detected
      if (this.tapTimer) {
        clearTimeout(this.tapTimer);
        this.tapTimer = null;
      }
      this.callbacks.doubleTap(tapEvent);
      this.lastTap = 0; // Reset to prevent triple tap
    } else {
      // Single tap (delayed to check for double tap)
      this.lastTap = now;
      this.tapTimer = setTimeout(() => {
        if (this.callbacks.tap) {
          this.callbacks.tap(tapEvent);
        }
        this.tapTimer = null;
      }, this.options.doubleTapDelay);
    }
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const deltaX = touch2.clientX - touch1.clientX;
    const deltaY = touch2.clientY - touch1.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  private getSwipeDirection(deltaX: number, deltaY: number): SwipeEvent['direction'] {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (absDeltaX > absDeltaY) {
      return deltaX > 0 ? 'right' : 'left';
    } else {
      return deltaY > 0 ? 'down' : 'up';
    }
  }

  private clearTimers(): void {
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // Public API
  onSwipe(callback: (event: SwipeEvent) => void): void {
    this.callbacks.swipe = callback;
  }

  onTap(callback: (event: TapEvent) => void): void {
    this.callbacks.tap = callback;
  }

  onDoubleTap(callback: (event: TapEvent) => void): void {
    this.callbacks.doubleTap = callback;
  }

  onLongPress(callback: (event: TapEvent) => void): void {
    this.callbacks.longPress = callback;
  }

  onPinch(callback: (event: PinchEvent) => void): void {
    this.callbacks.pinch = callback;
  }

  destroy(): void {
    this.clearTimers();
    this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
  }
}

// Svelte action for gesture handling
export function gestures(node: HTMLElement, options: GestureOptions & {
  onSwipe?: (event: SwipeEvent) => void;
  onTap?: (event: TapEvent) => void;
  onDoubleTap?: (event: TapEvent) => void;
  onLongPress?: (event: TapEvent) => void;
  onPinch?: (event: PinchEvent) => void;
} = {}) {
  if (!browser) {
    return {
      destroy() {}
    };
  }

  const handler = new GestureHandler(node, options);
  
  if (options.onSwipe) handler.onSwipe(options.onSwipe);
  if (options.onTap) handler.onTap(options.onTap);
  if (options.onDoubleTap) handler.onDoubleTap(options.onDoubleTap);
  if (options.onLongPress) handler.onLongPress(options.onLongPress);
  if (options.onPinch) handler.onPinch(options.onPinch);

  return {
    destroy() {
      handler.destroy();
    }
  };
}

// Utility functions for common gesture patterns
export const createSwipeToDeleteAction = (onDelete: () => void, threshold: number = 100) => {
  return (node: HTMLElement) => gestures(node, {
    swipeThreshold: threshold,
    onSwipe: (event) => {
      if (event.direction === 'left' && event.distance > threshold) {
        onDelete();
      }
    }
  });
};

export const createPullToRefreshAction = (onRefresh: () => void, threshold: number = 80) => {
  return (node: HTMLElement) => gestures(node, {
    swipeThreshold: threshold,
    onSwipe: (event) => {
      if (event.direction === 'down' && event.distance > threshold && node.scrollTop === 0) {
        onRefresh();
      }
    }
  });
};

export const createDoubleTapToZoomAction = (onZoom: (scale: number) => void) => {
  let currentScale = 1;
  
  return (node: HTMLElement) => gestures(node, {
    onDoubleTap: () => {
      currentScale = currentScale === 1 ? 2 : 1;
      onZoom(currentScale);
    }
  });
};