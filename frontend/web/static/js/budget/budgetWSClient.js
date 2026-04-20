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

// WebSocket Diagnostic Logger
const logWSDiag = typeof Logger !== 'undefined' ? new Logger('[WS_DIAG]', 'WS_DIAG') : {
    info: () => {},
    error: () => {},
    table: () => {},
    groupCollapsed: () => {},
    groupEnd: () => {}
};

// RTT Measurement Logger
const logWSRTT = typeof Logger !== 'undefined' ? new Logger('[WS_RTT]', 'WS_RTT') : {
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: () => {}
};

// Badge State Transition Logger
const logWSState = typeof Logger !== 'undefined' ? new Logger('[WS_STATE]', 'WS_STATE') : {
    info: () => {},
    debug: () => {},
    error: () => {}
};

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

        // RTT measurement for slow connection detection
        this._rttMeasurements = [];      // Rolling window of last 5 RTT measurements
        this._rttRollingAverage = 0;     // Average of last 5 measurements
        this._pingTimestamp = null;      // Timestamp when ping sent
        // Read threshold from config (with fallback to 5000ms)
        this.RTT_THRESHOLD = (typeof window !== 'undefined' && window.FEATURE_FLAGS?.WS_RTT_THRESHOLD_MS)
            ? window.FEATURE_FLAGS.WS_RTT_THRESHOLD_MS
            : 5000;
        this.RTT_WINDOW_SIZE = 5;        // Number of measurements to average

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

        // Sticky state mechanism to prevent rapid badge state transitions
        this._lastStateChangeTime = 0;      // Timestamp of last badge state change
        this._currentBadgeState = null;      // Current badge state
        this.STICKY_STATE_DURATION = 5000;   // Minimum 5s between state changes

        // iOS wake from sleep recovery
        // Prevents reconnection loops after screen wake from sleep
        this._reconnecting = false;  // Guard against parallel reconnection attempts
        this._lastVisibilityChange = 0;  // Timestamp of last visibility change
        this._iosWakeRecoveryMode = false;  // Increased delays after code 1005

        // iOS device detection (for special handling)
        // All iOS browsers (Safari, Chrome, Firefox, Yandex) use WebKit and have same issues
        this._iosDeviceMode = this._detectIOSDevice();

        // ==================== NAVIGATION DETECTION ====================
        // Suppress RTT warnings during page load/navigation window
        // Prevents false "slow connection" warnings during WebSocket reconnection
        this.isNavigating = true;  // Initially true (page just loaded)
        this._navigationTimer = null;
        this.NAVIGATION_WINDOW = 10000;  // 10 seconds window after page load

        // iOS WebSocket strategy:
        // Server has permessage-deflate disabled (--ws-per-message-deflate false)
        // Try WebSocket first with shorter timeout, fallback to Long Polling if fails
        // More frequent pings to keep connection alive on iOS
        // Reference: https://discussions.apple.com/thread/256142477
        if (this._iosDeviceMode) {
            this._iosWebSocketTimeout = 5000;  // 5 sec timeout (vs 10 sec default)
            this.CLIENT_PING_INTERVAL = 8000;  // 8 seconds (vs 15 default) - keep iOS connection alive
        }

        // ==================== WAKE RECOVERY ENHANCEMENTS ====================
        // Layer 3: Periodic health check (60s interval when visible)
        this._healthCheckInterval = null;
        this.HEALTH_CHECK_INTERVAL = 60000;  // 60 seconds

        // Layer 4: Pong timeout enforcement (force close if no pong)
        this._pongTimeoutTimer = null;
        this.PONG_TIMEOUT = 20000;  // 20 seconds

        // Layer 5: Enhanced logging (always enabled on iOS for debugging)
        this._enableDetailedLogging = this._iosDeviceMode;

        // Layer 2: Service Worker wake detection (backup mechanism)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'PAGE_WAKE') {
                    this._log('SW', 'info', 'Service Worker detected page wake', {
                        timestamp: event.data.timestamp,
                        source: event.data.source
                    });
                    if (this.isLeader && document.visibilityState === 'visible') {
                        this._performWakeHealthCheck();
                    }
                }
            });
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
                // iOS: debounce rapid visibility changes after wake from sleep
                // Multiple visibility change events can fire in quick succession
                // which causes the reconnection loop
                if (this._iosDeviceMode) {
                    const now = Date.now();
                    if (now - this._lastVisibilityChange < 2000) {
                        debugLog('[BudgetWS] iOS: Debouncing visibility change');
                        return;
                    }
                    this._lastVisibilityChange = now;
                }

                // Layer 2: Notify Service Worker about page wake
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        action: 'pageWake',
                        timestamp: Date.now()
                    });
                }

                // Layer 1: Enhanced Visibility API Recovery
                // Perform aggressive health check on wake
                if (this.isLeader) {
                    this._performWakeHealthCheck();
                }

                if (!this.isLeader && this.channel) {
                    this._broadcastMessage({ type: 'status_request' });
                }
            }
        });

        // ==================== NAVIGATION WINDOW SETUP ====================
        // Start navigation window to suppress RTT warnings during page load
        // DOMContentLoaded fires when page is ready, or already loaded if fast connection
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this._startNavigationWindow();
            }, { once: true });
        } else {
            // Page already loaded (fast connection or cached)
            this._startNavigationWindow();
        }

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

    // ==================== NAVIGATION WINDOW METHODS ====================

    /**
     * Start navigation window (suppress RTT warnings for 10 seconds)
     * Called on DOMContentLoaded to allow WebSocket reconnection to stabilize
     * @private
     */
    _startNavigationWindow() {
        this.isNavigating = true;

        // Clear existing timer (if any)
        if (this._navigationTimer) {
            clearTimeout(this._navigationTimer);
        }

        // Set timer to clear navigation flag
        this._navigationTimer = setTimeout(() => {
            this.isNavigating = false;
            this._navigationTimer = null;
        }, this.NAVIGATION_WINDOW);
    }

    /**
     * Stop navigation window (cleanup on disconnect)
     * @private
     */
    _stopNavigationWindow() {
        if (this._navigationTimer) {
            clearTimeout(this._navigationTimer);
            this._navigationTimer = null;
            this.isNavigating = false;
        }
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
        // CRITICAL FIX (v11.3.7): Skip offline mode check during initial login
        // offlineManager may not be fully initialized yet, causing WebSocket connection failure
        // This ensures WebSocket connects immediately after authentication
        try {
            const justLoggedIn = sessionStorage.getItem('just_logged_in');
            if (justLoggedIn === 'true') {
                debugLog('[BudgetWS] Skipping offline mode check - just logged in');
                return false;  // Force online mode for first login
            }
        } catch (e) {
            debugLog('[BudgetWS] sessionStorage unavailable:', e.message || e);
            // Continue with normal checks
        }

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

    // ==================== WAKE RECOVERY METHODS ====================

    /**
     * Centralized logging helper with module prefix
     * Routes to appropriate logger (RTT, STATE, or WS_DIAG)
     * @param {string} module - Module name (RTT, STATE, PING, PONG, WAKE, HEALTH, etc.)
     * @param {string} level - Log level (debug, info, warn, error)
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     * @private
     */
    _log(module, level, message, data = {}) {
        // Route to appropriate logger based on module
        const logger = module === 'RTT' ? logWSRTT :
                       module === 'STATE' ? logWSState :
                       module === 'NAV' ? logNav :
                       module === 'RTT_FILTER' ? logRTTFilter :
                       logWSDiag;  // PONG, PING, WAKE, HEALTH, etc. → WS_DIAG

        const logFn = logger[level] || logger.info;

        if (data && Object.keys(data).length > 0) {
            logFn.call(logger, message, data);
        } else {
            logFn.call(logger, message);
        }

        // Store in history for debugging
        this._logHistory(`${module}:${level}:${message}`);
    }

    /**
     * Layer 1: Enhanced Visibility API Recovery
     * Performs aggressive connection health check when page becomes visible
     * Handles cases where WebSocket died during long sleep (5+ minutes)
     * @private
     */
    _performWakeHealthCheck() {
        // Check 1: WebSocket readyState
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this._log('WAKE', 'warn', 'WebSocket not OPEN, reconnecting', {
                wsState: this.ws ? this.ws.readyState : 'null'
            });
            this._forceReconnect();
            return;
        }

        // Check 2: Stale connection (no ping > PING_TIMEOUT)
        if (this._isConnectionStale()) {
            this._log('WAKE', 'warn', 'Connection stale, reconnecting', {
                timeSinceLastPing: Date.now() - this.lastServerPing
            });
            this._forceReconnect();
            return;
        }

        // Check 3: Send ping to verify bidirectional communication
        this._sendMessage({ type: 'ping' });

        // Set timeout to check if pong received
        setTimeout(() => {
            const timeSincePong = Date.now() - this.lastPongReceived;
            if (timeSincePong > 10000) {
                this._log('WAKE', 'warn', 'No pong response within 3s, reconnecting', {
                    timeSincePong
                });
                this._forceReconnect();
            }
        }, 3000);
    }

    /**
     * Layer 3: Start periodic health check
     * Checks connection health every 60 seconds when page is visible
     * Catches cases where connection died but visibility change didn't trigger
     * @private
     */
    _startHealthCheck() {
        if (this._healthCheckInterval) return;

        this._healthCheckInterval = setInterval(() => {
            // Only check if visible and leader
            if (document.visibilityState !== 'visible' || !this.isLeader) {
                return;
            }

            if (this._isConnectionStale()) {
                this._log('HEALTH', 'warn', 'Connection stale');
                this._forceReconnect();
                return;
            }

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send ping for verification
                this._sendMessage({ type: 'ping' });
            } else {
                this._log('HEALTH', 'warn', 'WebSocket not OPEN');
                this._forceReconnect();
                return;
            }
        }, this.HEALTH_CHECK_INTERVAL);
    }

    /**
     * Layer 3: Stop periodic health check
     * @private
     */
    _stopHealthCheck() {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = null;
        }
    }

    /**
     * Layer 4: Reset pong timeout timer
     * Sets timeout to force close WebSocket if pong not received
     * Detects "zombie" connections where WebSocket is OPEN but TCP is dead
     * @private
     */
    _resetPongTimeout() {
        // Clear existing timeout
        if (this._pongTimeoutTimer) {
            clearTimeout(this._pongTimeoutTimer);
        }

        // Set new timeout
        this._pongTimeoutTimer = setTimeout(() => {
            this._log('PONG-TIMEOUT', 'error', 'No pong received, force closing', {
                timeout: `${this.PONG_TIMEOUT}ms`,
                lastPong: this.lastPongReceived ? (Date.now() - this.lastPongReceived) : 'never'
            });

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Force close (will trigger onclose → reconnect)
                this.ws.close(1000, 'Pong timeout');
            }
        }, this.PONG_TIMEOUT);
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

            // CLEANUP FIX (v11.3.7): Remove just_logged_in flag after WebSocket initialized
            // Delay removal to avoid race conditions with other components
            try {
                const justLoggedIn = sessionStorage.getItem('just_logged_in');
                if (justLoggedIn === 'true') {
                    setTimeout(() => {
                        sessionStorage.removeItem('just_logged_in');
                        debugLog('[BudgetWS] Cleared just_logged_in flag after init');
                    }, 5000);
                }
            } catch (e) {
                debugLog('[BudgetWS] sessionStorage unavailable for cleanup:', e.message || e);
                // Ignore - cleanup is non-critical
            }
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
        // Check if WebSocket exists but is not in OPEN state
        // This can happen after iOS wake from sleep when TCP is dead but WS object exists
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            return true;
        }

        // Check if we haven't received a server ping in PING_TIMEOUT
        if (!this.lastServerPing) return false;
        return Date.now() - this.lastServerPing > this.PING_TIMEOUT;
    }

    /**
     * Close existing connection cleanly
     * Layer 3: Stops health check
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

        // Layer 3: Stop periodic health check
        this._stopHealthCheck();

        this._pollingActive = false;
        this.isConnected = false;
        this.connectionId = null;
    }

    /**
     * Force reconnection
     * Guards against parallel reconnection attempts (especially important for iOS wake from sleep)
     * @private
     */
    _forceReconnect() {
        // Guard: prevent parallel reconnection attempts
        // This prevents the reconnection loop seen on iOS after wake from sleep
        if (this._reconnecting) {
            debugLog('[BudgetWS] Already reconnecting, skip');
            return;
        }
        this._reconnecting = true;

        this._closeExistingConnection();
        this.reconnectAttempts = 0;
        this.limitReached = false;
        this.useLongPolling = false;
        this._multiTabInitialized = false;

        // For iOS: give network time to stabilize after wake from sleep
        // TCP connections may have been killed while screen was off
        const delay = this._iosDeviceMode ? 500 : 100;
        setTimeout(() => {
            this._reconnecting = false;
            this.connect();
        }, delay);
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

                // Reset RTT measurements on new connection
                this._rttMeasurements = [];
                this._rttRollingAverage = 0;
                this._pingTimestamp = null;

                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.limitReached = false;
                this._updateStatusIndicator();
                this._notifyHandlers('connect', {});
                this._startClientPing();

                // Layer 3: Start periodic health check
                this._startHealthCheck();
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

                // Layer 3: Stop periodic health check
                this._stopHealthCheck();

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

                // iOS-specific: code 1005 (No Status Received) after wake from sleep
                // means TCP connection was killed while screen was off
                // Network may not be fully stable yet, so increase reconnection delays
                if (this._iosDeviceMode && event.code === 1005) {
                    this._logHistory('ios_1005_wake_recovery');
                    this._iosWakeRecoveryMode = true;
                    // Reset wake recovery mode after 5 seconds
                    // This gives network time to fully stabilize
                    setTimeout(() => {
                        this._iosWakeRecoveryMode = false;
                    }, 5000);
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

                // Calculate RTT
                const rtt = this._pingTimestamp ? (Date.now() - this._pingTimestamp) : 0;

                // ==================== RTT FILTERING ====================
                // FILTER 1: Skip if navigating (page load window)
                const skipNavigating = this.isNavigating;

                // FILTER 2: Skip anomalous first measurement (> 4000ms)
                const skipAnomalous = this._rttMeasurements.length === 0 && rtt > this.RTT_THRESHOLD * 2;

                if (!skipNavigating && !skipAnomalous) {
                    // Store measurement
                    this._rttMeasurements.push(rtt);

                    // Keep only last 5 measurements
                    if (this._rttMeasurements.length > this.RTT_WINDOW_SIZE) {
                        this._rttMeasurements.shift();
                    }

                    // Calculate rolling average
                    this._rttRollingAverage = this._rttMeasurements.reduce((a, b) => a + b, 0)
                        / this._rttMeasurements.length;

                    // Warn on slow connection (only if not navigating)
                    if (this._rttRollingAverage > this.RTT_THRESHOLD) {
                        this._log('RTT', 'warn', 'Slow connection detected', {
                            avg_rtt: `${Math.round(this._rttRollingAverage)}ms`,
                            threshold: `${this.RTT_THRESHOLD}ms`
                        });
                    }
                }

                // Log to connection history (always, even if filtered)
                this._logHistory(`pong_received_rtt=${rtt}ms${skipNavigating ? '_nav' : ''}${skipAnomalous ? '_anom' : ''}`);

                debugLog('[BudgetWS] Pong received, RTT:', rtt, 'ms');

                // Layer 4: Clear pong timeout on successful response
                if (this._pongTimeoutTimer) {
                    clearTimeout(this._pongTimeoutTimer);
                    this._pongTimeoutTimer = null;
                }
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
     * Layer 4: Sets pong timeout after each ping
     * @private
     */
    _startClientPing() {
        this._stopClientPing();

        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Record ping timestamp for RTT measurement
                this._pingTimestamp = Date.now();

                this._logHistory('ping_sent');
                this._sendMessage({ type: 'ping' });

                // Layer 4: Set pong timeout
                this._resetPongTimeout();
            }
        }, this.CLIENT_PING_INTERVAL);
    }

    /**
     * Stop client ping interval
     * Layer 4: Clears pong timeout
     * @private
     */
    _stopClientPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        // Layer 4: Clear pong timeout
        if (this._pongTimeoutTimer) {
            clearTimeout(this._pongTimeoutTimer);
            this._pongTimeoutTimer = null;
        }

        // Stop navigation window on disconnect
        this._stopNavigationWindow();
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
                debugLog('[BudgetWS] Long polling gracefully cancelled (AbortController triggered)');
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
            debugLog('[BudgetWS] Gracefully aborting active poll request (prevents nginx 499)');
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
     * Layer 3: Stops health check
     * @private
     */
    _silentClose() {
        debugLog('[BudgetWS] Page unload detected - closing connections gracefully');

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

        // Layer 3: Stop periodic health check
        this._stopHealthCheck();

        // Notify server on disconnect (fetch with keepalive — sendBeacon cannot send credentials)
        if (this.connectionId) {
            const payload = JSON.stringify({ connection_id: this.connectionId });
            debugLog('[BudgetWS] Sending disconnect beacon for:', this.connectionId);

            fetch('/api/v1/budget/ws/disconnect', {
                method: 'POST',
                body: payload,
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                credentials: 'include'
            }).catch(() => {});
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
                this.useLongPolling = false;  // Reset long polling flag
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
        let baseDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);

        // iOS wake recovery mode: increase minimum delay to let network stabilize
        // After code 1005 (TCP killed during sleep), network may not be fully ready
        if (this._iosDeviceMode && this._iosWakeRecoveryMode) {
            baseDelay = Math.max(baseDelay, 3000); // Minimum 3 seconds
            debugLog('[BudgetWS] iOS wake recovery: using minimum 3s delay');
        }

        const jitter = baseDelay * 0.2 * Math.random(); // ±10% jitter
        const delay = Math.min(baseDelay + jitter, this.maxReconnectDelay);

        debugLog('[BudgetWS] Reconnecting in', Math.round(delay), 'ms (attempt', this.reconnectAttempts + 1, ')');

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectAttempts++;
            this._updateStatusIndicator();

            // CRITICAL: Reset long polling flag to allow WebSocket retry
            // Without this, once fallback to long polling occurs, WebSocket is never attempted again
            this.useLongPolling = false;

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
        if (data && data.id && typeof window.Dexie !== 'undefined') {
            try {
                const db = window.Dexie.getDatabase();
                db && db.budgetFacts && db.budgetFacts.where('id').equals(data.id).modify({
                    sync_status: 'deleted',
                    updated_at: new Date()
                }).catch(function() {});
            } catch (e) {}
        }
    }

    _handlePlanCreated(data) {
        this._notifyHandlers('plan_created', data);
        if (typeof window.offlineManager !== 'undefined' && window.offlineManager.refreshUICallback) {
            window.offlineManager.refreshUICallback('plan_created', data);
        }
        if (data && data.id && typeof window.Dexie !== 'undefined') {
            try {
                const db = window.Dexie.getDatabase();
                db && db.recurringPlans && db.recurringPlans.put(
                    Object.assign({}, data, { is_active: data.is_active !== undefined ? data.is_active : true })
                ).catch(function() {});
            } catch (e) {}
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
        if (data && data.id && typeof window.Dexie !== 'undefined') {
            try {
                const db = window.Dexie.getDatabase();
                db && db.recurringPlans && db.recurringPlans.where('id').equals(data.id).delete().catch(function() {});
            } catch (e) {}
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
     * Check if state change is allowed (sticky state enforcement)
     * Prevents rapid badge state transitions by enforcing minimum duration between changes
     * Exception: Allows immediate transition FROM error states TO connected (recovery)
     * @param {string} newState - Proposed new state
     * @returns {boolean} - True if change allowed
     * @private
     */
    _canChangeState(newState) {
        const now = Date.now();
        const timeSinceLastChange = now - this._lastStateChangeTime;

        // Exception 1: Allow immediate transition FROM error/reconnecting states TO connected
        const isRecovery = (
            (this._currentBadgeState === 'error' ||
             this._currentBadgeState === 'limit_reached' ||
             this._currentBadgeState === 'reconnecting') &&
            (newState === 'connected' || newState === 'connected_via_leader')
        );

        if (isRecovery) {
            this._log('STATE', 'info', 'Allowing immediate recovery transition', {
                from: this._currentBadgeState,
                to: newState
            });
            return true;
        }

        // Exception 2: First state change (no previous state)
        if (!this._currentBadgeState) {
            return true;
        }

        // Enforce sticky state duration
        if (timeSinceLastChange < this.STICKY_STATE_DURATION) {
            this._log('STATE', 'debug', 'State change blocked by sticky state', {
                current_state: this._currentBadgeState,
                proposed_state: newState,
                time_since_last: `${timeSinceLastChange}ms`,
                required: `${this.STICKY_STATE_DURATION}ms`
            });
            return false;
        }

        return true;
    }

    /**
     * Record state change timestamp and update current badge state
     * @param {string} newState - New badge state
     * @private
     */
    _recordStateChange(newState) {
        const oldState = this._currentBadgeState;
        this._currentBadgeState = newState;
        this._lastStateChangeTime = Date.now();

        this._log('STATE', 'info', 'Badge state changed', {
            from: oldState || 'none',
            to: newState,
            timestamp: this._lastStateChangeTime
        });
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

        // STEP 1: Determine current state (priority order)
        let state;

        if (!this.enabled) {
            state = 'disabled';
        }
        // PRIORITY 1: Error states (highest priority)
        else if (this.limitReached) {
            state = 'limit_reached';
        }
        else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            state = 'error';
        }
        // PRIORITY 2: Connected states with warnings
        else if (this.isConnected) {
            // Check slow connection (RTT-based) - don't show during navigation window
            const isSlowConnection = !this.isNavigating && this._rttRollingAverage > this.RTT_THRESHOLD;

            // Check many tabs (connection pressure)
            const isManyTabs = this.approachingLimit;  // >= 0.7

            if (isSlowConnection) {
                state = 'warning_slow';
            } else if (isManyTabs) {
                state = 'warning_tabs';
            } else {
                state = 'connected';
            }
        }
        // PRIORITY 3: Multi-tab follower
        else if (!this.isLeader && this._supportsMultiTab() && this.lastLeaderHeartbeat > 0) {
            state = 'connected_via_leader';
        }
        // PRIORITY 4: Reconnecting
        else if (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
            state = 'reconnecting';
        }
        // PRIORITY 5: Connecting (initial)
        else {
            state = 'connecting';
        }

        // STEP 2: Check if state same as before
        if (state === this._lastIndicatorState) {
            return;
        }

        // STEP 3: Sticky state check (with exceptions for recovery)
        if (!this._canChangeState(state)) {
            return;  // State change blocked
        }

        // STEP 4: Apply debouncing
        const isConnectedState = state === 'connected' || state === 'connected_via_leader';

        if (this._iosDeviceMode) {
            // iOS: debounce ALL states if timer active
            if (this._indicatorDebounceTimer) {
                return;
            }
        } else {
            // Non-iOS: allow connected states immediately
            if (!isConnectedState && this._indicatorDebounceTimer) {
                return;
            }
        }

        // STEP 5: Record state change (before applying visual update)
        this._recordStateChange(state);
        this._lastIndicatorState = state;

        // STEP 6: Clear pending debounce timer
        if (this._indicatorDebounceTimer) {
            clearTimeout(this._indicatorDebounceTimer);
            this._indicatorDebounceTimer = null;
        }

        // STEP 7: Apply visual update
        this._applyIndicatorState(indicator, state);

        // STEP 8: Set debounce timer for next update (ENHANCED: 2s on iOS)
        const shouldDebounce = this._iosDeviceMode || !isConnectedState;
        if (shouldDebounce) {
            const debounceMs = this._iosDeviceMode ? 2000 : this.INDICATOR_DEBOUNCE_MS;
            this._indicatorDebounceTimer = setTimeout(() => {
                this._indicatorDebounceTimer = null;
            }, debounceMs);
        }
    }

    /**
     * Apply visual state to indicator element
     * @param {HTMLElement} indicator
     * @param {string} state - One of: disabled, warning_slow, warning_tabs, connected, connected_via_leader,
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

            // NEW: Slow connection warning
            case 'warning_slow':
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '&#128012;';  // 🐌 Snail emoji
                indicator.title = `Slow connection detected (${Math.round(this._rttRollingAverage)}ms RTT)`;
                break;

            // NEW: Many tabs warning
            case 'warning_tabs':
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '&#9888;&#65039;';  // ⚠️ Warning triangle
                indicator.title = 'Many connections. Close unused tabs';
                break;

            case 'connected':
                indicator.className = `badge badge-success ${sizeClasses}`;
                indicator.innerHTML = '&#128994;';  // 💚 Green circle
                indicator.title = 'Real-time sync active' + (this.useLongPolling ? ' (polling)' : '');
                break;

            case 'connected_via_leader':
                indicator.className = `badge badge-success ${sizeClasses}`;
                indicator.innerHTML = '&#128994;';  // 💚 Green circle
                indicator.title = 'Sync via another tab';
                break;

            case 'limit_reached':
                indicator.className = `badge badge-error ${sizeClasses}`;
                indicator.innerHTML = '&#128308;';  // 🔴 Red circle
                indicator.title = 'Connection limit reached. Close other tabs';
                break;

            case 'reconnecting':
                indicator.className = `badge badge-warning ${sizeClasses}`;
                indicator.innerHTML = '<span class="loading loading-ring loading-xs sm:loading-sm"></span>';
                indicator.title = `Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})`;
                break;

            case 'error':
                indicator.className = `badge badge-error ${sizeClasses}`;
                indicator.innerHTML = '&#128308;';  // 🔴 Red circle
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
            history: this._connectionHistory.slice(-10),

            // RTT measurement
            rtt: {
                current: this._pingTimestamp
                    ? `${Date.now() - this._pingTimestamp}ms`
                    : 'no ping sent',
                rolling_average: `${Math.round(this._rttRollingAverage)}ms`,
                measurements: this._rttMeasurements,
                threshold: `${this.RTT_THRESHOLD}ms`,
                slow_connection: this._rttRollingAverage > this.RTT_THRESHOLD
            },

            // Badge state management
            state: {
                current: this._currentBadgeState,
                last_change: this._lastStateChangeTime
                    ? new Date(this._lastStateChangeTime).toISOString()
                    : null,
                sticky_duration: `${this.STICKY_STATE_DURATION}ms`
            },

            // Navigation detection
            navigation: {
                is_navigating: this.isNavigating,
                window_duration: `${this.NAVIGATION_WINDOW}ms`,
                timer_active: this._navigationTimer !== null
            }
        };

        return diag;
    }

    /**
     * Show visual diagnostic modal (for iOS Safari debugging)
     * Tap status indicator 3 times quickly to trigger
     */
    showDiagnostics() {
        logWSDiag.info('Opening diagnostic modal');

        const diag = this.diagnose();

        // Log full diagnostic data to console for debugging
        logWSDiag.groupCollapsed('WebSocket Diagnostic Data');
        logWSDiag.table(diag);
        logWSDiag.groupEnd();

        // Build HTML content for modal (structured sections)
        const sections = [
            {
                title: 'Connection Status',
                items: [
                    { label: 'Connected', value: diag.isConnected, highlight: !diag.isConnected },
                    { label: 'Enabled', value: diag.enabled },
                    { label: 'WS State', value: diag.wsState },
                    { label: 'Long Polling', value: diag.useLongPolling, highlight: diag.useLongPolling },
                    { label: 'Polling Active', value: diag.pollingActive }
                ]
            },
            {
                title: 'Browser Detection',
                items: [
                    { label: 'Safari iOS Mode', value: diag.safariIOSMode, highlight: diag.safariIOSMode },
                    { label: 'Needs Longer Timeout', value: diag.needsLongerTimeout }
                ]
            },
            {
                title: 'Multi-Tab Coordination',
                items: [
                    { label: 'Leader', value: diag.isLeader, highlight: diag.isLeader },
                    { label: 'MultiTab Initialized', value: diag.multiTabInitialized },
                    { label: 'MultiTab Supported', value: diag.multiTabSupported },
                    { label: 'Has Channel', value: diag.hasChannel },
                    { label: 'Last Leader Heartbeat', value: diag.lastLeaderHeartbeat || 'none' }
                ]
            },
            {
                title: 'Reconnection State',
                items: [
                    { label: 'Reconnect Attempts', value: `${diag.reconnectAttempts} / ${diag.maxReconnectAttempts}`, highlight: diag.reconnectAttempts > 0 },
                    { label: 'Limit Reached', value: diag.limitReached, highlight: diag.limitReached },
                    { label: 'Approaching Limit', value: diag.approachingLimit, highlight: diag.approachingLimit }
                ]
            },
            {
                title: 'Error Tracking',
                items: [
                    { label: 'Last Error', value: diag.lastError ? diag.lastError.message : 'none', highlight: !!diag.lastError }
                ]
            },
            {
                title: 'RTT Metrics',
                items: [
                    { label: 'Rolling Avg RTT', value: diag.rtt.rolling_average, highlight: diag.rtt.slow_connection },
                    { label: 'Measurements', value: diag.rtt.measurements.length },
                    { label: 'Threshold', value: diag.rtt.threshold },
                    { label: 'Slow Connection', value: diag.rtt.slow_connection, highlight: diag.rtt.slow_connection }
                ]
            },
            {
                title: 'State Management',
                items: [
                    { label: 'Current State', value: diag.state.current || 'none' },
                    { label: 'Last Change', value: diag.state.last_change || 'never' },
                    { label: 'Sticky Duration', value: diag.state.sticky_duration }
                ]
            }
        ];

        // Build HTML
        let contentHTML = '';

        sections.forEach(section => {
            contentHTML += `<div class="border-l-4 border-primary pl-3">`;
            contentHTML += `<h4 class="font-bold text-base mb-2">${section.title}</h4>`;
            contentHTML += `<dl class="space-y-1">`;

            section.items.forEach(item => {
                const valueClass = item.highlight ? 'text-warning font-bold' : 'text-base-content/70';
                contentHTML += `<div class="flex justify-between gap-4">`;
                contentHTML += `<dt class="font-semibold">${item.label}:</dt>`;
                contentHTML += `<dd class="${valueClass}">${item.value}</dd>`;
                contentHTML += `</div>`;
            });

            contentHTML += `</dl></div>`;
        });

        // Add connection history
        if (diag.history && diag.history.length > 0) {
            contentHTML += `<div class="border-l-4 border-secondary pl-3">`;
            contentHTML += `<h4 class="font-bold text-base mb-2">Connection History (last ${diag.history.length})</h4>`;
            contentHTML += `<ul class="space-y-1 text-xs">`;

            diag.history.slice(-10).forEach(h => {
                const time = new Date(h.time).toLocaleTimeString();
                contentHTML += `<li><span class="text-base-content/50">${time}:</span> ${h.event}</li>`;
            });

            contentHTML += `</ul></div>`;
        }

        // Add user agent
        contentHTML += `<div class="border-l-4 border-accent pl-3">`;
        contentHTML += `<h4 class="font-bold text-base mb-2">Browser Info</h4>`;
        contentHTML += `<p class="text-xs break-all text-base-content/70">${diag.userAgent}</p>`;
        contentHTML += `</div>`;

        // Update modal content
        const contentElement = document.getElementById('ws-diagnostics-content');
        if (!contentElement) {
            logWSDiag.error('Modal content element not found (#ws-diagnostics-content)');
            // Fallback to alert if modal not available
            const lines = [
                `Connected: ${diag.isConnected}`,
                `Enabled: ${diag.enabled}`,
                `WS State: ${diag.wsState}`,
                `Long Polling: ${diag.useLongPolling}`,
                `Safari iOS: ${diag.safariIOSMode}`,
                `Leader: ${diag.isLeader}`,
                `Reconnects: ${diag.reconnectAttempts}`,
                `Last Error: ${diag.lastError ? diag.lastError.message : 'none'}`
            ];
            alert('[BudgetWS Diagnostics]\n\n' + lines.join('\n'));
            return;
        }

        contentElement.innerHTML = contentHTML;

        // Show modal
        const modal = document.getElementById('ws-diagnostics-modal');
        if (modal) {
            modal.showModal();
            logWSDiag.info('Diagnostic modal opened');
        } else {
            logWSDiag.error('Modal element not found (#ws-diagnostics-modal)');
        }
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

    // Auto-connect after initialization (v11.4.1)
    // Delayed to allow page to fully load and offlineManager to initialize
    setTimeout(() => {
        if (window.budgetWSClient && window.budgetWSClient.enabled) {
            window.budgetWSClient.connect();
        }
    }, 1000);

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

    // Admin sync helper — triggers full reference data re-sync after CRUD operations
    if (!window.BudgetSync) window.BudgetSync = {};
    window.BudgetSync.triggerEntitySync = function(entityType) {
        if (typeof window.Dexie === 'undefined') return;
        window.Dexie.getDexieManager().then(function(dexie) {
            return dexie.syncReferenceData();
        }).catch(function(err) {
            console.warn('[BudgetSync] Re-sync failed for', entityType, err);
        });
    };

}

// Debug log helper
if (typeof debugLog === 'undefined') {
    window.debugLog = function() {};
}
