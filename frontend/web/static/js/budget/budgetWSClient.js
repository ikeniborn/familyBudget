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
 * - Replaces legacy SSE implementation
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

        // Error tracking for debugging (especially iOS Safari without Web Inspector)
        this._lastError = null;
        this._connectionHistory = [];

        // Long Polling fallback
        this.useLongPolling = false;
        this.pollController = null;
        this.lastEventTimestamp = 0;
        this.POLL_INTERVAL = 5000;  // 5 seconds - faster updates, acceptable load
        this.POLL_TIMEOUT = 5;  // seconds
        this._pollTimeout = null;
        this._pollingActive = false;
        // Long polling retry with exponential backoff
        this._pollRetryCount = 0;
        this.MAX_POLL_RETRIES = 10;
        this.BASE_POLL_RETRY_DELAY = 1000;  // 1 second
        this._consecutive503Count = 0;  // Track consecutive 503 errors for offline mode detection

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

        // Status indicator debouncing to prevent visual flickering on iOS
        this._lastIndicatorState = null;
        this._indicatorDebounceTimer = null;
        this.INDICATOR_DEBOUNCE_MS = 500;  // Minimum 500ms between visual updates

        // iOS device detection (for special handling)
        // All iOS browsers (Safari, Chrome, Firefox, Yandex) use WebKit and have same issues
        this._iosDeviceMode = this._detectIOSDevice();

        // iOS WebSocket strategy:
        // Server has permessage-deflate disabled (--ws-per-message-deflate false)
        // Try WebSocket first with shorter timeout, fallback to Long Polling if fails
        // More frequent pings to keep connection alive on iOS
        // Reference: https://discussions.apple.com/thread/256142477
        if (this._iosDeviceMode) {
            this._iosWebSocketTimeout = 5000;  // 5 sec timeout (vs 10 sec default)
            this.CLIENT_PING_INTERVAL = 8000;  // 8 seconds (vs 15 default) - keep iOS connection alive
        }

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

    }

    // ==================== BROWSER DETECTION ====================

    /**
     * Detect ANY iOS/iPadOS device regardless of browser
     * All iOS browsers use WebKit engine (Apple requirement)
     * Web Locks API is unreliable on all iOS browsers
     * Chrome iOS (CriOS), Firefox iOS (FxiOS), Edge iOS (EdgiOS) all have same issues
     * @returns {boolean}
     * @private
     */
    _detectIOSDevice() {
        const ua = navigator.userAgent;

        // Standard iOS detection
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

        // iPadOS in desktop mode (reports as MacIntel but has touch)
        const isPadOSDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

        return isIOS || isPadOSDesktop;
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

    // ==================== OFFLINE MODE DETECTION ====================

    /**
     * Check if auto offline mode is active via OfflineManager or localStorage fallback
     * This prevents WebSocket from attempting connections when offline mode is enabled
     * Fallback to localStorage is needed for timing issues during page navigation
     * when offlineManager may not be initialized yet
     * @returns {boolean}
     * @private
     */
    _isOfflineModeActive() {
        // Check offlineManager if available (preferred)
        if (window.offlineManager &&
            window.offlineManager.networkDetector &&
            window.offlineManager.networkDetector.autoOfflineMode) {
            return true;
        }
        // Fallback: check localStorage directly for timing issues during page navigation
        // offlineManager may not be initialized yet when budgetWSClient.connect() is called
        try {
            return localStorage.getItem('budget_auto_offline_mode') === 'true';
        } catch (e) {
            return false;
        }
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
        if (this._multiTabInitialized) {
            this._logHistory('multitab_already_init');
            return;
        }
        this._multiTabInitialized = true;

        // Safari iOS: Skip Web Locks entirely
        if (this._iosDeviceMode) {
            this.isLeader = true;
            this._multiTabSupported = false;
            this._logHistory('safari_ios_leader_set');
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
                clearInterval(this._followerCheckInterval);
                this._followerCheckInterval = null;

                // Try to become leader
                this.isLeader = true;
                this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                this._startLeaderHeartbeat();

                // Create connection as new leader
                if (this.enabled && !this.isConnected) {
                    this._createConnection();
                }
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
            return { canConnect: true };
        }
    }

    /**
     * Get WebSocket auth token
     * @returns {Promise<string|null>}
     * @private
     */
    async _getWSToken() {
        this._logHistory('token_fetch_start');
        try {
            const response = await fetch('/api/v1/budget/ws/token', {
                method: 'POST',
                credentials: 'include'
            });
            if (!response.ok) {
                if (response.status === 401) {
                    this._setError('Token 401: Not authenticated');
                    this.enabled = false;
                    return null;
                }
                this._setError(`Token HTTP ${response.status}`);
                return null;
            }
            const data = await response.json();
            if (!data.token) {
                this._setError('Token empty in response');
                return null;
            }
            this._logHistory('token_received');
            return data.token;
        } catch (e) {
            this._setError(`Token fetch: ${e.message}`);
            return null;
        }
    }

    // ==================== PUBLIC API ====================

    /**
     * Connect to WebSocket endpoint
     */
    async connect() {
        this._logHistory('connect_start');

        // Skip connection if offline mode is active
        if (this._isOfflineModeActive()) {
            this._logHistory('connect_skip_offline_mode');
            debugLog('[BudgetWS] Skipping connect - offline mode active');
            this._updateStatusIndicator();
            return;
        }

        if (!this.enabled) {
            this._logHistory('connect_skip_disabled');
            return;
        }
        if (this.isConnected) {
            this._logHistory('connect_skip_connected');
            return;
        }
        if (this.ws || this._pollingActive) {
            this._logHistory('connect_skip_active');
            return;
        }

        // Initialize multi-tab support
        if (!this._multiTabInitialized) {
            this._logHistory('multitab_init_start');
            await this._initMultiTab();
            this._logHistory(`multitab_init_done_leader=${this.isLeader}_safari=${this._iosDeviceMode}`);
        }

        // Only leader creates connection
        if (this._supportsMultiTab()) {
            if (this.isLeader) {
                this._logHistory('creating_connection_leader');
                this._createConnection();
            } else {
                this._logHistory('follower_waiting');
                this._updateStatusIndicator();
            }
            return;
        }

        // Fallback: per-tab connection (Safari iOS uses this path)
        this._logHistory('creating_connection_fallback');
        this._createConnection();
    }

    /**
     * Create WebSocket connection
     * @private
     */
    async _createConnection() {
        if (!this.enabled) return;

        // Skip if offline mode is active
        if (this._isOfflineModeActive()) {
            debugLog('[BudgetWS] Skipping connection - offline mode active');
            this._updateStatusIndicator();
            return;
        }

        // Quick check: don't attempt if browser says offline
        if (!navigator.onLine) {
            debugLog('[BudgetWS] Browser reports offline, skipping connection attempt');
            this._updateStatusIndicator();
            return;
        }

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
            console.warn('[BudgetWS] No token, falling back to long polling');
            this.useLongPolling = true;
            this._startLongPolling();
            return;
        }

        // Build WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/v1/budget/ws?token=${encodeURIComponent(token)}`;

        try {
            this.ws = new WebSocket(wsUrl);

            // Connection timeout (5 sec for iOS, 10 sec for others)
            const timeout = this._iosWebSocketTimeout || 10000;
            this._logHistory(`ws_connecting_timeout_${timeout}ms`);
            const connectionTimeout = setTimeout(() => {
                if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                    this._setError(`WS timeout after ${timeout}ms`);
                    this.ws.close();
                    this.ws = null;
                    this.useLongPolling = true;
                    this._startLongPolling();
                }
            }, timeout);

            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                this._logHistory('ws_connected');
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
                this._setError('WS error event');
                clearTimeout(connectionTimeout);
            };

            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                // Log detailed close info for iOS debugging
                // Close codes: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code
                // 1000 = Normal, 1001 = Going Away, 1006 = Abnormal (no close frame)
                const reason = event.reason || 'none';
                const clean = event.wasClean ? 'clean' : 'unclean';
                this._logHistory(`ws_closed_code=${event.code}_reason=${reason}_${clean}`);
                this.isConnected = false;
                this.connectionId = null;
                this._stopClientPing();
                this._updateStatusIndicator();

                // Handle specific close codes
                if (event.code === 4001) {
                    this._setError('WS 4001: Auth error');
                    this.enabled = false;
                    this._notifyHandlers('auth_error', {});
                    return;
                }

                if (event.code === 4029) {
                    this._setError('WS 4029: Connection limit');
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
            this._setError(`WS create: ${error.message}`);
            this.useLongPolling = true;
            this._startLongPolling();
        }
    }

    /**
     * Set last error for debugging
     * @param {string} error
     * @private
     */
    _setError(error) {
        this._lastError = { message: error, time: new Date().toISOString() };
        this._logHistory(`error: ${error}`);
        console.error('[BudgetWS]', error);
    }

    /**
     * Log to connection history for debugging
     * @param {string} event
     * @private
     */
    _logHistory(event) {
        const entry = { event, time: Date.now() };
        this._connectionHistory.push(entry);
        // Keep only last 20 entries
        if (this._connectionHistory.length > 20) {
            this._connectionHistory.shift();
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
        if (this._pollingActive) return;

        // Skip if offline mode is active
        if (this._isOfflineModeActive()) {
            debugLog('[BudgetWS] Skipping long polling - offline mode active');
            return;
        }

        // Quick check: don't start polling if browser says offline
        if (!navigator.onLine) {
            debugLog('[BudgetWS] Browser reports offline, skipping long polling');
            return;
        }

        this._logHistory('poll_start');
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

        // Stop polling if offline mode became active
        if (this._isOfflineModeActive()) {
            debugLog('[BudgetWS] Stopping poll loop - offline mode active');
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
                    this._setError('Poll 401: Not authenticated');
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
                for (const event of data.events) {
                    this._handleServerMessage(event);
                }
            }

            // Update timestamp
            if (data.server_time) {
                this.lastEventTimestamp = data.server_time;
            }

            // Reset retry count on successful poll
            this._pollRetryCount = 0;
            this._consecutive503Count = 0;  // Reset 503 counter on success

            // Schedule next poll
            this._pollTimeout = setTimeout(() => this._pollLoop(), 100);

        } catch (error) {
            if (error.name === 'AbortError') {
                debugLog('[BudgetWS] Long polling aborted');
                return;
            }

            // For HTTP 503 (server unavailable), use warn instead of error - this is expected when offline
            if (error.message && error.message.includes('503')) {
                console.warn('[BudgetWS] Poll: server unavailable (503)');
                // Track consecutive 503 errors - stop polling if offline mode is active
                this._consecutive503Count++;
                if (this._consecutive503Count >= 3 && this._isOfflineModeActive()) {
                    debugLog('[BudgetWS] Multiple 503 errors + offline mode active, stopping poll');
                    this._stopLongPolling();
                    this._updateStatusIndicator();
                    return;
                }
            } else {
                this._setError(`Poll: ${error.message}`);
            }

            // Exponential backoff with jitter to prevent thundering herd
            this._pollRetryCount++;
            if (this._pollRetryCount <= this.MAX_POLL_RETRIES) {
                const baseDelay = this.BASE_POLL_RETRY_DELAY * Math.pow(2, this._pollRetryCount - 1);
                const jitter = baseDelay * 0.2 * Math.random(); // ±10% jitter
                const delay = Math.min(baseDelay + jitter, 30000); // max 30s
                debugLog('[BudgetWS] Long polling retry in', Math.round(delay), 'ms (attempt', this._pollRetryCount, ')');
                this._pollTimeout = setTimeout(() => this._pollLoop(), delay);
            } else {
                this._setError('Poll max retries');
                this._pollingActive = false;
                this._updateStatusIndicator();
            }
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
        // CRITICAL: Reset multi-tab init flag to allow re-initialization on reconnect
        // Without this, Safari iOS mode breaks: _initMultiTab() sets isLeader=true,
        // but disconnect() sets isLeader=false, and _initMultiTab() won't be called again
        this._multiTabInitialized = false;

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
        this._multiTabInitialized = false;

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
        } else if (!this.isConnected && !this._isOfflineModeActive()) {
            this.connect();
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     * @private
     */
    _scheduleReconnect() {
        // Skip reconnect if offline mode is active
        if (this._isOfflineModeActive()) {
            debugLog('[BudgetWS] Skipping reconnect - offline mode active');
            this._updateStatusIndicator();
            return;
        }

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

        // Calculate delay with exponential backoff and jitter to prevent thundering herd
        const baseDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
        const jitter = baseDelay * 0.2 * Math.random(); // ±10% jitter
        const delay = Math.min(baseDelay + jitter, this.maxReconnectDelay);

        debugLog('[BudgetWS] Reconnecting in', Math.round(delay), 'ms (attempt', this.reconnectAttempts + 1, ')');

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
            safariIOSMode: this._iosDeviceMode,
            useLongPolling: this.useLongPolling
        };
    }

    /**
     * Update status indicator with debouncing to prevent flickering on iOS
     * iOS Safari/Chrome/Firefox can rapidly cycle through disconnect/reconnect states
     * Debouncing prevents visual flickering while still showing connection state
     * @private
     */
    _updateStatusIndicator() {
        const indicator = document.getElementById('budget-sse-status-indicator');
        if (!indicator) return;

        // Determine current state
        let state;
        if (!this.enabled) {
            state = 'disabled';
        } else if (this.isConnected && this.approachingLimit) {
            state = 'warning';
        } else if (this.isConnected) {
            state = 'connected';
        } else if (!this.isLeader && this._supportsMultiTab() && this.lastLeaderHeartbeat > 0) {
            state = 'connected_via_leader';
        } else if (this.limitReached) {
            state = 'limit_reached';
        } else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            state = 'reconnecting';
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            state = 'error';
        } else {
            state = 'connecting';
        }

        // Skip update if state hasn't changed (prevents unnecessary DOM updates)
        if (state === this._lastIndicatorState) {
            return;
        }

        // Debounce rapid state changes to prevent visual flickering
        // Exception: always show 'connected' immediately (good news should show fast)
        if (state !== 'connected' && state !== 'connected_via_leader' && this._indicatorDebounceTimer) {
            return;
        }

        this._lastIndicatorState = state;

        // Clear any pending debounce timer
        if (this._indicatorDebounceTimer) {
            clearTimeout(this._indicatorDebounceTimer);
            this._indicatorDebounceTimer = null;
        }

        // Apply the visual update
        this._applyIndicatorState(indicator, state);

        // Set debounce timer for next update (except for connected states)
        if (state !== 'connected' && state !== 'connected_via_leader') {
            this._indicatorDebounceTimer = setTimeout(() => {
                this._indicatorDebounceTimer = null;
            }, this.INDICATOR_DEBOUNCE_MS);
        }
    }

    /**
     * Apply visual state to indicator element
     * @param {HTMLElement} indicator
     * @param {string} state - One of: disabled, warning, connected, connected_via_leader,
     *                         limit_reached, reconnecting, error, connecting
     * @private
     */
    _applyIndicatorState(indicator, state) {
        const sizeClasses = 'badge-sm sm:badge-md';

        switch (state) {
            case 'disabled':
                indicator.className = `badge badge-ghost ${sizeClasses}`;
                indicator.innerHTML = '&#9899;';
                indicator.title = 'Offline mode - real-time disabled';
                break;
            case 'warning':
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '&#9888;&#65039;';
                indicator.title = 'Many connections. Close unused tabs';
                break;
            case 'connected':
                indicator.className = `badge badge-success ${sizeClasses}`;
                indicator.innerHTML = '&#128994;';
                indicator.title = 'Real-time sync active' + (this.useLongPolling ? ' (polling)' : '');
                break;
            case 'connected_via_leader':
                indicator.className = `badge badge-success ${sizeClasses}`;
                indicator.innerHTML = '&#128994;';
                indicator.title = 'Sync via another tab';
                break;
            case 'limit_reached':
                indicator.className = `badge badge-error ${sizeClasses}`;
                indicator.innerHTML = '&#128308;';
                indicator.title = 'Connection limit reached. Close other tabs';
                break;
            case 'reconnecting':
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
                indicator.title = `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
                break;
            case 'error':
                indicator.className = `badge badge-error ${sizeClasses}`;
                indicator.innerHTML = '&#128308;';
                indicator.title = 'Connection error. Refresh page';
                break;
            case 'connecting':
            default:
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
                indicator.title = 'Connecting...';
                break;
        }
    }

    /**
     * Get detailed diagnostic info (for debugging without Web Inspector)
     * Call from console: window.budgetWSClient.diagnose()
     * @returns {Object}
     */
    diagnose() {
        const diag = {
            // Connection state
            isConnected: this.isConnected,
            enabled: this.enabled,
            connectionId: this.connectionId,

            // WebSocket state
            wsState: this.ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][this.ws.readyState] : 'NO_SOCKET',
            useLongPolling: this.useLongPolling,

            // Multi-tab state
            isLeader: this.isLeader,
            multiTabSupported: this._supportsMultiTab(),
            multiTabInitialized: this._multiTabInitialized,
            hasChannel: this.channel !== null,
            lastLeaderHeartbeat: this.lastLeaderHeartbeat ? new Date(this.lastLeaderHeartbeat).toISOString() : null,

            // Browser detection
            safariIOSMode: this._iosDeviceMode,
            needsLongerTimeout: this._needsLongerTimeout(),
            userAgent: navigator.userAgent,

            // Reconnection state
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            limitReached: this.limitReached,
            approachingLimit: this.approachingLimit,

            // Polling state
            pollingActive: this._pollingActive,
            pollRetryCount: this._pollRetryCount,

            // Error tracking
            lastError: this._lastError,
            history: this._connectionHistory.slice(-10)
        };

        return diag;
    }

    /**
     * Show visual diagnostic alert (for iOS Safari debugging)
     * Tap status indicator 3 times quickly to trigger
     */
    showDiagnostics() {
        const diag = this.diagnose();
        const lines = [
            `Connected: ${diag.isConnected}`,
            `Enabled: ${diag.enabled}`,
            `WS State: ${diag.wsState}`,
            `Long Polling: ${diag.useLongPolling}`,
            `Polling Active: ${diag.pollingActive}`,
            ``,
            `Safari iOS: ${diag.safariIOSMode}`,
            `Leader: ${diag.isLeader}`,
            `MultiTab Init: ${diag.multiTabInitialized}`,
            `MultiTab Supported: ${diag.multiTabSupported}`,
            `Has Channel: ${diag.hasChannel}`,
            ``,
            `Reconnects: ${diag.reconnectAttempts}`,
            `Limit Reached: ${diag.limitReached}`,
            ``,
            `Last Error: ${diag.lastError ? diag.lastError.message : 'none'}`,
            ``,
            `History (${diag.history.length}):`,
            ...diag.history.slice(-10).map(h => `  ${new Date(h.time).toLocaleTimeString()}: ${h.event}`)
        ];
        alert('[BudgetWS Diagnostics]\n\n' + lines.join('\n'));
    }

    /**
     * Force reconnect (for debugging)
     * Call from console: window.budgetWSClient.forceReconnect()
     */
    forceReconnect() {
        this.disconnect();
        this.reconnectAttempts = 0;
        this.limitReached = false;
        this.useLongPolling = false;
        this._multiTabInitialized = false;
        this.isLeader = false;
        setTimeout(() => this.connect(), 500);
    }
}

// ==================== GLOBAL EXPORTS ====================

if (typeof window !== 'undefined') {
    // Export class
    window.BudgetWSClient = BudgetWSClient;

    // Create singleton instance
    window.budgetWSClient = new BudgetWSClient();

    // Global online/offline handlers for automatic reconnection
    window.addEventListener('online', () => {
        const client = window.budgetWSClient;
        if (client && client.enabled && !client.isConnected) {
            // Skip reconnect if offline mode is active (user explicitly enabled offline mode)
            if (client._isOfflineModeActive()) {
                debugLog('[BudgetWS] Skipping reconnect - offline mode active');
                return;
            }
            // Reset state for clean reconnect
            client.reconnectAttempts = 0;
            client._multiTabInitialized = false;
            client.isLeader = false;
            setTimeout(() => client.connect(), 1000);
        }
    });

    window.addEventListener('offline', () => {
        const client = window.budgetWSClient;
        if (client) {
            client._updateStatusIndicator();
        }
    });

    // Triple-tap on status indicator to show diagnostics (for iOS Safari)
    let tapCount = 0;
    let tapTimeout = null;
    document.addEventListener('click', (e) => {
        if (e.target.id === 'budget-sse-status-indicator' || e.target.closest('#budget-sse-status-indicator')) {
            tapCount++;
            if (tapCount >= 3) {
                tapCount = 0;
                clearTimeout(tapTimeout);
                window.budgetWSClient.showDiagnostics();
            } else {
                clearTimeout(tapTimeout);
                tapTimeout = setTimeout(() => { tapCount = 0; }, 500);
            }
        }
    });
}

// Debug log helper
if (typeof debugLog === 'undefined') {
    window.debugLog = function() {};
}
