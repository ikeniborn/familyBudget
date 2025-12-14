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
 * @version 2.0.0 - Added Shopping Lists support
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
        this.lastOfflineToastTime = 0; // For debounce offline save toast

        // ✅ Request-level deduplication cache (prevent concurrent duplicate creates)
        this.pendingCreates = new Map(); // operationKey → Promise

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
                heartbeatIntervals: [2000, 4000, 20000],  // Прогрессивные интервалы: 2s, 4s, 20s
                heartbeatTimeout: 5000,    // 5 сек timeout
                maxFailures: 3,            // 3 ошибки подряд → offline
                minCheckInterval: 1000,    // Защита от спама (1 сек)
                onStatusChange: (newStatus, oldStatus, options = {}) => {
                    this._handleNetworkStatusChange(newStatus, oldStatus, options);
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

        // Listen for auto-offline recovery events
        window.addEventListener('auto-offline-recovered', () => {
            this._handleAutoOfflineRecovery();
        });

        window.addEventListener('server-recovered', (event) => {
            console.log('[OfflineManager] Server recovered at:', new Date(event.detail.timestamp));
        });

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

        // Dispatch restored state events AFTER all listeners are registered
        // This ensures UI updates correctly on page navigation
        if (this.networkDetector && this.networkDetector.dispatchRestoredState) {
            this.networkDetector.dispatchRestoredState();
        }

        this.isInitialized = true;
    }

    /**
     * Обработчик изменения статуса сети от SmartNetworkDetector
     * @param {'online'|'offline'|'degraded'} newStatus
     * @param {'online'|'offline'|'degraded'} oldStatus
     * @param {Object} options - Optional parameters from _setStatus
     * @param {boolean} options.manual - True if this is a manual mode transition
     */
    async _handleNetworkStatusChange(newStatus, oldStatus, options = {}) {
        // Note: NetworkDetector already logs status changes, so we don't duplicate here

        // Skip toasts for manual mode transitions - base.html handles those
        const skipToast = options.manual === true;

        if (newStatus === 'offline') {
            // Переход в offline
            if (!skipToast) {
                this._showToastDebounced('Работаем оффлайн', 'warning');
            }
            // Note: offline-status-change is dispatched at the end of function for all cases
        } else if (oldStatus === 'offline' && (newStatus === 'online' || newStatus === 'degraded')) {
            // Восстановление соединения
            if (!skipToast) {
                this._showToastDebounced('Соединение восстановлено', 'success');
            }

            // Запустить синхронизацию
            if (this.supportsBackgroundSync()) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    await registration.sync.register('sync-budget-data');
                    // Background Sync will dispatch offline-sync-complete via handleSyncComplete()
                    // when Service Worker finishes - no need to dispatch here
                } catch (e) {
                    // Fallback to main thread sync if Background Sync fails
                    const syncResults = await this.sync();
                    // Dispatch event with sync results for UI update
                    window.dispatchEvent(new CustomEvent('offline-sync-complete', {
                        detail: {
                            status: newStatus,
                            synced: syncResults.synced,
                            failed: syncResults.failed
                        }
                    }));
                }
            } else {
                // No Background Sync support (Safari) - sync from main thread
                const syncResults = await this.sync();
                // Show sync result toast only for non-manual transitions
                if (syncResults.synced > 0 && !skipToast) {
                    this.lastToastTime = 0;
                    this._showToastDebounced(`Синхронизировано: ${syncResults.synced} записей`, 'success');
                }
                // Dispatch event with sync results for UI update
                window.dispatchEvent(new CustomEvent('offline-sync-complete', {
                    detail: {
                        status: newStatus,
                        synced: syncResults.synced,
                        failed: syncResults.failed
                    }
                }));
            }
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
     * Show toast about offline save with option to enable auto-offline mode
     * @private
     */
    _showOfflineSaveToast() {
        // Debounce - don't show too frequently
        const now = Date.now();
        if (now - this.lastOfflineToastTime < 10000) {
            return; // Not more than once per 10 seconds
        }
        this.lastOfflineToastTime = now;

        // Check: is auto-offline already enabled?
        if (this.networkDetector && this.networkDetector.autoOfflineMode) {
            // Already in auto-offline mode - don't show action button
            this._showToastDebounced('Сохранено локально (офлайн режим)', 'info');
            return;
        }

        // Toast with action button (NOT blocking!)
        if (typeof showToastWithAction === 'function') {
            showToastWithAction({
                message: 'Сервер недоступен. Данные сохранены локально.',
                type: 'warning',
                duration: 8000,
                action: {
                    label: 'Включить офлайн режим',
                    onClick: () => {
                        this.enableAutoOfflineMode();
                    }
                }
            });
        } else {
            // Fallback: simple toast without action
            this._showToastDebounced('Сервер недоступен. Сохранено локально.', 'warning');
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
     * Create Fact (optimistic save)
     * Try to send online → on error automatically save offline
     * @param {Object} data - Fact data
     * @returns {Promise<Object>} Created fact
     */
    async createFact(data) {
        // If explicitly offline - save locally immediately
        if (!this.isOnline) {
            return await this.createFactOffline(data);
        }

        // Try to send online with short timeout (2 sec)
        try {
            return await this.createFactOnline(data, 2000);
        } catch (error) {
            // Error - automatically save offline
            console.warn('[OfflineManager] Online create failed, falling back to offline:', error);

            const offlineItem = await this.createFactOffline(data);

            // Show toast with option to enable auto-offline
            this._showOfflineSaveToast();

            return offlineItem;
        }
    }

    /**
     * Create fact online with short timeout
     * @param {Object} data - Fact data
     * @param {number} timeout - Timeout in ms (default 2000ms)
     * @returns {Promise<Object>} Created fact
     */
    async createFactOnline(data, timeout = 2000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch('/api/v1/facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

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
        // ✅ Check if same operation already in progress (request-level deduplication)
        const operationKey = this.db.generateContentHash(data);
        if (this.pendingCreates.has(operationKey)) {
            console.log('[OfflineManager] Duplicate operation detected, reusing existing promise');
            return await this.pendingCreates.get(operationKey);
        }

        // ✅ Create promise and cache it
        const createPromise = this._createFactOfflineInternal(data);
        this.pendingCreates.set(operationKey, createPromise);

        try {
            const result = await createPromise;
            return result;
        } finally {
            // ✅ Cleanup after 5 seconds (allow for rapid successive calls)
            setTimeout(() => {
                this.pendingCreates.delete(operationKey);
            }, 5000);
        }
    }

    /**
     * Internal implementation of createFactOffline (with duplicate detection)
     * @private
     */
    async _createFactOfflineInternal(data) {
        // Generate content hash for duplicate detection
        const contentHash = this.db.generateContentHash(data);

        // Check for duplicate (unsynced record with same content)
        const existing = await this.db.checkDuplicateByHash(contentHash);
        if (existing && !existing.synced) {
            console.log('[OfflineManager] Duplicate detected, skipping:', contentHash);
            return {
                ...existing.data,
                tempId: existing.tempId,
                _offline: true,
                _synced: false,
                _duplicate: true
            };
        }

        const tempId = `offline_fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 1. Save to IndexedDB with contentHash
        await this.db.addFact({
            tempId,
            data,
            contentHash,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        });

        // 2. Add to sync queue
        // Track if created in manual mode (user-initiated offline) vs true offline
        const createdInManualMode = this.networkDetector?.isManualOfflineModeEnabled() || false;
        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'fact',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null,
            createdInManualMode
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
        const createdInManualMode = this.networkDetector?.isManualOfflineModeEnabled() || false;
        await this.db.addToSyncQueue({
            operation: 'update',
            entity: 'fact',
            tempId,
            data: { ...data, id },
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null,
            createdInManualMode
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
        const createdInManualMode = this.networkDetector?.isManualOfflineModeEnabled() || false;
        await this.db.addToSyncQueue({
            operation: 'delete',
            entity: 'fact',
            tempId,
            data: { id },
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null,
            createdInManualMode
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

        const createdInManualMode = this.networkDetector?.isManualOfflineModeEnabled() || false;
        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'transfer',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null,
            createdInManualMode
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

        const createdInManualMode = this.networkDetector?.isManualOfflineModeEnabled() || false;
        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'plan',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null,
            createdInManualMode
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
     * @param {Object} options - Sync options
     * @param {boolean} options.includeManualModeItems - Include items created in manual mode (default: false for auto-sync)
     * @returns {Promise<Object>} Sync results
     */
    async sync(options = {}) {
        const { includeManualModeItems = false } = options;

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
            skippedManualMode: 0,
            items: []
        };

        try {
            let queue = await this.db.getSyncQueue('pending');

            // Filter out manual mode items if not explicitly requested
            if (!includeManualModeItems) {
                const originalCount = queue.length;
                queue = queue.filter(item => !item.createdInManualMode);
                results.skippedManualMode = originalCount - queue.length;
                if (results.skippedManualMode > 0) {
                    console.log(`[OfflineManager] Skipping ${results.skippedManualMode} manual mode items (use manual sync button)`);
                }
            }

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

        // Verify record exists on server (only for CREATE operations)
        if (item.operation === 'create') {
            const verified = await this.verifyOnServer(item, response);
            if (!verified) {
                throw new Error('Verification failed - record not found on server');
            }
        }

        // Mark as completed (only after verification passed)
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

        // Mark as offline sync (for all entity types: fact, plan, transfer)
        cleanData.is_offline_sync = true;

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

    /**
     * Verify that a record exists on the server after sync
     * @param {Object} item - Sync queue item
     * @param {Object} syncResponse - Response from POST/PUT request
     * @returns {Promise<boolean>} True if record exists
     */
    async verifyOnServer(item, syncResponse) {
        // Facts and Plans use /api/v1/facts, Transfers use /api/v1/transfers
        const endpoint = item.entity === 'transfer'
            ? `/api/v1/transfers/${syncResponse.transfer_id}`
            : `/api/v1/facts/${syncResponse.id || syncResponse.fact_id}`;

        try {
            const response = await fetch(endpoint, {
                credentials: 'include'
            });
            return response.ok;
        } catch (e) {
            console.warn('[OfflineManager] Verification request failed:', e);
            return false;
        }
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
     * Get all unsynced items (pending + failed) for display
     * @returns {Promise<{items: Array, hasRetryable: boolean, hasManualModeItems: boolean, manualModeCount: number, createdInManualModeCount: number}>}
     */
    async getAllUnsyncedItems() {
        const pending = await this.db.getSyncQueue('pending');
        const failed = await this.db.getSyncQueue('failed');
        const items = [...pending, ...failed];

        // Items are retryable if they have errors or are failed
        const hasRetryable = items.some(item =>
            item.status === 'failed' || (item.retryCount && item.retryCount > 0)
        );

        // Check for manual mode items (pending only, not failed)
        const manualModeItems = pending.filter(item => item.createdInManualMode);
        // ✅ FIX: Show sync button for ALL pending items (not just manual mode)
        const hasManualModeItems = pending.length > 0;
        const manualModeCount = pending.length;
        const createdInManualModeCount = manualModeItems.length; // Analytics

        return { items, hasRetryable, hasManualModeItems, manualModeCount, createdInManualModeCount };
    }

    /**
     * Sync all pending items in queue (auto-sync, excludes manual mode items)
     * @returns {Promise<Object>} Sync results {synced, failed, items}
     */
    async syncQueue() {
        return await this.sync();
    }

    /**
     * Sync items created in manual mode (user-initiated sync)
     * @returns {Promise<Object>} Sync results {synced, failed, items}
     */
    async syncManualModeItems() {
        return await this.sync({ includeManualModeItems: true });
    }

    /**
     * Clear all offline data (DANGEROUS!)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.db.clearAll();
    }

    /**
     * Enable auto-offline mode
     * Called when server is unavailable while trying to send data
     */
    async enableAutoOfflineMode() {
        if (this.networkDetector) {
            this.networkDetector.enableAutoOfflineMode();
        }

        // Show toast
        this._showToastDebounced('Включен офлайн режим (автоматически)', 'info');
    }

    /**
     * Handle auto-offline recovery
     * Called when server becomes available after auto-offline mode
     * @private
     */
    async _handleAutoOfflineRecovery() {
        console.log('[OfflineManager] Auto offline recovery detected');

        // Show toast
        this._showToastDebounced('Связь с сервером восстановлена', 'success');

        // Start synchronization
        if (this.supportsBackgroundSync()) {
            navigator.serviceWorker.ready.then(registration => {
                return registration.sync.register('sync-budget-data');
            }).catch(e => {
                this.sync();
            });
        } else {
            this.sync().then(results => {
                if (results.synced > 0) {
                    this._showToastDebounced(`Синхронизировано: ${results.synced} записей`, 'success');
                }
            });
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
}
