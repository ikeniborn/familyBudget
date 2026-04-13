/**
 * Budget Facts Sync Operations
 * Синхронизация транзакций (offline → server, server → local)
 */

import { db } from '../core/database';
import { logger } from '../utils/logger';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { bulkInsertFacts } from './bulkOperations';
import {
  getPendingOperations,
  confirmPendingOperation,
  failPendingOperation
} from './factOperations';
import { mapAPIFactToLocal, mapLocalFactToAPI, validateMappedFact } from '../utils/apiMapper';
import type {
  LocalBudgetFact,
  LocalPendingOperation
} from '../types/fact';

/**
 * Upload pending operations to server
 * Синхронизация offline изменений
 *
 * @returns Sync result
 */
export async function uploadPendingOperations(): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
}> {
  logger.info('[factSync] Uploading pending operations...');

  const pendingOps = await getPendingOperations();

  if (pendingOps.length === 0) {
    logger.info('[factSync] No pending operations');
    return { success: true, uploaded: 0, failed: 0 };
  }

  logger.info('[factSync] Found pending operations', { count: pendingOps.length });

  let uploaded = 0;
  let failed = 0;

  for (const op of pendingOps) {
    try {
      await uploadOperation(op);
      uploaded++;
    } catch (error) {
      logger.error('[factSync] ❌ Operation upload failed:', error);
      failed++;

      // Mark operation as failed
      if (op.temp_id) {
        await failPendingOperation(op.temp_id, (error as Error).message);
      }
    }
  }

  logger.info('[factSync] Upload complete', { uploaded, failed });

  return {
    success: failed === 0,
    uploaded,
    failed
  };
}

/**
 * Upload single operation to server
 */
async function uploadOperation(op: LocalPendingOperation): Promise<void> {
  logger.debug('[factSync] Uploading operation', {
    operation: op.operation,
    entity_type: op.entity_type,
    temp_id: op.temp_id
  });

  // Recurring plans use a different endpoint and raw payload (not mapLocalFactToAPI)
  if (op.entity_type === 'recurring_plan' && op.operation === 'create') {
    const response = await fetchWithTimeout('/api/v1/recurring-plans/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op.payload),
      credentials: 'include'
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }
    // Remove from pending queue — server will populate db.recurringPlans on next sync
    if (op.temp_id) {
      await db.pendingOperations.where('temp_id').equals(op.temp_id).delete();
    }
    return;
  }

  let endpoint: string;
  let method: string;

  switch (op.operation) {
    case 'create':
      endpoint = '/api/v1/facts';
      method = 'POST';
      break;
    case 'update':
      if (!op.server_id) {
        throw new Error('server_id required for update');
      }
      endpoint = `/api/v1/facts/${op.server_id}`;
      method = 'PUT';
      break;
    case 'delete':
      if (!op.server_id) {
        throw new Error('server_id required for delete');
      }
      endpoint = `/api/v1/facts/${op.server_id}`;
      method = 'DELETE';
      break;
    default:
      throw new Error(`Unknown operation: ${op.operation}`);
  }

  // MAP DEXIE → API before sending
  const apiPayload = op.operation !== 'delete'
    ? mapLocalFactToAPI(op.payload as Partial<LocalBudgetFact>)
    : undefined;

  const response = await fetchWithTimeout(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: apiPayload ? JSON.stringify(apiPayload) : undefined,
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  // Для create получаем server ID
  if (op.operation === 'create') {
    const result = await response.json();
    const serverId = result.id;

    // Confirm operation
    if (op.temp_id) {
      await confirmPendingOperation(op.temp_id, serverId);
    }
  } else if (op.operation === 'update') {
    if (op.temp_id) {
      const tempId = op.temp_id;
      // Atomically mark synced and remove from pending queue
      await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
        await db.pendingOperations.where('temp_id').equals(tempId).delete();
        await db.budgetFacts.where('temp_id').equals(tempId).modify({
          sync_status: 'synced',
          synced_at: new Date()
        });
      });
    }
  } else if (op.operation === 'delete') {
    if (op.temp_id) {
      const tempId = op.temp_id;
      // Atomically hard-delete from Dexie and remove pending op (server confirmed deletion)
      await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
        await db.pendingOperations.where('temp_id').equals(tempId).delete();
        await db.budgetFacts.where('temp_id').equals(tempId).delete();
      });
    }
  }

  logger.info('[factSync] ✅ Operation uploaded', {
    operation: op.operation,
    temp_id: op.temp_id
  });
}

