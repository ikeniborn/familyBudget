/**
 * Transfers Operations
 * Handles create, delete operations for budget transfers
 */

import { getState, updateState } from '../core/OfflineState';
import { isOnline } from '../core/stateManager';

/**
 * Create Transfer (optimistic save)
 * Try online → fallback to offline on error
 *
 * @param data - Transfer data
 * @returns Created transfer
 */
export async function createTransfer(data: any): Promise<any> {
  // If offline - save locally immediately
  if (!isOnline()) {
    return await createTransferOffline(data);
  }

  // Get adaptive timeout
  const state = getState();
  const timeout = state.isFirstRequest
    ? state.firstRequestTimeout
    : state.normalTimeout;

  // Try online with timeout
  try {
    const result = await createTransferOnline(data, timeout);

    // Success - optimize timeout
    updateState({
      isFirstRequest: false,
      normalTimeout: state.optimizedTimeout,
    });

    return result;
  } catch (error) {
    // Fallback to offline
    return await createTransferOffline(data);
  }
}

/**
 * Create transfer online with timeout
 *
 * @param data - Transfer data
 * @param timeout - Timeout in ms
 * @returns Created transfer from server
 */
export async function createTransferOnline(data: any, timeout: number = 3000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/v1/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to create transfer';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    // Notify network detector of success
    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestSuccess();
    }

    return await response.json();
  } catch (error) {
    // Notify network detector of failure
    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestFailure();
    }
    throw error;
  }
}

/**
 * Create transfer offline
 * Saves to IndexedDB and queues for sync
 */
export async function createTransferOffline(data: any): Promise<any> {
  const state = getState();
  const tempId = `offline_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate sync hash
  const userId = await getCurrentUserId();
  const createdDate = new Date().toISOString().split('T')[0];
  const contentHash = state.db.generateContentHash(data);
  const syncHashContent = `${contentHash}|${userId}|${createdDate}`;
  const syncHash = state.db._md5(syncHashContent);

  // Save to IndexedDB
  await state.db.addTransfer({
    tempId,
    ...data,
    sync_hash: syncHash,
  });

  // Add to sync queue
  await state.db.addToSyncQueue({
    entity_type: 'transfer',
    operation: 'create',
    tempId,
    data: { ...data, sync_hash: syncHash },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { ...data, tempId, sync_hash: syncHash, _offline: true };
}

/**
 * Delete transfer (coordinator)
 * Try online → fallback to offline on error
 *
 * @param transferId - Transfer ID
 */
export async function deleteTransfer(transferId: number): Promise<void> {
  if (!isOnline()) {
    return await deleteTransferOffline(transferId);
  }

  try {
    const response = await fetch(`/api/v1/transfers/${transferId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete transfer');
    }
  } catch (error) {
    return await deleteTransferOffline(transferId);
  }
}

/**
 * Delete transfer offline
 */
export async function deleteTransferOffline(transferId: number): Promise<void> {
  const state = getState();

  await state.db.addToSyncQueue({
    entity_type: 'transfer',
    operation: 'delete',
    tempId: `delete_${transferId}`,
    data: { id: transferId },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Get current user ID with 3 fallback mechanisms
 * @private
 *
 * @returns User ID
 * @throws Error if unable to get user ID
 */
async function getCurrentUserId(): Promise<number> {
  // 1. Try window.currentUser (set by backend template)
  if (typeof window !== 'undefined' && (window as any).currentUser?.id) {
    return (window as any).currentUser.id;
  }

  // 2. Try fetch /api/v1/users/me
  try {
    const response = await fetch('/api/v1/users/me', {
      credentials: 'include',
      // Short timeout to avoid blocking offline operations
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const user = await response.json();
      if (user && user.id) {
        return user.id;
      }
    }
  } catch (e) {
    // Fetch failed (offline, timeout, etc.) - try next fallback
  }

  // 3. Fallback: Cannot create offline without user ID
  throw new Error(
    'Cannot get user ID for offline operation. ' +
    'Please ensure you are logged in and try again.'
  );
}
