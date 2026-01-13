/**
 * Facts Operations (Budget Transactions CRUD)
 * Handles create, update, delete operations for budget facts
 *
 * Extracted from offlineManager.js:428-798 (FACTS section)
 */

import { getState, updateState } from '../core/OfflineState';
import { isOnline } from '../core/stateManager';
import { withDeduplication } from '../core/deduplication';

/**
 * Create Fact (optimistic save)
 * Try online → fallback to offline on error
 *
 * @param data - Fact data
 * @returns Created fact
 */
export async function createFact(data: any): Promise<any> {
  // If offline - save locally immediately
  if (!isOnline()) {
    return await createFactOffline(data);
  }

  // Get adaptive timeout
  const state = getState();
  const timeout = state.isFirstRequest
    ? state.firstRequestTimeout
    : state.normalTimeout;

  // Try online with timeout
  try {
    const result = await createFactOnline(data, timeout);

    // Success - optimize timeout
    updateState({
      isFirstRequest: false,
      normalTimeout: state.optimizedTimeout,
    });

    return result;
  } catch (error) {
    // Fallback to offline
    const offlineItem = await createFactOffline(data);
    return offlineItem;
  }
}

/**
 * Create fact online with timeout
 *
 * @param data - Fact data
 * @param timeout - Timeout in ms
 * @returns Created fact from server
 */
export async function createFactOnline(data: any, timeout: number = 2000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/v1/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to create fact';
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
 * Create fact offline (with deduplication)
 * Saves to IndexedDB and queues for sync
 *
 * @param data - Fact data
 * @returns Offline fact with tempId
 */
export async function createFactOffline(data: any): Promise<any> {
  return await withDeduplication('create', 'fact', data, async () => {
    return await _createFactOfflineInternal(data);
  });
}

/**
 * Internal implementation of createFactOffline
 * @private
 */
async function _createFactOfflineInternal(data: any): Promise<any> {
  const state = getState();

  // Generate content hash for duplicate detection
  const contentHash = state.db.generateContentHash(data);

  // Check for duplicate
  const existing = await state.db.checkDuplicateByHash(contentHash);
  if (existing && !existing.synced) {
    return {
      ...existing.data,
      tempId: existing.tempId,
      _offline: true,
      _synced: false,
      _duplicate: true,
    };
  }

  const tempId = `offline_fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate sync hash for backend deduplication
  const userId = await getCurrentUserId();
  const createdDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const syncHashContent = `${contentHash}|${userId}|${createdDate}`;
  const syncHash = state.db._md5(syncHashContent);

  // Save to IndexedDB (addFact expects the fact data directly)
  await state.db.addFact({
    tempId,
    ...data, // Spread fact data (contains article_id, record_type, etc.)
    sync_hash: syncHash,
  });

  // Add to sync queue
  await state.db.addToSyncQueue({
    entity_type: 'fact',
    operation: 'create',
    tempId,
    data: { ...data, sync_hash: syncHash },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    ...data,
    tempId,
    sync_hash: syncHash,
    _offline: true,
    _synced: false,
  };
}

/**
 * Update fact
 *
 * @param factId - Fact ID
 * @param updates - Updated fields
 * @returns Updated fact
 */
export async function updateFact(factId: number, updates: any): Promise<any> {
  if (!isOnline()) {
    return await updateFactOffline(factId, updates);
  }

  try {
    const response = await fetch(`/api/v1/facts/${factId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to update fact');
    }

    return await response.json();
  } catch (error) {
    return await updateFactOffline(factId, updates);
  }
}

/**
 * Update fact offline
 *
 * @param factId - Fact ID
 * @param updates - Updated fields
 */
export async function updateFactOffline(factId: number, updates: any): Promise<void> {
  const state = getState();

  await state.db.addToSyncQueue({
    entity_type: 'fact',
    operation: 'update',
    tempId: `update_${factId}`,
    data: { id: factId, ...updates },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Delete fact
 *
 * @param factId - Fact ID
 */
export async function deleteFact(factId: number): Promise<void> {
  if (!isOnline()) {
    return await deleteFactOffline(factId);
  }

  try {
    const response = await fetch(`/api/v1/facts/${factId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete fact');
    }
  } catch (error) {
    return await deleteFactOffline(factId);
  }
}

/**
 * Delete fact offline
 *
 * @param factId - Fact ID
 */
export async function deleteFactOffline(factId: number): Promise<void> {
  const state = getState();

  await state.db.addToSyncQueue({
    entity_type: 'fact',
    operation: 'delete',
    tempId: `delete_${factId}`,
    data: { id: factId },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Get current user ID (stub)
 * @private
 */
async function getCurrentUserId(): Promise<number> {
  // TODO: Implement proper user ID retrieval
  return 1;
}
