/**
 * WorkerWrapper - Simple Web Worker wrapper with fallback to main thread
 *
 * Design Principles (from critical analysis):
 * - Simple wrapper, NOT complex pool manager
 * - Progressive enhancement with automatic fallback
 * - Memory monitoring and aggressive termination
 * - Structured Clone validation
 * - Feature flag support
 *
 * @version 1.0.0
 * @requires window.FEATURE_FLAGS.ENABLE_WEB_WORKERS
 */

const WORKER_VERSION = 'v20251225_1523';  // Updated by scripts/update-worker-version.sh

class WorkerWrapper {
    constructor(workerPath, options = {}) {
        this.workerPath = workerPath;
        this.options = {
            idleTimeout: options.idleTimeout || 10000,  // 10s (aggressive, from corrections)
            debugMode: options.debugMode || (typeof window !== 'undefined' && window.DEBUG_MODE),
            enabled: this._checkFeatureFlag(),
            ...options
        };

        this.worker = null;
        this.pendingTasks = new Map();  // taskId -> { resolve, reject, timeout }
        this.taskIdCounter = 0;
        this.idleTimer = null;
        this.isTerminated = false;
        this.errorCount = 0;
        this.errorThreshold = 10;  // Auto-disable after 10 errors (from corrections)

        this._log('WorkerWrapper created', { workerPath, options: this.options });
    }

    /**
     * Check if Web Workers are enabled via feature flag
     */
    _checkFeatureFlag() {
        if (typeof window === 'undefined') return false;
        if (typeof Worker === 'undefined') {
            this._log('Web Workers not supported in this browser');
            return false;
        }

        const enabled = window.FEATURE_FLAGS?.ENABLE_WEB_WORKERS !== false;
        if (!enabled) {
            this._log('Web Workers disabled via feature flag');
        }
        return enabled;
    }

    /**
     * Debug logging (respects DEBUG_MODE)
     */
    _log(...args) {
        if (this.options.debugMode) {
            console.log(`[WorkerWrapper:${this.workerPath}]`, ...args);
        }
    }