/**
 * Download facts from server (initial sync)
 *
 * @param userId - User ID
 * @param dateFrom - Start date (YYYY-MM-DD)
 * @param dateTo - End date (YYYY-MM-DD)
 * @returns Sync result
 */
export async function downloadFacts(
  userId: number,
  dateFrom: string,
  dateTo: string
): Promise<{ success: boolean; count: number }> {
  logger.info('[factSync] Downloading facts...', { userId, dateFrom, dateTo });

  try {
    const response = await fetchWithTimeout(
      `/api/v1/facts?user_id=${userId}&date_from=${dateFrom}&date_to=${dateTo}`,
      {
        method: 'GET',
        credentials: 'include'
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch facts: ${response.status}`);
    }

    const responseData = await response.json();
    const apiFacts: any[] = responseData.facts || [];

    // MAP API FIELDS → DEXIE SCHEMA (with error handling)
    const mappedFacts: LocalBudgetFact[] = [];
    const errors: string[] = [];

    for (const apiFact of apiFacts) {
      try {
        const mapped = mapAPIFactToLocal(apiFact);
        validateMappedFact(mapped);
        mappedFacts.push(mapped);
      } catch (error) {
        // Log and skip malformed facts
        const factId = apiFact.id || 'unknown';
        const errorMsg = (error as Error).message;
        errors.push(`Fact ${factId}: ${errorMsg}`);
        logger.warn('[factSync] Skipping malformed fact', {
          factId,
          error: errorMsg,
          rawFact: apiFact
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('[factSync] Skipped malformed facts', {
        total: apiFacts.length,
        valid: mappedFacts.length,
        skipped: errors.length,
        errors: errors.slice(0, 10)  // First 10 errors only
      });
    }

    // Server facts whose local counterpart has unsent edits/deletes must not be overwritten
    const protectedFacts = await db.budgetFacts
      .where('sync_status').anyOf(['pending', 'deleted'])
      .toArray();
    const protectedServerIds = new Set(
      protectedFacts.filter(f => f.id != null).map(f => f.id!)
    );
    const safeToInsert = mappedFacts.filter(f => !f.id || !protectedServerIds.has(f.id));

    // Bulk insert (amount уже в cents от сервера)
    await bulkInsertFacts(safeToInsert);

    // Update sync metadata
    await db.syncMetadata.put({
      entity_type: 'budget_facts',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: mappedFacts.length
    });

    logger.info('[factSync] ✅ Facts downloaded', {
      count: mappedFacts.length,
      inserted: safeToInsert.length,
      skipped: mappedFacts.length - safeToInsert.length
    });
    return { success: true, count: mappedFacts.length };
  } catch (error) {
    logger.error('[factSync] ❌ Facts download failed:', error);
    return { success: false, count: 0 };
  }
}

/**
 * Full sync - upload pending + download server facts
 */
export async function fullFactSync(
  userId: number,
  dateFrom: string,
  dateTo: string
): Promise<{
  success: boolean;
  uploaded: number;
  downloaded: number;
  failed: number;
}> {
  logger.info('[factSync] Starting full sync...', { userId, dateFrom, dateTo });

  // 1. Upload pending operations first
  const uploadResult = await uploadPendingOperations();

  // 2. Download facts from server
  const downloadResult = await downloadFacts(userId, dateFrom, dateTo);

  const result = {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.count,
    failed: uploadResult.failed
  };

  logger.info('[factSync] Full sync complete', result);

  return result;
}
