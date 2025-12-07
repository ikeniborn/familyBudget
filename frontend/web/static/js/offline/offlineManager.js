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
 * - SmartNetworkDetector для надежного определения состояния сети
 *
 * @version 1.1.0
 */

class OfflineManager {
    constructor() {
        this.db = new IndexedDBManager();
        this.syncInProgress = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 3;
        this.isInitialized = false;
        this.lastToastTime = 0;
        this.toastDebounceMs = 3000; // Prevent toast spam

        // SmartNetworkDetector для надежного определения состояния сети
        this.networkDetector = null;

        // Note: Don't auto-init in constructor - let base.html call init() explicitly
        // This prevents double initialization
    }

    /**
     * Проверка онлайн статуса через SmartNetworkDetector
     */
    get isOnline() {
        if (this.networkDetector) {
            return this.networkDetector.isOnline();
        }
        return navigator.onLine;
    }

    /**
     * Получить детальный статус сети
     * @returns {'online'|'offline'|'degraded'}
     */
    getNetworkStatus() {
        if (this.networkDetector) {
            return this.networkDetector.getStatus();
        }
        return navigator.onLine ? 'online' : 'offline';
    }

    async init() {
        // Prevent double initialization
        if (this.isInitialized) {
            return;
        }

        // Initialize IndexedDB
        await this.db.init();

        // Initialize SmartNetworkDetector
        if (typeof SmartNetworkDetector !== 'undefined') {
            this.networkDetector = new SmartNetworkDetector({
                heartbeatUrl: '/health',
                heartbeatInterval: 30000,  // 30 сек
                heartbeatTimeout: 5000,    // 5 сек timeout
                maxFailures: 2,            // 2 ошибки подряд → offline
                minCheckInterval: 5000,    // Не проверять чаще 5 сек
                onStatusChange: (newStatus, oldStatus) => {
                    this._handleNetworkStatusChange(newStatus, oldStatus);
                }
            });
        } else {
            // Fallback: старый способ через navigator.onLine
            console.warn('[OfflineManager] SmartNetworkDetector not available, using fallback');
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());
        }

