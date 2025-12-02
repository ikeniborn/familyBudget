/**
 * Offline Manager для Family Budget PWA
 * Управление CRUD операциями в offline режиме с автоматической синхронизацией
 *
 * Features:
 * - CREATE/UPDATE/DELETE для facts, transfers, plans
 * - Automatic sync при восстановлении сети
 * - Background Sync API support (Chrome, Edge, Яндекс.Браузер)
 * - Fallback для Safari (polling)
 * - Conflict resolution
 * - Retry logic для failed syncs
 *
 * @version 1.0.0
 */

class OfflineManager {
    constructor() {
        this.db = new IndexedDBManager();
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 3;

        // Initialize
        this.init();
    }

    async init() {
        console.log('[Offline] Initializing OfflineManager');

        // Initialize IndexedDB
        await this.db.init();

        // Setup network listeners
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Check initial network status
        if (this.isOnline) {
            console.log('[Offline] Initial status: Online');
            // Sync pending items on load
            await this.sync();
        } else {
            console.log('[Offline] Initial status: Offline');
        }

        // Setup periodic sync fallback для Safari
        if (!this.supportsBackgroundSync()) {
            console.log('[Offline] Background Sync not supported, using polling fallback');
            this.setupSyncPolling();
        }

        // Clear expired cache periodically
        setInterval(() => this.db.clearExpiredCache(), 60000); // Every minute
    }

    /**
     * Check if Background Sync API is supported
     * @returns {boolean}
     */
    supportsBackgroundSync() {
        return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype;
    }

