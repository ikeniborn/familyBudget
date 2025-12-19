/**
 * Budget WebSocket Client
 * Real-time updates via WebSocket with Long Polling fallback for budget operations
 *
 * Features:
 * - WebSocket as primary transport (bidirectional, no buffering)
 * - Long Polling fallback (10 second interval)
 * - Automatic reconnection with exponential backoff
 * - Multi-tab support (Web Locks + BroadcastChannel)
 * - Client ping/pong for connection health
 * - check_online for offline mode detection
 * - Backward compatible with BudgetSSEClient interface
 *
 * @version 2.0.0
 */

class BudgetWSClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.baseReconnectDelay = 1000;  // 1 second
        this.maxReconnectDelay = 30000;  // 30 seconds
        this.reconnectTimeout = null;
        this.handlers = {};
        this.enabled = true;  // Can be disabled if not needed

        // Connection tracking
        this.connectionId = null;
        this.lastServerPing = 0;
        this.PING_TIMEOUT = 45000;  // Server pings every 10s, allow 45s before considering dead

        // Long Polling fallback
        this.useLongPolling = false;
        this.pollController = null;
        this.lastEventTimestamp = 0;
        this.POLL_INTERVAL = 10000;  // 10 seconds
        this.POLL_TIMEOUT = 10;  // seconds
        this._pollTimeout = null;
        this._pollingActive = false;

        // Client ping for bidirectional communication
        this.pingInterval = null;
        this.CLIENT_PING_INTERVAL = 15000;  // 15 seconds
        this.lastPongReceived = 0;

        // Flag for limit reached state
        this.limitReached = false;
        this.approachingLimit = false;

        // Multi-tab support: BroadcastChannel + Web Locks API
        this.isLeader = false;
        this.channel = null;
        this.leaderHeartbeatInterval = null;
        this._followerCheckInterval = null;
        this.lastLeaderHeartbeat = 0;
        this.HEARTBEAT_INTERVAL = 3000;  // Leader sends heartbeat every 3 sec
        this.LEADER_TIMEOUT = 10000;     // Follower considers leader dead after 10 sec
        this._multiTabSupported = null;  // Cached support check
        this._multiTabInitialized = false;  // Lazy init flag

        // Safari iOS detection (for special handling)
        this._safariIOSMode = this._detectSafariIOS();

        // Close connection on page unload
        window.addEventListener('beforeunload', () => {
            this._silentClose();
        });

        window.addEventListener('pagehide', (event) => {
            if (!event.persisted) {
                this._silentClose();
            }
        });

        // Visibility change handler
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                if (this.isLeader) {
                    debugLog('[BudgetWS] Tab hidden, leader keeping connection active');
                }
            } else if (document.visibilityState === 'visible') {
                console.log('[BudgetWS] Tab became visible, checking connection health');

                if (this.isLeader) {
                    if (this._isConnectionStale()) {
                        debugLog('[BudgetWS] Connection stale, forcing reconnect');
                        this._forceReconnect();
                        return;
                    }

                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.isConnected = true;
                        this._updateStatusIndicator();
                        return;
                    }

                    if (this.useLongPolling && this._pollingActive) {
                        this._updateStatusIndicator();
                        return;
                    }

                    if (!this.isConnected && this.enabled) {
                        debugLog('[BudgetWS] Tab visible, leader reconnecting');
                        this._forceReconnect();
                    }
                }

                if (!this.isLeader && this.channel) {
                    this._broadcastMessage({ type: 'status_request' });
                }
            }
        });

        // DEBUG: Log initialization
        console.log('[BudgetWS] Initialized, Safari iOS mode:', this._safariIOSMode);
    }

    // ==================== BROWSER DETECTION ====================

    /**
     * Detect Safari on iOS/iPadOS
     * @returns {boolean}
     * @private
     */
    _detectSafariIOS() {
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
        const isPadOSDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        const isSafariLike = /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);

        return (isIOS || isPadOSDesktop) && isSafariLike;
    }

    /**
     * Check if browser needs longer Web Locks timeout
     * @returns {boolean}
     * @private
     */
    _needsLongerTimeout() {
        const ua = navigator.userAgent;
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
        const isYandex = /YaBrowser/.test(ua);
        return isSafari || isYandex;
    }

    // ==================== MULTI-TAB SUPPORT ====================

    /**
     * Check if multi-tab sharing is supported
     * @returns {boolean}
     * @private
     */
    _supportsMultiTab() {
        if (this._multiTabSupported === null) {
            this._multiTabSupported = (
                typeof BroadcastChannel !== 'undefined' &&
                typeof navigator.locks !== 'undefined'
            );
        }
        return this._multiTabSupported;
    }

    /**
     * Initialize multi-tab support
     * @private
     */
    async _initMultiTab() {
        if (this._multiTabInitialized) return;
        this._multiTabInitialized = true;

        // Safari iOS: Skip Web Locks entirely
        if (this._safariIOSMode) {
            console.log('[BudgetWS] Safari iOS: Skipping Web Locks, using per-tab connection');
            this.isLeader = true;
            this._multiTabSupported = false;
            return;
        }

        if (!this._supportsMultiTab()) {
            debugLog('[BudgetWS] Multi-tab not supported, using per-tab connection');
            return;
        }

        // Safety timeout for Web Locks
        let safetyTimeoutFired = false;
        const safetyTimeout = setTimeout(() => {
            safetyTimeoutFired = true;
            if (!this.isLeader && !this.isConnected) {
                console.warn('[BudgetWS] Safety timeout (5s): forcing leader status');
                this.isLeader = true;
                this._multiTabSupported = false;
                if (this.enabled) {
                    this._createConnection();
                }
            }
        }, 5000);

        try {
            // Create BroadcastChannel
            this.channel = new BroadcastChannel('budget-ws-channel');
            this.channel.onmessage = (e) => this._handleChannelMessage(e.data);
            this.channel.onerror = () => {
                debugLog('[BudgetWS] BroadcastChannel error, falling back to per-tab');
                this._multiTabSupported = false;
                this.channel = null;
            };

            // Check connection pressure
            let connectionPressure = 0;
            try {
                const status = await this._checkConnectionLimit();
                if (status.limits && status.limits.max_per_user > 0) {
                    connectionPressure = (status.user_connections || 0) / status.limits.max_per_user;
                    this.approachingLimit = connectionPressure >= 0.7;
                }
            } catch (e) {
                debugLog('[BudgetWS] Connection limit check failed:', e);
            }

            if (safetyTimeoutFired) {
                console.log('[BudgetWS] Safety timeout already fired, skipping leader election');
                return;
            }

            // Leader election based on browser type
            if (this._needsLongerTimeout()) {
                const timeout = connectionPressure >= 0.5 ? 2000 : 500;
                await this._tryBecomeLeaderWithTimeout(timeout);
            } else {
                await this._tryBecomeLeader();
            }
        } catch (e) {
            debugLog('[BudgetWS] Multi-tab init failed:', e);
            this._multiTabSupported = false;
        } finally {
            clearTimeout(safetyTimeout);
        }
    }

    /**
     * Try to acquire leader lock (fast path for Chrome/Firefox/Edge)
     * @private
     */
    async _tryBecomeLeader() {
        return new Promise((resolve) => {
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (Date.now() - this.lastLeaderHeartbeat < 5000) {
                        debugLog('[BudgetWS] Timeout, leader detected via heartbeat');
                        this._startFollowerMode();
                    } else {
                        debugLog('[BudgetWS] Timeout, no leader detected, becoming leader');
                        this.isLeader = true;
                        this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                        this._startLeaderHeartbeat();
                    }
                    resolve();
                }
            }, 100);

            navigator.locks.request('budget-ws-leader', async (lock) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.isLeader = true;
                    if (this._followerCheckInterval) {
                        clearInterval(this._followerCheckInterval);
                        this._followerCheckInterval = null;
                    }
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    debugLog('[BudgetWS] Acquired Web Lock, became leader');
                } else if (!this.isLeader) {
                    this.isLeader = true;
                    if (this._followerCheckInterval) {
                        clearInterval(this._followerCheckInterval);
                        this._followerCheckInterval = null;
                    }
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    if (this.enabled && !this.isConnected) {
                        this._createConnection();
                    }
                    debugLog('[BudgetWS] Promoted to leader after timeout');
                }
                resolve();
                return new Promise(() => {});  // Hold lock forever
            });
        });
    }

    /**
     * Try to acquire leader lock with configurable timeout (for Safari)
     * @param {number} timeoutMs
     * @private
     */
    async _tryBecomeLeaderWithTimeout(timeoutMs) {
        return new Promise((resolve) => {
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (Date.now() - this.lastLeaderHeartbeat < 5000) {
                        debugLog('[BudgetWS] Timeout: Leader detected, staying follower');
                        this._startFollowerMode();
                    } else {
                        debugLog('[BudgetWS] Timeout: No leader, becoming leader');
                        this.isLeader = true;
                        this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                        this._startLeaderHeartbeat();
                    }
                    resolve();
                }
            }, timeoutMs);

            navigator.locks.request('budget-ws-leader', async (lock) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    this.isLeader = true;
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    debugLog('[BudgetWS] Acquired Web Lock, became leader');
                } else if (!this.isLeader) {
                    this.isLeader = true;
                    if (this._followerCheckInterval) {
                        clearInterval(this._followerCheckInterval);
                        this._followerCheckInterval = null;
                    }
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    if (this.enabled && !this.isConnected) {
                        this._createConnection();
                    }
                    debugLog('[BudgetWS] Promoted to leader after timeout');
                }
                resolve();
                return new Promise(() => {});
            });
        });
    }

    /**
     * Start follower mode
     * @private
     */
    _startFollowerMode() {
        this.lastLeaderHeartbeat = Date.now();

        this._followerCheckInterval = setInterval(() => {
            if (this.isLeader) {
                clearInterval(this._followerCheckInterval);
                this._followerCheckInterval = null;
                return;
            }

            const timeSinceHeartbeat = Date.now() - this.lastLeaderHeartbeat;
            if (timeSinceHeartbeat > this.LEADER_TIMEOUT) {
                debugLog('[BudgetWS] Leader heartbeat timeout, may become leader soon');
            }
        }, 5000);
    }

    /**
     * Start leader heartbeat
     * @private
     */
    _startLeaderHeartbeat() {
        if (this.leaderHeartbeatInterval) {
            clearInterval(this.leaderHeartbeatInterval);
        }

        this.leaderHeartbeatInterval = setInterval(() => {
            this._broadcastMessage({
                type: 'heartbeat',
                timestamp: Date.now(),
                isConnected: this.isConnected
            });
        }, this.HEARTBEAT_INTERVAL);

        this._broadcastMessage({
            type: 'heartbeat',
            timestamp: Date.now(),
            isConnected: this.isConnected
        });
    }

    /**
     * Broadcast message to other tabs
     * @param {Object} message
     * @private
     */
    _broadcastMessage(message) {
        if (this.channel) {
            try {
                this.channel.postMessage(message);
            } catch (e) {
                debugLog('[BudgetWS] Broadcast failed:', e);
            }
        }
    }

    /**
     * Handle BroadcastChannel message
     * @param {Object} data
     * @private
     */
    _handleChannelMessage(data) {
        switch (data.type) {
            case 'heartbeat':
                this.lastLeaderHeartbeat = data.timestamp;
                if (!this.isLeader) {
                    this.isConnected = data.isConnected;
                    this._updateStatusIndicator();
                }
                break;

            case 'ws_event':
                if (!this.isLeader) {
                    this._dispatchReceivedEvent(data.event, data.data);
                }
                break;

            case 'leader_changed':
                this.lastLeaderHeartbeat = data.timestamp;
                debugLog('[BudgetWS] Leader changed, resetting heartbeat');
                break;

            case 'status_request':
                if (this.isLeader) {
                    this._broadcastMessage({
                        type: 'status_response',
                        isConnected: this.isConnected,
                        connectionId: this.connectionId
                    });
                }
                break;

            case 'status_response':
                if (!this.isLeader) {
                    this.isConnected = data.isConnected;
                    this._updateStatusIndicator();
                }
                break;
        }
    }

    /**
     * Dispatch received event from BroadcastChannel (for followers)
     * @param {string} eventType
     * @param {Object} eventData
     * @private
     */
    _dispatchReceivedEvent(eventType, eventData) {
        switch (eventType) {
            case 'fact_created':
                this._handleFactCreated(eventData);
                break;
            case 'fact_updated':
                this._handleFactUpdated(eventData);
                break;
            case 'fact_deleted':
                this._handleFactDeleted(eventData);
                break;
            case 'plan_created':
                this._handlePlanCreated(eventData);
                break;
            case 'plan_updated':
                this._handlePlanUpdated(eventData);
                break;
            case 'plan_deleted':
                this._handlePlanDeleted(eventData);
                break;
            case 'transfer_created':
                this._handleTransferCreated(eventData);
                break;
            case 'transfer_deleted':
                this._handleTransferDeleted(eventData);
                break;
            case 'item_created':
                this._handleItemCreated(eventData);
                break;
            case 'item_updated':
                this._handleItemUpdated(eventData);
                break;
            case 'item_deleted':
                this._handleItemDeleted(eventData);
                break;
            case 'item_completed':
                this._handleItemCompleted(eventData);
                break;
            default:
                this._handleEvent(eventType, eventData);
        }
    }

    /**
     * Broadcast WebSocket event to followers
     * @param {string} eventType
     * @param {Object} eventData
     * @private
     */
    _broadcastWSEvent(eventType, eventData) {
        if (this.isLeader && this.channel) {
            this._broadcastMessage({
                type: 'ws_event',
                event: eventType,
                data: eventData
            });
        }
    }

    // ==================== CONNECTION MANAGEMENT ====================

    /**
     * Check if connection is stale
     * @returns {boolean}
     * @private
     */
    _isConnectionStale() {
        if (!this.lastServerPing) return false;
        return Date.now() - this.lastServerPing > this.PING_TIMEOUT;
    }

    /**
     * Close existing connection cleanly
     * @private
     */
    _closeExistingConnection() {
        if (this.ws) {
            this.ws.close(1000, 'Client closing');
            this.ws = null;
        }
        if (this.pollController) {
            this.pollController.abort();
            this.pollController = null;
        }
        if (this._pollTimeout) {
            clearTimeout(this._pollTimeout);
            this._pollTimeout = null;
        }
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this._pollingActive = false;
        this.isConnected = false;
        this.connectionId = null;
    }

    /**
     * Force reconnection
     * @private
     */
    _forceReconnect() {
        console.log('[BudgetWS] Force reconnecting...');
        this._closeExistingConnection();
        this.reconnectAttempts = 0;
        this.limitReached = false;
        this.useLongPolling = false;
        this._multiTabInitialized = false;
        this.connect();
    }

    /**
     * Check connection limit
     * @returns {Promise<Object>}
     * @private
     */
    async _checkConnectionLimit() {
        try {
            const response = await fetch('/api/v1/budget/ws/status', {
                credentials: 'include'
            });
            if (!response.ok) {
                return { canConnect: true };
            }
            const data = await response.json();
            const canConnect = data.user_connections < data.limits.max_per_user;
            return { canConnect, ...data };
        } catch (e) {
            console.log('[BudgetWS] Status check error:', e);
            return { canConnect: true };
        }
    }

    /**
     * Get WebSocket auth token
     * @returns {Promise<string|null>}
     * @private
     */
    async _getWSToken() {
        try {
            const response = await fetch('/api/v1/budget/ws/token', {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.error('[BudgetWS] 401: Not authenticated');
                    this.enabled = false;
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.token;
        } catch (e) {
            console.error('[BudgetWS] Failed to get WS token:', e);
            return null;
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Connect to WebSocket endpoint
     */
    async connect() {
        console.log('[BudgetWS] connect() called, enabled:', this.enabled);

        if (!this.enabled) {
            console.log('[BudgetWS] WebSocket disabled');
            return;
        }

        if (this.isConnected) {
            console.log('[BudgetWS] Already connected');
            return;
        }

        if (this.ws || this._pollingActive) {
            console.log('[BudgetWS] Connection already in progress');
            return;
        }

        // Initialize multi-tab support
        if (!this._multiTabInitialized) {
            console.log('[BudgetWS] Initializing multi-tab support...');
            await this._initMultiTab();
            console.log('[BudgetWS] Multi-tab init done, isLeader:', this.isLeader);
        }

        // Only leader creates connection
        if (this._supportsMultiTab()) {
            if (this.isLeader) {
                console.log('[BudgetWS] Leader connecting');
                this._createConnection();
            } else {
                console.log('[BudgetWS] Follower - waiting for events from leader');
                this._updateStatusIndicator();
            }
            return;
        }

        // Fallback: per-tab connection
        console.log('[BudgetWS] Per-tab connection, calling _createConnection');
        this._createConnection();
    }

    /**
     * Create WebSocket connection
     * @private
     */
    async _createConnection() {
        if (!this.enabled) return;

        // If already using long polling, continue with that
        if (this.useLongPolling) {
            this._startLongPolling();
            return;
        }

        // Close existing connection if any
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Get auth token for WebSocket
        const token = await this._getWSToken();
        if (!token) {
            console.error('[BudgetWS] No token, falling back to long polling');
            this.useLongPolling = true;
            this._startLongPolling();
            return;
        }

        // Build WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/budget/ws?token=${encodeURIComponent(token)}`;

        try {
            console.log('[BudgetWS] Creating WebSocket connection...');
            this.ws = new WebSocket(wsUrl);

            // Connection timeout (10 seconds)
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    console.error('[BudgetWS] Connection timeout, falling back to long polling');
                    this.ws.close();
                    this.ws = null;
                    this.useLongPolling = true;
                    this._startLongPolling();
                }
            }, 10000);

            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                console.log('[BudgetWS] WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.limitReached = false;
                this._updateStatusIndicator();
                this._notifyHandlers('connect', {});
                this._startClientPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this._handleServerMessage(message);
                } catch (e) {
                    console.error('[BudgetWS] Failed to parse message:', e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[BudgetWS] WebSocket error:', error);
                clearTimeout(connectionTimeout);
            };

            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log('[BudgetWS] WebSocket closed:', event.code, event.reason);

                this.isConnected = false;
                this.connectionId = null;
                this._stopClientPing();
                this._updateStatusIndicator();

                // Handle specific close codes
                if (event.code === 4001) {
                    // Auth error
                    console.error('[BudgetWS] Auth error, disabling WebSocket');
                    this.enabled = false;
                    this._notifyHandlers('auth_error', {});
                    return;
                }

                if (event.code === 4029) {
                    // Connection limit
                    console.error('[BudgetWS] Connection limit reached');
                    this.limitReached = true;
                    this.reconnectAttempts = this.maxReconnectAttempts;
                    this._notifyHandlers('limit_reached', {});
                    return;
                }

                // Schedule reconnect
                this._notifyHandlers('disconnect', {});
                this._scheduleReconnect();
            };

        } catch (error) {
            console.error('[BudgetWS] WebSocket creation failed:', error);
            this.useLongPolling = true;
            this._startLongPolling();
        }
    }

    /**
     * Handle server message
     * @param {Object} message
     * @private
     */
    _handleServerMessage(message) {
        const { type, data, timestamp } = message;

        // Update last server ping time for any message
        this.lastServerPing = Date.now();

        switch (type) {
            case 'connected':
                if (data && data.connection_id) {
                    this.connectionId = data.connection_id;
                    debugLog('[BudgetWS] Connection ID:', this.connectionId);
                }
                this._notifyHandlers('connected', data);
                break;

            case 'ping':
                // Server keepalive, send pong if needed
                debugLog('[BudgetWS] Server ping received');
                break;

            case 'pong':
                // Response to our client ping
                this.lastPongReceived = Date.now();
                debugLog('[BudgetWS] Pong received');
                break;

            case 'online_status':
                // Response to check_online
                this._notifyHandlers('online_status', data);
                break;

            case 'fact_created':
                this._handleFactCreated(data);
                this._broadcastWSEvent('fact_created', data);
                break;

            case 'fact_updated':
                this._handleFactUpdated(data);
                this._broadcastWSEvent('fact_updated', data);
                break;

            case 'fact_deleted':
                this._handleFactDeleted(data);
                this._broadcastWSEvent('fact_deleted', data);
                break;

            case 'plan_created':
                this._handlePlanCreated(data);
                this._broadcastWSEvent('plan_created', data);
                break;

            case 'plan_updated':
                this._handlePlanUpdated(data);
                this._broadcastWSEvent('plan_updated', data);
                break;

            case 'plan_deleted':
                this._handlePlanDeleted(data);
                this._broadcastWSEvent('plan_deleted', data);
                break;

            case 'transfer_created':
                this._handleTransferCreated(data);
                this._broadcastWSEvent('transfer_created', data);
                break;

            case 'transfer_deleted':
                this._handleTransferDeleted(data);
                this._broadcastWSEvent('transfer_deleted', data);
                break;

            case 'item_created':
                this._handleItemCreated(data);
                this._broadcastWSEvent('item_created', data);
                break;

            case 'item_updated':
                this._handleItemUpdated(data);
                this._broadcastWSEvent('item_updated', data);
                break;

            case 'item_deleted':
                this._handleItemDeleted(data);
                this._broadcastWSEvent('item_deleted', data);
                break;

            case 'item_completed':
                this._handleItemCompleted(data);
                this._broadcastWSEvent('item_completed', data);
                break;

            default:
                debugLog('[BudgetWS] Unknown message type:', type);
                this._handleEvent(type, data);
        }
    }

    /**
     * Start client ping interval
     * @private
     */
    _startClientPing() {
        this._stopClientPing();

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this._sendMessage({ type: 'ping' });
            }
        }, this.CLIENT_PING_INTERVAL);
    }

    /**
     * Stop client ping interval
     * @private
     */
    _stopClientPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Send message to server
     * @param {Object} message
     * @private
     */
    _sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify(message));
            } catch (e) {
                console.error('[BudgetWS] Send failed:', e);
            }
        }
    }

    /**
     * Check if server is online (for offline mode detection)
     * @returns {Promise<boolean>}
     */
    async checkOnline() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => resolve(false), 5000);

                const handler = (data) => {
                    clearTimeout(timeout);
                    this.off('online_status', handler);
                    resolve(data.online === true);
                };

                this.on('online_status', handler);
                this._sendMessage({ type: 'check_online' });
            });
        }

        // Fallback: HTTP check
        try {
            const response = await fetch('/api/v1/budget/ws/status', {
                credentials: 'include',
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch (e) {
            return false;
        }
    }

    // ==================== LONG POLLING FALLBACK ====================

    /**
     * Start long polling
     * @private
     */
    _startLongPolling() {
        if (this._pollingActive) {
            console.log('[BudgetWS] Long polling already active');
            return;
        }

        console.log('[BudgetWS] Starting long polling (10s interval)');
        this._pollingActive = true;
        this.isConnected = true;
        this._updateStatusIndicator();
        this._notifyHandlers('connect', { mode: 'polling' });

        this.lastEventTimestamp = Date.now() / 1000;
        this._pollLoop();
    }

    /**
     * Long polling loop
     * @private
     */
    async _pollLoop() {
        if (!this.enabled || !this._pollingActive) {
            this._stopLongPolling();
            return;
        }

        this.pollController = new AbortController();

        try {
            const url = `/api/v1/budget/poll?since=${this.lastEventTimestamp}&timeout=${this.POLL_TIMEOUT}`;
            const response = await fetch(url, {
                credentials: 'include',
                signal: this.pollController.signal
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('[BudgetWS] Long polling: 401 - not authenticated');
                    this._stopLongPolling();
                    this.enabled = false;
                    this.isConnected = false;
                    this._updateStatusIndicator();
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.lastServerPing = Date.now();

            // Process events
            if (data.events && data.events.length > 0) {
                console.log('[BudgetWS] Long polling received', data.events.length, 'events');
                for (const event of data.events) {
                    this._handleServerMessage(event);
                }
            }

            // Update timestamp
            if (data.server_time) {
                this.lastEventTimestamp = data.server_time;
            }

            // Schedule next poll
            this._pollTimeout = setTimeout(() => this._pollLoop(), 100);

        } catch (error) {
            if (error.name === 'AbortError') {
                debugLog('[BudgetWS] Long polling aborted');
                return;
            }

            console.error('[BudgetWS] Long polling error:', error.message);

            // Retry after interval
            this._pollTimeout = setTimeout(() => this._pollLoop(), this.POLL_INTERVAL);
        }
    }

    /**
     * Stop long polling
     * @private
     */
    _stopLongPolling() {
        if (this.pollController) {
            this.pollController.abort();
            this.pollController = null;
        }
        if (this._pollTimeout) {
            clearTimeout(this._pollTimeout);
            this._pollTimeout = null;
        }
        this._pollingActive = false;
    }

    /**
     * Disconnect
     */
    disconnect() {
        // Cleanup multi-tab resources
        if (this.leaderHeartbeatInterval) {
            clearInterval(this.leaderHeartbeatInterval);
            this.leaderHeartbeatInterval = null;
        }
        if (this._followerCheckInterval) {
            clearInterval(this._followerCheckInterval);
            this._followerCheckInterval = null;
        }
        if (this.channel) {
            try {
                this.channel.close();
            } catch (e) {}
            this.channel = null;
        }
        this.isLeader = false;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        this._stopClientPing();
        this._stopLongPolling();

        if (this.ws) {
            debugLog('[BudgetWS] Disconnecting WebSocket');
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.limitReached = false;
        this.connectionId = null;
        this.useLongPolling = false;
        this._updateStatusIndicator();
        this._notifyHandlers('disconnect', {});
    }

    /**
     * Silent close (for page unload)
     * @private
     */
    _silentClose() {
        // Cleanup multi-tab
        if (this.leaderHeartbeatInterval) {
            clearInterval(this.leaderHeartbeatInterval);
            this.leaderHeartbeatInterval = null;
        }
        if (this._followerCheckInterval) {
            clearInterval(this._followerCheckInterval);
            this._followerCheckInterval = null;
        }
        if (this.channel) {
            try { this.channel.close(); } catch (e) {}
            this.channel = null;
        }
        this.isLeader = false;

        // Notify server via sendBeacon
        if (this.connectionId) {
            const payload = JSON.stringify({ connection_id: this.connectionId });
            debugLog('[BudgetWS] Sending disconnect beacon for:', this.connectionId);

            if (navigator.sendBeacon) {
                navigator.sendBeacon('/api/v1/budget/ws/disconnect', payload);
            } else {
                fetch('/api/v1/budget/ws/disconnect', {
                    method: 'POST',
                    body: payload,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,
                    credentials: 'include'
                }).catch(() => {});
            }
            this.connectionId = null;
        }

        // Clear timers
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this._stopClientPing();

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Stop polling
        this._stopLongPolling();

        this.isConnected = false;
    }

    /**
     * Enable/disable connection
     * @param {boolean} enabled
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
        if (!navigator.onLine) {
            debugLog('[BudgetWS] Offline, waiting for network');
            this._updateStatusIndicator();
            window.addEventListener('online', () => {
                debugLog('[BudgetWS] Back online, reconnecting');
                this.reconnectAttempts = 0;
                this._createConnection();
            }, { once: true });
            return;
        }

        if (this.reconnectTimeout) return;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[BudgetWS] Max reconnect attempts reached');
            this._updateStatusIndicator();
            this._notifyHandlers('reconnect_failed', { attempts: this.reconnectAttempts });
            return;
        }

        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        debugLog('[BudgetWS] Reconnecting in', delay, 'ms (attempt', this.reconnectAttempts + 1, ')');

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectAttempts++;
            this._updateStatusIndicator();
            this._createConnection();
        }, delay);
    }

    // ==================== EVENT HANDLERS ====================

    _handleFactCreated(data) {
        this._notifyHandlers('fact_created', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_created', data);
        }
    }

    _handleFactUpdated(data) {
        this._notifyHandlers('fact_updated', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_updated', data);
        }
    }

    _handleFactDeleted(data) {
        this._notifyHandlers('fact_deleted', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('fact_deleted', data);
        }
    }

    _handlePlanCreated(data) {
        this._notifyHandlers('plan_created', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_created', data);
        }
    }

    _handlePlanUpdated(data) {
        this._notifyHandlers('plan_updated', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_updated', data);
        }
    }

    _handlePlanDeleted(data) {
        this._notifyHandlers('plan_deleted', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_deleted', data);
        }
    }

    _handleTransferCreated(data) {
        this._notifyHandlers('transfer_created', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('transfer_created', data);
        }
    }

    _handleTransferDeleted(data) {
        this._notifyHandlers('transfer_deleted', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('transfer_deleted', data);
        }
    }

    _handleItemCreated(data) {
        this._notifyHandlers('item_created', data);
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.addItemToUI(data);
        }
    }

    _handleItemUpdated(data) {
        this._notifyHandlers('item_updated', data);
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.updateItemInUI(data);
        }
    }

    _handleItemDeleted(data) {
        this._notifyHandlers('item_deleted', data);
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.removeItemFromUI(data.id, data.shopping_list_id);
        }
    }

    _handleItemCompleted(data) {
        this._notifyHandlers('item_completed', data);
        if (typeof window.listsManager !== 'undefined') {
            window.listsManager.toggleItemCompletedInUI(data.id, data.is_completed, data.shopping_list_id);
        }
    }

    _handleEvent(eventType, data) {
        this._notifyHandlers(eventType, data);
    }

    // ==================== HANDLER REGISTRATION ====================

    /**
     * Register event handler
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
    }

    /**
     * Remove event handler
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
        if (!this.handlers[event]) return;
        this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }

    /**
     * Notify handlers
     * @param {string} event
     * @param {Object} data
     * @private
     */
    _notifyHandlers(event, data) {
        if (!this.handlers[event]) return;
        for (const handler of this.handlers[event]) {
            try {
                handler(data);
            } catch (error) {
                console.error('[BudgetWS] Handler error:', error);
            }
        }
    }

    // ==================== STATUS ====================

    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            enabled: this.enabled,
            reconnectAttempts: this.reconnectAttempts,
            limitReached: this.limitReached,
            multiTabSupported: this._supportsMultiTab(),
            isLeader: this.isLeader,
            hasChannel: this.channel !== null,
            safariIOSMode: this._safariIOSMode,
            useLongPolling: this.useLongPolling
        };
    }

    /**
     * Update status indicator
     * @private
     */
    _updateStatusIndicator() {
        const indicator = document.getElementById('budget-sse-status-indicator');
        if (!indicator) return;

        const sizeClasses = 'badge-sm sm:badge-md';

        if (!this.enabled) {
            indicator.className = `badge badge-ghost ${sizeClasses}`;
            indicator.innerHTML = '&#9899;';
            indicator.title = 'Offline mode - real-time disabled';
        } else if (this.isConnected && this.approachingLimit) {
            indicator.className = `badge badge-warning ${sizeClasses}`;
            indicator.innerHTML = '&#9888;&#65039;';
            indicator.title = 'Many connections. Close unused tabs';
        } else if (this.isConnected) {
            indicator.className = `badge badge-success ${sizeClasses}`;
            indicator.innerHTML = '&#128994;';
            indicator.title = 'Real-time sync active' + (this.useLongPolling ? ' (polling)' : '');
        } else if (!this.isLeader && this._supportsMultiTab() && this.lastLeaderHeartbeat > 0) {
            indicator.className = `badge badge-success ${sizeClasses}`;
            indicator.innerHTML = '&#128994;';
            indicator.title = 'Sync via another tab';
        } else if (this.limitReached) {
            indicator.className = `badge badge-error ${sizeClasses}`;
            indicator.innerHTML = '&#128308;';
            indicator.title = 'Connection limit reached. Close other tabs';
        } else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            indicator.className = `badge badge-warning ${sizeClasses}`;
            indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
            indicator.title = `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            indicator.className = `badge badge-error ${sizeClasses}`;
            indicator.innerHTML = '&#128308;';
            indicator.title = 'Connection error. Refresh page';
        } else {
            indicator.className = `badge badge-neutral ${sizeClasses}`;
            indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
            indicator.title = 'Connecting...';
        }
    }
}

// ==================== BACKWARD COMPATIBILITY EXPORTS ====================
// CRITICAL: Keep window.budgetSSEClient name for 32+ files that reference it

if (typeof window !== 'undefined') {
    // New class names
    window.BudgetWSClient = BudgetWSClient;

    // BACKWARD COMPATIBILITY: Keep SSE names for existing code
    window.BudgetSSEClient = BudgetWSClient;  // Alias for offlineManager.js and others

    // Create singleton instance with SAME NAME as before
    window.budgetWSClient = new BudgetWSClient();
    window.budgetSSEClient = window.budgetWSClient;  // Alias for existing code
}

// Debug log helper
if (typeof debugLog === 'undefined') {
    window.debugLog = function() {};
}