        // Listen for sync completion messages from Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.action === 'syncComplete') {
                    this.handleSyncComplete(event.data);
                }
            });
        }

        // Check initial network status
        if (this.isOnline) {
            // If Background Sync is supported, let SW handle sync
            // This prevents race condition between main thread and SW
            if (this.supportsBackgroundSync()) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    await registration.sync.register('sync-budget-data');
                } catch (e) {
                    // Fallback to main thread sync
                    await this.sync();
                }
            } else {
                // Safari or browsers without Background Sync
                await this.sync();
            }
        }

        // Setup periodic sync fallback для Safari
        if (!this.supportsBackgroundSync()) {
            this.setupSyncPolling();
        }

        // Clear expired cache periodically
        setInterval(() => this.db.clearExpiredCache(), 60000); // Every minute

        this.isInitialized = true;
    }

    /**
     * Обработчик изменения статуса сети от SmartNetworkDetector
     * @param {'online'|'offline'|'degraded'} newStatus
     * @param {'online'|'offline'|'degraded'} oldStatus
     */
    async _handleNetworkStatusChange(newStatus, oldStatus) {
        console.log(`[OfflineManager] Network status: ${oldStatus} → ${newStatus}`);

        if (newStatus === 'offline') {
            // Переход в offline
            this._showToastDebounced('Работаем оффлайн', 'warning');
            window.dispatchEvent(new CustomEvent('offline-status-change', {
                detail: { online: false, status: newStatus }
            }));
        } else if (oldStatus === 'offline' && (newStatus === 'online' || newStatus === 'degraded')) {
            // Восстановление соединения
            this._showToastDebounced('Соединение восстановлено', 'success');

            // Запустить синхронизацию
            if (this.supportsBackgroundSync()) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    await registration.sync.register('sync-budget-data');
                } catch (e) {
                    await this.sync();
                }
            } else {
                const results = await this.sync();
                if (results.synced > 0) {
                    this.lastToastTime = 0;
                    this._showToastDebounced(`Синхронизировано: ${results.synced} записей`, 'success');
                }
            }

            window.dispatchEvent(new CustomEvent('offline-sync-complete', {
                detail: { status: newStatus }
            }));
        } else if (newStatus === 'degraded' && oldStatus === 'online') {
            // Соединение ухудшилось
            this._showToastDebounced('Медленное соединение', 'warning');
        }

        // Обновить UI индикаторы
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: newStatus !== 'offline', status: newStatus }
        }));
    }

    /**
     * Show toast with debounce to prevent spam
     * @private
     */
    _showToastDebounced(message, type) {
        const now = Date.now();
        if (now - this.lastToastTime < this.toastDebounceMs) {
            return;
        }
        this.lastToastTime = now;

        if (typeof showToast === 'function') {
            showToast(message, type);
        }
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
        // Use navigator.onLine directly as it's more reliable on iOS PWA
        // this.isOnline may not update quickly enough when network changes
        const actuallyOnline = navigator.onLine && this.isOnline;

        if (actuallyOnline) {
            try {
                return await this.createFactOnline(data);
            } catch (error) {
                // Update internal state
                this.isOnline = false;
                return await this.createFactOffline(data);
            }
        } else {
            return await this.createFactOffline(data);
        }
    }

    async createFactOnline(data) {
        try {
            const response = await fetch('/api/v1/facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                // Try to parse error response, with fallback
                let errorMessage = 'Failed to create fact';
                try {
                    const error = await response.json();
                    // SW returns {error: 'Offline', message: '...'}, API returns {detail: '...'}
                    errorMessage = error.detail || error.message || errorMessage;
                } catch (parseError) {
                    // Ignore parse errors
                }
                throw new Error(errorMessage);
            }

            // Уведомить networkDetector об успешном запросе
            if (this.networkDetector) {
                this.networkDetector.onRequestSuccess();
            }

            return await response.json();
        } catch (error) {
            // Уведомить networkDetector об ошибке
            if (this.networkDetector) {
                this.networkDetector.onRequestFailure();
            }
            throw error;
        }
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

        // Note: No automatic Background Sync registration here
        // Sync is triggered manually by user or when exiting offline mode

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
                return await this.updateFactOffline(id, data);
            }
        } else {
            return await this.updateFactOffline(id, data);
        }
    }

    async updateFactOnline(id, data) {
        try {
            const response = await fetch(`/api/v1/facts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                // SW returns {error: 'Offline', message: '...'}, API returns {detail: '...'}
                throw new Error(error.detail || error.message || 'Failed to update fact');
            }

            // Уведомить networkDetector об успешном запросе
            if (this.networkDetector) {
                this.networkDetector.onRequestSuccess();
            }

            return await response.json();
        } catch (error) {
            // Уведомить networkDetector об ошибке
            if (this.networkDetector) {
                this.networkDetector.onRequestFailure();
            }
            throw error;
        }
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
                return await this.deleteFactOffline(id);
            }
        } else {
            return await this.deleteFactOffline(id);
        }
    }

    async deleteFactOnline(id) {
        try {
            const response = await fetch(`/api/v1/facts/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                const error = await response.json();
                // SW returns {error: 'Offline', message: '...'}, API returns {detail: '...'}
                throw new Error(error.detail || error.message || 'Failed to delete fact');
            }

            // Уведомить networkDetector об успешном запросе
            if (this.networkDetector) {
                this.networkDetector.onRequestSuccess();
            }

            return await response.json();
        } catch (error) {
            // Уведомить networkDetector об ошибке
            if (this.networkDetector) {
                this.networkDetector.onRequestFailure();
            }
            throw error;
        }
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
    }

    // ==================== TRANSFERS ====================

    async createTransfer(data) {
        if (this.isOnline) {
            try {
                return await this.createTransferOnline(data);
            } catch (error) {
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
            // SW returns {error: 'Offline', message: '...'}, API returns {detail: '...'}
            throw new Error(error.detail || error.message || 'Failed to create transfer');
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

        // Note: No automatic Background Sync registration here
        // Sync is triggered manually by user or when exiting offline mode

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
                return await this.createPlanOffline(data);
            }
        } else {
            return await this.createPlanOffline(data);
        }
    }

    async createPlanOnline(data) {
        // Plans are created via /api/v1/facts with record_type='plan'
        const response = await fetch('/api/v1/facts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            // SW returns {error: 'Offline', message: '...'}, API returns {detail: '...'}
            throw new Error(error.detail || error.message || 'Failed to create plan');
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

        // Note: No automatic Background Sync registration here
        // Sync is triggered manually by user or when exiting offline mode

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
            return { skipped: true };
        }

        if (!this.isOnline) {
            return { skipped: true, reason: 'offline' };
        }

        this.syncInProgress = true;

        const results = {
            synced: 0,
            failed: 0,
            items: []
        };

        try {
            const queue = await this.db.getSyncQueue('pending');

            for (const item of queue) {
                try {
                    await this.syncItem(item);
                    results.synced++;
                    results.items.push({ ...item, status: 'synced' });
                } catch (error) {

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

        return response;
    }

    async syncCreate(item) {
        // Plans use /api/v1/facts endpoint (same as facts, with record_type='plan')
        const endpoint = item.entity === 'fact' || item.entity === 'plan' ? '/api/v1/facts' :
                         item.entity === 'transfer' ? '/api/v1/transfers' :
                         '/api/v1/facts';

        // Clean data: remove display-only fields not expected by API
        const cleanData = { ...item.data };

        // Common display-only fields for facts/plans
        delete cleanData.article_name;
        delete cleanData.financial_center_name;
        delete cleanData.cost_center_name;
        delete cleanData.plan_date;
        delete cleanData.fact_type;
        // Notification fields are stored for display but not sent to API
        // (reminders are created separately after sync)
        delete cleanData.notification_enabled;
        delete cleanData.reminder_datetime;

        // Transfer-specific display-only fields
        if (item.entity === 'transfer') {
            delete cleanData.from_financial_center_name;
            delete cleanData.to_financial_center_name;
            delete cleanData.from_article_name;
            delete cleanData.to_article_name;
        }

        debugLog(`[OfflineManager] Syncing ${item.entity} to ${endpoint}:`, cleanData);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData),
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    }

    async syncUpdate(item) {
        const id = item.data.id;
        // Plans use /api/v1/facts endpoint (same as facts, with record_type='plan')
        const endpoint = item.entity === 'fact' || item.entity === 'plan' ? `/api/v1/facts/${id}` :
                         item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/facts/${id}`;

        // Clean data: remove display-only fields
        const cleanData = { ...item.data };

        // Common display-only fields for facts/plans
        delete cleanData.article_name;
        delete cleanData.financial_center_name;
        delete cleanData.cost_center_name;
        delete cleanData.plan_date;
        delete cleanData.fact_type;
        // Notification fields are stored for display but not sent to API
        delete cleanData.notification_enabled;
        delete cleanData.reminder_datetime;

        // Transfer-specific display-only fields
        if (item.entity === 'transfer') {
            delete cleanData.from_financial_center_name;
            delete cleanData.to_financial_center_name;
            delete cleanData.from_article_name;
            delete cleanData.to_article_name;
        }

        debugLog(`[OfflineManager] Updating ${item.entity} at ${endpoint}:`, cleanData);

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cleanData),
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    }

    async syncDelete(item) {
        const id = item.data.id;
        // Plans use /api/v1/facts endpoint (same as facts, with record_type='plan')
        const endpoint = item.entity === 'fact' || item.entity === 'plan' ? `/api/v1/facts/${id}` :
                         item.entity === 'transfer' ? `/api/v1/transfers/${id}` :
                         `/api/v1/facts/${id}`;

        const response = await fetch(endpoint, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (!response.ok) {
            let errorDetail = `HTTP ${response.status}`;
            try {
                const error = await response.json();
                errorDetail = error.detail || error.message || errorDetail;
            } catch (e) {
                errorDetail = response.statusText || errorDetail;
            }
            throw new Error(errorDetail);
        }

        // DELETE returns 204 No Content
        return { success: true };
    }

    // ==================== EVENT HANDLERS ====================

    async handleOnline() {
        this.isOnline = true;

        // Show notification (debounced to prevent spam)
        this._showToastDebounced('Соединение восстановлено', 'success');

        // If Background Sync is supported, let Service Worker handle sync
        // This prevents race condition between main thread and SW
        if (this.supportsBackgroundSync()) {
            // Just register sync - SW will handle it
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-budget-data');
            } catch (e) {
                // Fall through to main thread sync if registration fails
            }
            // Return early - SW will handle sync
            return { skipped: true, reason: 'background-sync' };
        }

        // Fallback: sync from main thread (Safari, or if SW registration failed)
        const results = await this.sync();

        // Show sync results (only if there were items to sync)
        if (results.synced > 0) {
            // Reset debounce time to allow sync result toast
            this.lastToastTime = 0;
            this._showToastDebounced(`Синхронизировано: ${results.synced} записей`, 'success');

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
        this.isOnline = false;

        // Show notification (debounced to prevent spam)
        this._showToastDebounced('Работаем оффлайн', 'warning');

        // Emit custom event for UI updates
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: false }
        }));
    }

    /**
     * Handle sync completion message from Service Worker
     * @param {Object} data - Sync completion data {synced, failed}
     */
    handleSyncComplete(data) {
        const { synced, failed } = data;

        // Show toast with sync results
        if (synced > 0) {
            this.lastToastTime = 0; // Reset debounce
            this._showToastDebounced(`Синхронизировано: ${synced} записей`, 'success');
        }

        if (failed > 0) {
            this._showToastDebounced(`Не удалось синхронизировать: ${failed} записей`, 'error');
        }

        // Emit custom event for UI updates (e.g., reload facts list)
        window.dispatchEvent(new CustomEvent('offline-sync-complete', {
            detail: { synced, failed, source: 'service-worker' }
        }));
    }

    /**
     * Request notification permission
     */
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            return false;
        }

        const permission = await Notification.requestPermission();
        return permission === 'granted';
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
     * Get sync queue item by ID (for status checking)
     * @param {number} id - Fact ID
     * @returns {Promise<Object|null>} Queue item or null if not found
     */
    async getSyncQueueItem(id) {
        const queue = await this.db.getSyncQueue();
        return queue.find(item => item.data && item.data.id === id) || null;
    }

    /**
     * Get all pending sync items for display
     * @returns {Promise<Array>} Array of pending items
     */
    async getPendingSyncItems() {
        return await this.db.getSyncQueue('pending');
    }

    /**
     * Sync all pending items in queue
     * @returns {Promise<Object>} Sync results {synced, failed, items}
     */
    async syncQueue() {
        return await this.sync();
    }

    /**
     * Clear all offline data (DANGEROUS!)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.db.clearAll();
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
}
