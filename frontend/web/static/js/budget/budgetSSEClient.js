/**
 * Budget SSE Client
 * Real-time updates via Server-Sent Events for budget operations (facts, plans, transfers)
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event handlers for fact/plan/transfer events
 * - Integration with OfflineManager for UI updates
 * - Global connection (shared family budget model)
 *
 * @version 1.0.0
 */

class BudgetSSEClient {
    constructor() {
        this.eventSource = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;  // 1 second
        this.maxReconnectDelay = 30000;  // 30 seconds
        this.reconnectTimeout = null;
        this.handlers = {};
        this.enabled = true;  // Can be disabled if not needed

        // Reconnect when tab becomes visible
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' &&
                !this.isConnected &&
                this.enabled &&
                !this.reconnectTimeout) {
                debugLog('[BudgetSSE] Tab visible, reconnecting');
                this.reconnectAttempts = 0;
                this._createConnection();
            }
        });
    }

    /**
     * Connect to SSE endpoint
     * Global connection for all budget events (shared family budget model)
     */
    connect() {
        if (this.eventSource && this.isConnected) {
            debugLog('[BudgetSSE] Already connected');
            return;
        }

        if (!this.enabled) {
            debugLog('[BudgetSSE] SSE disabled');
            return;
        }

        this._createConnection();
    }

    /**
     * Create EventSource connection
     * @private
     */
    _createConnection() {
        if (!this.enabled) {
            return;
        }

        try {
            const url = '/api/v1/budget/events';
            debugLog('[BudgetSSE] Connecting to:', url);

            this.eventSource = new EventSource(url);

            // Connection opened
            this.eventSource.onopen = () => {
                debugLog('[BudgetSSE] Connection opened');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this._updateStatusIndicator();
                this._notifyHandlers('connect', {});
            };

            // Generic message handler (fallback)
            this.eventSource.onmessage = (event) => {
                debugLog('[BudgetSSE] Message:', event.data);
                try {
                    const data = JSON.parse(event.data);
                    this._handleEvent(data.type || 'message', data);
                } catch (e) {
                    console.error('[BudgetSSE] Error parsing message:', e);
                }
            };

            // Server connected event
            this.eventSource.addEventListener('connected', (event) => {
                debugLog('[BudgetSSE] Connected event:', event.data);
                const data = JSON.parse(event.data);
                this._notifyHandlers('connected', data);
            });

            // Fact events
            this.eventSource.addEventListener('fact_created', (event) => {
                debugLog('[BudgetSSE] Fact created:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactCreated(data);
            });

            this.eventSource.addEventListener('fact_updated', (event) => {
                debugLog('[BudgetSSE] Fact updated:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactUpdated(data);
            });

            this.eventSource.addEventListener('fact_deleted', (event) => {
                debugLog('[BudgetSSE] Fact deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactDeleted(data);
            });

            // Plan events
            this.eventSource.addEventListener('plan_created', (event) => {
                debugLog('[BudgetSSE] Plan created:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanCreated(data);
            });

            this.eventSource.addEventListener('plan_updated', (event) => {
                debugLog('[BudgetSSE] Plan updated:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanUpdated(data);
            });

            this.eventSource.addEventListener('plan_deleted', (event) => {
                debugLog('[BudgetSSE] Plan deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanDeleted(data);
            });

            // Transfer events
            this.eventSource.addEventListener('transfer_created', (event) => {
                debugLog('[BudgetSSE] Transfer created:', event.data);
                const data = JSON.parse(event.data);
                this._handleTransferCreated(data);
            });

            this.eventSource.addEventListener('transfer_deleted', (event) => {
                debugLog('[BudgetSSE] Transfer deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleTransferDeleted(data);
            });

            // Keepalive ping
            this.eventSource.addEventListener('ping', (event) => {
                debugLog('[BudgetSSE] Ping received');
            });

            // Error handler
            this.eventSource.onerror = (error) => {
                console.error('[BudgetSSE] Connection error:', error);
                this.isConnected = false;
                this._updateStatusIndicator();
                this._notifyHandlers('error', error);
                this._scheduleReconnect();
            };

        } catch (error) {
            console.error('[BudgetSSE] Failed to create connection:', error);
            this._scheduleReconnect();
        }
    }

    /**
     * Disconnect from SSE
     */
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.eventSource) {
            debugLog('[BudgetSSE] Disconnecting');
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
        this._updateStatusIndicator();
        this._notifyHandlers('disconnect', {});
    }

    /**
     * Enable/disable SSE connection
     * @param {boolean} enabled - Whether to enable SSE
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.disconnect();
        } else if (!this.isConnected) {
            this.connect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     * @private
     */
    _scheduleReconnect() {
        // If offline - wait for network
        if (!navigator.onLine) {
            debugLog('[BudgetSSE] Offline, waiting for network');
            this._updateStatusIndicator();
            window.addEventListener('online', () => {
                debugLog('[BudgetSSE] Back online, reconnecting');
                this.reconnectAttempts = 0;
                this._createConnection();
            }, { once: true });
            return;
        }

        if (this.reconnectTimeout) {
            return;  // Already scheduled
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[BudgetSSE] Max reconnect attempts reached');
            this._updateStatusIndicator();
            this._notifyHandlers('reconnect_failed', {
                attempts: this.reconnectAttempts
            });
            return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, ... up to 30s
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        debugLog('[BudgetSSE] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempts + 1, ')');

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectAttempts++;
            this._updateStatusIndicator();

            if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
            }

            this._createConnection();
        }, delay);
    }

    // ==================== EVENT HANDLERS ====================

    /**
     * Handle fact_created event
     * @param {Object} data - Fact data
     * @private
     */
    _handleFactCreated(data) {
        this._notifyHandlers('fact_created', data);

        // Trigger UI refresh if OfflineManager is available
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_created', data);
        }
    }

    /**
     * Handle fact_updated event
     * @param {Object} data - Fact data
     * @private
     */
    _handleFactUpdated(data) {
        this._notifyHandlers('fact_updated', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_updated', data);
        }
    }

    /**
     * Handle fact_deleted event
     * @param {Object} data - { id: factId }
     * @private
     */
    _handleFactDeleted(data) {
        this._notifyHandlers('fact_deleted', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_deleted', data);
        }
    }

    /**
     * Handle plan_created event
     * @param {Object} data - Plan data
     * @private
     */
    _handlePlanCreated(data) {
        this._notifyHandlers('plan_created', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_created', data);
        }
    }

    /**
     * Handle plan_updated event
     * @param {Object} data - Plan data
     * @private
     */
    _handlePlanUpdated(data) {
        this._notifyHandlers('plan_updated', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_updated', data);
        }
    }

    /**
     * Handle plan_deleted event
     * @param {Object} data - { id: planId }
     * @private
     */
    _handlePlanDeleted(data) {
        this._notifyHandlers('plan_deleted', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_deleted', data);
        }
    }

    /**
     * Handle transfer_created event
     * @param {Object} data - Transfer data
     * @private
     */
    _handleTransferCreated(data) {
        this._notifyHandlers('transfer_created', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('transfer_created', data);
        }
    }

    /**
     * Handle transfer_deleted event
     * @param {Object} data - { id: transferId }
     * @private
     */
    _handleTransferDeleted(data) {
        this._notifyHandlers('transfer_deleted', data);

        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('transfer_deleted', data);
        }
    }

    /**
     * Handle generic event
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     * @private
     */
    _handleEvent(eventType, data) {
        this._notifyHandlers(eventType, data);
    }

    // ==================== HANDLER REGISTRATION ====================

    /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} handler - Handler function
     */
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    /**
     * Remove event handler
     * @param {string} event - Event name
     * @param {Function} handler - Handler function to remove
     */
    off(event, handler) {
        if (!this.handlers[event]) {
            return;
        }
        this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }

    /**
     * Notify all handlers for an event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     * @private
     */
    _notifyHandlers(event, data) {
        if (!this.handlers[event]) {
            return;
        }
        for (const handler of this.handlers[event]) {
            try {
                handler(data);
            } catch (error) {
                console.error('[BudgetSSE] Handler error:', error);
            }
        }
    }

    // ==================== STATUS ====================

    /**
     * Get connection status
     * @returns {Object} Status object
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            enabled: this.enabled,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Update SSE status indicator in UI
     * @private
     */
    _updateStatusIndicator() {
        const indicator = document.getElementById('budget-sse-status-indicator');
        if (!indicator) return;

        // Badge size classes
        const sizeClasses = 'badge-sm sm:badge-md';

        // Check if SSE is disabled (offline mode)
        if (!this.enabled) {
            indicator.className = `badge badge-ghost ${sizeClasses}`;
            indicator.innerHTML = '⚫';
            indicator.title = 'Offline режим - SSE отключен';
        } else if (this.isConnected) {
            indicator.className = `badge badge-success ${sizeClasses}`;
            indicator.innerHTML = '🟢';
            indicator.title = 'Real-time синхронизация активна';
        } else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            indicator.className = `badge badge-warning ${sizeClasses}`;
            indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
            indicator.title = `Переподключение (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            indicator.className = `badge badge-error ${sizeClasses}`;
            indicator.innerHTML = '🔴';
            indicator.title = 'Ошибка соединения. Обновите страницу';
        } else {
            indicator.className = `badge badge-neutral ${sizeClasses}`;
            indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
            indicator.title = 'Подключение...';
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.BudgetSSEClient = BudgetSSEClient;

    // Create singleton instance (auto-connect disabled by default)
    window.budgetSSEClient = new BudgetSSEClient();
}

// Debug log helper (if not defined)
if (typeof debugLog === 'undefined') {
    window.debugLog = function(...args) {
        if (window.DEBUG_MODE) {
            console.log(...args);
        }
    };
}

debugLog('[BudgetSSE] Module loaded');