    /**
     * Setup periodic sync polling (fallback for Safari)
     */
    setupSyncPolling() {
        setInterval(async () => {
            if (this.isOnline && !this.syncInProgress) {
                const pendingCount = await this.db.countSyncQueue('pending');
                if (pendingCount > 0) {
                    console.log('[Offline] Polling: Found pending items, triggering sync');
                    await this.sync();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    // ==================== FACTS ====================

    /**
     * Create Fact (online or offline)
     * @param {Object} data - Fact data
     * @returns {Promise<Object>} Created fact
     */
    async createFact(data) {
        if (this.isOnline) {
            try {
                return await this.createFactOnline(data);
            } catch (error) {
                console.warn('[Offline] Online create failed, falling back to offline:', error);
                return await this.createFactOffline(data);
            }
        } else {
            return await this.createFactOffline(data);
        }
    }

    async createFactOnline(data) {
        const response = await fetch('/api/v1/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create fact');
        }

        return await response.json();
    }

    async createFactOffline(data) {
        const tempId = `offline_fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 1. Save to IndexedDB
        await this.db.addFact({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        });

        // 2. Add to sync queue
        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'fact',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        // 3. Register Background Sync (if supported)
        if (this.supportsBackgroundSync()) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-budget-data');
                console.log('[Offline] Background Sync registered');
            } catch (error) {
                console.error('[Offline] Failed to register Background Sync:', error);
            }
        }

        console.log('[Offline] Fact created offline:', tempId);

        return {
            id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    /**
     * Update Fact (online or offline)
     * @param {number} id - Server fact ID
     * @param {Object} data - Updated fact data
     * @returns {Promise<Object>}
     */
    async updateFact(id, data) {
        if (this.isOnline) {
            try {
                return await this.updateFactOnline(id, data);
            } catch (error) {
                console.warn('[Offline] Online update failed, falling back to offline:', error);
                return await this.updateFactOffline(id, data);
            }
        } else {
            return await this.updateFactOffline(id, data);
        }
    }

    async updateFactOnline(id, data) {
        const response = await fetch(`/api/v1/facts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to update fact');
        }

        return await response.json();
    }

    async updateFactOffline(id, data) {
        const tempId = `offline_fact_update_${id}_${Date.now()}`;

        // 1. Save to IndexedDB
        await this.db.addFact({
            tempId,
            data: { ...data, id }, // Include server ID
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: id
        });

        // 2. Add to sync queue
        await this.db.addToSyncQueue({
            operation: 'update',
            entity: 'fact',
            tempId,
            data: { ...data, id },
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        // 3. Register Background Sync
        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-budget-data');
        }

        console.log('[Offline] Fact update queued:', id);

        return {
            id,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    /**
     * Delete Fact (online or offline)
     * @param {number} id - Server fact ID
     * @returns {Promise<void>}
     */
    async deleteFact(id) {
        if (this.isOnline) {
            try {
                return await this.deleteFactOnline(id);
            } catch (error) {
                console.warn('[Offline] Online delete failed, falling back to offline:', error);
                return await this.deleteFactOffline(id);
            }
        } else {
            return await this.deleteFactOffline(id);
        }
    }

    async deleteFactOnline(id) {
        const response = await fetch(`/api/v1/facts/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete fact');
        }

        return await response.json();
    }

    async deleteFactOffline(id) {
        const tempId = `offline_fact_delete_${id}_${Date.now()}`;

        // Add to sync queue
        await this.db.addToSyncQueue({
            operation: 'delete',
            entity: 'fact',
            tempId,
            data: { id },
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        // Register Background Sync
        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-budget-data');
        }

        console.log('[Offline] Fact delete queued:', id);
    }

    // ==================== TRANSFERS ====================

    async createTransfer(data) {
        if (this.isOnline) {
            try {
                return await this.createTransferOnline(data);
            } catch (error) {
                console.warn('[Offline] Online create failed, falling back to offline:', error);
                return await this.createTransferOffline(data);
            }
        } else {
            return await this.createTransferOffline(data);
        }
    }

    async createTransferOnline(data) {
        const response = await fetch('/api/v1/transfers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create transfer');
        }

        return await response.json();
    }

    async createTransferOffline(data) {
        const tempId = `offline_transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addTransfer({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        });

        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'transfer',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-budget-data');
        }

        console.log('[Offline] Transfer created offline:', tempId);

        return {
            transfer_id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    // ==================== PLANS ====================

    async createPlan(data) {
        if (this.isOnline) {
            try {
                return await this.createPlanOnline(data);
            } catch (error) {
                console.warn('[Offline] Online create failed, falling back to offline:', error);
                return await this.createPlanOffline(data);
            }
        } else {
            return await this.createPlanOffline(data);
        }
    }

    async createPlanOnline(data) {
        const response = await fetch('/api/v1/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create plan');
        }

        return await response.json();
    }

    async createPlanOffline(data) {
        const tempId = `offline_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addPlan({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        });

        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'plan',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        if (this.supportsBackgroundSync()) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-budget-data');
        }

        console.log('[Offline] Plan created offline:', tempId);

        return {
            id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false
        };
    }

    // ==================== SYNC ====================

    /**
     * Sync all pending items
     * @returns {Promise<Object>} Sync results
     */
    async sync() {
        if (this.syncInProgress) {
            console.log('[Offline] Sync already in progress');
            return { skipped: true };
        }

        if (!this.isOnline) {
            console.log('[Offline] Cannot sync: offline');
            return { skipped: true, reason: 'offline' };
        }

        this.syncInProgress = true;
        console.log('[Offline] Starting sync...');

        const results = {
            synced: 0,
            failed: 0,
            items: []
        };

        try {
            const queue = await this.db.getSyncQueue('pending');
            console.log(`[Offline] Found ${queue.length} pending items`);

            for (const item of queue) {
                try {
                    await this.syncItem(item);
                    results.synced++;
                    results.items.push({ ...item, status: 'synced' });
                } catch (error) {
                    console.error(`[Offline] Sync failed for item ${item.id}:`, error);

                    const retryCount = (item.retryCount || 0) + 1;

                    if (retryCount >= this.maxRetries) {
                        // Max retries reached, mark as failed
                        await this.db.updateSyncQueueItem(item.id, {
                            status: 'failed',
                            error: error.message,
                            retryCount
                        });
                        results.failed++;
                        results.items.push({ ...item, status: 'failed', error: error.message });
                    } else {
                        // Retry later
                        await this.db.updateSyncQueueItem(item.id, {
                            status: 'pending',
                            error: error.message,
                            retryCount
                        });
                        results.items.push({ ...item, status: 'retry', retryCount });
                    }
                }
            }

            console.log(`[Offline] Sync complete: ${results.synced} synced, ${results.failed} failed`);

            // Clear completed items
            await this.db.clearCompletedSyncQueue();

            return results;
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync single item
     * @private
     */
    async syncItem(item) {
        console.log(`[Offline] Syncing item ${item.id} (${item.operation} ${item.entity})`);

        // Update status to syncing
        await this.db.updateSyncQueueItem(item.id, { status: 'syncing' });

        let response;

        switch (item.operation) {
            case 'create':
                response = await this.syncCreate(item);
                break;
            case 'update':
                response = await this.syncUpdate(item);
                break;
            case 'delete':
                response = await this.syncDelete(item);
                break;
            default:
                throw new Error(`Unknown operation: ${item.operation}`);
        }

        // Mark as completed
        await this.db.updateSyncQueueItem(item.id, { status: 'completed' });

        // Update offline record
        if (item.operation === 'create') {
            if (item.entity === 'fact') {
                const fact = await this.db.getFact(item.tempId);
                if (fact) {
                    await this.db.updateFact({
                        ...fact,
                        synced: true,
                        serverId: response.id || response.fact_id
                    });
                }
            } else if (item.entity === 'transfer') {
                const transfer = await this.db.getTransfer(item.tempId);
                if (transfer) {
                    await this.db.updateTransfer({
                        ...transfer,
                        synced: true,
                        serverId: response.transfer_id
                    });
                }
            } else if (item.entity === 'plan') {
                const plan = await this.db.getPlan(item.tempId);
                if (plan) {
                    await this.db.updatePlan({
                        ...plan,
                        synced: true,
                        serverId: response.id || response.plan_id
                    });
                }
            }
        }

        console.log(`[Offline] Item ${item.id} synced successfully`);

        return response;
    }

    async syncCreate(item) {
        const endpoint = item.entity === 'fact' ? '/api/v1/facts' :
                         item.entity === 'transfer' ? '/api/v1/transfers' :
                         '/api/v1/plans';

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to sync ${item.entity}`);
        }

        return await response.json();
    }

    async syncUpdate(item) {
        const id = item.data.id;
        const endpoint = item.entity === 'fact' ? `/api/v1/facts/${id}` :
                         item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/plans/${id}`;

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to update ${item.entity}`);
        }

        return await response.json();
    }

    async syncDelete(item) {
        const id = item.data.id;
        const endpoint = item.entity === 'fact' ? `/api/v1/facts/${id}` :
                         item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/plans/${id}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to delete ${item.entity}`);
        }

        return await response.json();
    }

    // ==================== EVENT HANDLERS ====================

    async handleOnline() {
        console.log('[Offline] Network restored');
        this.isOnline = true;

        // Show notification
        if (typeof showToast === 'function') {
            showToast('Соединение восстановлено', 'success');
        }

        // Trigger sync
        const results = await this.sync();

        // Show sync results
        if (results.synced > 0) {
            if (typeof showToast === 'function') {
                showToast(`Синхронизировано: ${results.synced} записей`, 'success');
            }

            // Request notification permission if not already granted
            if ('Notification' in window && Notification.permission === 'default') {
                await this.requestNotificationPermission();
            }
        }

        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
            detail: results
        }));
    }

    async handleOffline() {
        console.log('[Offline] Network lost');
        this.isOnline = false;

        if (typeof showToast === 'function') {
            showToast('Работаем оффлайн', 'warning');
        }

        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: false }
        }));
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('[Offline] Notifications not supported');
            return false;
        }

        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('[Offline] Notification permission granted');
            return true;
        }

        console.log('[Offline] Notification permission denied');
        return false;
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get pending items count
     * @returns {Promise<number>}
     */
    async getPendingCount() {
        return await this.db.getPendingCount();
    }

    /**
     * Get database info
     * @returns {Promise<Object>}
     */
    async getInfo() {
        return await this.db.getInfo();
    }

    /**
     * Clear all offline data (DANGEROUS!)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.db.clearAll();
        console.log('[Offline] All offline data cleared');
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
}
