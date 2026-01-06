/**
 * Offline Manager для Family Budget PWA
 * Управление CRUD операциями в offline режиме с автоматической синхронизацией
 *
 * Features:
 * - CREATE/UPDATE/DELETE для facts, transfers, plans, shopping lists & items
 * - Automatic sync при восстановлении сети
 * - Background Sync API support (Chrome, Edge, Яндекс.Браузер)
 * - Fallback для Safari (polling)
 * - Conflict resolution
 * - Retry logic для failed syncs
 * - SmartNetworkDetector для надежного определения состояния сети
 * - Caching stores & product groups для offline работы
 *
 * @version 2.0.0
 * @date 2026-01-05
 */

// Silent logger - only errors in production
const _offlineLog = window.DEBUG_MODE ? console.log.bind(console) : function() {};
const _offlineWarn = window.DEBUG_MODE ? console.warn.bind(console) : function() {};

// Type declaration for IndexedDBManager (loaded via idb.ts)
declare const IndexedDBManager: any;

interface SyncResult {
    success: boolean;
    error?: string;
    tempId?: string;
    serverId?: number;
}

interface OfflineManagerInfo {
    online: boolean;
    pendingCount: number;
    syncInProgress: boolean;
    lastSyncAttempt: string | null;
}

interface NetworkStatusChangeOptions {
    source?: string;
    [key: string]: any;
}

class OfflineManager {
    // Web Worker for sync hash generation
    private static _workerWrapper: any = null;

    private db: any;
    private syncInProgress: boolean;
    private retryDelay: number;
    // @ts-ignore - Used in full implementation
    private maxRetries: number;
    private isInitialized: boolean;
    private lastToastTime: number;
    private toastDebounceMs: number;
    // @ts-ignore - Used in full implementation
    private lastOfflineToastTime: number;
    // @ts-ignore - Used in full implementation
    private _isNavigating: boolean;
    private _navigationTimeout: ReturnType<typeof setTimeout> | null;
    private pendingCreates: Map<string, Promise<any>>;
    private retryTimeout: ReturnType<typeof setTimeout> | null;
    private _isFirstRequest: boolean;
    private _firstRequestTimeout: number;
    private _normalTimeout: number;
    // @ts-ignore - Used in full implementation
    private _optimizedTimeout: number;
    private networkDetector: any; // SmartNetworkDetector

    /**
     * Initialize Web Worker for sync processing.
     * Called automatically on first use.
     */
    static initializeWorker(): void {
        if (!this._workerWrapper && typeof window.WorkerWrapper !== 'undefined') {
            try {
                this._workerWrapper = new window.WorkerWrapper('/static/js/workers/syncWorker.min.js', {
                    idleTimeout: 60000,  // 60s for sync operations
                    debugMode: window.DEBUG_MODE || false
                });
            } catch (error) {
                console.warn('[OfflineManager] Failed to initialize worker:', error);
                this._workerWrapper = null;
            }
        }
    }

    constructor() {
        this.db = new IndexedDBManager();
        this.syncInProgress = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 5;
        this.isInitialized = false;
        this.lastToastTime = 0;
        this.toastDebounceMs = 10000; // 10s to prevent spam
        this.lastOfflineToastTime = 0;

        // Track navigation state
        this._isNavigating = false;
        this._navigationTimeout = null;

        // Listen for navigation events
        window.addEventListener('beforeunload', () => {
            this._isNavigating = true;
        });

        // HTMX navigation
        if (typeof window.htmx !== 'undefined') {
            document.body.addEventListener('htmx:beforeRequest', () => {
                this._isNavigating = true;
                clearTimeout(this._navigationTimeout!);
                this._navigationTimeout = setTimeout(() => {
                    this._isNavigating = false;
                }, 8000);
            });

            document.body.addEventListener('htmx:afterSettle', () => {
                clearTimeout(this._navigationTimeout!);
                this._navigationTimeout = setTimeout(() => {
                    this._isNavigating = false;
                }, 1000);
            });
        }

        // Deduplication cache
        this.pendingCreates = new Map();
        this.retryTimeout = null;

        // Adaptive timeout for cold backend
        this._isFirstRequest = true;
        this._firstRequestTimeout = 8000;
        this._normalTimeout = 3000;
        this._optimizedTimeout = 2000;

        // SmartNetworkDetector
        this.networkDetector = null;

        // Update navbar badge after sync
        window.addEventListener('offline-sync-complete', async () => {
            _offlineLog('[OfflineManager] offline-sync-complete event → updating navbar badge');
            await this._updateNavbarBadge();
        });
    }

