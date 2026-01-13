/**
 * Transfers Operations
 * Handles create, delete operations for budget transfers
 */

import { getState } from '../core/OfflineState';

/**
 * Create transfer offline
 * Saves to IndexedDB and queues for sync
 */
export async function createTransferOffline(data: any): Promise<any> {
  const state = getState();
  const tempId = `offline_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate sync hash
  const userId = 1; // TODO: Get current user ID
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
