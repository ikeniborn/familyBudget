/**
 * PGlite Sync Handler
 * Handles initial sync from backend to PGlite
 */

import { getDexieManager, getPGliteFeatureFlags } from '@db/dexie';
import type { SyncInitialResponse, SyncIncrementalResponse } from '../types/events';

// Type declaration for global debugLog
declare const debugLog: (...args: any[]) => void;

/**
 * Handle sync_initial response from backend
 *
 * @param data - Sync response with reference data
 */
export async function handleSyncInitial(data: SyncInitialResponse['data']): Promise<void> {
  const pglite = await getDexieManager();

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
      id: fc.id,
      user_id: fc.user_id,
      name: fc.name,
      description: null,
      code: null,
      is_active: fc.is_active,
      created_at: new Date(fc.created_at),
      updated_at: new Date(fc.created_at)
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
    await pglite.updateSyncMetadata({
      entity_type: 'articles',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: data.articles.length
    });

    await pglite.updateSyncMetadata({
      entity_type: 'financial_centers',
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: data.financial_centers.length
    });

    await pglite.updateSyncMetadata({
      entity_type: 'cost_centers',
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

// ============================================================================
// Incremental Sync (task-007)
// ============================================================================

/**
 * Handle sync_incremental response from backend
 *
 * @param data - Delta updates (created, updated, deleted facts)
 */
export async function handleSyncIncremental(data: SyncIncrementalResponse['data']): Promise<void> {
  const pglite = await getDexieManager();

  if (!pglite.isReady()) {
    debugLog('[SYNC] PGlite not initialized');
    return;
  }

  try {
    debugLog('[SYNC] Starting incremental sync', {
      created: data.created.length,
      updated: data.updated.length,
      deleted: data.deleted.length,
      sync_timestamp: data.sync_timestamp
    });

    // Convert date strings to Date objects and add sync fields
    const created = data.created.map(f => ({
      ...f,
      temp_id: f.id?.toString() || '', // Server facts use id as temp_id
      sync_status: 'synced' as const,  // Server facts are always synced
      synced_at: new Date(),             // Current time
      created_at: new Date(f.created_at),
      updated_at: new Date(f.updated_at)
    }));

    const updated = data.updated.map(f => ({
      ...f,
      temp_id: f.id?.toString() || '', // Server facts use id as temp_id
      sync_status: 'synced' as const,
      synced_at: new Date(),
      created_at: new Date(f.created_at),
      updated_at: new Date(f.updated_at)
    }));

    // Apply bulk operations
    if (created.length > 0) {
      await pglite.bulkInsertFacts(created);
    }

    if (updated.length > 0) {
      await pglite.bulkUpdateFacts(updated);
    }

    if (data.deleted.length > 0) {
      // Convert server IDs to temp_ids (TODO: server should send temp_ids instead)
      await pglite.bulkSoftDeleteFacts(data.deleted.map(String));
    }

    // Update sync metadata with new timestamp
    await pglite.updateSyncMetadata({
      entity_type: 'budget_facts',
      last_sync_timestamp: new Date(data.sync_timestamp),
      sync_version: 1,
      total_records: created.length + updated.length // Approximate
    });

    debugLog('[SYNC] Incremental sync completed successfully');

    // Dispatch CustomEvent for UI updates
    const event = new CustomEvent('pglite:sync:complete', {
      detail: {
        created: data.created.length,
        updated: data.updated.length,
        deleted: data.deleted.length,
        timestamp: data.sync_timestamp
      }
    });
    window.dispatchEvent(event);

    // Invalidate DataLayer cache (if exists)
    if ((window as any).BudgetApp?.dataLayer?.invalidateCache) {
      (window as any).BudgetApp.dataLayer.invalidateCache();
      debugLog('[SYNC] DataLayer cache invalidated');
    }
  } catch (error) {
    debugLog('[SYNC] Incremental sync failed', error);
    throw error;
  }
}

/**
 * Request incremental sync from backend
 *
 * @param userId - User ID for sync
 */
export async function requestIncrementalSync(userId: number): Promise<void> {
  const pglite = await getDexieManager();

  if (!pglite.isReady()) {
    debugLog('[SYNC] PGlite not initialized');
    return;
  }

  if (!(window as any).budgetWSClient) {
    debugLog('[SYNC] budgetWSClient not initialized');
    return;
  }

  // Get last sync timestamp from metadata
  const syncMeta = await pglite.getSyncMetadata('budget_facts');
  const lastSyncTimestamp = syncMeta?.last_sync_timestamp
    ? new Date(syncMeta.last_sync_timestamp).toISOString()
    : new Date(0).toISOString(); // Epoch if never synced

  const request = {
    event: 'sync_incremental',
    data: {
      user_id: userId,
      last_sync_timestamp: lastSyncTimestamp
    }
  };

  debugLog('[SYNC] Requesting incremental sync', request);
  (window as any).budgetWSClient.send(request);
}

/**
 * SyncHandler class for auto-synchronization
 */
export class SyncHandler {
  private userId: number;
  private syncInProgress = false;
  private autoSyncTimer: number | null = null;

  constructor(userId: number) {
    this.userId = userId;
  }

  /**
   * Perform incremental sync (manual or auto)
   */
  async performIncrementalSync(): Promise<void> {
    if (this.syncInProgress) {
      debugLog('[SYNC] Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;

    try {
      await requestIncrementalSync(this.userId);
    } catch (error) {
      debugLog('[SYNC] Incremental sync failed', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Start auto-sync with configurable interval
   */
  startAutoSync(): void {
    const flags = getPGliteFeatureFlags();

    if (this.autoSyncTimer !== null) {
      debugLog('[SYNC] Auto-sync already running');
      return;
    }

    debugLog('[SYNC] Starting auto-sync', {
      interval: flags.autoSyncInterval
    });

    // Perform initial sync
    void this.performIncrementalSync();

    // Setup periodic sync
    this.autoSyncTimer = window.setInterval(() => {
      void this.performIncrementalSync();
    }, flags.autoSyncInterval);
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncTimer === null) {
      debugLog('[SYNC] Auto-sync not running');
      return;
    }

    debugLog('[SYNC] Stopping auto-sync');
    window.clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = null;
  }

  /**
   * Check if auto-sync is running
   */
  isAutoSyncActive(): boolean {
    return this.autoSyncTimer !== null;
  }
}

// Global SyncHandler instance (to be initialized after login)
let syncHandlerInstance: SyncHandler | null = null;

/**
 * Initialize SyncHandler for logged-in user
 *
 * @param userId - User ID
 */
export function initSyncHandler(userId: number): void {
  if (syncHandlerInstance) {
    debugLog('[SYNC] SyncHandler already initialized, stopping old instance');
    syncHandlerInstance.stopAutoSync();
  }

  syncHandlerInstance = new SyncHandler(userId);
  syncHandlerInstance.startAutoSync();

  debugLog('[SYNC] SyncHandler initialized', { userId });
}

/**
 * Get global SyncHandler instance
 */
export function getSyncHandler(): SyncHandler | null {
  return syncHandlerInstance;
}

/**
 * Destroy SyncHandler instance (on logout)
 */
export function destroySyncHandler(): void {
  if (syncHandlerInstance) {
    syncHandlerInstance.stopAutoSync();
    syncHandlerInstance = null;
    debugLog('[SYNC] SyncHandler destroyed');
  }
}
