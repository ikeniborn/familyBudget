/**
 * Deduplication Logic for Offline Operations
 * Implements 3-level deduplication to prevent duplicate operations
 *
 * Level 1: Request-level (pendingCreates Map) - prevents concurrent duplicates
 * Level 2: Content-hash - prevents duplicate content in IndexedDB
 * Level 3: Sync-hash - prevents duplicates on backend
 */

import { getState, updateState } from './OfflineState';
import type { PendingOperation } from './OfflineState';

/**
 * Create operation key for deduplication
 * Format: "${operation}_${entityType}_${contentHash}"
 *
 * @param operation - Operation type (create, update, delete)
 * @param entityType - Entity type (fact, transfer, plan, recurring_plan)
 * @param data - Operation data
 * @returns Operation key string
 */
export function createOperationKey(
  operation: string,
  entityType: string,
  data: any
): string {
  const state = getState();
  const contentHash = state.db.generateContentHash(data);
  return `${operation}_${entityType}_${contentHash}`;
}

/**
 * Get pending operation promise from cache
 * Returns existing promise if operation is already in progress
 *
 * @param key - Operation key
 * @returns Pending promise or undefined
 */
export function getPendingOperation(key: string): Promise<any> | undefined {
  const state = getState();
  const operation = state.pendingCreates.get(key);
  return operation?.promise;
}

/**
 * Set pending operation in cache
 * Caches promise to prevent duplicate concurrent operations
 *
 * @param key - Operation key
 * @param promise - Operation promise
 */
export function setPendingOperation(key: string, promise: Promise<any>): void {
  const state = getState();
  const pendingCreates = new Map(state.pendingCreates);

  const operation: PendingOperation = {
    operationKey: key,
    promise,
    timestamp: Date.now(),
  };

  pendingCreates.set(key, operation);
  updateState({ pendingCreates });
}

/**
 * Clear pending operation from cache
 * Called after operation completes or after timeout
 *
 * @param key - Operation key
 */
export function clearPendingOperation(key: string): void {
  const state = getState();
  const pendingCreates = new Map(state.pendingCreates);
  pendingCreates.delete(key);
  updateState({ pendingCreates });
}

/**
 * Wrap operation with deduplication
 * Prevents concurrent duplicate operations by caching promises
 *
 * Usage:
 * ```typescript
 * const result = await withDeduplication(
 *   'create',
 *   'fact',
 *   data,
 *   () => _createFactInternal(data)
 * );
 * ```
 *
 * @param operation - Operation type
 * @param entityType - Entity type
 * @param data - Operation data
 * @param fn - Function to execute (only runs once per unique operation)
 * @returns Operation result
 */
export async function withDeduplication<T>(
  operation: string,
  entityType: string,
  data: any,
  fn: () => Promise<T>
): Promise<T> {
  const operationKey = createOperationKey(operation, entityType, data);

  // Check if operation already in progress
  const existingPromise = getPendingOperation(operationKey);
  if (existingPromise) {
    // Deduplication hit - reuse existing promise
    return await existingPromise;
  }

  // Create new promise and cache it
  const promise = fn();
  setPendingOperation(operationKey, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    // Clear cache after 5 seconds (allows for rapid successive calls)
    setTimeout(() => {
      clearPendingOperation(operationKey);
    }, 5000);
  }
}
