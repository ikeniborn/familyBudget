/**
 * Smart Network Detector для Family Budget PWA
 *
 * Надежное определение состояния сети с использованием:
 * - navigator.onLine (быстрая проверка)
 * - Network Information API (качество соединения)
 * - Heartbeat к /health endpoint (реальная доступность API)
 * - Счетчик последовательных ошибок (быстрое переключение)
 *
 * @version 1.0.0
 */

class SmartNetworkDetector {
    constructor(options = {}) {
        // Состояние: 'online' | 'offline' | 'degraded'
        this.status = navigator.onLine ? 'online' : 'offline';

        // Manual offline mode (user-controlled)
        this.manualOfflineMode = false;

        // Auto offline mode (server unavailable)
        this.autoOfflineMode = false;

        this._loadOfflineState();

        // Счетчик последовательных ошибок
        this.consecutiveFailures = 0;
        this.maxFailuresBeforeOffline = options.maxFailures || 3;

        // Heartbeat настройки (прогрессивные интервалы)
        this.heartbeatUrl = options.heartbeatUrl || '/health';
        this.heartbeatIntervals = options.heartbeatIntervals || [2000, 4000, 20000]; // 2s, 4s, 20s
        this.heartbeatTimeout = options.heartbeatTimeout || 5000; // 5 сек
        this.lastHeartbeat = 0;
        this.heartbeatTimer = null;

        // Минимальный интервал между проверками (защита от спама)
        this.minCheckInterval = options.minCheckInterval || 1000; // 1 сек (защита от спама)
        this.lastCheck = 0;

        // Network Information API thresholds
        // Note: RTT threshold increased from 1000ms to 2500ms to reduce
        // false positives on mobile networks, VPN, and slower connections
        this.slowConnectionTypes = ['slow-2g', '2g'];
        this.degradedRtt = options.degradedRtt || 2500; // RTT > 2500ms = degraded

        // Callbacks
        this.onStatusChange = options.onStatusChange || null;

        // Привязка методов
        this._handleOnline = this._handleOnline.bind(this);
        this._handleOffline = this._handleOffline.bind(this);
        this._handleConnectionChange = this._handleConnectionChange.bind(this);

        // Инициализация
        this._init();
    }

    _init() {
        // Слушатели браузерных событий
        window.addEventListener('online', this._handleOnline);
        window.addEventListener('offline', this._handleOffline);

        // Network Information API (Chrome, Edge, Yandex Browser)
        if (this._hasNetworkInformation()) {
            navigator.connection.addEventListener('change', this._handleConnectionChange);
        }

        // Запуск heartbeat (only if not in any offline mode)
        if (!this.manualOfflineMode && !this.autoOfflineMode) {
            this._startHeartbeat();
            // Первичная проверка
            this.checkConnectivity();
        }
    }

    /**
     * Проверка поддержки Network Information API
     */
    _hasNetworkInformation() {
        return 'connection' in navigator &&
               navigator.connection &&
               'effectiveType' in navigator.connection;
    }

    /**
     * Получить информацию о качестве соединения
     */
    getConnectionInfo() {
        if (!this._hasNetworkInformation()) {
            return null;
        }

        const conn = navigator.connection;
        return {
            effectiveType: conn.effectiveType,  // '4g', '3g', '2g', 'slow-2g'
            downlink: conn.downlink,            // Mbps
            rtt: conn.rtt,                      // Round-trip time ms
            saveData: conn.saveData             // Data saver mode
        };
    }

    /**
     * Обработка события online
     */
    async _handleOnline() {
        // Skip if any offline mode is enabled
        if (this.manualOfflineMode || this.autoOfflineMode) {
            return;
        }
        // navigator.onLine стал true, но нужно проверить реальное соединение
        await this.checkConnectivity(true);
    }

    /**
     * Обработка события offline
     */
    _handleOffline() {
        this._setStatus('offline');
    }

    /**
     * Обработка изменения качества соединения
     */
    async _handleConnectionChange() {
        // Skip if any offline mode is enabled
        if (this.manualOfflineMode || this.autoOfflineMode) {
            return;
        }

        const info = this.getConnectionInfo();
        if (!info) return;

        // Очень медленное соединение → degraded
        if (this.slowConnectionTypes.includes(info.effectiveType) ||
            info.rtt > this.degradedRtt) {
            this._setStatus('degraded');
        } else if (this.status === 'degraded') {
            // Соединение улучшилось → проверить реальную доступность
            await this.checkConnectivity(true);
        }
    }

