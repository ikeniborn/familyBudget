/**
 * Upload Handler
 * Synchronizes local PGlite pending operations with backend via WebSocket
 *
 * Task-008: Client-to-server upload with retry logic and progress tracking
 */

import { getPGliteManager } from '@db/pglite';
import type {
  SyncClientChangesRequest,
  SyncClientChangesResponse,
  UploadResult,
} from '../types/events';

// Global debugLog function (declared in index.html)
declare const debugLog: (...args: any[]) => void;

/**
 * UploadHandler class for managing pending operations upload
 */
export class UploadHandler {
  private userId: number;
  private uploadInProgress = false;
  private readonly BATCH_SIZE = 100;          // Max operations per batch
  // Reserved for future retry logic implementation
  // private readonly RETRY_DELAYS = [1000, 2000, 5000];  // Exponential backoff (ms)

  constructor(userId: number) {
    this.userId = userId;
  }

  /**
   * Upload pending operations to server
   * - Queries local_pending_operations (WHERE attempts < max_attempts)
   * - Batches operations (max 100 per request)
   * - Sends via WebSocket sync_client_changes
   * - Returns summary
   */
  async performUpload(): Promise<UploadResult> {
    if (this.uploadInProgress) {
      debugLog('[UPLOAD] Upload already in progress, skipping');
      return { success: false, uploaded: 0, failed: 0, remaining: 0 };
    }

    const pglite = await getPGliteManager();
    if (!pglite.isReady()) {
      debugLog('[UPLOAD] PGlite not initialized');
      return { success: false, uploaded: 0, failed: 0, remaining: 0 };
    }

    if (!(window as any).budgetWSClient) {
      debugLog('[UPLOAD] budgetWSClient not initialized');
      return { success: false, uploaded: 0, failed: 0, remaining: 0 };
    }

    this.uploadInProgress = true;

    try {
      // Get pending operations (retry-eligible only)
      const pending = await pglite.getPendingOperations();

      if (pending.length === 0) {
        debugLog('[UPLOAD] No pending operations to upload');
        return { success: true, uploaded: 0, failed: 0, remaining: 0 };
      }

      debugLog('[UPLOAD] Found pending operations', { count: pending.length });

      // Batch operations (max 100)
      const batch = pending.slice(0, this.BATCH_SIZE);
      const remaining = pending.length - batch.length;

      // Build request
      const request: SyncClientChangesRequest = {
        event: 'sync_client_changes',
        data: {
          user_id: this.userId,
          operations: batch.map(op => ({
            temp_id: op.temp_id || `op-${op.id}`, // Fallback for non-create ops
            operation: op.operation,
            entity_type: op.entity_type,
            payload: op.payload,
            content_hash: op.content_hash,
          }))
        }
      };

      debugLog('[UPLOAD] Sending batch', {
        batch_size: batch.length,
        remaining,
        operations: batch.map(op => ({ operation: op.operation, temp_id: op.temp_id }))
      });

      // Send via WebSocket
      (window as any).budgetWSClient.send(request);

      // Note: Response will be handled by handleUploadResponse() via event dispatcher
      return { success: true, uploaded: batch.length, failed: 0, remaining };
    } catch (error) {
      debugLog('[UPLOAD] Upload failed', error);
      return { success: false, uploaded: 0, failed: 1, remaining: 0 };
    } finally {
      this.uploadInProgress = false;
    }
  }

  /**
   * Handle sync_client_changes_response from server
   * - Confirms successful operations (remove from queue, update fact)
   * - Retries failed operations (increment attempts)
   * - Shows notifications
   */
  async handleUploadResponse(response: SyncClientChangesResponse): Promise<void> {
    const pglite = await getPGliteManager();
    if (!pglite.isReady()) {
      debugLog('[UPLOAD] PGlite not initialized for response handling');
      return;
    }

    const { results, success_count, error_count } = response.data;

    debugLog('[UPLOAD] Processing response', {
      total: results.length,
      success: success_count,
      errors: error_count
    });

    for (const result of results) {
      try {
        if (result.status === 'success' && result.server_id !== null) {
          // Confirm successful upload
          await pglite.confirmPendingOperation(result.temp_id, result.server_id);
          debugLog('[UPLOAD] Confirmed operation', {
            temp_id: result.temp_id,
            server_id: result.server_id
          });
        } else {
          // Retry failed operation
          const errorMsg = result.error || 'Unknown error';
          await pglite.retryPendingOperation(result.temp_id, errorMsg);
          debugLog('[UPLOAD] Retry scheduled', {
            temp_id: result.temp_id,
            error: errorMsg
          });
        }
      } catch (error) {
        debugLog('[UPLOAD] Failed to process result', { temp_id: result.temp_id, error });
      }
    }

    // Show notification
    if (success_count > 0) {
      this.showNotification(`Синхронизировано: ${success_count} операций`, 'success');
    }

    if (error_count > 0) {
      this.showNotification(`Ошибок синхронизации: ${error_count}`, 'warning');
    }

    // Dispatch CustomEvent for UI updates
    const event = new CustomEvent('pglite:upload:complete', {
      detail: {
        success: success_count,
        errors: error_count,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);

    // Invalidate cache
    if ((window as any).BudgetApp?.dataLayer?.invalidateCache) {
      (window as any).BudgetApp.dataLayer.invalidateCache();
      debugLog('[UPLOAD] DataLayer cache invalidated');
    }
  }

  /**
   * Show toast notification (integration with existing notification system)
   */
  private showNotification(message: string, type: 'success' | 'warning' | 'error'): void {
    if ((window as any).showToast) {
      (window as any).showToast(message, type);
    } else {
      debugLog(`[UPLOAD] ${type.toUpperCase()}: ${message}`);
    }
  }

  /**
   * Check if upload is in progress
   */
  isUploadInProgress(): boolean {
    return this.uploadInProgress;
  }
}

// ============================================================================
// Global Instance Management (follows SyncHandler pattern)
// ============================================================================

let uploadHandlerInstance: UploadHandler | null = null;

/**
 * Initialize UploadHandler for logged-in user
 */
export function initUploadHandler(userId: number): void {
  if (uploadHandlerInstance) {
    debugLog('[UPLOAD] UploadHandler already initialized');
    return;
  }

  uploadHandlerInstance = new UploadHandler(userId);
  debugLog('[UPLOAD] UploadHandler initialized', { userId });
}

/**
 * Get global UploadHandler instance
 */
export function getUploadHandler(): UploadHandler | null {
  return uploadHandlerInstance;
}

/**
 * Destroy UploadHandler instance (on logout)
 */
export function destroyUploadHandler(): void {
  if (uploadHandlerInstance) {
    uploadHandlerInstance = null;
    debugLog('[UPLOAD] UploadHandler destroyed');
  }
}

/**
 * Trigger manual upload (for developer console / UI button)
 */
export async function triggerManualUpload(): Promise<UploadResult> {
  const handler = getUploadHandler();
  if (!handler) {
    debugLog('[UPLOAD] UploadHandler not initialized');
    return { success: false, uploaded: 0, failed: 0, remaining: 0 };
  }

  return await handler.performUpload();
}
