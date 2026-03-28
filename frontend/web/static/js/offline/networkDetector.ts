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

// Connection info from Network Information API
interface ConnectionInfo {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;      // Mbps
  rtt: number;          // Round-trip time ms
  saveData: boolean;    // Data saver mode
}

// Constructor options
interface SmartNetworkDetectorOptions {
  maxFailures?: number;
  heartbeatUrl?: string;
  heartbeatIntervals?: number[];
  heartbeatTimeout?: number;
  minCheckInterval?: number;
  degradedRtt?: number;
  onStatusChange?: ((newStatus: NetworkStatus, oldStatus: NetworkStatus, options?: any) => void) | null;
}

// Detailed status response
interface DetailedStatus {
  status: NetworkStatus;
  navigatorOnLine: boolean;
  consecutiveFailures: number;
  lastHeartbeat: number;
  lastCheck: number;
  connectionInfo: ConnectionInfo | null;
}

// Silent logger - only errors in production
const _networkLog = window.DEBUG_MODE ? console.log.bind(console) : function(): void {};
const _networkWarn = window.DEBUG_MODE ? console.warn.bind(console) : function(): void {};

class SmartNetworkDetector {
    private status: NetworkStatus;
    private autoOfflineMode: boolean = false;
    private _hasRestoredState: boolean = false;
    private _stateDispatched: boolean = false;

    private consecutiveFailures: number = 0;
    private maxFailuresBeforeOffline: number;

    private heartbeatUrl: string;
    private heartbeatIntervals: number[];
    private lastHeartbeat: number = 0;
    private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

    private minCheckInterval: number;
    private lastCheck: number = 0;

    private slowConnectionTypes: ReadonlyArray<'4g' | '3g' | '2g' | 'slow-2g'>;
    private degradedRtt: number;

    private onStatusChange: ((newStatus: NetworkStatus, oldStatus: NetworkStatus, options?: any) => void) | null;

    private autoRecoveryTimer: ReturnType<typeof setTimeout> | null = null;

    // Bound methods
    private _handleOnline: () => Promise<void>;
    private _handleOffline: () => void;
    private _handleConnectionChange: () => Promise<void>;

