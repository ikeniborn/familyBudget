/**
 * Worker Integration
 * Web Worker for async hash generation (performance optimization)
 *
 * Extracted from offlineManager.js:23-42
 *
 * Offloads CPU-intensive hash generation to Web Worker to avoid blocking main thread.
 * Falls back to synchronous MD5 if worker unavailable.
 */

import { getState, updateState } from './OfflineState';

/**
 * Initialize Web Worker for hash generation
 * Creates WorkerWrapper instance and stores in state
 *
 * Call this ONCE during app initialization (optional - worker is not required)
 *
 * @example
 * ```typescript
 * // During app initialization (after initializeOfflineManager)
 * initializeWorker();
 * ```
 */
export function initializeWorker(): void {
  const state = getState();

  // Skip if worker already initialized
  if (state.workerWrapper) {
    return;
  }

  // Check if WorkerWrapper is available globally
  if (typeof window !== 'undefined' && typeof (window as any).WorkerWrapper !== 'undefined') {
    try {
      const WorkerWrapperClass = (window as any).WorkerWrapper;

      // Create worker instance
      const worker = new WorkerWrapperClass('/static/js/workers/syncWorker.min.js', {
        idleTimeout: 60000, // 60s idle timeout before worker termination
        debugMode: (window as any).DEBUG_MODE || false,
      });

      // Store worker in state
      updateState({ workerWrapper: worker });
    } catch (error) {
      console.warn('[OfflineManager] Failed to initialize worker:', error);
      // Fallback: continue without worker (sync hash generation)
    }
  }
}

/**
 * Generate sync hash asynchronously using Web Worker
 * Falls back to synchronous MD5 if worker unavailable
 *
 * @param contentHash - Content hash (entity data hash)
 * @param userId - User ID (for multi-user deduplication)
 * @param createdDate - Creation date ISO string (for temporal deduplication)
 * @returns Promise with sync hash (MD5 of contentHash|userId|createdDate)
 *
 * @example
 * ```typescript
 * const syncHash = await generateSyncHashAsync(
 *   'abc123def456',
 *   42,
 *   '2025-01-14T18:00:00.000Z'
 * );
 * // Output: "d41d8cd98f00b204e9800998ecf8427e"
 * ```
 */
export async function generateSyncHashAsync(
  contentHash: string,
  userId: number,
  createdDate: string
): Promise<string> {
  const state = getState();

  // Try async worker execution
  if (state.workerWrapper) {
    try {
      const syncHash = await state.workerWrapper.execute('generateSyncHash', {
        contentHash,
        userId,
        createdDate,
      });

      return syncHash;
    } catch (error) {
      console.warn('[OfflineManager] Worker execution failed, falling back to sync:', error);
      // Fall through to synchronous fallback
    }
  }

  // Fallback: synchronous MD5 generation in main thread
  return generateSyncHashSync(contentHash, userId, createdDate);
}

/**
 * Generate sync hash synchronously (fallback)
 * Uses IndexedDB manager's MD5 implementation
 *
 * @param contentHash - Content hash
 * @param userId - User ID
 * @param createdDate - Creation date ISO string
 * @returns Sync hash (MD5)
 *
 * @private
 */
function generateSyncHashSync(
  contentHash: string,
  userId: number,
  createdDate: string
): string {
  const state = getState();

  // Combine inputs
  const combined = `${contentHash}|${userId}|${createdDate}`;

  // Use IndexedDB manager's MD5 function
  if (state.db && typeof state.db._md5 === 'function') {
    return state.db._md5(combined);
  }

  // Last resort: simple hash (NOT cryptographic, only for deduplication)
  // This should never happen in production (db._md5 always available)
  return simpleFallbackHash(combined);
}

/**
 * Simple fallback hash function (non-cryptographic)
 * Used only if MD5 is unavailable (should never happen)
 *
 * @param str - String to hash
 * @returns Hash string (32 chars, hex)
 *
 * @private
 */
function simpleFallbackHash(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert to hex string (pad to 32 chars to match MD5 format)
  const hex = Math.abs(hash).toString(16).padStart(32, '0');
  return hex;
}

/**
 * Terminate worker and clean up resources
 * Call this during app shutdown or when worker no longer needed
 *
 * @example
 * ```typescript
 * // On app shutdown
 * terminateWorker();
 * ```
 */
export function terminateWorker(): void {
  const state = getState();

  if (state.workerWrapper) {
    try {
      // WorkerWrapper should have a terminate() method
      if (typeof state.workerWrapper.terminate === 'function') {
        state.workerWrapper.terminate();
      }

      // Clear worker from state
      updateState({ workerWrapper: null });
    } catch (error) {
      console.warn('[OfflineManager] Failed to terminate worker:', error);
    }
  }
}

/**
 * Check if worker is available and initialized
 *
 * @returns true if worker is initialized and ready
 *
 * @example
 * ```typescript
 * if (isWorkerAvailable()) {
 *   // Use async hash generation
 * } else {
 *   // Fallback to sync generation
 * }
 * ```
 */
export function isWorkerAvailable(): boolean {
  const state = getState();
  return state.workerWrapper !== null;
}

/**
 * Get worker status for debugging
 *
 * @returns Worker status object
 *
 * @example
 * ```typescript
 * const status = getWorkerStatus();
 * // Output: { available: true, type: 'WorkerWrapper', idleTimeout: 60000 }
 * ```
 */
export function getWorkerStatus(): {
  available: boolean;
  type: string | null;
  idleTimeout: number | null;
} {
  const state = getState();

  if (state.workerWrapper) {
    return {
      available: true,
      type: state.workerWrapper.constructor?.name || 'WorkerWrapper',
      idleTimeout: state.workerWrapper.idleTimeout || null,
    };
  }

  return {
    available: false,
    type: null,
    idleTimeout: null,
  };
}

/**
 * Global type declarations
 * WorkerWrapper is loaded globally via script tag
 */
declare global {
  interface Window {
    WorkerWrapper?: any;
    DEBUG_MODE?: boolean;
  }
}