    /**
     * Update navbar badge with pending count
     */
    private async _updateNavbarBadge(): Promise<void> {
        const pendingCount = await this.getPendingCount();
        const badge = document.getElementById('offline-badge');
        if (badge) {
            badge.textContent = pendingCount > 0 ? String(pendingCount) : '';
            badge.style.display = pendingCount > 0 ? 'inline' : 'none';
        }
    }

    /**
     * Initialize OfflineManager
     */
    async init(): Promise<void> {
        if (this.isInitialized) return;

        await this.db.init();

        // Initialize Web Worker
        OfflineManager.initializeWorker();

        // Initialize SmartNetworkDetector
        if (typeof window.SmartNetworkDetector !== 'undefined') {
            this.networkDetector = new window.SmartNetworkDetector({
                maxFailures: 3,
                heartbeatUrl: '/api/v1/health',
                onStatusChange: this._handleNetworkStatusChange.bind(this)
            });
            await this.networkDetector.init();
        }

        // Update badge
        await this._updateNavbarBadge();

        // Background Sync API registration
        if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
            try {
                await navigator.serviceWorker.ready;
                _offlineLog('[OfflineManager] Background Sync available');
            } catch (error) {
                _offlineWarn('[OfflineManager] Background Sync not available:', error);
            }
        }