    /**
     * Validate data is Structured Clone compatible
     * Critical correction from plan analysis - prevents DataCloneError
     */
    _validateSerializable(data) {
        try {
            // Use JSON round-trip as validation (detects circular refs)
            JSON.parse(JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('[WorkerWrapper] Data not serializable:', error);
            console.error('[WorkerWrapper] Problematic data:', data);
            return false;
        }
    }

    /**
     * Check memory usage before creating worker
     * Critical correction from plan analysis - prevent memory issues
     */
    _checkMemory() {
        if (!performance.memory) return true;  // Memory API not available

        const usedHeapMB = performance.memory.usedJSHeapSize / 1024 / 1024;
        const limitMB = 500;  // 500MB threshold (from corrections)

        if (usedHeapMB > limitMB) {
            console.warn(`[WorkerWrapper] High memory usage: ${usedHeapMB.toFixed(0)}MB > ${limitMB}MB, falling back to sync`);
            return false;
        }

        return true;
    }

    /**
     * Initialize worker (lazy initialization)
     */
    _initWorker() {
        if (this.isTerminated) {
            throw new Error('Worker已 terminated, cannot reinitialize');
        }

        if (this.worker) return;  // Already initialized

        try {
            this.worker = new Worker(this.workerPath);
            this.worker.onmessage = (event) => this._handleMessage(event.data);
            this.worker.onerror = (error) => this._handleError(error);
            this._log('Worker initialized');
        } catch (error) {
            console.error('[WorkerWrapper] Failed to create worker:', error);
            this.worker = null;
            throw error;
        }
    }

    /**
     * Handle message from worker
     */
    _handleMessage(data) {
        const { id, success, result, error, duration } = data;

        const task = this.pendingTasks.get(id);
        if (!task) {
            console.warn('[WorkerWrapper] Received message for unknown task:', id);
            return;
        }

        // Clear timeout
        clearTimeout(task.timeout);
        this.pendingTasks.delete(id);

        this._log(`Task ${id} completed in ${duration}ms`);

        // Reset idle timer (worker is active)
        this._resetIdleTimer();

        if (success) {
            task.resolve(result);
        } else {
            task.reject(new Error(error?.message || 'Worker task failed'));
        }
    }

    /**
     * Handle worker error
     */
    _handleError(error) {
        console.error('[WorkerWrapper] Worker error:', error);

        this.errorCount++;
        if (this.errorCount >= this.errorThreshold) {
            console.error(`[WorkerWrapper] Error threshold (${this.errorThreshold}) exceeded, auto-disabling`);
            this.options.enabled = false;
            this.terminate();
        }

        // Reject all pending tasks
        for (const [id, task] of this.pendingTasks.entries()) {
            clearTimeout(task.timeout);
            task.reject(new Error('Worker error: ' + error.message));
        }
        this.pendingTasks.clear();
    }

    /**
     * Reset idle timer (worker becomes idle after timeout)
     */
    _resetIdleTimer() {
        clearTimeout(this.idleTimer);

        this.idleTimer = setTimeout(() => {
            this._log(`Worker idle for ${this.options.idleTimeout}ms, terminating`);
            this.terminate();
        }, this.options.idleTimeout);
    }

    /**
     * Execute task in worker
     *
     * @param {Object} message - Message to send to worker
     * @param {string} message.action - Action name
     * @param {Object} message.data - Input data
     * @param {Object} message.options - Optional parameters
     * @param {number} timeout - Task timeout in ms (default: 30000)
     * @returns {Promise} - Resolves with worker result
     */
    async execute(message, timeout = 30000) {
        // Feature flag check
        if (!this.options.enabled) {
            throw new Error('WorkerWrapper disabled (feature flag or error threshold)');
        }

        // Memory check (from corrections)
        if (!this._checkMemory()) {
            throw new Error('High memory usage, falling back to synchronous');
        }

        // Validate serializable (from corrections)
        if (!this._validateSerializable(message)) {
            throw new Error('Worker data must not contain circular references or functions');
        }

        // Initialize worker if needed
        if (!this.worker) {
            this._initWorker();
        }

        // Create task
        const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;
        const taskMessage = {
            id: taskId,
            ...message,
            timestamp: Date.now()
        };

        this._log(`Executing task ${taskId}:`, message.action);

        return new Promise((resolve, reject) => {
            // Set timeout
            const timeoutId = setTimeout(() => {
                this.pendingTasks.delete(taskId);
                reject(new Error(`Worker task timeout after ${timeout}ms`));
            }, timeout);

            // Store task
            this.pendingTasks.set(taskId, { resolve, reject, timeout: timeoutId });

            // Send to worker
            try {
                this.worker.postMessage(taskMessage);
                this._resetIdleTimer();  // Worker is active
            } catch (error) {
                clearTimeout(timeoutId);
                this.pendingTasks.delete(taskId);
                reject(error);
            }
        });
    }

    /**
     * Terminate worker
     */
    terminate() {
        if (this.worker) {
            this._log('Terminating worker');
            this.worker.terminate();
            this.worker = null;
        }

        clearTimeout(this.idleTimer);
        this.isTerminated = true;

        // Reject all pending tasks
        for (const [id, task] of this.pendingTasks.entries()) {
            clearTimeout(task.timeout);
            task.reject(new Error('Worker terminated'));
        }
        this.pendingTasks.clear();
    }

    /**
     * Get worker status (for debugging)
     */
    getStatus() {
        return {
            workerPath: this.workerPath,
            enabled: this.options.enabled,
            isInitialized: this.worker !== null,
            isTerminated: this.isTerminated,
            pendingTasks: this.pendingTasks.size,
            errorCount: this.errorCount,
            version: WORKER_VERSION
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerWrapper;
} else if (typeof window !== 'undefined') {
    window.WorkerWrapper = WorkerWrapper;
}
