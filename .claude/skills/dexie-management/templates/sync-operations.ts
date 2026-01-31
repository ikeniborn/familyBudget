/**
 * Sync Operations Template
 * Замените {Model} и {models} на actual model name
 */

import { db, toCents } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type { Local{Model}, LocalPendingOperation } from '../types/{model}';

/**
 * UPLOAD pending operations
 */
export async function uploadPending{Models}(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  const pendingOps = await db.pendingOperations
    .where('entity_type').equals('{model}')
    .toArray();

  if (pendingOps.length === 0) {
    return { success: true, uploaded: 0, failed: 0 };
  }

  let uploaded = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      await uploadOperation(op);
      uploaded++;
    } catch (error) {
      logger.error('[{model}Sync] Upload failed:', error);
      failed++;
    }
  }

  return { success: failed === 0, uploaded, failed };
}

async function uploadOperation(op: LocalPendingOperation): Promise<void> {
  let endpoint: string;
  let method: string;

  switch (op.operation) {
    case 'create':
      endpoint = '/api/v1/{models}';
      method = 'POST';
      break;
    case 'update':
      endpoint = `/api/v1/{models}/${op.server_id}`;
      method = 'PUT';
      break;
    case 'delete':
      endpoint = `/api/v1/{models}/${op.server_id}`;
      method = 'DELETE';
      break;
  }

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: op.operation !== 'delete' ? JSON.stringify(op.payload) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  if (op.operation === 'create') {
    const result = await response.json();
    await db.{models}.where('temp_id').equals(op.temp_id!).modify({
      id: result.id,
      sync_status: 'synced',
      synced_at: new Date()
    });
  }

  await db.pendingOperations.where('temp_id').equals(op.temp_id!).delete();
}

/**
 * DOWNLOAD from server
 */
export async function download{Models}(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; count: number }> {
  try {
    let url = `/api/v1/{models}?user_id=${userId}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const items: Local{Model}[] = await response.json();

    const itemsWithCents = items.map(item => ({
      ...item,
      amount: toCents(item.amount), // ⚠️ Only if amount field exists
      sync_status: 'synced' as const,
      synced_at: new Date()
    }));

    await db.{models}.bulkPut(itemsWithCents);

    await db.syncMetadata.put({
      entity_type: '{models}',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: items.length
    });

    return { success: true, count: items.length };
  } catch (error) {
    logger.error('[{model}Sync] Download failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * FULL SYNC (upload + download)
 */
export async function fullSync{Models}(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  failed: number;
}> {
  const uploadResult = await uploadPending{Models}();
  const downloadResult = await download{Models}(userId, dateFrom, dateTo);

  return {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadResult.failed
  };
}
