/**
 * SwipeHandler - Handles swipe gestures for Hierarchy View items
 * Enables swipe-to-action (edit/delete) on mobile devices
 */

import type { HTMLElementWithHandlers } from '../types/hierarchy';

// Global functions from templates (onclick handlers)
declare const openEditItemModal: (itemId: number) => void;
declare const closeItemModal: () => void;
declare const debugLog: (...args: any[]) => void;

export class SwipeHandler {
  private activeSwipedItemId: number | null = null;
  private modalOpenedBySwipe: number | null = null;
  private startX: number | null = null;
  private startY: number | null = null;
  private currentX: number | null = null;
  private currentY: number | null = null;
  private isDragging: boolean = false;
  private hasMoved: boolean = false;
  private readonly SWIPE_THRESHOLD: number = 0.5; // 50% of item width

  constructor() {
    // SwipeHandler is self-contained and doesn't need external dependencies
  }

  /**
   * Handle touch start event
   */
  handleTouchStart(e: TouchEvent, itemId: number, itemElement: HTMLElement): void {
    try {
      // CRITICAL: Disable swipe for completed items (no indicator, no action needed)
      if (itemElement.classList.contains('completed')) {
        return;
      }

      // Check if touch event has touches array (graceful degradation)
      if (!e.touches || e.touches.length === 0) {
        console.warn('[SwipeHandler] No touch points detected');
        return;
      }

      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.currentX = this.startX; // CRITICAL: Initialize to prevent undefined in handleTouchEnd
      this.currentY = this.startY;
      this.isDragging = true;
      this.hasMoved = false; // Track if finger actually moved

      // Close other swiped items
      if (this.activeSwipedItemId && this.activeSwipedItemId !== itemId) {
        this.closeAllSwipes();
      }

      // Add swiping class to CONTENT element (disables transition during drag)
      const contentElement = itemElement.querySelector('.hierarchy-item-content') as HTMLElement | null;
      if (contentElement) {
        contentElement.classList.add('swiping');
      }
    } catch (error) {
      console.error('[SwipeHandler] Error in handleTouchStart:', error);
      // Reset state on error
      this.isDragging = false;
      this.hasMoved = false;
    }
  }

