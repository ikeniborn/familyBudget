/**
 * Shopping List SSE Client
 * Real-time updates via Server-Sent Events
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event handlers for item_created, item_updated, item_deleted, item_completed
 * - Integration with listsManager for UI updates
 *
 * @version 1.0.0
 */

class ShoppingListSSEClient {
    constructor() {
        this.eventSource = null;
        this.currentListId = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;  // 1 second
        this.maxReconnectDelay = 30000;  // 30 seconds
        this.reconnectTimeout = null;
        this.handlers = {};

        // Переподключение при возврате на вкладку
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' &&
                !this.isConnected &&
                this.currentListId &&
                !this.reconnectTimeout) {
                debugLog('[SSEClient] Tab visible, reconnecting');
                this.reconnectAttempts = 0;
                this._createConnection();
            }
        });
    }

    /**
     * Connect to SSE endpoint for a shopping list
     * @param {number} listId - Shopping list ID
     */
    connect(listId) {
        if (this.eventSource && this.currentListId === listId) {
            debugLog('[SSEClient] Already connected to list:', listId);
            return;
        }

        // Disconnect from previous list if any
        if (this.eventSource) {
            this.disconnect();
        }

        this.currentListId = listId;
        this._createConnection();
    }

    /**
     * Create EventSource connection
     * @private
     */
    _createConnection() {
        if (!this.currentListId) {
            return;
        }

        try {
            const url = `/api/v1/shopping-lists/${this.currentListId}/events`;
            debugLog('[SSEClient] Connecting to:', url);

            this.eventSource = new EventSource(url);

            // Connection opened
            this.eventSource.onopen = () => {
                debugLog('[SSEClient] Connection opened');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this._updateStatusIndicator();
                this._notifyHandlers('connect', { listId: this.currentListId });
            };

            // Generic message handler (fallback)
            this.eventSource.onmessage = (event) => {
                debugLog('[SSEClient] Message:', event.data);
                try {
                    const data = JSON.parse(event.data);
                    this._handleEvent(data.type || 'message', data);
                } catch (e) {
                    console.error('[SSEClient] Error parsing message:', e);
                }
            };

            // Specific event handlers
            this.eventSource.addEventListener('connected', (event) => {
                debugLog('[SSEClient] Connected event:', event.data);
                const data = JSON.parse(event.data);
                this._notifyHandlers('connected', data);
            });

            this.eventSource.addEventListener('item_created', (event) => {
                debugLog('[SSEClient] Item created:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCreated(data);
            });

            this.eventSource.addEventListener('item_updated', (event) => {
                debugLog('[SSEClient] Item updated:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemUpdated(data);
            });

            this.eventSource.addEventListener('item_deleted', (event) => {
                debugLog('[SSEClient] Item deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemDeleted(data);
            });

            this.eventSource.addEventListener('item_completed', (event) => {
                debugLog('[SSEClient] Item completed:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCompleted(data);
            });

            this.eventSource.addEventListener('ping', (event) => {
                // Keepalive ping - no action needed
                debugLog('[SSEClient] Ping received');
            });

            // Error handler
            this.eventSource.onerror = (error) => {
                console.error('[SSEClient] Connection error:', error);
                this.isConnected = false;
                this._updateStatusIndicator();
                this._notifyHandlers('error', error);
                this._scheduleReconnect();
            };

        } catch (error) {
            console.error('[SSEClient] Failed to create connection:', error);
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
            debugLog('[SSEClient] Disconnecting from list:', this.currentListId);
            this.eventSource.close();
            this.eventSource = null;
        }

        this.isConnected = false;
        this.currentListId = null;
        this.reconnectAttempts = 0;
        this._updateStatusIndicator();
        this._notifyHandlers('disconnect', {});
    }

    /**
     * Schedule reconnection with exponential backoff
     * @private
     */
    _scheduleReconnect() {
        // Если offline - ждать восстановления сети
        if (!navigator.onLine) {
            debugLog('[SSEClient] Offline, waiting for network');
            this._updateStatusIndicator();
            window.addEventListener('online', () => {
                debugLog('[SSEClient] Back online, reconnecting');
                this.reconnectAttempts = 0;
                this._createConnection();
            }, { once: true });
            return;
        }

        if (this.reconnectTimeout) {
            return;  // Already scheduled
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[SSEClient] Max reconnect attempts reached');
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

        debugLog('[SSEClient] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempts + 1, ')');

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
     * Handle item_created event
     * @param {Object} data - Item data
     * @private
     */
    _handleItemCreated(data) {
        this._notifyHandlers('item_created', data);

        // Update UI if listsManager is available
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.addItemToUI(data);
        }
    }

    /**
     * Handle item_updated event
     * @param {Object} data - Item data
     * @private
     */
    _handleItemUpdated(data) {
        this._notifyHandlers('item_updated', data);

        // Update UI if listsManager is available
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.updateItemInUI(data);
        }
    }

    /**
     * Handle item_deleted event
     * @param {Object} data - { id: itemId }
     * @private
     */
    _handleItemDeleted(data) {
        this._notifyHandlers('item_deleted', data);

        // Update UI if listsManager is available
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.removeItemFromUI(data.id);
        }
    }

    /**
     * Handle item_completed event
     * @param {Object} data - { id: itemId, is_completed: boolean }
     * @private
     */
    _handleItemCompleted(data) {
        this._notifyHandlers('item_completed', data);

        // Update UI if listsManager is available
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.toggleItemCompletedInUI(data.id, data.is_completed);
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
                console.error('[SSEClient] Handler error:', error);
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
            listId: this.currentListId,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Update SSE status indicator in UI
     * @private
     */
    _updateStatusIndicator() {
        const indicator = document.getElementById('sse-status-indicator');
        if (!indicator) return;

        if (this.isConnected) {
            indicator.className = 'badge badge-success badge-xs';
            indicator.innerHTML = '🟢';
            indicator.title = 'Синхронизация активна';
        } else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            indicator.className = 'badge badge-warning badge-xs';
            indicator.innerHTML = '<span class="loading loading-ring loading-xs"></span>';
            indicator.title = `Переподключение (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            indicator.className = 'badge badge-error badge-xs';
            indicator.innerHTML = '🔴';
            indicator.title = 'Ошибка соединения. Обновите страницу';
        } else {
            indicator.className = 'badge badge-neutral badge-xs';
            indicator.innerHTML = '<span class="loading loading-ring loading-xs"></span>';
            indicator.title = 'Подключение...';
        }
    }
}

// Export as global
if (typeof window !== 'undefined') {
    window.ShoppingListSSEClient = ShoppingListSSEClient;
}

debugLog('[SSEClient] Module loaded');
