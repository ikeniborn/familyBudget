/**
 * LogsCollector - Centralized Browser Logs Collection
 *
 * Collects browser logs from Logger class and sends them to backend for admin viewing.
 *
 * Features:
 * - Buffer last 500 logs (FIFO)
 * - Batch send every 30 seconds
 * - Immediate push for errors
 * - Integration with Logger class
 *
 * Usage:
 * ```javascript
 * window.logsCollector = new LogsCollector();
 * window.logsCollector.start();
 * ```
 *
 * Author: Claude Code
 * Date: 2025-12-27
 */

class LogsCollector {
    constructor() {
        this.buffer = [];  // FIFO buffer
        this.maxSize = 500;  // Max buffer size
        this.batchInterval = 30000;  // 30 seconds
        this.intervalId = null;
        this.userId = null;  // Set from JWT or user data
        this.sessionId = this._generateSessionId();
        this.isRunning = false;
        this._offlineStatusChangeHandler = null;  // Stored for cleanup in stop()

        // Try to get user ID from page
        this._initUserId();
    }

    /**
     * Initialize user ID from page data
     * @private
     */
    _initUserId() {
        // Try to get user ID from global variables or data attributes
        if (window.userData && window.userData.id) {
            this.userId = window.userData.id;
        } else if (window.user && window.user.id) {
            this.userId = window.user.id;
        } else {
            // Try to parse from page
            const userElement = document.querySelector('[data-user-id]');
            if (userElement) {
                this.userId = parseInt(userElement.dataset.userId);
            }
        }

        if (!this.userId) {
            console.warn('[LOGS_COLLECTOR] User ID not found - logs will not be sent');
        }
    }

    /**
     * Generate unique session ID
     * @private
     */
    _generateSessionId() {
        const timestamp = Date.now().toString(36);

        // Используем crypto.getRandomValues() вместо Math.random()
        const randomBytes = new Uint8Array(8);
        crypto.getRandomValues(randomBytes);
        const randomPart = Array.from(randomBytes)
            .map(byte => byte.toString(36))
            .join('')
            .substring(0, 13);

        return `${timestamp}-${randomPart}`;
    }

    /**
     * Capture log entry from Logger class
     *
     * @param {string} level - Log level (info, warning, error)
     * @param {string} module - Module/prefix name
     * @param {string} message - Log message
     * @param {string} timestamp - ISO 8601 timestamp
     */
    captureLog(level, module, message, timestamp) {
        const logEntry = {
            timestamp,
            level: level.toLowerCase(),  // Normalize to lowercase
            message,
            module,
            correlation_id: this._getCorrelationId()  // Extract if available
        };

        // Add to buffer (FIFO)
        this.buffer.push(logEntry);
        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();  // Remove oldest
        }

        // Immediate push for errors
        if (level === 'error') {
            this.sendBatch([logEntry]);
        }
    }

    /**
     * Extract correlation ID from current page/request if available
     * @private
     */
    _getCorrelationId() {
        // Try to extract from response headers or page meta
        const metaCorrelation = document.querySelector('meta[name="correlation-id"]');
        if (metaCorrelation) {
            return metaCorrelation.content;
        }
        return null;
    }

    /**
     * Send log batch to backend
     *
     * @param {Array} logs - Array of log entries to send (default: entire buffer)
     */
    async sendBatch(logs = null) {
        if (!this.userId) {
            console.warn('[LOGS_COLLECTOR] Cannot send logs - user ID not set');
            return;
        }

        // Skip send when offline or auto-offline-mode is active
        const isOffline = !navigator.onLine || localStorage.getItem('budget_auto_offline_mode') === 'true';
        if (isOffline) {
            return;
        }

        const logsToSend = logs || this.buffer.slice();  // Use provided logs or copy buffer

        if (logsToSend.length === 0) {
            return;
        }

        try {
            const response = await fetch('/api/v1/admin/logs/browser', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // JWT token should be in cookies (httpOnly), no need to send explicitly
                },
                body: JSON.stringify({
                    logs: logsToSend,
                    user_id: this.userId,
                    session_id: this.sessionId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[LOGS_COLLECTOR] Failed to send logs:', {
                    status: response.status,
                    error: errorData
                });
                return;
            }

            await response.json();  // Consume response body

            // Clear sent logs from buffer (only if we sent the entire buffer)
            if (logs === null) {
                this.buffer = [];
            }

        } catch (error) {
            console.error('[LOGS_COLLECTOR] Error sending batch:', error);
        }
    }

    /**
     * Start periodic batch sending
     */
    start() {
        if (this.isRunning) {
            console.warn('[LOGS_COLLECTOR] Already running');
            return;
        }

        this.isRunning = true;

        // Send batch every 30 seconds (sendBatch handles offline guard internally)
        this.intervalId = setInterval(() => {
            this.sendBatch();
        }, this.batchInterval);

        // Flush buffered logs immediately when connectivity is restored
        this._offlineStatusChangeHandler = (e) => {
            if (e.detail && e.detail.online && this.isRunning && this.buffer.length > 0) {
                this.sendBatch();
            }
        };
        window.addEventListener('offline-status-change', this._offlineStatusChangeHandler);

        // Send batch on page unload (best effort)
        window.addEventListener('beforeunload', () => {
            // Use navigator.sendBeacon for reliable unload sending
            if (this.buffer.length > 0 && this.userId) {
                const data = JSON.stringify({
                    logs: this.buffer,
                    user_id: this.userId,
                    session_id: this.sessionId
                });

                // sendBeacon is more reliable than fetch during unload
                // Wrap in Blob with JSON content-type (plain string sends as text/plain → 422)
                const blob = new Blob([data], { type: 'application/json' });
                navigator.sendBeacon('/api/v1/admin/logs/browser', blob);
            }
        });

        // Send batch on visibility change (mobile wake/sleep)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && this.buffer.length > 0) {
                this.sendBatch();
            }
        });
    }

    /**
     * Stop periodic batch sending
     */
    stop() {
        if (!this.isRunning) {
            console.warn('[LOGS_COLLECTOR] Not running');
            return;
        }

        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this._offlineStatusChangeHandler) {
            window.removeEventListener('offline-status-change', this._offlineStatusChangeHandler);
            this._offlineStatusChangeHandler = null;
        }

        // Final batch send
        if (this.buffer.length > 0) {
            this.sendBatch();
        }
    }

    /**
     * Get current buffer status
     */
    getStatus() {
        return {
            bufferSize: this.buffer.length,
            maxSize: this.maxSize,
            isRunning: this.isRunning,
            userId: this.userId,
            sessionId: this.sessionId
        };
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.LogsCollector = LogsCollector;
}