    /**
     * Установить новый статус и уведомить слушателей
     */
    _setStatus(newStatus) {
        const oldStatus = this.status;

        if (oldStatus !== newStatus) {
            this.status = newStatus;

            // Уведомить через callback
            if (this.onStatusChange) {
                this.onStatusChange(newStatus, oldStatus);
            }

            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('network-status-change', {
                detail: {
                    status: newStatus,
                    previousStatus: oldStatus,
                    timestamp: Date.now()
                }
            }));

            console.log(`[NetworkDetector] Status changed: ${oldStatus} → ${newStatus}`);
        }

        return newStatus;
    }

    /**
     * Get adaptive timeout based on RTT (Round-Trip Time)
     * @returns {number} Timeout in ms
     * @private
     */
    _getAdaptiveTimeout() {
        const info = this.getConnectionInfo();

        if (info && info.rtt) {
            // RTT * 2 or minimum 2sec, maximum 5sec
            return Math.max(Math.min(info.rtt * 2, 5000), 2000);
        }

        // Fallback: 3000ms (compromise between 2 and 5 sec)
        return 3000;
    }

    /**
     * Проверить реальную доступность API
     * @param {boolean} force - Игнорировать минимальный интервал
     */
    async checkConnectivity(force = false) {
        // Skip network checks if any offline mode is enabled
        if (this.manualOfflineMode || this.autoOfflineMode) {
            return 'offline';
        }

        // Быстрая проверка navigator.onLine
        if (!navigator.onLine) {
            return this._setStatus('offline');
        }

        // Не проверять слишком часто
        const now = Date.now();
        if (!force && now - this.lastCheck < this.minCheckInterval) {
            return this.status;
        }
        this.lastCheck = now;

        try {
            // Use adaptive timeout based on RTT
            const timeout = this._getAdaptiveTimeout();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(this.heartbeatUrl, {
                method: 'GET',
                cache: 'no-store',
                credentials: 'include',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                this.consecutiveFailures = 0;
                this.lastHeartbeat = now;

                // Проверить качество соединения
                const info = this.getConnectionInfo();
                if (info && (this.slowConnectionTypes.includes(info.effectiveType) ||
                             info.rtt > this.degradedRtt)) {
                    return this._setStatus('degraded');
                }

                return this._setStatus('online');
            } else {
                // HTTP error (но соединение есть)
                return this._setStatus('degraded');
            }
        } catch (error) {
            // Network error или timeout
            this.consecutiveFailures++;

            if (this.consecutiveFailures >= this.maxFailuresBeforeOffline) {
                return this._setStatus('offline');
            }

            return this._setStatus('degraded');
        }
    }

    /**
     * Получить задержку до следующей проверки (прогрессивный backoff)
     * @private
     */
    _getNextCheckDelay() {
        // consecutiveFailures = 0: первая проверка через 2s
        // consecutiveFailures = 1: вторая проверка через 2s
        // consecutiveFailures = 2: третья проверка через 4s
        // consecutiveFailures >= 3 (offline): проверки каждые 20s
        const index = Math.min(this.consecutiveFailures, this.heartbeatIntervals.length - 1);
        return this.heartbeatIntervals[index];
    }

    /**
     * Запустить периодический heartbeat (с прогрессивным backoff)
     */
    _startHeartbeat() {
        this._scheduleNextHeartbeat();
    }

    /**
     * Запланировать следующую проверку heartbeat
     * @private
     */
    _scheduleNextHeartbeat() {
        // Очистить предыдущий таймер
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
        }

        // Skip if any offline mode is enabled
        if (this.manualOfflineMode || this.autoOfflineMode) {
            return;
        }

        const delay = this._getNextCheckDelay();

        this.heartbeatTimer = setTimeout(async () => {
            // ВАЖНО: Проверять ВСЕГДА, независимо от статуса!
            // Это позволяет обнаруживать восстановление сети даже когда status = 'offline'
            await this.checkConnectivity();

            // Запланировать следующую проверку
            this._scheduleNextHeartbeat();
        }, delay);
    }

    /**
     * Остановить heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Вызывается при успешном запросе
     * (для интеграции с OfflineManager)
     */
    onRequestSuccess() {
        // Skip if manual offline mode is enabled
        if (this.manualOfflineMode) {
            return;
        }

        this.consecutiveFailures = 0;

        if (this.status === 'offline') {
            // Если были offline, проверить реальное состояние
            this.checkConnectivity(true);
        } else if (this.status === 'degraded') {
            // Успешный запрос при degraded → вернуться в online
            this._setStatus('online');
        }
    }

    /**
     * Вызывается при неудачном запросе
     * (для интеграции с OfflineManager)
     */
    onRequestFailure() {
        // Skip if manual offline mode is enabled
        if (this.manualOfflineMode) {
            return;
        }

        this.consecutiveFailures++;

        if (this.consecutiveFailures >= this.maxFailuresBeforeOffline) {
            this._setStatus('offline');
        } else if (this.status === 'online') {
            this._setStatus('degraded');
        }
    }

    /**
     * Получить текущий статус
     */
    getStatus() {
        return this.status;
    }

    /**
     * Проверка: онлайн ли (online или degraded, но не offline)
     */
    isOnline() {
        return this.status !== 'offline';
    }

    /**
     * Проверка: полностью ли онлайн (только 'online', не 'degraded')
     */
    isFullyOnline() {
        return this.status === 'online';
    }

    /**
     * Получить детальную информацию о состоянии сети
     */
    getDetailedStatus() {
        return {
            status: this.status,
            navigatorOnLine: navigator.onLine,
            consecutiveFailures: this.consecutiveFailures,
            lastHeartbeat: this.lastHeartbeat,
            lastCheck: this.lastCheck,
            connectionInfo: this.getConnectionInfo()
        };
    }

    /**
     * Очистка при уничтожении
     */
    destroy() {
        window.removeEventListener('online', this._handleOnline);
        window.removeEventListener('offline', this._handleOffline);

        if (this._hasNetworkInformation()) {
            navigator.connection.removeEventListener('change', this._handleConnectionChange);
        }

        this.stopHeartbeat();
        this._stopAutoRecoveryCheck();
    }

    // ==================== MANUAL OFFLINE MODE ====================

    /**
     * Load offline state from localStorage (both manual and auto)
     * @private
     */
    _loadOfflineState() {
        try {
            const manual = localStorage.getItem('budget_manual_offline_mode');
            const auto = localStorage.getItem('budget_auto_offline_mode');

            this.manualOfflineMode = manual === 'true';
            this.autoOfflineMode = auto === 'true';

            if (this.manualOfflineMode || this.autoOfflineMode) {
                this.status = 'offline';
            }
        } catch (e) {
            this.manualOfflineMode = false;
            this.autoOfflineMode = false;
        }
    }

    /**
     * Save offline state to localStorage (both manual and auto)
     * @private
     */
    _saveOfflineState() {
        try {
            localStorage.setItem('budget_manual_offline_mode', this.manualOfflineMode.toString());
            localStorage.setItem('budget_auto_offline_mode', this.autoOfflineMode.toString());
        } catch (e) {
            console.warn('[NetworkDetector] Failed to save offline state');
        }
    }

    /**
     * Enable manual offline mode
     * When enabled, network checks are skipped and status is forced to 'offline'
     */
    enableManualOfflineMode() {
        if (this.manualOfflineMode) return;

        const oldStatus = this.status;
        this.manualOfflineMode = true;
        this._saveOfflineState();
        this.stopHeartbeat();
        this.status = 'offline';

        console.log('[NetworkDetector] Manual offline mode ENABLED');

        // Always dispatch events for UI updates (even if status was already offline)
        // This ensures UI is updated when user manually enables offline mode
        window.dispatchEvent(new CustomEvent('network-status-change', {
            detail: {
                status: 'offline',
                previousStatus: oldStatus,
                timestamp: Date.now(),
                manual: true
            }
        }));

        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: false, status: 'offline', manual: true }
        }));

        window.dispatchEvent(new CustomEvent('manual-offline-mode-change', {
            detail: { enabled: true }
        }));

        // Notify callback if set
        if (this.onStatusChange) {
            this.onStatusChange('offline', oldStatus);
        }
    }

    /**
     * Disable manual offline mode
     * Network checks resume and status is determined by actual connectivity
     */
    async disableManualOfflineMode() {
        if (!this.manualOfflineMode) return;

        this.manualOfflineMode = false;
        this._saveOfflineState();
        this._startHeartbeat();

        console.log('[NetworkDetector] Manual offline mode DISABLED');

        // Dispatch event for UI updates first
        window.dispatchEvent(new CustomEvent('manual-offline-mode-change', {
            detail: { enabled: false }
        }));

        // Check actual connectivity and update status
        // This will trigger network-status-change and offline-status-change events
        await this.checkConnectivity(true);

        // If status changed back to online, ensure UI is updated
        const currentStatus = this.status;
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: currentStatus !== 'offline', status: currentStatus, manual: false }
        }));
    }

    /**
     * Toggle manual offline mode
     * @returns {Promise<boolean>} New state (true = offline mode enabled)
     */
    async toggleManualOfflineMode() {
        if (this.manualOfflineMode) {
            await this.disableManualOfflineMode();
        } else {
            this.enableManualOfflineMode();
        }
        return this.manualOfflineMode;
    }

    /**
     * Check if manual offline mode is enabled
     * @returns {boolean}
     */
    isManualOfflineModeEnabled() {
        return this.manualOfflineMode;
    }

    // ==================== AUTO OFFLINE MODE ====================

    /**
     * Enable auto offline mode
     * Activated when server is unavailable when trying to send data
     */
    enableAutoOfflineMode() {
        if (this.autoOfflineMode) return;

        // Manual mode has priority
        if (this.manualOfflineMode) {
            console.log('[NetworkDetector] Manual offline mode active, skipping auto offline');
            return;
        }

        const oldStatus = this.status;
        this.autoOfflineMode = true;
        this._saveOfflineState();
        this.stopHeartbeat();
        this.status = 'offline';

        console.log('[NetworkDetector] Auto offline mode ENABLED');

        // Start periodic recovery check (progressive backoff: 30s → 60s → 120s)
        this._startAutoRecoveryCheck();

        // Dispatch events
        window.dispatchEvent(new CustomEvent('network-status-change', {
            detail: {
                status: 'offline',
                previousStatus: oldStatus,
                timestamp: Date.now(),
                auto: true
            }
        }));

        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: { online: false, status: 'offline', auto: true }
        }));
    }

    /**
     * Disable auto offline mode
     * Called when connection to server is restored
     */
    async disableAutoOfflineMode() {
        if (!this.autoOfflineMode) return;

        this.autoOfflineMode = false;
        this._saveOfflineState();
        this._stopAutoRecoveryCheck();
        this._startHeartbeat();

        console.log('[NetworkDetector] Auto offline mode DISABLED');

        // Check actual network state
        await this.checkConnectivity(true);
    }

    /**
     * Start periodic recovery check with progressive backoff
     * Checks every 30s → 60s → 120s when in auto-offline mode
     * @private
     */
    _startAutoRecoveryCheck() {
        this._stopAutoRecoveryCheck(); // Clear previous

        let checkCount = 0;
        const intervals = [30000, 60000, 120000]; // 30s, 60s, 120s

        const scheduleNext = () => {
            const interval = intervals[Math.min(checkCount, intervals.length - 1)];

            console.log(`[NetworkDetector] Scheduling next auto recovery check in ${interval / 1000}s (check #${checkCount + 1})`);

            this.autoRecoveryTimer = setTimeout(async () => {
                console.log(`[NetworkDetector] Auto recovery check #${checkCount + 1}...`);

                // Temporarily disable auto offline mode to allow real connectivity check
                const wasAutoOffline = this.autoOfflineMode;
                this.autoOfflineMode = false;

                try {
                    // Check actual server connectivity
                    await this.checkConnectivity(true);

                    if (this.status !== 'offline') {
                        // Recovered!
                        console.log('[NetworkDetector] Server recovered, disabling auto offline mode');
                        await this.disableAutoOfflineMode();

                    // Show notification
                    window.dispatchEvent(new CustomEvent('server-recovered', {
                        detail: { timestamp: Date.now() }
                    }));

                        // Trigger sync
                        window.dispatchEvent(new CustomEvent('auto-offline-recovered'));
                    } else {
                        // Not recovered - restore auto offline mode and schedule next check
                        this.autoOfflineMode = wasAutoOffline;
                        checkCount++;
                        scheduleNext();
                    }
                } catch (error) {
                    // Error during check - restore auto offline mode and schedule next check
                    console.error('[NetworkDetector] Error during recovery check:', error);
                    this.autoOfflineMode = wasAutoOffline;
                    checkCount++;
                    scheduleNext();
                }
            }, interval);
        };

        scheduleNext();
    }

    /**
     * Stop auto recovery check
     * @private
     */
    _stopAutoRecoveryCheck() {
        if (this.autoRecoveryTimer) {
            clearTimeout(this.autoRecoveryTimer);
            this.autoRecoveryTimer = null;
        }
    }

    /**
     * Check if any offline mode is enabled (manual or auto)
     * @returns {boolean}
     */
    isOfflineModeEnabled() {
        return this.manualOfflineMode || this.autoOfflineMode;
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.SmartNetworkDetector = SmartNetworkDetector;
}