        this.isInitialized = true;
        _offlineLog('[OfflineManager] Initialized');
    }

    /**
     * Handle network status change from SmartNetworkDetector
     */
    private async _handleNetworkStatusChange(
        newStatus: NetworkStatus,
        oldStatus: NetworkStatus,
        options: NetworkStatusChangeOptions = {}
    ): Promise<void> {
        _offlineLog(`[OfflineManager] Network status: ${oldStatus} → ${newStatus}`, options);

        if (newStatus === 'online' && (oldStatus === 'offline' || oldStatus === 'degraded')) {
            _offlineLog('[OfflineManager] Network restored → triggering sync');
            await this.handleOnline();
        } else if (newStatus === 'offline' && oldStatus === 'online') {
            _offlineLog('[OfflineManager] Network lost');
            await this.handleOffline();
        }
    }

    /**
     * Get current user ID from window.currentUser
     */
    async getCurrentUserId(): Promise<number> {
        const user = window.currentUser;
        if (!user || !user.id) {
            throw new Error('User not authenticated');
        }
        return user.id;
    }

    // ==================== FACTS CRUD ====================

    /**
     * Create fact (auto online/offline)
     */
    async createFact(data: Partial<BudgetFact>): Promise<any> {
        const operationKey = `fact_${Date.now()}_${Math.random()}`;

        if (this.pendingCreates.has(operationKey)) {
            _offlineLog('[OfflineManager] Deduplication: Waiting for in-progress create');
            return this.pendingCreates.get(operationKey)!;
        }

        const promise = this._createFactImpl(data, operationKey);
        this.pendingCreates.set(operationKey, promise);

        try {
            return await promise;
        } finally {
            this.pendingCreates.delete(operationKey);
        }
    }

    private async _createFactImpl(data: Partial<BudgetFact>, _operationKey: string): Promise<any> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                const timeout = this._isFirstRequest ? this._firstRequestTimeout : this._normalTimeout;
                return await this.createFactOnline(data, timeout);
            } catch (error: any) {
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    _offlineWarn('[OfflineManager] Network error → falling back to offline');
                    return await this.createFactOffline(data);
                }
                throw error;
            }
        } else {
            return await this.createFactOffline(data);
        }
    }

    /**
     * Create fact online
     */
    async createFactOnline(data: Partial<BudgetFact>, timeout: number = 2000): Promise<any> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch('/api/v1/facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            this._isFirstRequest = false;

            _offlineLog('[OfflineManager] Fact created online:', result);
            return result;
        } catch (error: any) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Create fact offline
     */
    async createFactOffline(data: Partial<BudgetFact>): Promise<OfflineFact> {
        return await this._createFactOfflineInternal(data);
    }

    private async _createFactOfflineInternal(data: Partial<BudgetFact>): Promise<OfflineFact> {
        const userId = await this.getCurrentUserId();
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const offlineFact: OfflineFact = {
            ...data as BudgetFact,
            tempId,
            synced: false,
            syncAttempts: 0,
            serverId: null,
            is_synced: false,
            user_id: userId,
            created_at: new Date().toISOString()
        };

        // Generate content hash for duplicate detection
        const contentHash = this.db.generateContentHash(offlineFact);
        (offlineFact as any).contentHash = contentHash;

        // Check for duplicates
        const duplicate = await this.db.checkDuplicateByHash(contentHash);
        if (duplicate) {
            _offlineWarn('[OfflineManager] Duplicate detected, skipping create:', duplicate);
            throw new Error('Duplicate fact detected');
        }

        await this.db.addFact(offlineFact);
        await this.db.addToSyncQueue({
            operation: 'create',
            entityType: 'fact',
            tempId,
            data: offlineFact,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        await this._updateNavbarBadge();

        _offlineLog('[OfflineManager] Fact saved offline:', offlineFact);
        return offlineFact;
    }

    /**
     * Update fact (auto online/offline)
     */
    async updateFact(id: number, data: Partial<BudgetFact>): Promise<any> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                return await this.updateFactOnline(id, data);
            } catch (error) {
                return await this.updateFactOffline(id, data);
            }
        } else {
            return await this.updateFactOffline(id, data);
        }
    }

    async updateFactOnline(id: number, data: Partial<BudgetFact>): Promise<any> {
        try {
            const response = await fetch(`/api/v1/facts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error: any = await response.json();
                throw new Error(error.detail || error.message || 'Failed to update fact');
            }

            if (this.networkDetector) {
                this.networkDetector.onRequestSuccess();
            }

            return await response.json();
        } catch (error) {
            if (this.networkDetector) {
                this.networkDetector.onRequestFailure();
            }
            throw error;
        }
    }

    async updateFactOffline(id: number, data: Partial<BudgetFact>): Promise<any> {
        const tempId = `offline_fact_update_${id}_${Date.now()}`;

        await this.db.addFact({
            tempId,
            data: { ...data, id } as any,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: id
        } as any);

        await this.db.addToSyncQueue({
            operation: 'update',
            entityType: 'fact',
            tempId,
            data: { ...data, id } as any,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync?.register('sync-budget-data');
        }

        await this._updateNavbarBadge();

        return {
            id,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    /**
     * Delete fact (auto online/offline)
     */
    async deleteFact(id: number): Promise<void> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                return await this.deleteFactOnline(id);
            } catch (error) {
                return await this.deleteFactOffline(id);
            }
        } else {
            return await this.deleteFactOffline(id);
        }
    }

    async deleteFactOnline(id: number): Promise<any> {
        try {
            const response = await fetch(`/api/v1/facts/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error: any = await response.json();
                throw new Error(error.detail || error.message || 'Failed to delete fact');
            }

            if (this.networkDetector) {
                this.networkDetector.onRequestSuccess();
            }

            return await response.json();
        } catch (error) {
            if (this.networkDetector) {
                this.networkDetector.onRequestFailure();
            }
            throw error;
        }
    }

    async deleteFactOffline(id: number): Promise<void> {
        const tempId = `offline_fact_delete_${id}_${Date.now()}`;

        await this.db.addToSyncQueue({
            operation: 'delete',
            entityType: 'fact',
            tempId,
            data: { id } as any,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync?.register('sync-budget-data');
        }

        await this._updateNavbarBadge();
    }

    // ==================== TRANSFERS ====================

    async createTransfer(data: any): Promise<any> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                return await this.createTransferOnline(data);
            } catch (error) {
                return await this.createTransferOffline(data);
            }
        } else {
            return await this.createTransferOffline(data);
        }
    }

    async createTransferOnline(data: any): Promise<any> {
        const response = await fetch('/api/v1/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error: any = await response.json();
            throw new Error(error.detail || error.message || 'Failed to create transfer');
        }

        return await response.json();
    }

    async createTransferOffline(data: any): Promise<any> {
        const tempId = `offline_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addTransfer({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        } as any);

        await this.db.addToSyncQueue({
            operation: 'create',
            entityType: 'transfer',
            tempId,
            data,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        await this._updateNavbarBadge();

        return {
            transfer_id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    // ==================== PLANS ====================

    async createPlan(data: Partial<BudgetFact>): Promise<any> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                return await this.createPlanOnline(data);
            } catch (error) {
                return await this.createPlanOffline(data);
            }
        } else {
            return await this.createPlanOffline(data);
        }
    }

    async createPlanOnline(data: Partial<BudgetFact>): Promise<any> {
        const response = await fetch('/api/v1/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error: any = await response.json();
            throw new Error(error.detail || error.message || 'Failed to create plan');
        }

        return await response.json();
    }

    async createPlanOffline(data: Partial<BudgetFact>): Promise<any> {
        const tempId = `offline_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addPlan({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        } as any);

        await this.db.addToSyncQueue({
            operation: 'create',
            entityType: 'plan',
            tempId,
            data,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        await this._updateNavbarBadge();

        return {
            id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    // ==================== RECURRING PLANS ====================

    /**
     * Create recurring plan (online-preferred with offline fallback)
     */
    async createRecurringPlan(data: any): Promise<any> {
        const isOnline = this.networkDetector?.status === 'online';

        if (isOnline) {
            try {
                return await this.createRecurringPlanOnline(data);
            } catch (error: any) {
                _offlineLog('[OfflineManager] Online recurring plan creation failed, falling back to offline:', error.message);
                return await this.createRecurringPlanOffline(data);
            }
        } else {
            return await this.createRecurringPlanOffline(data);
        }
    }

    async createRecurringPlanOnline(data: any): Promise<any> {
        const response = await fetch('/api/v1/recurring-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error: any = await response.json();
            throw new Error(error.detail || error.message || 'Failed to create recurring plan');
        }

        return await response.json();
    }

    async createRecurringPlanOffline(data: any): Promise<any> {
        const tempId = `offline_recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addRecurringPlan({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        } as any);

        await this.db.addToSyncQueue({
            operation: 'create',
            entityType: 'recurring',
            tempId,
            data,
            status: 'pending',
            syncAttempts: 0,
            created_at: new Date().toISOString()
        });

        _offlineLog('[OfflineManager] Recurring plan saved offline:', tempId);

        return {
            id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false,
            _pendingSync: true
        };
    }

    async getPendingRecurringPlans(): Promise<any[]> {
        return await this.db.getAllRecurringPlans(false);
    }

    // ==================== SYNC OPERATIONS ====================

    /**
     * Sync all pending items (enhanced version with parallel/sequential processing)
     */
    async sync(): Promise<any> {
        if (this.syncInProgress) {
            return { skipped: true };
        }

        const isOnline = this.networkDetector?.status === 'online';
        if (!isOnline) {
            return { skipped: true, reason: 'offline' };
        }

        this.syncInProgress = true;

        const results = {
            synced: 0,
            failed: 0,
            needsRetry: false,
            items: [] as any[]
        };

        try {
            const queue = await this.db.getSyncQueue('pending');

            // For large queues (>10 items), use parallel batch processing
            if (queue.length > 10) {
                _offlineLog(`[OfflineManager] Using parallel batch processing for ${queue.length} items`);
                await this._syncQueueParallel(queue, results);
            } else {
                // For small queues, use sequential processing
                _offlineLog(`[OfflineManager] Using sequential processing for ${queue.length} items`);
                await this._syncQueueSequentialEnhanced(queue, results);
            }

            // Clear completed items
            _offlineLog(`[OfflineManager] sync() completed. Synced: ${results.synced}, Failed: ${results.failed}`);
            const clearedCount = await this.db.clearCompletedSyncQueue();
            _offlineLog(`[OfflineManager] Cleared ${clearedCount} completed items from sync queue`);

            // Verify queue state after cleanup
            const remainingQueue = await this.db.getSyncQueue();
            _offlineLog(`[OfflineManager] Remaining items in queue: ${remainingQueue.length}`);
            if (remainingQueue.length > 0) {
                _offlineLog('[OfflineManager] Remaining items:', remainingQueue.map((i: any) => ({
                    id: i.id,
                    status: i.status
                })));
            }

            // Schedule retry sync if there are items that need retry
            if (results.needsRetry) {
                _offlineLog(`[OfflineManager] Scheduling retry sync in ${this.retryDelay}ms...`);

                // Cancel any existing retry timeout
                if (this.retryTimeout) {
                    clearTimeout(this.retryTimeout);
                }

                // Schedule next sync after delay
                this.retryTimeout = setTimeout(async () => {
                    _offlineLog('[OfflineManager] Starting scheduled retry sync...');
                    await this.sync();
                }, this.retryDelay);
            }

            // Update navbar badge before returning
            await this._updateNavbarBadge();

            return results;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Process sync queue sequentially (enhanced version with error handling)
     */
    private async _syncQueueSequentialEnhanced(queue: SyncQueueEntry[], results: any): Promise<void> {
        for (const item of queue) {
            try {
                _offlineLog(`[OfflineManager] Syncing item ${item.id} (${item.operation} ${item.entityType})...`);
                const response = await this.syncItemEnhanced(item);

                // If syncItem returned null, item was already processed
                if (response === null) {
                    _offlineLog(`[OfflineManager] Item ${item.id} skipped (already processed)`);
                    continue;
                }

                results.synced++;
                results.items.push({
                    id: item.id,
                    status: 'success',
                    entity: item.entityType,
                    operation: item.operation
                });

                _offlineLog(`[OfflineManager] Successfully synced item ${item.id}`);
            } catch (error: any) {
                console.error(`[OfflineManager] Failed to sync item ${item.id}:`, error);

                results.failed++;
                results.items.push({
                    id: item.id,
                    status: 'error',
                    error: error.message,
                    entity: item.entityType,
                    operation: item.operation
                });

                // Mark item for retry if it's a network error
                const isNetworkError = error.message &&
                    (error.message.includes('NetworkError') ||
                     error.message.includes('Failed to fetch') ||
                     error.message.includes('timeout'));

                if (isNetworkError) {
                    try {
                        await this.db.updateSyncQueueItem(item.id!, {
                            status: 'pending',
                            syncAttempts: (item.syncAttempts || 0) + 1
                        });
                        results.needsRetry = true;
                        _offlineLog(`[OfflineManager] Item ${item.id} marked for retry (attempt ${(item.syncAttempts || 0) + 1})`);
                    } catch (e) {
                        console.error(`[OfflineManager] Failed to mark item for retry:`, e);
                    }
                } else {
                    // Non-network error - mark as failed permanently
                    try {
                        await this.db.updateSyncQueueItem(item.id!, { status: 'failed' });
                        _offlineLog(`[OfflineManager] Item ${item.id} marked as permanently failed`);
                    } catch (e) {
                        console.error(`[OfflineManager] Failed to update status:`, e);
                    }
                }
            }
        }
    }

    /**
     * Process sync queue in parallel batches (for large queues >10 items)
     */
    private async _syncQueueParallel(queue: SyncQueueEntry[], results: any): Promise<void> {
        const BATCH_SIZE = 4;
        const BATCH_DELAY = 100; // ms

        for (let i = 0; i < queue.length; i += BATCH_SIZE) {
            const batch = queue.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(queue.length / BATCH_SIZE);

            _offlineLog(`[OfflineManager] Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

            // Process batch in parallel
            const batchPromises = batch.map(async (item) => {
                try {
                    _offlineLog(`[OfflineManager] [Batch ${batchNum}] Syncing item ${item.id} (${item.operation} ${item.entityType})...`);
                    const response = await this.syncItemEnhanced(item);

                    if (response === null) {
                        _offlineLog(`[OfflineManager] [Batch ${batchNum}] Item ${item.id} skipped (already processed)`);
                        return { success: true, skipped: true, item };
                    }

                    _offlineLog(`[OfflineManager] [Batch ${batchNum}] Successfully synced item ${item.id}`);
                    return { success: true, item, response };
                } catch (error) {
                    console.error(`[OfflineManager] [Batch ${batchNum}] Failed to sync item ${item.id}:`, error);
                    return { success: false, item, error };
                }
            });

            // Wait for all items in batch to complete
            const batchResults = await Promise.allSettled(batchPromises);

            // Process batch results
            for (const promiseResult of batchResults) {
                if (promiseResult.status === 'fulfilled') {
                    const itemResult: any = promiseResult.value;

                    if (itemResult.skipped) {
                        continue;
                    }

                    if (itemResult.success) {
                        results.synced++;
                        results.items.push({
                            id: itemResult.item.id,
                            status: 'success',
                            entity: itemResult.item.entityType,
                            operation: itemResult.item.operation
                        });
                    } else {
                        results.failed++;
                        results.items.push({
                            id: itemResult.item.id,
                            status: 'error',
                            error: itemResult.error.message,
                            entity: itemResult.item.entityType,
                            operation: itemResult.item.operation
                        });

                        // Mark for retry if network error
                        const isNetworkError = itemResult.error.message &&
                            (itemResult.error.message.includes('NetworkError') ||
                             itemResult.error.message.includes('Failed to fetch') ||
                             itemResult.error.message.includes('timeout'));

                        if (isNetworkError) {
                            try {
                                await this.db.updateSyncQueueItem(itemResult.item.id, {
                                    status: 'pending',
                                    syncAttempts: (itemResult.item.syncAttempts || 0) + 1
                                });
                                results.needsRetry = true;
                                _offlineLog(`[OfflineManager] [Batch ${batchNum}] Item ${itemResult.item.id} marked for retry`);
                            } catch (e) {
                                console.error(`[OfflineManager] [Batch ${batchNum}] Failed to mark item for retry:`, e);
                            }
                        } else {
                            try {
                                await this.db.updateSyncQueueItem(itemResult.item.id, { status: 'failed' });
                                _offlineLog(`[OfflineManager] [Batch ${batchNum}] Item ${itemResult.item.id} marked as permanently failed`);
                            } catch (e) {
                                console.error(`[OfflineManager] [Batch ${batchNum}] Failed to update status:`, e);
                            }
                        }
                    }
                }
            }

            // Add delay between batches
            if (i + BATCH_SIZE < queue.length) {
                _offlineLog(`[OfflineManager] Waiting ${BATCH_DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        _offlineLog(`[OfflineManager] Parallel batch processing complete. Synced: ${results.synced}, Failed: ${results.failed}`);
    }

    /**
     * Sync single item (enhanced version with verification and cleaning)
     */
    private async syncItemEnhanced(item: SyncQueueEntry): Promise<any> {
        // Update status to syncing
        try {
            await this.db.updateSyncQueueItem(item.id!, { status: 'syncing' });
        } catch (e: any) {
            // Item already processed by SW - skip
            if (e.message && e.message.includes('not found')) {
                _offlineLog(`[OfflineManager] Item ${item.id} already processed by SW - skipping`);
                return null;
            }
            throw e;
        }

        let response;

        switch (item.operation) {
            case 'create':
                response = await this.syncCreateEnhanced(item);
                break;
            case 'update':
                response = await this.syncUpdateEnhanced(item);
                break;
            case 'delete':
                response = await this.syncDeleteEnhanced(item);
                break;
            default:
                throw new Error(`Unknown operation: ${item.operation}`);
        }

        // Handle case where SW already synced this item
        if (response && response._already_synced_by_sw) {
            _offlineLog(`[OfflineManager] Item ${item.id} was already synced by SW - marking as completed`);
        } else if (item.operation === 'create') {
            // Verify record exists on server
            const verified = await this.verifyOnServer(item, response);
            if (!verified) {
                throw new Error('Verification failed - record not found on server');
            }
        }

        // Mark as completed
        _offlineLog(`[OfflineManager] syncItem ${item.id} - updating status to 'completed'`);
        try {
            await this.db.updateSyncQueueItem(item.id!, { status: 'completed' });
            _offlineLog(`[OfflineManager] syncItem ${item.id} - status updated successfully`);
        } catch (e: any) {
            if (e.message && e.message.includes('not found')) {
                _offlineLog(`[OfflineManager] Item ${item.id} already marked completed by SW`);
            } else {
                console.error(`[OfflineManager] Failed to update status for item ${item.id}:`, e);
            }
        }

        // Delete offline record after successful sync
        if (item.operation === 'create') {
            try {
                if (item.entityType === 'fact') {
                    await this.db.deleteFact(item.tempId);
                } else if (item.entityType === 'transfer') {
                    await this.db.deleteTransfer(item.tempId);
                } else if (item.entityType === 'plan') {
                    await this.db.deletePlan(item.tempId);
                } else if (item.entityType === 'recurring') {
                    await this.db.deleteRecurringPlan(item.tempId);
                }
                _offlineLog(`[OfflineManager] Deleted synced ${item.entityType} ${item.tempId} from offline store`);
            } catch (e: any) {
                _offlineLog(`[OfflineManager] Failed to delete ${item.entityType} ${item.tempId} (may already be deleted):`, e.message);
            }
        }

        return response;
    }

    async syncCreateEnhanced(item: SyncQueueEntry): Promise<any> {
        // Route to appropriate API endpoint
        const endpoint = item.entityType === 'fact' || item.entityType === 'plan' ? '/api/v1/facts' :
                         item.entityType === 'transfer' ? '/api/v1/transfers' :
                         item.entityType === 'recurring' ? '/api/v1/recurring-plans' :
                         '/api/v1/facts';

        // Clean data: remove display-only fields
        const cleanData: any = { ...item.data };

        // Common display-only fields
        delete cleanData.article_name;
        delete cleanData.financial_center_name;
        delete cleanData.cost_center_name;
        delete cleanData.plan_date;
        delete cleanData.fact_type;
        delete cleanData.notification_enabled;
        delete cleanData.reminder_datetime;

        // Transfer-specific display-only fields
        if (item.entityType === 'transfer') {
            delete cleanData.from_financial_center_name;
            delete cleanData.to_financial_center_name;
            delete cleanData.from_article_name;
            delete cleanData.to_article_name;
        }

        // Recurring plan-specific display-only fields
        if (item.entityType === 'recurring') {
            delete cleanData.frequency_label;
            delete cleanData.duration_label;
        }

        // Mark as offline sync (NOT for recurring plans)
        if (item.entityType !== 'recurring') {
            cleanData.is_offline_sync = true;
        }

        // Add deduplication hashes for facts and plans
        if (item.entityType === 'fact' || item.entityType === 'plan') {
            const idbRecord = await this.db.getFact(item.tempId);
            if (idbRecord && (idbRecord as any).contentHash) {
                cleanData.content_hash = (idbRecord as any).contentHash;

                // Use pre-generated syncHash if available
                if ((idbRecord as any).syncHash) {
                    cleanData.sync_hash = (idbRecord as any).syncHash;
                } else {
                    // Generate sync_hash
                    const userId = await this.getCurrentUserId();
                    const createdDate = new Date(idbRecord.created_at ?? new Date()).toISOString().split('T')[0];
                    const syncHashContent = `${(idbRecord as any).contentHash}|${userId}|${createdDate}`;
                    cleanData.sync_hash = this.db.hashString(syncHashContent);
                }
            } else {
                // Offline record not found - already synced by SW
                _offlineLog(`[OfflineManager] Offline record not found for ${item.tempId} - already synced by SW`);
                return { _already_synced_by_sw: true, id: null };
            }
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData),
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error: any = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        const result = await response.json();

        // Log if duplicate was skipped by backend
        if (result._duplicate_skipped) {
            _offlineLog('[OfflineManager] Duplicate skipped by server (idempotent):', {
                fact_id: result.id,
                sync_hash: cleanData.sync_hash
            });
        }

        return result;
    }

    async syncUpdateEnhanced(item: SyncQueueEntry): Promise<any> {
        const id = item.data.id;
        const endpoint = item.entityType === 'fact' || item.entityType === 'plan' ? `/api/v1/facts/${id}` :
                         item.entityType === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/facts/${id}`;

        // Clean data: remove display-only fields
        const cleanData: any = { ...item.data };

        delete cleanData.article_name;
        delete cleanData.financial_center_name;
        delete cleanData.cost_center_name;
        delete cleanData.plan_date;
        delete cleanData.fact_type;
        delete cleanData.notification_enabled;
        delete cleanData.reminder_datetime;

        if (item.entityType === 'transfer') {
            delete cleanData.from_financial_center_name;
            delete cleanData.to_financial_center_name;
            delete cleanData.from_article_name;
            delete cleanData.to_article_name;
        }

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData),
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error: any = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    }

    async syncDeleteEnhanced(item: SyncQueueEntry): Promise<any> {
        const id = item.data.id;
        const endpoint = item.entityType === 'fact' || item.entityType === 'plan' ? `/api/v1/facts/${id}` :
                         item.entityType === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/facts/${id}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error: any = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        return { success: true };
    }

    /**
     * Verify that a record exists on the server after sync
     */
    async verifyOnServer(item: SyncQueueEntry, syncResponse: any): Promise<boolean> {
        const endpoint = item.entityType === 'transfer'
            ? `/api/v1/transfers/${syncResponse.transfer_id}`
            : `/api/v1/facts/${syncResponse.id || syncResponse.fact_id}`;

        try {
            const response = await fetch(endpoint, {
                credentials: 'include'
            });
            return response.ok;
        } catch (e) {
            _offlineWarn('[OfflineManager] Verification request failed:', e);
            return false;
        }
    }

    // ==================== NETWORK HANDLERS ====================

    async handleOnline(): Promise<any> {
        // Show notification (debounced)
        this._showToastDebounced('Соединение восстановлено', 'success');

        // If Background Sync is supported, let Service Worker handle sync
        if (this.supportsBackgroundSync()) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync?.register('sync-budget-data');
            } catch (e) {
                // Fall through to main thread sync
            }
            return { skipped: true, reason: 'background-sync' };
        }

        // Fallback: sync from main thread
        const results = await this.sync();

        // Show sync results
        if (results.synced > 0) {
            this.lastToastTime = 0;
            this._showToastDebounced(`Синхронизировано: ${results.synced} записей`, 'success');

            // Request notification permission if not granted
            if ('Notification' in window && Notification.permission === 'default') {
                await this.requestNotificationPermission();
            }
        }

        // Emit custom event
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
            detail: results
        }));

        return results;
    }

    async handleOffline(): Promise<void> {
        // Show notification (debounced)
        this._showToastDebounced('Работаем оффлайн', 'warning');

        // Emit custom event
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: false }
        }));
    }

    /**
     * Handle sync completion message from Service Worker
     */
    handleSyncComplete(data: { synced: number; failed: number }): void {
        const { synced, failed } = data;

        // Reset debounce
        this.lastToastTime = 0;

        if (synced > 0) {
            this._showToastDebounced(`Соединение восстановлено. Синхронизировано: ${synced}`, 'success');
        } else if (failed === 0) {
            this._showToastDebounced('Соединение восстановлено', 'success');
        }

        if (failed > 0) {
            this._showToastDebounced(`Не удалось синхронизировать: ${failed} записей`, 'error');
        }

        // Emit custom event
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
            detail: { synced, failed, source: 'service-worker' }
        }));
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    // ==================== UTILITY METHODS ====================

    async getPendingCount(): Promise<number> {
        return await this.db.getPendingCount();
    }

    async getInfo(): Promise<any> {
        return await this.db.getInfo();
    }

    async getSyncQueueItem(id: number): Promise<any> {
        const queue = await this.db.getSyncQueue();
        return queue.find((item: any) => item.data && item.data.id === id) || null;
    }

    async getPendingSyncItems(): Promise<any[]> {
        return await this.db.getSyncQueue('pending');
    }

    async getAllUnsyncedItems(): Promise<{ items: any[]; hasRetryable: boolean }> {
        const pending = await this.db.getSyncQueue('pending');
        const failed = await this.db.getSyncQueue('failed');
        const items = [...pending, ...failed];

        const hasRetryable = items.some((item: any) =>
            item.status === 'failed' || (item.syncAttempts && item.syncAttempts > 0)
        );

        return { items, hasRetryable };
    }

    async updatePendingItemData(itemId: number, updatedData: any): Promise<void> {
        _offlineLog('[OfflineManager] Updating pending item data:', itemId);
        await this.db.updateSyncQueueItem(itemId, { data: updatedData });
    }

    async removePendingItem(itemId: number): Promise<void> {
        _offlineLog('[OfflineManager] Removing pending item:', itemId);
        await this.db.deleteSyncQueueItem(itemId);
    }

    async syncQueue(): Promise<any> {
        return await this.sync();
    }

    async clearAll(): Promise<void> {
        await this.db.clearAll();
    }

    async enableAutoOfflineMode(): Promise<void> {
        if (this.networkDetector) {
            this.networkDetector.enableAutoOfflineMode();
        }

        this._showToastDebounced('Включен офлайн режим (автоматически)', 'info');
    }

    // @ts-ignore - Used in full implementation
    private async _handleAutoOfflineRecovery(): Promise<void> {
        _offlineLog('[OfflineManager] Auto offline recovery event received (toast/sync already handled by status change)');
    }

    // ==================== WEBSOCKET INTEGRATION ====================

    refreshUICallback: ((eventType: string, data: any) => void) | null = null;

    initWS(options: any = {}): void {
        const {
            onFact = null,
            onPlan = null,
            onTransfer = null,
            autoConnect = true
        } = options;

        // Set refresh callback
        if (onFact || onPlan || onTransfer) {
            this.refreshUICallback = (eventType: string, data: any) => {
                if (eventType.startsWith('fact_') && onFact) {
                    onFact(eventType, data);
                } else if (eventType.startsWith('plan_') && onPlan) {
                    onPlan(eventType, data);
                } else if (eventType.startsWith('transfer_') && onTransfer) {
                    onTransfer(eventType, data);
                }
            };
        }

        // Check if BudgetWSClient is available
        if (typeof window.budgetWSClient === 'undefined') {
            _offlineWarn('[OfflineManager] BudgetWSClient not loaded - WebSocket disabled');
            return;
        }

        // Auto-connect if requested
        if (autoConnect) {
            window.budgetWSClient.connect();
        }

        _offlineLog('[OfflineManager] WebSocket integration initialized');
    }

    disconnectWS(): void {
        if (typeof window.budgetWSClient !== 'undefined') {
            window.budgetWSClient.setEnabled(false);
        }
    }

    reconnectWS(): void {
        const isOnline = this.networkDetector?.status === 'online';
        if (!isOnline) {
            _offlineLog('[OfflineManager] Skip reconnectWS - still offline');
            return;
        }

        if (typeof window.budgetWSClient !== 'undefined') {
            window.budgetWSClient.setEnabled(true);
        }
    }

    getWSStatus(): any {
        if (typeof window.budgetWSClient !== 'undefined') {
            return window.budgetWSClient.getStatus();
        }
        return null;
    }

    // ==================== HELPER METHODS ====================

    supportsBackgroundSync(): boolean {
        return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype;
    }

    private _showToastDebounced(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
        const now = Date.now();
        if (now - this.lastToastTime > this.toastDebounceMs) {
            this.lastToastTime = now;
            if (window.showToast) {
                window.showToast(message, type);
            }
        }
    }

    get isOnline(): boolean {
        return this.networkDetector?.status === 'online';
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
}
