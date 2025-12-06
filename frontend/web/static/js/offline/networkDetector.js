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

        // Счетчик последовательных ошибок
        this.consecutiveFailures = 0;
        this.maxFailuresBeforeOffline = options.maxFailures || 2;

        // Heartbeat настройки
        this.heartbeatUrl = options.heartbeatUrl || '/health';
        this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 сек
        this.heartbeatTimeout = options.heartbeatTimeout || 5000; // 5 сек
        this.lastHeartbeat = 0;
        this.heartbeatTimer = null;

        // Минимальный интервал между проверками
        this.minCheckInterval = options.minCheckInterval || 5000; // 5 сек
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

        // Запуск heartbeat
        this._startHeartbeat();

        // Первичная проверка
        this.checkConnectivity();
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
     * Проверить реальную доступность API
     * @param {boolean} force - Игнорировать минимальный интервал
     */
    async checkConnectivity(force = false) {
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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.heartbeatTimeout);

            const response = await fetch(this.heartbeatUrl, {
                method: 'HEAD',
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
     * Запустить периодический heartbeat
     */
    _startHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(async () => {
            // Проверять только если думаем что online
            if (this.status !== 'offline') {
                await this.checkConnectivity();
            }
        }, this.heartbeatInterval);
    }

    /**
     * Остановить heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Вызывается при успешном запросе
     * (для интеграции с OfflineManager)
     */
    onRequestSuccess() {
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
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.SmartNetworkDetector = SmartNetworkDetector;
}
