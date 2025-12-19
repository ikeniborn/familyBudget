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

        // Safari iOS specific: always use fetch-based SSE (EventSource has buffering issues)
        // Also skip Web Locks on Safari iOS - too unreliable
        this._safariIOSMode = this._detectSafariIOS();

        // DEBUG: Log Safari iOS detection result
        console.log('[BudgetSSE] Safari iOS mode:', this._safariIOSMode, 'UA:', navigator.userAgent.substring(0, 100));

        // Flag for limit reached state
        this.limitReached = false;

        // Connection ID for active disconnect notification (sendBeacon)
        this.connectionId = null;

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

        // Connection state tracking (for staleness detection)
        this.lastServerPing = 0;
        this.PING_TIMEOUT = 45000;  // Server pings every 10s, allow 45s before considering dead
        this.approachingLimit = false;  // Track if approaching connection limit

        // Close connection on page unload
        window.addEventListener('beforeunload', () => {
            this._silentClose();
        });

        window.addEventListener('pagehide', (event) => {
            // Only close if not persisted (not going to bfcache)
            if (!event.persisted) {
                this._silentClose();
            }
        });

        // Visibility change handler - updated for multi-tab with connection reuse
        // iOS 18 bug: EventSource error event doesn't fire after background
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                // Leader: keep connection alive, continue heartbeat
                // Follower: nothing to close (no connection)
                if (this.isLeader) {
                    debugLog('[BudgetSSE] Tab hidden, leader keeping SSE connection active');
                }
            } else if (document.visibilityState === 'visible') {
                console.log('[BudgetSSE] Tab became visible, checking connection health');

                // iOS 18 bug workaround: error event doesn't fire after background
                // Force health check for Safari/iOS devices
                if (this._safariIOSMode || this._needsLongerTimeout()) {
                    this._checkConnectionHealth();
                    return;
                }

                if (this.isLeader) {
                    // Check for stale connection (no ping received in 45s)
                    if (this._isConnectionStale()) {
                        debugLog('[BudgetSSE] Connection stale, forcing reconnect');
                        this._forceReconnect();
                        return;
                    }

                    // Check if EventSource is still alive (connection reuse)
                    if (this.eventSource && this.eventSource.readyState === EventSource.OPEN) {
                        this.isConnected = true;
                        this._updateStatusIndicator();
                        return;
                    }

                    // Check fetch-based SSE connection
                    if (this.fetchController && this.isConnected) {
                        // Fetch connection might still be alive
                        this._updateStatusIndicator();
                        return;
                    }

                    // Connection dead, need reconnect
                    if (!this.isConnected && this.enabled) {
                        debugLog('[BudgetSSE] Tab visible, leader reconnecting');
                        this._forceReconnect();
                    }
                }
                // Follower: request status from leader
                if (!this.isLeader && this.channel) {
                    this._broadcastMessage({ type: 'status_request' });
                }
            }
        });

        // Multi-tab initialization is now lazy - triggered by connect()
        // This prevents 401 errors for unauthenticated users
    }

    /**
     * Check if multi-tab sharing is supported (BroadcastChannel + Web Locks)
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
     * Detect browsers that need longer Web Locks timeout
     * Safari (iOS/macOS) and Yandex Browser have known issues with Web Locks timing
     * @returns {boolean}
     * @private
     */
    _needsLongerTimeout() {
        const ua = navigator.userAgent;
        // Safari: contains Safari but not Chrome
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
        // Yandex Browser: contains YaBrowser
        const isYandex = /YaBrowser/.test(ua);
        return isSafari || isYandex;
    }

    /**
     * Detect Safari browser (iOS and macOS) - legacy, use _needsLongerTimeout()
     * @returns {boolean}
     * @private
     */
    _isSafari() {
        const ua = navigator.userAgent;
        const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua) && !/Chromium/.test(ua);
        return isSafari;
    }

    /**
     * Detect Safari on iOS devices specifically
     * @returns {boolean}
     * @private
     */
    _isSafariIOS() {
        const ua = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) &&
               !window.MSStream &&
               /Safari/.test(ua);
    }

    /**
     * Detect Safari on iOS/iPadOS with comprehensive checks
     * Used for enabling Safari iOS specific mode (fetch-only SSE, no Web Locks)
     *
     * Safari iOS/iPadOS has multiple known issues:
     * 1. EventSource buffers responses until ~2KB (onopen never fires for small responses)
     * 2. Web Locks API is unreliable and slow
     * 3. Cookies with withCredentials can be problematic
     * 4. iOS 18+ has EventSource error event regression (doesn't fire after background)
     *
     * IMPORTANT: iPadOS in Desktop Mode masquerades as macOS Safari in User-Agent!
     * Detection via maxTouchPoints is required.
     *
     * @returns {boolean}
     * @private
     */
    _detectSafariIOS() {
        const ua = navigator.userAgent;

        // Standard iOS detection (iPhone, iPad in mobile mode, iPod)
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

        // iPadOS Desktop Mode detection
        // In Desktop Mode, iPadOS presents as macOS Safari (no "iPad" in UA)
        // But navigator.platform='MacIntel' with maxTouchPoints > 1 reveals it's a touch device
        const isPadOSDesktop = navigator.platform === 'MacIntel' &&
                               navigator.maxTouchPoints > 1;

        // Safari-like browser (not Chrome, Firefox, Edge on iOS)
        // On iOS, all browsers use WebKit, but we want Safari-specific behavior
        const isSafariLike = /Safari/.test(ua) &&
                            !/Chrome/.test(ua) &&
                            !/CriOS/.test(ua) &&
                            !/FxiOS/.test(ua) &&
                            !/EdgiOS/.test(ua);

        // Detect problematic Safari versions (17+ have known SSE issues)
        const safariVersion = ua.match(/Version\/(\d+)/);
        const isProblematicSafari = safariVersion && parseInt(safariVersion[1]) >= 17;

        // Safari iOS/iPadOS mode: any iOS/iPadOS device with Safari-like browser
        const isSafariIOS = (isIOS || isPadOSDesktop) && isSafariLike;

        // Detailed logging for debugging
        console.log('[BudgetSSE] Safari iOS detection:', {
            isIOS,
            isPadOSDesktop,
            isSafariLike,
            isProblematicSafari,
            result: isSafariIOS,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints,
            userAgent: ua.substring(0, 100)
        });

        if (isSafariIOS) {
            debugLog('[BudgetSSE] Safari iOS/iPadOS detected, using optimized connection strategy');
        }

        return isSafariIOS;
    }

    /**
     * Check if connection is stale (no ping received in PING_TIMEOUT)
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
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        if (this.fetchController) {
            this.fetchController.abort();
            this.fetchController = null;
        }
        this.isConnected = false;
        this.connectionId = null;
    }

    /**
     * Check connection health by calling status endpoint
     * Used for iOS 18 bug workaround where error event doesn't fire after background
     * @private
     */
    _checkConnectionHealth() {
        if (!this.enabled) return;

        console.log('[BudgetSSE] Checking connection health...');

        // First check: connection staleness (no ping in 45s)
        if (this._isConnectionStale()) {
            console.log('[BudgetSSE] Connection stale (no ping in 45s), reconnecting');
            this._forceReconnect();
            return;
        }

        // For Safari iOS with fetch-based SSE, verify server is reachable
        fetch('/api/v1/budget/events/status', {
            credentials: 'include',
            signal: AbortSignal.timeout(5000)  // 5s timeout
        })
            .then(r => {
                if (!r.ok) {
                    console.log('[BudgetSSE] Health check failed (HTTP', r.status, '), reconnecting');
                    this._forceReconnect();
                } else {
                    console.log('[BudgetSSE] Health check OK');
                    // If we think we're connected but actually not, reconnect
                    if (!this.isConnected && this.enabled) {
                        console.log('[BudgetSSE] Not connected despite health OK, reconnecting');
                        this._forceReconnect();
                    }
                }
            })
            .catch((e) => {
                console.log('[BudgetSSE] Health check error:', e.message, ', reconnecting');
                this._forceReconnect();
            });
    }

    /**
     * Force reconnection by closing existing connection and starting fresh
     * Resets all connection state including multi-tab initialization
     * @private
     */
    _forceReconnect() {
        console.log('[BudgetSSE] Force reconnecting...');

        // Close existing connection
        this._closeExistingConnection();

        // Reset connection state
        this.reconnectAttempts = 0;
        this.limitReached = false;

        // Reset multi-tab state to allow fresh leader election
        // This is important for Safari/iOS where Web Locks may have failed
        this._multiTabInitialized = false;

        // Reconnect
        this.connect();
    }

    /**
     * Initialize multi-tab support with BroadcastChannel and Web Locks
     * Called lazily from connect() to prevent 401 errors for unauthenticated users
     * Now waits for leader status to be determined before returning
     *
     * IMPORTANT: Safari iOS has a special code path that skips Web Locks entirely
     * due to unreliable behavior. On Safari iOS, each tab creates its own connection.
     *
     * SAFETY: Added 5-second safety timeout to prevent Web Locks from hanging forever.
     * This ensures connection is established even if Web Locks API misbehaves.
     *
     * @private
     */
    async _initMultiTab() {
        // Prevent double initialization
        if (this._multiTabInitialized) {
            return;
        }
        this._multiTabInitialized = true;

        // Safari iOS: Skip Web Locks entirely - they're unreliable
        // Each tab will create its own connection (no multi-tab sharing)
        if (this._safariIOSMode) {
            console.log('[BudgetSSE] Safari iOS: Skipping Web Locks, using per-tab connection');
            this.isLeader = true;  // Always "leader" - each tab manages itself
            this._multiTabSupported = false;  // Disable multi-tab for Safari iOS
            return;
        }

        if (!this._supportsMultiTab()) {
            debugLog('[BudgetSSE] Multi-tab not supported, using per-tab connection');
            // Fallback: work like before (per-tab connection)
            return;
        }

        // Safety timeout: if leader election takes too long, force direct connection
        // This prevents Web Locks from hanging forever on problematic browsers
        let safetyTimeoutFired = false;
        const safetyTimeout = setTimeout(() => {
            safetyTimeoutFired = true;
            if (!this.isLeader && !this.isConnected) {
                console.warn('[BudgetSSE] Safety timeout (5s): forcing leader status and connection');
                this.isLeader = true;
                this._multiTabSupported = false; // Disable multi-tab as fallback
                if (this.enabled) {
                    this._createConnection();
                }
            }
        }, 5000); // 5 second safety net

        try {
            // Create BroadcastChannel for inter-tab communication
            this.channel = new BroadcastChannel('budget-sse-channel');
            this.channel.onmessage = (e) => this._handleChannelMessage(e.data);
            this.channel.onerror = () => {
                debugLog('[BudgetSSE] BroadcastChannel error, falling back to per-tab');
                this._multiTabSupported = false;
                this.channel = null;
            };

            // Check connection limit before deciding strategy
            const status = await this._checkConnectionLimit();

            // Calculate connection pressure (default to 0 if status check failed)
            let connectionPressure = 0;
            if (status.limits && status.limits.max_per_user > 0) {
                connectionPressure = (status.user_connections || 0) / status.limits.max_per_user;
                // Track if approaching limit (for UI warning)
                this.approachingLimit = connectionPressure >= 0.7;  // 70% of max
            }

            // If safety timeout already fired, skip leader election
            if (safetyTimeoutFired) {
                console.log('[BudgetSSE] Safety timeout already fired, skipping leader election');
                return;
            }

            // Choose leader election strategy based on browser and connection pressure
            // Safari (macOS) and Yandex Browser have known issues with Web Locks timing
            if (this._needsLongerTimeout()) {
                if (connectionPressure >= 0.5) {
                    // High connection pressure - use longer timeout
                    debugLog('[BudgetSSE] Problematic browser with high pressure, using 2000ms timeout');
                    await this._tryBecomeLeaderWithTimeout(2000);
                } else {
                    // Normal connection pressure - use medium timeout
                    debugLog('[BudgetSSE] Problematic browser detected, using 500ms timeout');
                    await this._tryBecomeLeaderWithTimeout(500);
                }
            } else {
                // Standard browsers (Chrome, Firefox, Edge) - fast handling
                await this._tryBecomeLeader();
            }
        } catch (e) {
            debugLog('[BudgetSSE] Multi-tab init failed:', e);
            this._multiTabSupported = false;
        } finally {
            // Clear safety timeout if we completed normally
            clearTimeout(safetyTimeout);
        }
    }

    /**
     * Try to acquire leader lock using Web Locks API (non-Safari browsers)
     * Returns a Promise that resolves when leader status is determined
     * Uses 100ms timeout for fast response on Chrome/Firefox/Edge
     * If timeout occurs, checks for leader heartbeat before becoming follower
     * @private
     * @returns {Promise<void>}
     */
    async _tryBecomeLeader() {
        return new Promise((resolve) => {
            let resolved = false;

            // Short timeout for non-Safari - Web Locks should be fast
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Lock not acquired in 100ms
                    // Check if any leader heartbeat received (another tab is leader)
                    if (Date.now() - this.lastLeaderHeartbeat < 5000) {
                        // Leader exists, stay as follower
                        debugLog('[BudgetSSE] Timeout, leader detected via heartbeat, starting as follower');
                        this._startFollowerMode();
                    } else {
                        // No leader detected - this is the first tab, become leader
                        debugLog('[BudgetSSE] Timeout, no leader detected, becoming leader');
                        this.isLeader = true;
                        // CRITICAL: Start heartbeat and notify other tabs
                        this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                        this._startLeaderHeartbeat();
                    }
                    resolve();
                }
            }, 100);  // 100ms timeout for non-Safari

            navigator.locks.request('budget-sse-leader', async (lock) => {
                if (!resolved) {
                    // Lock acquired before timeout
                    resolved = true;
                    clearTimeout(timeout);
                    this.isLeader = true;
                    if (this._followerCheckInterval) {
                        clearInterval(this._followerCheckInterval);
                        this._followerCheckInterval = null;
                    }
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    debugLog('[BudgetSSE] Acquired Web Lock, became leader');
                } else if (!this.isLeader) {
                    // Lock acquired AFTER timeout, but we're follower
                    // Previous leader died - promote to leader now
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
                    debugLog('[BudgetSSE] Promoted to leader after timeout');
                }
                resolve();
                return new Promise(() => {});  // Hold lock forever
            });
        });
    }

    /**
     * Try to acquire leader lock with configurable timeout (for Safari browsers)
     * Safari (iOS and macOS) has known issues with Web Locks API timing
     * Uses longer timeout and heartbeat detection to handle slow Web Locks
     * @param {number} timeoutMs - Timeout in milliseconds (500ms normal, 2000ms high pressure)
     * @private
     * @returns {Promise<void>}
     */
    async _tryBecomeLeaderWithTimeout(timeoutMs) {
        return new Promise((resolve) => {
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    // Timeout reached without acquiring lock
                    // Check if any leader heartbeat received
                    if (Date.now() - this.lastLeaderHeartbeat < 5000) {
                        // Leader exists, stay as follower
                        debugLog('[BudgetSSE] Timeout: Leader detected via heartbeat, staying follower');
                        this._startFollowerMode();
                    } else {
                        // No leader detected, become leader
                        debugLog('[BudgetSSE] Timeout: No leader detected, becoming leader');
                        this.isLeader = true;
                        // CRITICAL: Start heartbeat and notify other tabs
                        this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                        this._startLeaderHeartbeat();
                    }
                    resolve();
                }
            }, timeoutMs);

            navigator.locks.request('budget-sse-leader', async (lock) => {
                if (!resolved) {
                    // Lock acquired before timeout - normal flow
                    resolved = true;
                    clearTimeout(timeout);
                    this.isLeader = true;
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    debugLog('[BudgetSSE] Acquired Web Lock, became leader');
                } else if (!this.isLeader) {
                    // CRITICAL FIX: Lock acquired AFTER timeout, but we're follower
                    // Previous leader died - promote to leader now
                    this.isLeader = true;
                    if (this._followerCheckInterval) {
                        clearInterval(this._followerCheckInterval);
                        this._followerCheckInterval = null;
                    }
                    this._broadcastMessage({ type: 'leader_changed', timestamp: Date.now() });
                    this._startLeaderHeartbeat();
                    if (this.enabled && !this.isConnected) {
                        this._createConnection();  // Must create connection here!
                    }
                    debugLog('[BudgetSSE] Promoted to leader after timeout');
                }
                // If isLeader was already true from timeout (no leader detected case),
                // we now also hold the lock - good state
                resolve();
                return new Promise(() => {});  // Hold lock forever
            });
        });
    }

    /**
     * Start follower mode - listen for events from leader via BroadcastChannel
     * @private
     */
    _startFollowerMode() {
        // Follower listens for events from leader via BroadcastChannel
        // and tracks heartbeat to detect leader death
        this.lastLeaderHeartbeat = Date.now();

        // Check heartbeat every 5 seconds
        this._followerCheckInterval = setInterval(() => {
            if (this.isLeader) {
                // We became leader, stop checking
                clearInterval(this._followerCheckInterval);
                this._followerCheckInterval = null;
                return;
            }

            const timeSinceHeartbeat = Date.now() - this.lastLeaderHeartbeat;
            if (timeSinceHeartbeat > this.LEADER_TIMEOUT) {
                debugLog('[BudgetSSE] Leader heartbeat timeout, may become leader soon');
                // Web Locks will automatically transfer lock to next in queue
            }
        }, 5000);
    }

    /**
     * Start leader heartbeat to notify followers we're alive
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

        // Send initial heartbeat
        this._broadcastMessage({
            type: 'heartbeat',
            timestamp: Date.now(),
            isConnected: this.isConnected
        });
    }

    /**
     * Broadcast message to other tabs via BroadcastChannel
     * @param {Object} message - Message to broadcast
     * @private
     */
    _broadcastMessage(message) {
        if (this.channel) {
            try {
                this.channel.postMessage(message);
            } catch (e) {
                debugLog('[BudgetSSE] Broadcast failed:', e);
            }
        }
    }

    /**
     * Handle message from BroadcastChannel
     * @param {Object} data - Message data
     * @private
     */
    _handleChannelMessage(data) {
        switch (data.type) {
            case 'heartbeat':
                this.lastLeaderHeartbeat = data.timestamp;
                // Update connection status indicator based on leader's status
                if (!this.isLeader) {
                    this.isConnected = data.isConnected;
                    this._updateStatusIndicator();
                }
                break;

            case 'sse_event':
                // Received SSE event from leader - process as usual
                if (!this.isLeader) {
                    this._dispatchReceivedEvent(data.event, data.data);
                }
                break;

            case 'leader_changed':
                // New leader - reset heartbeat timer
                this.lastLeaderHeartbeat = data.timestamp;
                debugLog('[BudgetSSE] Leader changed, resetting heartbeat');
                break;

            case 'status_request':
                // Follower requested status - respond if we're leader
                if (this.isLeader) {
                    this._broadcastMessage({
                        type: 'status_response',
                        isConnected: this.isConnected,
                        connectionId: this.connectionId
                    });
                }
                break;

            case 'status_response':
                // Got status from leader
                if (!this.isLeader) {
                    this.isConnected = data.isConnected;
                    this._updateStatusIndicator();
                }
                break;
        }
    }

    /**
     * Dispatch received event from BroadcastChannel (for followers)
     * @param {string} eventType - Event type
     * @param {Object} eventData - Event data
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
     * Broadcast SSE event to followers (called by leader when receiving SSE event)
     * @param {string} eventType - Event type
     * @param {Object} eventData - Event data
     * @private
     */
    _broadcastSSEEvent(eventType, eventData) {
        if (this.isLeader && this.channel) {
            this._broadcastMessage({
                type: 'sse_event',
                event: eventType,
                data: eventData
            });
        }
    }

    /**
     * Check connection limit before attempting to connect
     * @returns {Promise<{canConnect: boolean, user_connections?: number, limits?: object}>}
     * @private
     */
    async _checkConnectionLimit() {
        try {
            console.log('[BudgetSSE] _checkConnectionLimit: fetching /api/v1/budget/events/status');
            const response = await fetch('/api/v1/budget/events/status', {
                credentials: 'include'
            });
            console.log('[BudgetSSE] _checkConnectionLimit: response status', response.status);
            if (!response.ok) {
                console.log('[BudgetSSE] Status check failed, allowing connection');
                return { canConnect: true };
            }
            const data = await response.json();
            console.log('[BudgetSSE] _checkConnectionLimit: data', data);
            const canConnect = data.user_connections < data.limits.max_per_user;
            return { canConnect, ...data };
        } catch (e) {
            console.log('[BudgetSSE] Status check error, allowing connection:', e);
            return { canConnect: true };
        }
    }

    /**
     * Connect to SSE endpoint
     * Global connection for all budget events (shared family budget model)
     *
     * With multi-tab support:
     * - If multi-tab is supported, only the leader tab creates a connection
     * - Followers receive events via BroadcastChannel
     * - If multi-tab is not supported, each tab creates its own connection (fallback)
     *
     * IMPORTANT: This method is async because it waits for leader election to complete
     * before deciding whether to create a connection (fixes Safari iOS race condition)
     */
    async connect() {
        console.log('[BudgetSSE] connect() called, enabled:', this.enabled, 'safariIOSMode:', this._safariIOSMode);

        // Guard: SSE disabled (applies to all browsers)
        if (!this.enabled) {
            console.log('[BudgetSSE] SSE disabled');
            return;
        }

        // Safari iOS: SIMPLIFIED PATH - BEFORE other guards
        // Uses same logic as offline→online handler which works reliably
        // Only checks !enabled; lets _createConnection() handle duplicate prevention
        // This mirrors the working offline→online path exactly
        if (this._safariIOSMode) {
            console.log('[BudgetSSE] Safari iOS: Using simplified direct connection (bypassing guards)');
            this.reconnectAttempts = 0;
            this._createConnection();
            return;
        }

        // Other browsers: full guards
        // Guard: already connected
        if (this.isConnected) {
            console.log('[BudgetSSE] Already connected');
            return;
        }

        // Guard: connection in progress (fetchController or eventSource exists)
        if (this.fetchController || this.eventSource) {
            console.log('[BudgetSSE] Connection already in progress');
            return;
        }

        // Other browsers: full multi-tab support
        // Lazy init multi-tab support (only on first connect)
        if (!this._multiTabInitialized) {
            console.log('[BudgetSSE] Initializing multi-tab support...');
            await this._initMultiTab();
            console.log('[BudgetSSE] Multi-tab init done, isLeader:', this.isLeader, 'multiTabSupported:', this._supportsMultiTab());
        }

        // If multi-tab is supported, only leader creates connection
        if (this._supportsMultiTab()) {
            if (this.isLeader) {
                console.log('[BudgetSSE] Leader connecting');
                this._createConnection();
            } else {
                console.log('[BudgetSSE] Follower - waiting for events from leader');
                this._updateStatusIndicator();
            }
            return;
        }

        // Fallback: per-tab connection (multi-tab not supported)
        console.log('[BudgetSSE] Per-tab connection (no multi-tab), calling _createConnection');
        this._createConnection();
    }

    /**
     * Create EventSource connection with Safari iOS fallback
     * Validates existing connection before creating new one (connection reuse)
     *
     * Safari iOS: Uses fetch-based SSE directly (EventSource has buffering issues)
     *
     * @private
     */
    async _createConnection() {
        console.log('[BudgetSSE] _createConnection called, enabled:', this.enabled, 'safariIOSMode:', this._safariIOSMode);

        if (!this.enabled) {
            console.log('[BudgetSSE] _createConnection: SSE disabled, returning');
            return;
        }

        // Check if existing EventSource is still valid (connection reuse)
        if (this.eventSource) {
            if (this.eventSource.readyState === EventSource.OPEN) {
                // Connection still alive, just ensure state is correct
                debugLog('[BudgetSSE] Existing connection still alive, reusing');
                this.isConnected = true;
                this._updateStatusIndicator();
                return;
            }
            // Connection is CONNECTING or CLOSED - close it properly before creating new
            debugLog('[BudgetSSE] Closing stale EventSource before reconnect');
            this.eventSource.close();
            this.eventSource = null;
        }

        // Also cleanup any stale fetch controller
        if (this.fetchController) {
            this.fetchController.abort();
            this.fetchController = null;
        }

        // Precheck connection limit before attempting connection
        console.log('[BudgetSSE] Checking connection limit...');
        const { canConnect, user_connections, limits } = await this._checkConnectionLimit();
        console.log('[BudgetSSE] Connection limit check result:', { canConnect, user_connections, limits });

        if (!canConnect) {
            console.log('[BudgetSSE] Connection limit reached, stopping');
            this.limitReached = true;
            this.reconnectAttempts = this.maxReconnectAttempts;  // Stop reconnect loop
            this._updateStatusIndicator();
            this._notifyHandlers('limit_reached', { user_connections, limits });
            return;
        }

        this.limitReached = false;
        const url = '/api/v1/budget/events';
        console.log('[BudgetSSE] Connecting to:', url);

        // Safari iOS: Use fetch-based SSE directly (EventSource has buffering issues)
        // EventSource on Safari iOS buffers responses until ~2KB, so onopen never fires
        if (this._safariIOSMode) {
            console.log('[BudgetSSE] Safari iOS: Using fetch-based SSE (EventSource has buffering issues)');
            this._useFetchEventSource();
            return;
        }

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
                // Save connection_id for active disconnect notification
                if (data.connection_id) {
                    this.connectionId = data.connection_id;
                    debugLog('[BudgetSSE] Connection ID:', this.connectionId);
                }
                this._notifyHandlers('connected', data);
            });

            // Fact events
            this.eventSource.addEventListener('fact_created', (event) => {
                debugLog('[BudgetSSE] Fact created:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactCreated(data);
                this._broadcastSSEEvent('fact_created', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('fact_updated', (event) => {
                debugLog('[BudgetSSE] Fact updated:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactUpdated(data);
                this._broadcastSSEEvent('fact_updated', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('fact_deleted', (event) => {
                debugLog('[BudgetSSE] Fact deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleFactDeleted(data);
                this._broadcastSSEEvent('fact_deleted', data);  // Broadcast to followers
            });

            // Plan events
            this.eventSource.addEventListener('plan_created', (event) => {
                debugLog('[BudgetSSE] Plan created:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanCreated(data);
                this._broadcastSSEEvent('plan_created', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('plan_updated', (event) => {
                debugLog('[BudgetSSE] Plan updated:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanUpdated(data);
                this._broadcastSSEEvent('plan_updated', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('plan_deleted', (event) => {
                debugLog('[BudgetSSE] Plan deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handlePlanDeleted(data);
                this._broadcastSSEEvent('plan_deleted', data);  // Broadcast to followers
            });

            // Transfer events
            this.eventSource.addEventListener('transfer_created', (event) => {
                debugLog('[BudgetSSE] Transfer created:', event.data);
                const data = JSON.parse(event.data);
                this._handleTransferCreated(data);
                this._broadcastSSEEvent('transfer_created', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('transfer_deleted', (event) => {
                debugLog('[BudgetSSE] Transfer deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleTransferDeleted(data);
                this._broadcastSSEEvent('transfer_deleted', data);  // Broadcast to followers
            });

            // Shopping list item events (consolidated from shopping_list_sse)
            this.eventSource.addEventListener('item_created', (event) => {
                debugLog('[BudgetSSE] Item created:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCreated(data);
                this._broadcastSSEEvent('item_created', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('item_updated', (event) => {
                debugLog('[BudgetSSE] Item updated:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemUpdated(data);
                this._broadcastSSEEvent('item_updated', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('item_deleted', (event) => {
                debugLog('[BudgetSSE] Item deleted:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemDeleted(data);
                this._broadcastSSEEvent('item_deleted', data);  // Broadcast to followers
            });

            this.eventSource.addEventListener('item_completed', (event) => {
                debugLog('[BudgetSSE] Item completed:', event.data);
                const data = JSON.parse(event.data);
                this._handleItemCompleted(data);
                this._broadcastSSEEvent('item_completed', data);  // Broadcast to followers
            });

            // Keepalive ping - track last ping time for staleness detection
            this.eventSource.addEventListener('ping', (event) => {
                debugLog('[BudgetSSE] Ping received');
                this.lastServerPing = Date.now();
            });

            // Error handler
            this.eventSource.onerror = (error) => {
                console.error('[BudgetSSE] Connection error:', error);
                if (this.connectionTimer) {
                    clearTimeout(this.connectionTimer);
                    this.connectionTimer = null;
                }

                // Close and clear reference to EventSource
                if (this.eventSource) {
                    this.eventSource.close();
                    this.eventSource = null;
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
     *
     * This is the primary connection method for Safari iOS due to EventSource buffering issues.
     * Also used as a fallback for other browsers when EventSource fails.
     *
     * Features:
     * - Retry counter with fallback to polling after 3 failures
     * - Detailed logging for debugging iOS Safari issues
     * - Proper error handling for various HTTP status codes
     *
     * @private
     */
    async _useFetchEventSource() {
        const url = '/api/v1/budget/events';

        // Track fetch attempts for fallback to polling
        this._fetchAttempts = (this._fetchAttempts || 0) + 1;

        console.log('[BudgetSSE] _useFetchEventSource starting', {
            attempt: this._fetchAttempts,
            safariIOSMode: this._safariIOSMode,
            enabled: this.enabled
        });

        // After 3 failed fetch attempts, switch to polling fallback
        if (this._fetchAttempts > 3 && this._pollingFallbackAvailable()) {
            console.warn('[BudgetSSE] Max fetch attempts (3) reached, switching to polling fallback');
            this._startPollingFallback();
            return;
        }

        this.fetchController = new AbortController();

        // Set a connection timeout for fetch (Safari iOS might hang)
        const connectionTimeout = setTimeout(() => {
            if (!this.isConnected && this.fetchController) {
                console.error('[BudgetSSE] Fetch connection timeout (15s)');
                this.fetchController.abort();
            }
        }, 15000);  // 15 second timeout for connection

        try {
            console.log('[BudgetSSE] Sending fetch request to', url);

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',  // Send cookies (critical for auth)
                headers: {
                    'Accept': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                },
                signal: this.fetchController.signal,
            });

            clearTimeout(connectionTimeout);

            console.log('[BudgetSSE] Fetch response received', {
                status: response.status,
                ok: response.ok,
                contentType: response.headers.get('content-type'),
                hasBody: response.body !== null
            });

            if (!response.ok) {
                // Special handling for 401 - not authenticated
                if (response.status === 401) {
                    console.error('[BudgetSSE] 401: Not authenticated');
                    this.enabled = false;  // Disable SSE
                    this._updateStatusIndicator();
                    return;  // Don't reconnect - user needs to log in
                }
                // Special handling for 429 - connection limit reached
                if (response.status === 429) {
                    console.error('[BudgetSSE] 429: Connection limit reached');
                    this.limitReached = true;
                    this.reconnectAttempts = this.maxReconnectAttempts;  // Stop reconnect loop
                    this._updateStatusIndicator();
                    this._notifyHandlers('limit_reached', {});
                    return;  // Don't reconnect - it will just fail again
                }
                throw new Error(`HTTP ${response.status}`);
            }

            // Verify response body is readable
            if (!response.body) {
                throw new Error('Response body is null - ReadableStream not supported');
            }

            console.log('[BudgetSSE] Fetch connection established successfully');
            this.isConnected = true;
            this.limitReached = false;
            this.reconnectAttempts = 0;
            this._fetchAttempts = 0;  // Reset fetch attempts on success
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
            clearTimeout(connectionTimeout);

            if (error.name === 'AbortError') {
                debugLog('[BudgetSSE] Fetch aborted');
                // Don't schedule reconnect for intentional aborts
                // But do schedule if this was a timeout
                if (!this.isConnected && this.enabled) {
                    console.error('[BudgetSSE] Fetch timeout or abort, scheduling reconnect');
                    this.isConnected = false;
                    this._updateStatusIndicator();
                    this._scheduleReconnect();
                }
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
                    // Save connection_id for active disconnect notification (fetch-based SSE)
                    if (data.connection_id) {
                        this.connectionId = data.connection_id;
                        debugLog('[BudgetSSE] Connection ID (fetch):', this.connectionId);
                    }
                    this._notifyHandlers('connected', data);
                    break;
                case 'ping':
                    // Keepalive - track last ping time for staleness detection
                    this.lastServerPing = Date.now();
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
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.channel = null;
        }
        this.isLeader = false;

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

        // Stop polling fallback if active
        this._stopPollingFallback();

        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.limitReached = false;  // Reset limit flag on disconnect
        this.connectionId = null;   // Clear connection ID
        this._fetchAttempts = 0;    // Reset fetch attempts
        this._updateStatusIndicator();
        this._notifyHandlers('disconnect', {});
    }

    /**
     * Close connection silently without notifying handlers
     * Used for tab hidden/page unload scenarios where we don't want UI updates
     * @private
     */
    _silentClose() {
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
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.channel = null;
        }
        this.isLeader = false;

        // Actively notify server about disconnect via sendBeacon
        // This allows instant connection slot release (even on page close)
        if (this.connectionId) {
            const payload = JSON.stringify({ connection_id: this.connectionId });
            debugLog('[BudgetSSE] Sending disconnect beacon for:', this.connectionId);

            if (navigator.sendBeacon) {
                // sendBeacon works even during page unload
                navigator.sendBeacon('/api/v1/budget/events/disconnect', payload);
            } else {
                // Fallback for older browsers
                fetch('/api/v1/budget/events/disconnect', {
                    method: 'POST',
                    body: payload,
                    headers: { 'Content-Type': 'application/json' },
                    keepalive: true,  // Keeps request alive after page unload
                    credentials: 'include'
                }).catch(() => {});  // Ignore errors - best effort
            }
            this.connectionId = null;
        }

        // Clear timers
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }

        // Close EventSource
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }

        // Abort fetch
        if (this.fetchController) {
            this.fetchController.abort();
            this.fetchController = null;
        }

        // Stop polling silently (no logging during page unload)
        if (this._pollingInterval) {
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
        }
        this._pollingActive = false;

        this.isConnected = false;
        // Don't call _notifyHandlers or _updateStatusIndicator
        // because tab is hidden/closing
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

    // ==================== POLLING FALLBACK ====================

    /**
     * Check if polling fallback is available
     * Polling is always available as a last resort for SSE
     * @returns {boolean}
     * @private
     */
    _pollingFallbackAvailable() {
        return true;  // Always available
    }

    /**
     * Start polling fallback for SSE events
     * Used when both EventSource and fetch-based SSE fail (e.g., iOS Safari issues)
     * Polls /api/v1/budget/events/poll every 5 seconds
     *
     * @private
     */
    _startPollingFallback() {
        if (this._pollingActive) {
            console.log('[BudgetSSE] Polling already active');
            return;
        }

        console.log('[BudgetSSE] Starting polling fallback (5s interval)');
        this._pollingActive = true;
        this.isConnected = true;  // For UI indicator (show as connected)
        this._updateStatusIndicator();
        this._notifyHandlers('connect', { mode: 'polling' });

        // Track last event timestamp for incremental polling
        this._lastPollTimestamp = Date.now();

        this._pollingInterval = setInterval(async () => {
            if (!this.enabled || !this._pollingActive) {
                this._stopPollingFallback();
                return;
            }

            try {
                const response = await fetch('/api/v1/budget/events/poll', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                    },
                    signal: AbortSignal.timeout(10000),  // 10s timeout
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        console.error('[BudgetSSE] Polling: 401 - not authenticated');
                        this._stopPollingFallback();
                        this.enabled = false;
                        this.isConnected = false;
                        this._updateStatusIndicator();
                        return;
                    }
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                // Update last ping time (for staleness detection)
                this.lastServerPing = Date.now();

                // Process events if any
                if (data.events && data.events.length > 0) {
                    console.log('[BudgetSSE] Polling received', data.events.length, 'events');
                    for (const event of data.events) {
                        this._dispatchSSEEvent(event);
                    }
                }

                // Update timestamp for next poll
                if (data.timestamp) {
                    this._lastPollTimestamp = new Date(data.timestamp).getTime();
                }

            } catch (error) {
                console.error('[BudgetSSE] Polling error:', error.message);
                // Don't stop polling on transient errors, just log
                // But if we get many errors, switch to disconnected state
                this._pollingErrors = (this._pollingErrors || 0) + 1;
                if (this._pollingErrors > 5) {
                    console.error('[BudgetSSE] Too many polling errors, stopping');
                    this._stopPollingFallback();
                    this.isConnected = false;
                    this._updateStatusIndicator();
                    // Try to reconnect with SSE after a delay
                    setTimeout(() => {
                        this._fetchAttempts = 0;
                        this._pollingErrors = 0;
                        this.connect();
                    }, 30000);  // Wait 30s before retrying SSE
                }
            }
        }, 5000);  // Poll every 5 seconds
    }

    /**
     * Stop polling fallback
     * @private
     */
    _stopPollingFallback() {
        if (this._pollingInterval) {
            console.log('[BudgetSSE] Stopping polling fallback');
            clearInterval(this._pollingInterval);
            this._pollingInterval = null;
        }
        this._pollingActive = false;
        this._pollingErrors = 0;
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
            reconnectAttempts: this.reconnectAttempts,
            limitReached: this.limitReached,
            // Multi-tab status
            multiTabSupported: this._supportsMultiTab(),
            isLeader: this.isLeader,
            hasChannel: this.channel !== null,
            // Safari iOS specific
            safariIOSMode: this._safariIOSMode,
            useFetchSSE: this.useFetchSSE
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
        } else if (this.isConnected && this.approachingLimit) {
            // Connected but approaching connection limit - show warning
            indicator.className = `badge badge-warning ${sizeClasses}`;
            indicator.innerHTML = '⚠️';
            indicator.title = 'Много соединений. Закройте лишние вкладки';
        } else if (this.isConnected) {
            indicator.className = `badge badge-success ${sizeClasses}`;
            indicator.innerHTML = '🟢';
            indicator.title = 'Real-time синхронизация активна';
        } else if (!this.isLeader && this._supportsMultiTab() && this.lastLeaderHeartbeat > 0) {
            // Follower mode - receiving events from leader tab
            indicator.className = `badge badge-success ${sizeClasses}`;
            indicator.innerHTML = '🟢';
            indicator.title = 'Синхронизация через другую вкладку';
        } else if (this.limitReached) {
            // Connection limit reached - different from general error
            indicator.className = `badge badge-error ${sizeClasses}`;
            indicator.innerHTML = '🔴';
            indicator.title = 'Превышен лимит соединений. Закройте другие вкладки или обновите страницу';
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

// Debug log helper - disabled in production (no-op)
if (typeof debugLog === 'undefined') {
    window.debugLog = function() {};
}
