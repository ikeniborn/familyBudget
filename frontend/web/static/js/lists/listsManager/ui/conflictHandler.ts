/**
 * Conflict Handler - Integration layer for Shopping Lists conflict resolution
 * Task-013: Conflict Resolution Modal UI
 *
 * Provides:
 * - ConflictQueue for sequential processing of conflicts (FIFO)
 * - handleShoppingConflict() public API for sync integration
 * - Modal lifecycle management
 */

import type { PGlite } from '@electric-sql/pglite';
import type { ShoppingConflictDetection, ResolutionStrategy } from '../../../../../../shared/db/pglite/types/conflicts';
import { ShoppingConflictManager } from '../../../../../../shared/db/pglite/ShoppingConflictManager';
import { ConflictResolutionModal } from '../../../modules/uiComponents/modals/ConflictResolutionModal';
import { logger } from '../../../../../../shared/db/pglite/utils/logger';

/**
 * ConflictQueue class
 * Manages sequential processing of conflicts (FIFO)
 */
class ConflictQueue {
  private queue: Array<{ conflict: ShoppingConflictDetection; db: PGlite }> = [];
  private isProcessing: boolean = false;
  private currentModal: ConflictResolutionModal | null = null;

  /**
   * Add conflict to queue and trigger processing
   */
  enqueue(conflict: ShoppingConflictDetection, db: PGlite): void {
    this.queue.push({ conflict, db });
    logger.debug(`[CONFLICT_QUEUE] Enqueued conflict (queue size: ${this.queue.length})`);

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process conflicts sequentially (FIFO)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Already processing
    }

    if (this.queue.length === 0) {
      logger.debug('[CONFLICT_QUEUE] Queue empty');
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!; // Get first item (FIFO)
      logger.debug(`[CONFLICT_QUEUE] Processing conflict (${this.queue.length} remaining)`, {
        entityType: item.conflict.entityType,
        temp_id: item.conflict.tempId,
      });

      try {
        // Show modal and wait for user resolution
        await this.showResolutionModal(item.conflict, item.db);
      } catch (error) {
        console.error('[CONFLICT_QUEUE] Failed to process conflict', error);
        // Continue processing remaining conflicts even if one fails
      }
    }

    this.isProcessing = false;
    logger.debug('[CONFLICT_QUEUE] All conflicts processed');
  }

  /**
   * Show conflict resolution modal and wait for user decision
   * @returns Promise that resolves when user makes a decision
   */
  private showResolutionModal(conflict: ShoppingConflictDetection, db: PGlite): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create modal
      this.currentModal = new ConflictResolutionModal({
        id: `conflict-modal-${conflict.tempId}`,
        conflict,
        onResolve: async (strategy: ResolutionStrategy) => {
          try {
            await this.applyResolution(conflict, strategy, db);
            resolve(); // Resolve promise after successful resolution
          } catch (error) {
            reject(error); // Reject promise on error
          }
        },
        onCancel: () => {
          // User cancelled - log but don't block queue
          logger.debug('[CONFLICT_QUEUE] User cancelled conflict resolution', {
            temp_id: conflict.tempId,
          });
          resolve(); // Resolve anyway to allow processing of next conflict
        },
        onClose: () => {
          // Cleanup modal after close
          this.cleanup();
        },
      });

      // Render modal to DOM
      const modalElement = this.currentModal.render();
      document.body.appendChild(modalElement);

      // Open modal
      this.currentModal.open();
    });
  }

  /**
   * Apply resolution strategy using ShoppingConflictManager
   */
  private async applyResolution(
    conflict: ShoppingConflictDetection,
    strategy: ResolutionStrategy,
    db: PGlite
  ): Promise<void> {
    const conflictManager = new ShoppingConflictManager(db);

    logger.debug('[CONFLICT_QUEUE] Applying resolution', {
      temp_id: conflict.tempId,
      strategy,
    });

    if (strategy === 'server') {
      await conflictManager.applyServerResolution(conflict);
    } else if (strategy === 'client') {
      await conflictManager.applyClientResolution(conflict);
    } else if (strategy === 'merge') {
      // Task-014: Smart merge with OR logic for is_completed, MAX for quantity
      await conflictManager.applyMergeResolution(conflict);
    } else {
      throw new Error(`Unknown resolution strategy: ${strategy}`);
    }

    logger.debug('[CONFLICT_QUEUE] Resolution applied successfully', {
      temp_id: conflict.tempId,
      strategy,
    });
  }

  /**
   * Cleanup current modal instance
   */
  private cleanup(): void {
    if (this.currentModal) {
      this.currentModal.destroy();
      this.currentModal = null;
    }
  }

  /**
   * Get current queue size (for debugging)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

/**
 * Singleton instance of ConflictQueue
 */
const conflictQueue = new ConflictQueue();

/**
 * Public API: Handle shopping list conflict
 * Called from shoppingSync.ts when conflict is detected
 *
 * @param conflict - Conflict detection result
 * @param db - PGlite database instance
 */
export async function handleShoppingConflict(conflict: ShoppingConflictDetection, db: PGlite): Promise<void> {
  logger.debug('[SHOPPING_CONFLICT] Handling conflict', {
    entityType: conflict.entityType,
    temp_id: conflict.tempId,
    conflictType: conflict.conflictType,
    changedFieldsCount: conflict.changedFields.filter((f) => f.isDifferent).length,
  });

  // Enqueue conflict for sequential processing
  conflictQueue.enqueue(conflict, db);
}

/**
 * Export conflict queue for debugging/testing
 */
export { conflictQueue };
