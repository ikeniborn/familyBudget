/**
 * PGlite Sync Handler
 * Handles initial sync from backend to PGlite
 */

import { getPGliteManager } from '@db/pglite';
import type { SyncInitialResponse } from '../types/events';

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

/**
 * Handle sync_initial response from backend
 *
 * @param data - Sync response with reference data
 */
export async function handleSyncInitial(data: SyncInitialResponse['data']): Promise<void> {
  const pglite = getPGliteManager();

  if (!pglite.isReady()) {
    debugLog('[SYNC] PGlite not initialized');
    return;
  }

  try {
    debugLog('[SYNC] Starting initial sync', {
      articles: data.articles.length,
      financial_centers: data.financial_centers.length,
      cost_centers: data.cost_centers.length,
      hierarchy: data.hierarchy.length,
      total: data.total_records
    });

    // Progress callback for UI updates
    const onProgress = (current: number, total: number) => {
      const percent = Math.round((current / total) * 100);
      debugLog(`[SYNC] Progress: ${current}/${total} (${percent}%)`);

      // Notify UI (optional modal implementation)
      if ((window as any).updateSyncProgress) {
        (window as any).updateSyncProgress(current, total);
      }
    };

    // Convert ISO strings to Date objects
    const articles = data.articles.map(a => ({
      ...a,
      created_at: new Date(a.created_at),
      updated_at: new Date(a.updated_at)
    }));

    const financialCenters = data.financial_centers.map(fc => ({
      ...fc,
      created_at: new Date(fc.created_at)
    }));

    const costCenters = data.cost_centers.map(cc => ({
      ...cc,
      created_at: new Date(cc.created_at)
    }));

    // Bulk insert with progress tracking
    await pglite.bulkInsertArticles(articles, onProgress);
    await pglite.bulkInsertFinancialCenters(financialCenters, onProgress);
    await pglite.bulkInsertCostCenters(costCenters, onProgress);
    await pglite.bulkInsertHierarchy(data.hierarchy, onProgress);

    // Update sync metadata
    await pglite.updateSyncMetadata('articles', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: data.articles.length
    });

    await pglite.updateSyncMetadata('financial_centers', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: data.financial_centers.length
    });

    await pglite.updateSyncMetadata('cost_centers', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: data.cost_centers.length
    });

    debugLog('[SYNC] Initial sync completed successfully');

    // Notify UI completion
    if ((window as any).onSyncComplete) {
      (window as any).onSyncComplete();
    }
  } catch (error) {
    debugLog('[SYNC] Initial sync failed', error);

    // Notify UI error
    if ((window as any).onSyncError) {
      (window as any).onSyncError(error);
    }
  }
}

/**
 * Request initial sync from backend
 *
 * @param userId - User ID for sync
 */
export function requestInitialSync(userId: number): void {
  if (!(window as any).budgetWSClient) {
    debugLog('[SYNC] budgetWSClient not initialized');
    return;
  }

  const request = {
    event: 'sync_initial',
    data: { user_id: userId }
  };

  debugLog('[SYNC] Requesting initial sync', request);
  (window as any).budgetWSClient.send(request);
}