    constructor(options: SmartNetworkDetectorOptions = {}) {
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
    dispatchRestoredState(): void {
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
                restored: true  // Indicates state was restored from localStorage
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

    private _init(): void {
        // Слушатели браузерных событий
        window.addEventListener('online', this._handleOnline);
        window.addEventListener('offline', this._handleOffline);

        // Network Information API (Chrome, Edge, Yandex Browser)
        if (this._hasNetworkInformation()) {
            navigator.connection!.addEventListener('change', this._handleConnectionChange);
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
    private _hasNetworkInformation(): boolean {
        return 'connection' in navigator &&
               !!navigator.connection &&
               'effectiveType' in navigator.connection;
    }

    /**
     * Получить информацию о качестве соединения
     */
    getConnectionInfo(): ConnectionInfo | null {
        if (!this._hasNetworkInformation()) {
            return null;
        }

        const conn = navigator.connection!;
        return {
            effectiveType: conn.effectiveType as '4g' | '3g' | '2g' | 'slow-2g',
            downlink: conn.downlink || 0,
            rtt: conn.rtt || 0,
            saveData: conn.saveData || false
        };
    }

    /**
     * Обработка события online
     */
    private async _handleOnlineImpl(): Promise<void> {
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
    private _handleOfflineImpl(): void {
        this._setStatus('offline');
    }

    /**
     * Обработка изменения качества соединения
     */
    private async _handleConnectionChangeImpl(): Promise<void> {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
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
     * @param newStatus - New status
     * @param options - Optional parameters (reserved for future use)
     */
    private _setStatus(newStatus: NetworkStatus, options: any = {}): NetworkStatus {
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
    private _getAdaptiveTimeout(): number {
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
    async checkConnectivity(force: boolean = false): Promise<NetworkStatus> {
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
     */
    private _getNextCheckDelay(): number {
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
    private _startHeartbeat(): void {
        this._scheduleNextHeartbeat();
    }

    /**
     * Запланировать следующую проверку heartbeat
     */
    private _scheduleNextHeartbeat(): void {
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
    stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Вызывается при успешном запросе
     * (для интеграции с OfflineManager)
     */
    onRequestSuccess(): void {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
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
    onRequestFailure(): void {
        // Skip if auto offline mode is enabled
        if (this.autoOfflineMode) {
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
    getStatus(): NetworkStatus {
        return this.status;
    }

    /**
     * Проверка: онлайн ли (online или degraded, но не offline)
     */
    isOnline(): boolean {
        return this.status !== 'offline';
    }

    /**
     * Проверка: полностью ли онлайн (только 'online', не 'degraded')
     */
    isFullyOnline(): boolean {
        return this.status === 'online';
    }

    /**
     * Получить детальную информацию о состоянии сети
     */
    getDetailedStatus(): DetailedStatus {
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
    destroy(): void {
        window.removeEventListener('online', this._handleOnline);
        window.removeEventListener('offline', this._handleOffline);

        if (this._hasNetworkInformation()) {
            navigator.connection!.removeEventListener('change', this._handleConnectionChange);
        }

        this.stopHeartbeat();
        this._stopAutoRecoveryCheck();
    }

    // ==================== AUTO OFFLINE MODE ====================

    /**
     * Load offline state from localStorage
     */
    private _loadOfflineState(): void {
        try {
            const auto = localStorage.getItem('budget_auto_offline_mode');
            this.autoOfflineMode = auto === 'true';

            if (this.autoOfflineMode) {
                this.status = 'offline';
            }

            // Cleanup legacy manual mode state
            localStorage.removeItem('budget_manual_offline_mode');
        } catch (e) {
            this.autoOfflineMode = false;
        }
    }

    /**
     * Save offline state to localStorage
     */
    private _saveOfflineState(): void {
        try {
            localStorage.setItem('budget_auto_offline_mode', this.autoOfflineMode.toString());
        } catch (e) {
            _networkWarn('[NetworkDetector] Failed to save offline state');
        }
    }

    /**
     * Enable auto offline mode
     * Activated when server is unavailable when trying to send data
     */
    enableAutoOfflineMode(): void {
        if (this.autoOfflineMode) return;

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
    async disableAutoOfflineMode(): Promise<void> {
        if (!this.autoOfflineMode) return;

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
    private _startAutoRecoveryCheck(): void {
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
     */
    private _stopAutoRecoveryCheck(): void {
        if (this.autoRecoveryTimer) {
            clearTimeout(this.autoRecoveryTimer);
            this.autoRecoveryTimer = null;
        }
    }

    /**
     * Check if auto offline mode is enabled
     */
    isOfflineModeEnabled(): boolean {
        return this.autoOfflineMode;
    }

    // ==================== P2P CAPABILITY ====================

    /**
     * Detect whether this device/browser can initiate P2P WebRTC sync.
     * Emits 'p2p-capability-change' CustomEvent with { capable: boolean, reason: string }.
     * @returns {{ capable: boolean, reason: string }}
     */
    detectP2PCapability(): { capable: boolean; reason: string } {
        const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
        const hasRTC = typeof RTCPeerConnection !== 'undefined';
        const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);

        let capable = false;
        let reason = '';

        if (!isHttps) {
            reason = 'requires HTTPS';
        } else if (!hasRTC) {
            reason = 'RTCPeerConnection not supported in this browser';
        } else {
            capable = true;
            reason = hasGetUserMedia ? 'full support' : 'limited (no getUserMedia, iOS ICE workaround unavailable)';
        }

        window.dispatchEvent(new CustomEvent('p2p-capability-change', {
            detail: { capable, reason }
        }));

        _networkLog('[NetworkDetector] P2P capability:', capable, reason);
        return { capable, reason };
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.SmartNetworkDetector = SmartNetworkDetector;
}