  /**
   * Handle touch move event
   */
  handleTouchMove(e: TouchEvent, _itemId: number, itemElement: HTMLElement): void {
    try {
      if (!this.isDragging) return;

      // Check if touch event has touches array
      if (!e.touches || e.touches.length === 0) {
        this.isDragging = false;
        return;
      }

      this.currentX = e.touches[0].clientX;
      this.currentY = e.touches[0].clientY;
      const deltaX = this.currentX - (this.startX ?? 0);
      const deltaY = this.currentY - (this.startY ?? 0);

      // CRITICAL: Mark as moved if finger moved more than 5px (prevents accidental taps)
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance > 5) {
        this.hasMoved = true;
      }

      const contentElement = itemElement.querySelector('.hierarchy-item-content') as HTMLElement | null;
      if (!contentElement) return;

      // Allow both left swipe (open) and right swipe (close)
      if (deltaX > 0) {
        // Right swipe - close if already swiped
        if (itemElement.classList.contains('swiped')) {
          const swipeDistance = Math.min(deltaX, itemElement.offsetWidth * this.SWIPE_THRESHOLD);
          const targetTransform = -(itemElement.offsetWidth * this.SWIPE_THRESHOLD - swipeDistance);
          contentElement.style.transform = `translateX(${targetTransform}px)`;
        } else {
          // CRITICAL: Remove transform completely to avoid creating containing block
          contentElement.style.removeProperty('transform');
        }
        return;
      }

      const itemWidth = itemElement.offsetWidth;
      const maxSwipe = itemWidth * this.SWIPE_THRESHOLD;

      // Limit swipe to threshold
      const swipeDistance = Math.max(deltaX, -maxSwipe);
      contentElement.style.transform = `translateX(${swipeDistance}px)`;
    } catch (error) {
      console.error('[SwipeHandler] Error in handleTouchMove:', error);
      // Reset dragging state on error
      this.isDragging = false;
    }
  }

  /**
   * Handle touch end event
   */
  handleTouchEnd(_e: TouchEvent, itemId: number, itemElement: HTMLElement): void {
    try {
      if (!this.isDragging) return;

      this.isDragging = false;
      const deltaX = (this.currentX ?? 0) - (this.startX ?? 0);
      const itemWidth = itemElement.offsetWidth;
      const threshold = itemWidth * this.SWIPE_THRESHOLD;

      const contentElement = itemElement.querySelector('.hierarchy-item-content') as HTMLElement | null;
      if (!contentElement) return;

      // Remove swiping class (re-enable transition)
      contentElement.classList.remove('swiping');

      // CRITICAL: Ignore tap without movement (prevents accidental modal opens)
      if (!this.hasMoved) {
        this.resetSwipe(itemId, itemElement);
        // CRITICAL: Reset hasMoved for taps too (v7.0.1)
        // Without this, second tap won't trigger click event
        this.hasMoved = false;
        return;
      }

      // Determine action based on threshold
      if (deltaX < 0 && Math.abs(deltaX) >= threshold) {
        // Left swipe - OPEN MODAL DIRECTLY
        this.openEditModal(itemId, itemElement);
      } else if (deltaX > 0 && Math.abs(deltaX) >= threshold) {
        // Right swipe - CLOSE MODAL IF OPEN
        this.closeModalIfOpen(itemId);
      } else {
        // Snap back (gesture incomplete)
        this.resetSwipe(itemId, itemElement);
      }

      // CRITICAL: Reset hasMoved after swipe processing to allow subsequent clicks (v7.0.1)
      // Without this, hasMoved stays true and blocks all future clicks until next touchstart
      this.hasMoved = false;
    } catch (error) {
      console.error('[SwipeHandler] Error in handleTouchEnd:', error);
      // Reset all state on error
      this.isDragging = false;
      this.hasMoved = false;
    }
  }

  /**
   * Open edit modal (called after successful left swipe)
   */
  openEditModal(itemId: number, itemElement: HTMLElement): void {
    // Reset visual state immediately
    this.resetSwipe(itemId, itemElement);

    // Track that this swipe opened the modal
    this.modalOpenedBySwipe = itemId;

    // Call global modal function (defined in listsManager.js)
    if (typeof openEditItemModal === 'function') {
      openEditItemModal(itemId);
    } else {
      console.error('[SWIPE] openEditItemModal function not found');
    }
  }

  /**
   * Close modal if currently open (for right swipe)
   */
  closeModalIfOpen(itemId: number): void {
    const modal = document.getElementById('item-modal') as HTMLDialogElement | null;

    // Only close if modal is open AND was opened by swipe for THIS item
    if (modal && modal.open && this.modalOpenedBySwipe === itemId) {
      if (typeof closeItemModal === 'function') {
        closeItemModal();
        this.modalOpenedBySwipe = null;
      }
    }
  }

  /**
   * Reset swipe visual state (snap back to original position)
   *
   * CRITICAL: Must remove inline transform completely, not just set to 'translateX(0)'.
   * Reason: Any transform value creates a new containing block, causing
   * absolutely positioned .swipe-indicator to position relative to content
   * instead of .hierarchy-item (breaks right: 0.75rem positioning).
   */
  resetSwipe(itemId: number, itemElement: HTMLElement): void {
    const contentElement = itemElement.querySelector('.hierarchy-item-content') as HTMLElement | null;
    if (contentElement) {
      // Step 1: Remove swiping class to re-enable transitions
      contentElement.classList.remove('swiping');

      // Step 2: Force reflow to apply transition re-enablement
      void contentElement.offsetHeight;

      // Step 3: Remove inline transform (triggers animated transition back)
      // CRITICAL: Must remove completely, not set to 'translateX(0)'.
      // Any transform value creates a containing block, breaking .swipe-indicator positioning.
      contentElement.style.removeProperty('transform');
    }

    // Clear any swiped state
    itemElement.classList.remove('swiped');
    if (this.activeSwipedItemId === itemId) {
      this.activeSwipedItemId = null;
    }
  }

  /**
   * Close all open swipes
   */
  closeAllSwipes(): void {
    if (this.activeSwipedItemId) {
      const swipedElement = document.querySelector(
        `.hierarchy-item[data-item-id="${this.activeSwipedItemId}"]`
      ) as HTMLElement | null;
      if (swipedElement) {
        this.resetSwipe(this.activeSwipedItemId, swipedElement);
      }
    }
  }

  /**
   * Setup event listeners for all items
   */
  setupSwipeHandlers(): void {
    const items = document.querySelectorAll('.hierarchy-item') as NodeListOf<HTMLElementWithHandlers>;

    items.forEach((itemElement) => {
      const itemId = parseInt(itemElement.dataset.itemId ?? '0', 10);
      const contentElement = itemElement.querySelector('.hierarchy-item-content') as HTMLElementWithHandlers | null;
      const swipeIndicator = itemElement.querySelector('.swipe-indicator') as HTMLElementWithHandlers | null;

      // Remove old listeners (if any)
      if (itemElement._touchStartHandler) {
        itemElement.removeEventListener('touchstart', itemElement._touchStartHandler);
      }
      if (itemElement._touchMoveHandler) {
        itemElement.removeEventListener('touchmove', itemElement._touchMoveHandler);
      }
      if (itemElement._touchEndHandler) {
        itemElement.removeEventListener('touchend', itemElement._touchEndHandler);
      }
      if (contentElement && contentElement._clickHandler) {
        contentElement.removeEventListener('click', contentElement._clickHandler);
      }
      if (swipeIndicator) {
        if (swipeIndicator._blockTouchStart) {
          swipeIndicator.removeEventListener('touchstart', swipeIndicator._blockTouchStart);
        }
        if (swipeIndicator._blockTouchEnd) {
          swipeIndicator.removeEventListener('touchend', swipeIndicator._blockTouchEnd);
        }
        if (swipeIndicator._blockClick) {
          swipeIndicator.removeEventListener('click', swipeIndicator._blockClick);
        }
      }

      // Create bound handlers
      itemElement._touchStartHandler = (e: TouchEvent) => this.handleTouchStart(e, itemId, itemElement);
      itemElement._touchMoveHandler = (e: TouchEvent) => this.handleTouchMove(e, itemId, itemElement);
      itemElement._touchEndHandler = (e: TouchEvent) => this.handleTouchEnd(e, itemId, itemElement);

      // Click handler for content: toggle completion or close swipe
      if (contentElement) {
        contentElement._clickHandler = (e: MouseEvent) => {
          // CRITICAL: Block clicks in right zone (where swipe indicator is)
          // Indicator has pointer-events: none, so clicks pass through to content
          // Need to check click coordinates, not just e.target
          const rect = contentElement.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickFromRight = rect.width - clickX;

          // Block clicks in right 120px zone (indicator zone)
          // Indicator width: ~90px (icon + 3 chevrons + gaps + padding)
          if (clickFromRight < 120) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }

          // CRITICAL: Block clicks on swipe indicator (iOS Safari PWA fix)
          if ((e.target as HTMLElement).closest('.swipe-indicator')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return;
          }

          // Close swipe if currently swiped
          if (itemElement.classList.contains('swiped')) {
            e.preventDefault();
            e.stopPropagation();
            this.resetSwipe(itemId, itemElement);
            return;
          }

          // Toggle item completion
          const isCompleted = itemElement.dataset.itemCompleted === 'true';

          if (window.listsManager && typeof window.listsManager.toggleItemCompleted === 'function') {
            window.listsManager.toggleItemCompleted(itemId, !isCompleted);
          } else {
            console.error('[CONTENT_CLICK] listsManager.toggleItemCompleted not found');
          }
        };
        contentElement.addEventListener('click', contentElement._clickHandler);
      }

      // CRITICAL: Block ALL events on swipe indicator (iOS Safari fix)
      // Prevents indicator from triggering parent onclick handlers
      if (swipeIndicator) {
        swipeIndicator._blockTouchStart = (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        };
        swipeIndicator._blockTouchEnd = (e: TouchEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        };
        swipeIndicator._blockClick = (e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        };

        // Add event listeners with capture phase for maximum blocking
        swipeIndicator.addEventListener('touchstart', swipeIndicator._blockTouchStart, {
          passive: false,
          capture: true,
        });
        swipeIndicator.addEventListener('touchend', swipeIndicator._blockTouchEnd, {
          passive: false,
          capture: true,
        });
        swipeIndicator.addEventListener('click', swipeIndicator._blockClick, { capture: true });
      }

      // Add listeners with passive: false for preventDefault() support
      itemElement.addEventListener('touchstart', itemElement._touchStartHandler, { passive: false });
      itemElement.addEventListener('touchmove', itemElement._touchMoveHandler, { passive: false });
      itemElement.addEventListener('touchend', itemElement._touchEndHandler, { passive: false });
    });
  }

  /**
   * Diagnostic method - call from console to debug swipe state
   * Usage: window.hierarchyView.swipeHandler.diagnoseSwipe()
   */
  diagnoseSwipe(): NodeListOf<Element> {
    return document.querySelectorAll('.hierarchy-item.swiped');
  }
}
