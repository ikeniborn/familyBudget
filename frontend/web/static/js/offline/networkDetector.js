"use strict";
/**
 * Smart Network Detector для Family Budget PWA
 *
 * Надежное определение состояния сети с использованием:
 * - navigator.onLine (быстрая проверка)
 * - Network Information API (качество соединения)
 * - Heartbeat к /health endpoint (реальная доступность API)
 * - Счетчик последовательных ошибок (быстрое переключение)
 *
 * @version 2.0.0
 * @date 2026-01-05
 */
// Silent logger - only errors in production
const _networkLog = window.DEBUG_MODE ? console.log.bind(console) : function () { };
const _networkWarn = window.DEBUG_MODE ? console.warn.bind(console) : function () { };
class SmartNetworkDetector {
    constructor(options = {}) {
        this.autoOfflineMode = false;
        this._hasRestoredState = false;
        this._stateDispatched = false;
        this.consecutiveFailures = 0;
        this.lastHeartbeat = 0;
        this.heartbeatTimer = null;
        this.lastCheck = 0;
        this.autoRecoveryTimer = null;
        // Состояние: 'online' | 'offline' | 'degraded'
        this.status = navigator.onLine ? 'online' : 'offline';
        this._loadOfflineState();
        // Счетчик последовательных ошибок
        this.maxFailuresBeforeOffline = options.maxFailures || 3;
        // Heartbeat настройки (прогрессивные интервалы)
        this.heartbeatUrl = options.heartbeatUrl || '/health';
        this.heartbeatIntervals = options.heartbeatIntervals || [2000, 4000, 20000]; // 2s, 4s, 20s
        // heartbeatTimeout используется только в options, не хранится как поле класса
        // Минимальный интервал между проверками (защита от спама)
        this.minCheckInterval = options.minCheckInterval || 1000; // 1 сек (защита от спама)
        // Network Information API thresholds
        // Note: RTT threshold increased from 1000ms → 2500ms → 5000ms to reduce
        // false positives on mobile networks, VPN connections, and page transitions
        this.slowConnectionTypes = ['slow-2g', '2g'];
        this.degradedRtt = options.degradedRtt || 5000; // RTT > 5000ms = degraded
        // Callbacks
        this.onStatusChange = options.onStatusChange || null;
        // Привязка методов
        this._handleOnline = this._handleOnlineImpl.bind(this);
        this._handleOffline = this._handleOfflineImpl.bind(this);
        this._handleConnectionChange = this._handleConnectionChangeImpl.bind(this);
        // Инициализация
        this._init();
        // Store reference for dispatching events after init
        // Events are dispatched via dispatchRestoredState() called explicitly
        // This ensures listeners are registered before dispatch
        this._hasRestoredState = this.autoOfflineMode;
    }
    /**
     * Dispatch events for restored offline state from localStorage.
     * Should be called after event listeners are registered (e.g., after init completes).
     * This method is safe to call multiple times - it only dispatches once.
     */
    dispatchRestoredState() {
        if (!this._hasRestoredState || this._stateDispatched) {
            return;
        }
        this._stateDispatched = true;
        // Dispatch network status change event
        window.dispatchEvent(new CustomEvent('network-status-change', {
            detail: {
                status: 'offline',
                previousStatus: 'online',
                timestamp: Date.now(),
                auto: this.autoOfflineMode,
                restored: true // Indicates state was restored from localStorage
            }
        }));
        // Dispatch offline status change for UI updates
        window.dispatchEvent(new CustomEvent('offline-status-change', {
            detail: {
                online: false,
                status: 'offline',
                auto: this.autoOfflineMode
            }
        }));
    }
    _init() {
        // Слушатели браузерных событий
        window.addEventListener('online', this._handleOnline);
        window.addEventListener('offline', this._handleOffline);
        // Network Information API (Chrome, Edge, Yandex Browser)
        if (this._hasNetworkInformation()) {
            navigator.connection.addEventListener('change', this._handleConnectionChange);
        }
        // Запуск heartbeat (only if not in auto offline mode)
        if (!this.autoOfflineMode) {
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
            !!navigator.connection &&
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
            effectiveType: conn.effectiveType,
            downlink: conn.downlink || 0,
            rtt: conn.rtt || 0,
            saveData: conn.saveData || false
        };
    }
    /**
     * Обработка события online
     */
    async _handleOnlineImpl() {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
            return;
        }
        // navigator.onLine стал true, но нужно проверить реальное соединение
        await this.checkConnectivity(true);
    }
    /**
     * Обработка события offline
     */
    _handleOfflineImpl() {
        this._setStatus('offline');
    }
    /**
     * Обработка изменения качества соединения
     */
    async _handleConnectionChangeImpl() {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
            return;
        }
        const info = this.getConnectionInfo();
        if (!info)
            return;
        // Очень медленное соединение → degraded
        if (this.slowConnectionTypes.includes(info.effectiveType) ||
            info.rtt > this.degradedRtt) {
            this._setStatus('degraded');
        }
        else if (this.status === 'degraded') {
            // Соединение улучшилось → проверить реальную доступность
            await this.checkConnectivity(true);
        }
    }
    /**
     * Установить новый статус и уведомить слушателей
     * @param newStatus - New status
     * @param options - Optional parameters (reserved for future use)
     */
    _setStatus(newStatus, options = {}) {
        const oldStatus = this.status;
        if (oldStatus !== newStatus) {
            this.status = newStatus;
            // Уведомить через callback
            if (this.onStatusChange) {
                this.onStatusChange(newStatus, oldStatus, options);
            }
            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('network-status-change', {
                detail: {
                    status: newStatus,
                    previousStatus: oldStatus,
                    timestamp: Date.now()
                }
            }));
            _networkLog(`[NetworkDetector] Status changed: ${oldStatus} → ${newStatus}`);
        }
        return newStatus;
    }
    /**
     * Get adaptive timeout based on RTT (Round-Trip Time)
     * @returns Timeout in ms
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
     * @param force - Игнорировать минимальный интервал
     */
    async checkConnectivity(force = false) {
        // Skip network checks if auto offline mode is enabled
        if (this.autoOfflineMode) {
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
            }
            else {
                // HTTP error (но соединение есть)
                return this._setStatus('degraded');
            }
        }
        catch (error) {
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
     */
    _scheduleNextHeartbeat() {
        // Очистить предыдущий таймер
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
        }
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
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
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
            return;
        }
        this.consecutiveFailures = 0;
        if (this.status === 'offline') {
            // Если были offline, проверить реальное состояние
            this.checkConnectivity(true);
        }
        else if (this.status === 'degraded') {
            // Успешный запрос при degraded → вернуться в online
            this._setStatus('online');
        }
    }
    /**
     * Вызывается при неудачном запросе
     * (для интеграции с OfflineManager)
     */
    onRequestFailure() {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
            return;
        }
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.maxFailuresBeforeOffline) {
            this._setStatus('offline');
        }
        else if (this.status === 'online') {
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
    // ==================== AUTO OFFLINE MODE ====================
    /**
     * Load offline state from localStorage
     */
    _loadOfflineState() {
        try {
            const auto = localStorage.getItem('budget_auto_offline_mode');
            this.autoOfflineMode = auto === 'true';
            if (this.autoOfflineMode) {
                this.status = 'offline';
            }
            // Cleanup legacy manual mode state
            localStorage.removeItem('budget_manual_offline_mode');
        }
        catch (e) {
            this.autoOfflineMode = false;
        }
    }
    /**
     * Save offline state to localStorage
     */
    _saveOfflineState() {
        try {
            localStorage.setItem('budget_auto_offline_mode', this.autoOfflineMode.toString());
        }
        catch (e) {
            _networkWarn('[NetworkDetector] Failed to save offline state');
        }
    }
    /**
     * Enable auto offline mode
     * Activated when server is unavailable when trying to send data
     */
    enableAutoOfflineMode() {
        if (this.autoOfflineMode)
            return;
        const oldStatus = this.status;
        this.autoOfflineMode = true;
        this._saveOfflineState();
        this.stopHeartbeat();
        this.status = 'offline';
        _networkLog('[NetworkDetector] Auto offline mode ENABLED');
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
        if (!this.autoOfflineMode)
            return;
        this.autoOfflineMode = false;
        this._saveOfflineState();
        this._stopAutoRecoveryCheck();
        this._startHeartbeat();
        _networkLog('[NetworkDetector] Auto offline mode DISABLED');
        // Check actual network state
        await this.checkConnectivity(true);
    }
    /**
     * Start periodic recovery check with progressive backoff
     * Checks every 30s → 60s → 120s when in auto-offline mode
     */
    _startAutoRecoveryCheck() {
        this._stopAutoRecoveryCheck(); // Clear previous
        let checkCount = 0;
        const intervals = [30000, 60000, 120000]; // 30s, 60s, 120s
        const scheduleNext = () => {
            const interval = intervals[Math.min(checkCount, intervals.length - 1)];
            _networkLog(`[NetworkDetector] Scheduling next auto recovery check in ${interval / 1000}s (check #${checkCount + 1})`);
            this.autoRecoveryTimer = setTimeout(async () => {
                _networkLog(`[NetworkDetector] Auto recovery check #${checkCount + 1}...`);
                // Temporarily disable auto offline mode to allow real connectivity check
                const wasAutoOffline = this.autoOfflineMode;
                this.autoOfflineMode = false;
                try {
                    // Check actual server connectivity
                    await this.checkConnectivity(true);
                    if (this.status !== 'offline') {
                        // Recovered!
                        _networkLog('[NetworkDetector] Server recovered, disabling auto offline mode');
                        await this.disableAutoOfflineMode();
                        // Show notification
                        window.dispatchEvent(new CustomEvent('server-recovered', {
                            detail: { timestamp: Date.now() }
                        }));
                        // Trigger sync
                        window.dispatchEvent(new CustomEvent('auto-offline-recovered'));
                    }
                    else {
                        // Not recovered - restore auto offline mode and schedule next check
                        this.autoOfflineMode = wasAutoOffline;
                        checkCount++;
                        scheduleNext();
                    }
                }
                catch (error) {
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
     */
    _stopAutoRecoveryCheck() {
        if (this.autoRecoveryTimer) {
            clearTimeout(this.autoRecoveryTimer);
            this.autoRecoveryTimer = null;
        }
    }
    /**
     * Check if auto offline mode is enabled
     */
    isOfflineModeEnabled() {
        return this.autoOfflineMode;
    }
}
// Export as global
if (typeof window !== 'undefined') {
    window.SmartNetworkDetector = SmartNetworkDetector;
}
//# sourceMappingURL=networkDetector.js.map