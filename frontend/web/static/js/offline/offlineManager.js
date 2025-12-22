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

// Silent logger - only errors in production
const _offlineLog = window.DEBUG_MODE ? console.log.bind(console) : function() {};
const _offlineWarn = window.DEBUG_MODE ? console.warn.bind(console) : function() {};

class OfflineManager {
    constructor() {
        this.db = new IndexedDBManager();
        this.syncInProgress = false;
        this.retryDelay = 5000; // 5 seconds
        this.maxRetries = 5;
        this.isInitialized = false;
        this.lastToastTime = 0;
        this.toastDebounceMs = 3000; // Prevent toast spam
        this.lastOfflineToastTime = 0; // For debounce offline save toast

        // ✅ Request-level deduplication cache (prevent concurrent duplicate creates)
        this.pendingCreates = new Map(); // operationKey → Promise

        // ✅ NEW: Timeout ID for scheduled retry sync
        this.retryTimeout = null;

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
                // Интервалы увеличены после внедрения WebSocket (real-time updates через WebSocket,
                // health check нужен только для определения offline режима)
                heartbeatIntervals: [5000, 10000, 30000],  // Прогрессивные интервалы: 5s, 10s, 30s
                heartbeatTimeout: 5000,    // 5 сек timeout
                maxFailures: 3,            // 3 ошибки подряд → offline
                minCheckInterval: 2000,    // Защита от спама (2 сек)
                onStatusChange: (newStatus, oldStatus, options = {}) => {
                    this._handleNetworkStatusChange(newStatus, oldStatus, options);
                }
            });
        } else {
            // Fallback: старый способ через navigator.onLine
            _offlineWarn('[OfflineManager] SmartNetworkDetector not available, using fallback');
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
            _offlineLog('[OfflineManager] Server recovered at:', new Date(event.detail.timestamp));
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
     * @param {Object} options - Optional parameters from _setStatus (reserved for future use)
     */
    async _handleNetworkStatusChange(newStatus, oldStatus, options = {}) {
        // Note: NetworkDetector already logs status changes, so we don't duplicate here

        if (newStatus === 'offline') {
            // Переход в offline
            this._showToastDebounced('Работаем оффлайн', 'warning');
            // Disconnect WebSocket - нет смысла держать соединение в offline режиме
            this.disconnectWS();
            _offlineLog('[OfflineManager] WebSocket disconnected (offline mode)');
            // Note: offline-status-change is dispatched at the end of function for all cases
        } else if (oldStatus === 'offline' && (newStatus === 'online' || newStatus === 'degraded')) {
            // Восстановление соединения
            // НЕ показываем toast "Соединение восстановлено" сразу
            // Объединенный toast покажется после sync с результатами

            // Reconnect WebSocket - восстановить real-time соединение
            this.reconnectWS();
            _offlineLog('[OfflineManager] WebSocket reconnected (online mode)');

            // Запустить синхронизацию
            if (this.supportsBackgroundSync()) {
                try {
                    const registration = await navigator.serviceWorker.ready;
                    await registration.sync.register('sync-budget-data');
                    // Background Sync will dispatch offline-sync-complete via handleSyncComplete()
                    // when Service Worker finishes - toast покажется там с результатами sync
                } catch (e) {
                    // Fallback to main thread sync if Background Sync fails
                    const syncResults = await this.sync();
                    // Показать объединенный toast с результатами sync
                    this.lastToastTime = 0;
                    if (syncResults.synced > 0) {
                        this._showToastDebounced(`Онлайн. Синхронизировано: ${syncResults.synced} записей`, 'success');
                    } else {
                        this._showToastDebounced('Соединение восстановлено', 'success');
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
            } else {
                // No Background Sync support (Safari) - sync from main thread
                const syncResults = await this.sync();
                // Показать объединенный toast с результатами sync
                this.lastToastTime = 0;
                if (syncResults.synced > 0) {
                    this._showToastDebounced(`Онлайн. Синхронизировано: ${syncResults.synced} записей`, 'success');
                } else {
                    this._showToastDebounced('Соединение восстановлено', 'success');
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

    /**
     * Get current user ID from backend
     * @returns {Promise<number>} User ID
     */
    async getCurrentUserId() {
        // Option 1: From global window.currentUser (если доступно)
        if (window.currentUser && window.currentUser.id) {
            return window.currentUser.id;
        }

        // Option 2: Skip API call if offline
        if (!navigator.onLine) {
            _offlineLog('[OfflineManager] Offline mode - skipping user fetch, using fallback');
            return 0;  // Backend will set correct user_id from JWT when syncing
        }

        // Option 3: Fetch from /api/v1/users/me
        try {
            const response = await fetch('/api/v1/users/me', {
                credentials: 'include'
            });
            if (response.ok) {
                const user = await response.json();
                // Cache for future use
                if (!window.currentUser) {
                    window.currentUser = user;
                }
                return user.id;
            }
        } catch (error) {
            _offlineLog('[OfflineManager] Failed to get user ID:', error.message);
        }

        // Fallback: return 0 (backend will set correct user_id from JWT)
        return 0;
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
            _offlineWarn('[OfflineManager] Online create failed, falling back to offline:', error);

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
            _offlineLog('[OfflineManager] Duplicate operation detected, reusing existing promise');
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
            _offlineLog('[OfflineManager] Duplicate detected, skipping:', contentHash);
            return {
                ...existing.data,
                tempId: existing.tempId,
                _offline: true,
                _synced: false,
                _duplicate: true
            };
        }

        const tempId = `offline_fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Generate syncHash for backend deduplication (same format as in syncItem)
        // syncHash = MD5(content_hash|user_id|created_date)
        const userId = await this.getCurrentUserId();
        const createdDate = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
        const syncHashContent = `${contentHash}|${userId}|${createdDate}`;
        const syncHash = this.db._md5(syncHashContent);

        // 1. Save to IndexedDB with contentHash and syncHash
        await this.db.addFact({
            tempId,
            data,
            contentHash,
            syncHash,  // Save syncHash for SW to use during sync
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

    // ==================== RECURRING PLANS ====================

    /**
     * Create recurring plan (online-preferred with offline fallback)
     * @param {Object} data - Recurring plan data
     * @returns {Promise<Object>} Created recurring plan with _offline flag if created offline
     */
    async createRecurringPlan(data) {
        if (this.isOnline) {
            try {
                return await this.createRecurringPlanOnline(data);
            } catch (error) {
                _log('[OfflineManager] Online recurring plan creation failed, falling back to offline:', error.message);
                return await this.createRecurringPlanOffline(data);
            }
        } else {
            return await this.createRecurringPlanOffline(data);
        }
    }

    /**
     * Create recurring plan online
     * @param {Object} data - Recurring plan data
     * @returns {Promise<Object>} Created recurring plan from server
     */
    async createRecurringPlanOnline(data) {
        const response = await fetch('/api/v1/recurring-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || error.message || 'Failed to create recurring plan');
        }

        return await response.json();
    }

    /**
     * Create recurring plan offline (queued for later sync)
     * @param {Object} data - Recurring plan data
     * @returns {Promise<Object>} Offline recurring plan with tempId
     */
    async createRecurringPlanOffline(data) {
        const tempId = `offline_recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await this.db.addRecurringPlan({
            tempId,
            data,
            synced: false,
            createdAt: Date.now(),
            error: null,
            serverId: null
        });

        await this.db.addToSyncQueue({
            operation: 'create',
            entity: 'recurring',
            tempId,
            data,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0,
            error: null
        });

        _log('[OfflineManager] Recurring plan saved offline:', tempId);

        return {
            id: null,
            tempId,
            ...data,
            _offline: true,
            _synced: false,
            _pendingSync: true
        };
    }

    /**
     * Get all pending (unsynced) recurring plans
     * @returns {Promise<Array>} Array of pending recurring plans
     */
    async getPendingRecurringPlans() {
        return await this.db.getAllRecurringPlans(false);
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
            needsRetry: false,
            items: []
        };

        try {
            const queue = await this.db.getSyncQueue('pending');

            for (const item of queue) {
                try {
                    const syncResult = await this.syncItem(item);
                    // Check if item was skipped (already processed by SW)
                    if (syncResult === null) {
                        _offlineLog(`[OfflineManager] Item ${item.id} was skipped (already processed)`);
                        continue;
                    }
                    results.synced++;
                    results.items.push({ ...item, status: 'synced' });
                } catch (error) {
                    const retryCount = (item.retryCount || 0) + 1;

                    // Wrap in try-catch to handle race conditions with SW
                    try {
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
                            // NON-BLOCKING RETRY: Mark for retry but don't wait here
                            _offlineLog(`[OfflineManager] Item ${item.id} failed (attempt ${retryCount}/${this.maxRetries}), marking for retry`);

                            // Update retry count and keep status as 'pending' for next sync session
                            await this.db.updateSyncQueueItem(item.id, {
                                status: 'pending',
                                error: error.message,
                                retryCount,
                                lastRetryAttempt: Date.now()
                            });

                            // Mark that we need to schedule a retry sync
                            results.needsRetry = true;
                            results.items.push({ ...item, status: 'retry', retryCount });
                        }
                    } catch (updateError) {
                        // Item was already deleted by SW or another process - just log and continue
                        if (updateError.message && updateError.message.includes('not found')) {
                            _offlineLog(`[OfflineManager] Item ${item.id} already processed by another sync - skipping`);
                        } else {
                            _offlineWarn(`[OfflineManager] Could not update item ${item.id}: ${updateError.message}`);
                            results.failed++;
                        }
                    }
                }
            }

            // Clear completed items
            _offlineLog(`[OfflineManager] sync() completed. Synced: ${results.synced}, Failed: ${results.failed}`);
            const clearedCount = await this.db.clearCompletedSyncQueue();
            _offlineLog(`[OfflineManager] Cleared ${clearedCount} completed items from sync queue`);

            // Verify queue state after cleanup
            const remainingQueue = await this.db.getSyncQueue();
            _offlineLog(`[OfflineManager] Remaining items in queue: ${remainingQueue.length}`);
            if (remainingQueue.length > 0) {
                _offlineLog('[OfflineManager] Remaining items:', remainingQueue.map(i => ({
                    id: i.id,
                    status: i.status
                })));
            }

            // ✅ NEW: Schedule retry sync if there are items that need retry
            if (results.needsRetry) {
                _offlineLog(`[OfflineManager] Scheduling retry sync in ${this.retryDelay}ms...`);

                // Cancel any existing retry timeout to avoid duplicates
                if (this.retryTimeout) {
                    clearTimeout(this.retryTimeout);
                }

                // Schedule next sync after delay
                this.retryTimeout = setTimeout(async () => {
                    _offlineLog('[OfflineManager] Starting scheduled retry sync...');
                    await this.sync();
                }, this.retryDelay);
            }

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
        // Update status to syncing - wrap in try-catch to handle race condition with SW
        try {
            await this.db.updateSyncQueueItem(item.id, { status: 'syncing' });
        } catch (e) {
            // Item already processed by SW - skip
            if (e.message && e.message.includes('not found')) {
                _offlineLog(`[OfflineManager] Item ${item.id} already processed by SW - skipping`);
                return null;  // Signal to caller that item was skipped
            }
            throw e;
        }

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

        // Handle case where SW already synced this item
        // (offline record was deleted, so we couldn't get sync_hash)
        if (response && response._already_synced_by_sw) {
            _offlineLog(`[OfflineManager] Item ${item.id} was already synced by SW - marking as completed`);
            // Skip verification - SW already did it
            // Just mark as completed and clean up
        } else if (item.operation === 'create') {
            // Verify record exists on server (only for CREATE operations that we actually sent)
            const verified = await this.verifyOnServer(item, response);
            if (!verified) {
                throw new Error('Verification failed - record not found on server');
            }
        }

        // Mark as completed (only after verification passed)
        // Wrap in try-catch to handle race condition with SW
        _offlineLog(`[OfflineManager] syncItem ${item.id} - updating status to 'completed'`);
        try {
            await this.db.updateSyncQueueItem(item.id, { status: 'completed' });
            _offlineLog(`[OfflineManager] syncItem ${item.id} - status updated successfully`);
        } catch (e) {
            // Item already processed by SW - ignore
            if (e.message && e.message.includes('not found')) {
                _offlineLog(`[OfflineManager] Item ${item.id} already marked completed by SW`);
            } else {
                console.error(`[OfflineManager] Failed to update status for item ${item.id}:`, e);
            }
        }

        // Delete offline record after successful sync (it's now on server)
        if (item.operation === 'create') {
            try {
                if (item.entity === 'fact') {
                    await this.db.deleteFact(item.tempId);
                } else if (item.entity === 'transfer') {
                    await this.db.deleteTransfer(item.tempId);
                } else if (item.entity === 'plan') {
                    await this.db.deletePlan(item.tempId);
                } else if (item.entity === 'recurring') {
                    await this.db.deleteRecurringPlan(item.tempId);
                }
                _offlineLog(`[OfflineManager] Deleted synced ${item.entity} ${item.tempId} from offline store`);
            } catch (e) {
                // Ignore - may already be deleted by SW
                _offlineLog(`[OfflineManager] Failed to delete ${item.entity} ${item.tempId} (may already be deleted):`, e.message);
            }
        }

        return response;
    }

    async syncCreate(item) {
        // Route to appropriate API endpoint based on entity type
        const endpoint = item.entity === 'fact' || item.entity === 'plan' ? '/api/v1/facts' :
                         item.entity === 'transfer' ? '/api/v1/transfers' :
                         item.entity === 'recurring' ? '/api/v1/recurring-plans' :
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

        // Recurring plan-specific display-only fields
        if (item.entity === 'recurring') {
            delete cleanData.frequency_label;
            delete cleanData.duration_label;
        }

        // Mark as offline sync (for facts, plans, transfers - NOT recurring plans)
        // RecurringPlan model doesn't have is_offline_sync field
        if (item.entity !== 'recurring') {
            cleanData.is_offline_sync = true;
        }

        // Add deduplication hashes for facts and plans
        if (item.entity === 'fact' || item.entity === 'plan') {
            const idbRecord = await this.db.getFact(item.tempId);
            if (idbRecord && idbRecord.contentHash) {
                cleanData.content_hash = idbRecord.contentHash;

                // Use pre-generated syncHash if available (from _createFactOfflineInternal)
                // Otherwise generate it (for backward compatibility with older offline records)
                if (idbRecord.syncHash) {
                    cleanData.sync_hash = idbRecord.syncHash;
                } else {
                    // Generate sync_hash = MD5(content_hash|user_id|created_date)
                    const userId = await this.getCurrentUserId();
                    const createdDate = new Date(idbRecord.createdAt).toISOString().split('T')[0];  // YYYY-MM-DD
                    const syncHashContent = `${idbRecord.contentHash}|${userId}|${createdDate}`;
                    cleanData.sync_hash = this.db._md5(syncHashContent);
                }

                debugLog('[OfflineManager] Adding deduplication hashes:', {
                    content_hash: cleanData.content_hash,
                    sync_hash: cleanData.sync_hash
                });
            } else {
                // Offline record not found - SW already processed and deleted it
                // Return special marker to indicate item was already synced
                _offlineLog(`[OfflineManager] Offline record not found for ${item.tempId} - already synced by SW`);
                return { _already_synced_by_sw: true, id: null };
            }
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

        const result = await response.json();

        // ✅ NEW: Log if duplicate was skipped by backend
        if (result._duplicate_skipped) {
            _offlineLog('[OfflineManager] Duplicate skipped by server (idempotent):', {
                fact_id: result.id,
                sync_hash: cleanData.sync_hash
            });
        }

        return result;
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
            _offlineWarn('[OfflineManager] Verification request failed:', e);
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

        // Показать объединённый toast о восстановлении связи с результатами sync
        this.lastToastTime = 0; // Reset debounce для гарантированного показа
        if (synced > 0) {
            this._showToastDebounced(`Соединение восстановлено. Синхронизировано: ${synced}`, 'success');
        } else if (failed === 0) {
            // Нет pending данных для синхронизации
            this._showToastDebounced('Соединение восстановлено', 'success');
        }
        // Если failed > 0 без synced - показать только ошибку

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
     * @returns {Promise<{items: Array, hasRetryable: boolean}>}
     */
    async getAllUnsyncedItems() {
        const pending = await this.db.getSyncQueue('pending');
        const failed = await this.db.getSyncQueue('failed');
        const items = [...pending, ...failed];

        // Items are retryable if they have errors or are failed
        const hasRetryable = items.some(item =>
            item.status === 'failed' || (item.retryCount && item.retryCount > 0)
        );

        return { items, hasRetryable };
    }

    /**
     * Update data of a pending item in the sync queue
     * @param {number} itemId - IndexedDB sync queue item ID
     * @param {Object} updatedData - New data object to replace existing data
     * @returns {Promise<void>}
     */
    async updatePendingItemData(itemId, updatedData) {
        _offlineLog('[OfflineManager] Updating pending item data:', itemId);
        await this.db.updateSyncQueueItem(itemId, { data: updatedData });
    }

    /**
     * Remove a pending item from the sync queue
     * @param {number} itemId - IndexedDB sync queue item ID
     * @returns {Promise<void>}
     */
    async removePendingItem(itemId) {
        _offlineLog('[OfflineManager] Removing pending item:', itemId);
        await this.db.deleteSyncQueueItem(itemId);
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
        // NOTE: Toast and sync are already handled by _handleNetworkStatusChange()
        // which is called BEFORE this event is dispatched (see networkDetector.js:689-702)
        // Flow: checkConnectivity() → _setStatus('online') → onStatusChange() → _handleNetworkStatusChange()
        //       → THEN dispatch('auto-offline-recovered') → this handler
        //
        // This handler is kept for:
        // 1. Logging for debugging
        // 2. Future auto-recovery specific logic (if needed)
        _offlineLog('[OfflineManager] Auto offline recovery event received (toast/sync already handled by status change)');
    }

    // ==================== WEBSOCKET INTEGRATION ====================

    /**
     * Callback for WebSocket events to refresh UI
     * Set this from the page to handle real-time updates
     * @type {Function|null}
     * @param {string} eventType - Event type (fact_created, fact_updated, fact_deleted, etc.)
     * @param {Object} data - Event data
     */
    refreshUICallback = null;

    /**
     * Initialize Budget WebSocket client for real-time updates
     * Call this after OfflineManager.init() on pages that need real-time updates
     * @param {Object} options - WebSocket options
     * @param {Function} options.onFact - Callback for fact events (created/updated/deleted)
     * @param {Function} options.onPlan - Callback for plan events (created/updated/deleted)
     * @param {Function} options.onTransfer - Callback for transfer events (created/deleted)
     * @param {boolean} options.autoConnect - Whether to auto-connect (default: true)
     */
    initWS(options = {}) {
        const {
            onFact = null,
            onPlan = null,
            onTransfer = null,
            autoConnect = true
        } = options;

        // Set refresh callback if any handler provided
        if (onFact || onPlan || onTransfer) {
            this.refreshUICallback = (eventType, data) => {
                // Route events to appropriate handlers
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

    /**
     * Disconnect WebSocket client (disables auto-reconnect)
     */
    disconnectWS() {
        if (typeof window.budgetWSClient !== 'undefined') {
            // Use setEnabled(false) to prevent auto-reconnect from visibility/online events
            window.budgetWSClient.setEnabled(false);
        }
    }

    /**
     * Reconnect WebSocket client (re-enables and connects)
     */
    reconnectWS() {
        // Don't reconnect if we're not actually online
        if (!this.isOnline) {
            _offlineLog('[OfflineManager] Skip reconnectWS - still offline');
            return;
        }

        if (typeof window.budgetWSClient !== 'undefined') {
            // Use setEnabled(true) to re-enable auto-reconnect and connect
            window.budgetWSClient.setEnabled(true);
        }
    }

    /**
     * Get WebSocket connection status
     * @returns {Object|null} WebSocket status or null if not available
     */
    getWSStatus() {
        if (typeof window.budgetWSClient !== 'undefined') {
            return window.budgetWSClient.getStatus();
        }
        return null;
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
}
