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

        // Safari iOS fallback support
        this.connectionTimeout = 5000;  // 5 seconds to connect
        this.useFetchSSE = false;       // Flag for fetch-based SSE
        this.fetchController = null;    // AbortController for fetch
        this.connectionTimer = null;    // Timer for connection timeout

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
     * Create EventSource connection with Safari iOS fallback
     * @private
     */
    _createConnection() {
        if (!this.enabled) {
            return;
        }

        const url = '/api/v1/budget/events';
        debugLog('[BudgetSSE] Connecting to:', url);

        // If we already know EventSource doesn't work - use fetch directly
        if (this.useFetchSSE) {
            this._useFetchEventSource();
            return;
        }

        try {
            this.eventSource = new EventSource(url, { withCredentials: true });

            // Timeout - if onopen not called within 5 seconds, switch to fetch
            this.connectionTimer = setTimeout(() => {
                if (!this.isConnected && this.eventSource) {
                    debugLog('[BudgetSSE] EventSource timeout, trying fetch-based SSE');
                    this.eventSource.close();
                    this.eventSource = null;
                    this.useFetchSSE = true;
                    this._useFetchEventSource();
                }
            }, this.connectionTimeout);

            // Connection opened
            this.eventSource.onopen = () => {
                if (this.connectionTimer) {
                    clearTimeout(this.connectionTimer);
                    this.connectionTimer = null;
                }
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

            // Shopping list item events (consolidated from shopping_list_sse)
            this.eventSource.addEventListener('item_created', (event) => {
                debugLog('[BudgetSSE] Item created:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCreated(data);
            });

            this.eventSource.addEventListener('item_updated', (event) => {
                debugLog('[BudgetSSE] Item updated:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemUpdated(data);
            });

            this.eventSource.addEventListener('item_deleted', (event) => {
                debugLog('[BudgetSSE] Item deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemDeleted(data);
            });

            this.eventSource.addEventListener('item_completed', (event) => {
                debugLog('[BudgetSSE] Item completed:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCompleted(data);
            });

            // Keepalive ping
            this.eventSource.addEventListener('ping', (event) => {
                debugLog('[BudgetSSE] Ping received');
            });

            // Error handler
            this.eventSource.onerror = (error) => {
                console.error('[BudgetSSE] Connection error:', error);
                if (this.connectionTimer) {
                    clearTimeout(this.connectionTimer);
                    this.connectionTimer = null;
                }
                this.isConnected = false;
                this._updateStatusIndicator();
                this._notifyHandlers('error', error);
                this._scheduleReconnect();
            };

        } catch (error) {
            console.error('[BudgetSSE] EventSource failed:', error);
            this.useFetchSSE = true;
            this._useFetchEventSource();
        }
    }

    /**
     * Fetch-based SSE implementation for Safari iOS
     * Uses fetch API with ReadableStream instead of EventSource
     * @private
     */
    async _useFetchEventSource() {
        const url = '/api/v1/budget/events';
        debugLog('[BudgetSSE] Using fetch-based SSE');

        this.fetchController = new AbortController();

        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',  // Send cookies!
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                },
                signal: this.fetchController.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.isConnected = true;
            this.reconnectAttempts = 0;
            this._updateStatusIndicator();
            this._notifyHandlers('connect', {});

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    debugLog('[BudgetSSE] Stream ended');
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const events = this._parseSSEBuffer(buffer);
                buffer = events.remaining;

                for (const event of events.parsed) {
                    this._dispatchSSEEvent(event);
                }
            }

            // Stream ended - schedule reconnect
            this.isConnected = false;
            this._updateStatusIndicator();
            this._scheduleReconnect();

        } catch (error) {
            if (error.name === 'AbortError') {
                debugLog('[BudgetSSE] Fetch aborted');
                return;
            }
            console.error('[BudgetSSE] Fetch SSE error:', error);
            this.isConnected = false;
            this._updateStatusIndicator();
            this._notifyHandlers('error', error);
            this._scheduleReconnect();
        }
    }

    /**
     * Parse SSE events from buffer
     * @param {string} buffer - Raw SSE data
     * @returns {Object} - { parsed: Event[], remaining: string }
     * @private
     */
    _parseSSEBuffer(buffer) {
        const events = [];
        const lines = buffer.split('\n');
        let remaining = '';
        let currentEvent = { event: 'message', data: '' };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Incomplete line at end - save for next chunk
            if (i === lines.length - 1 && line !== '') {
                remaining = line;
                continue;
            }

            if (line === '') {
                // Empty line = end of event
                if (currentEvent.data) {
                    events.push(currentEvent);
                }
                currentEvent = { event: 'message', data: '' };
            } else if (line.startsWith('event:')) {
                currentEvent.event = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                currentEvent.data += line.slice(5).trim();
            } else if (line.startsWith('id:')) {
                currentEvent.id = line.slice(3).trim();
            }
        }

        return { parsed: events, remaining };
    }

    /**
     * Dispatch parsed SSE event to handlers
     * @param {Object} event - Parsed SSE event { event, data, id }
     * @private
     */
    _dispatchSSEEvent(event) {
        debugLog('[BudgetSSE] Event:', event.event, event.data);

        try {
            const data = event.data ? JSON.parse(event.data) : {};

            switch (event.event) {
                case 'connected':
                    this._notifyHandlers('connected', data);
                    break;
                case 'ping':
                    // Keepalive - ignore
                    break;
                case 'fact_created':
                    this._handleFactCreated(data);
                    break;
                case 'fact_updated':
                    this._handleFactUpdated(data);
                    break;
                case 'fact_deleted':
                    this._handleFactDeleted(data);
                    break;
                case 'plan_created':
                    this._handlePlanCreated(data);
                    break;
                case 'plan_updated':
                    this._handlePlanUpdated(data);
                    break;
                case 'plan_deleted':
                    this._handlePlanDeleted(data);
                    break;
                case 'transfer_created':
                    this._handleTransferCreated(data);
                    break;
                case 'transfer_deleted':
                    this._handleTransferDeleted(data);
                    break;
                case 'item_created':
                    this._handleItemCreated(data);
                    break;
                case 'item_updated':
                    this._handleItemUpdated(data);
                    break;
                case 'item_deleted':
                    this._handleItemDeleted(data);
                    break;
                case 'item_completed':
                    this._handleItemCompleted(data);
                    break;
                default:
                    this._handleEvent(event.event, data);
            }
        } catch (e) {
            console.error('[BudgetSSE] Parse error:', e);
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

        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }

        if (this.eventSource) {
            debugLog('[BudgetSSE] Disconnecting EventSource');
            this.eventSource.close();
            this.eventSource = null;
        }

        // Abort fetch if active
        if (this.fetchController) {
            debugLog('[BudgetSSE] Aborting fetch');
            this.fetchController.abort();
            this.fetchController = null;
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

    // ==================== SHOPPING LIST ITEM HANDLERS ====================

    /**
     * Handle item_created event
     * @param {Object} data - Item data (contains shopping_list_id for filtering)
     * @private
     */
    _handleItemCreated(data) {
        this._notifyHandlers('item_created', data);

        // Trigger UI refresh if listsManager is available
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.addItemToUI(data);
        }
    }

    /**
     * Handle item_updated event
     * @param {Object} data - Item data (contains shopping_list_id for filtering)
     * @private
     */
    _handleItemUpdated(data) {
        this._notifyHandlers('item_updated', data);

        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.updateItemInUI(data);
        }
    }

    /**
     * Handle item_deleted event
     * @param {Object} data - { id: itemId, shopping_list_id: listId }
     * @private
     */
    _handleItemDeleted(data) {
        this._notifyHandlers('item_deleted', data);

        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.removeItemFromUI(data.id, data.shopping_list_id);
        }
    }

    /**
     * Handle item_completed event
     * @param {Object} data - { id: itemId, shopping_list_id: listId, is_completed: bool }
     * @private
     */
    _handleItemCompleted(data) {
        this._notifyHandlers('item_completed', data);

        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.toggleItemCompletedInUI(data.id, data.is_completed, data.shopping_list_id);
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
