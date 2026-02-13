/**
 * Pending Records State Management
 *
 * Handles state for pending records functionality including:
 * - Deduplication lock for loadPendingRecords
 * - Call counting for debugging
 */

import {
  getState,
  incrementPendingCallCount,
  setPendingLock,
  getPendingLock,
} from '../../core/DashboardState';

// ============================================================================
// Deduplication Lock Management
// ============================================================================

/**
 * Check if load operation is currently in progress
 */
export function isLoadInProgress(): boolean {
  return getPendingLock() !== null;
}

/**
 * Acquire lock for load operation
 * Returns the lock promise that resolves when operation completes
 */
export function acquireLoadLock(): {
  lockPromise: Promise<void>;
  resolve: () => void;
} {
  let resolveFunc: () => void = () => {};

  const lockPromise = new Promise<void>((resolve) => {
    resolveFunc = resolve;
  });

  setPendingLock(lockPromise);

  return {
    lockPromise,
    resolve: resolveFunc,
  };
}

/**
 * Release the load lock
 */
export function releaseLoadLock(): void {
  setPendingLock(null);
}

/**
 * Wait for existing lock to complete
 */
export async function waitForExistingLock(): Promise<void> {
  const existingLock = getPendingLock();
  if (existingLock) {
    await existingLock;
  }
}

/**
 * Get next call ID for debugging
 */
export function getNextCallId(): number {
  return incrementPendingCallCount();
}

/**
 * Get current call count
 */
export function getCurrentCallCount(): number {
  return getState().loadPendingCallCount;
}
