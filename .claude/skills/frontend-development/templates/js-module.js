/**
 * ES6 Module Template for Family Budget Project
 *
 * Features:
 * - ES6 class-based structure
 * - Event handling
 * - API integration with Fetch API
 * - LocalStorage for offline support
 * - Error handling
 * - Toast notifications
 *
 * Usage:
 * 1. Copy this template to frontend/web/static/js/<module-name>.js
 * 2. Update class name, API endpoints, and methods
 * 3. Import in base.html or specific page:
 *    <script type="module" src="/static/js/<module-name>.js"></script>
 * 4. Initialize:
 *    <script type="module">
 *        import { ResourceManager } from '/static/js/resource-manager.js';
 *        window.resourceManager = new ResourceManager();
 *    </script>
 */

/**
 * ResourceManager Class
 * Manages CRUD operations for a resource
 */
export class ResourceManager {
    constructor(options = {}) {
        // Configuration
        this.apiEndpoint = options.apiEndpoint || '/api/v1/resources';
        this.cacheKey = options.cacheKey || 'resources_cache';
        this.cacheDuration = options.cacheDuration || 5 * 60 * 1000; // 5 minutes

        // State
        this.resources = [];
        this.loading = false;
        this.lastFetch = 0;

        // Event handlers storage
        this.eventHandlers = {
            onCreate: [],
            onUpdate: [],
            onDelete: [],
            onError: []
        };

        // Initialize
        this.init();
    }

    /**
     * Initialize the module
     */
    async init() {
        console.log('[ResourceManager] Initializing...');

        // Load from cache first (for offline support)
        this.loadFromCache();

        // Fetch fresh data from API
        await this.fetchResources();

        // Setup event listeners
        this.setupEventListeners();

        console.log('[ResourceManager] Initialized');
    }

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Example: Listen for custom events
        document.addEventListener('resource:refresh', () => {
            this.fetchResources(true); // Force refresh
        });

        // Example: Online/offline detection
        window.addEventListener('online', () => {
            console.log('[ResourceManager] Back online, syncing...');
            this.syncOfflineChanges();
        });

        window.addEventListener('offline', () => {
            console.log('[ResourceManager] Offline mode activated');
        });
    }

    /**
     * Fetch resources from API
     * @param {boolean} force - Force refresh, ignore cache
     */
    async fetchResources(force = false) {
        // Check cache freshness
        const cacheAge = Date.now() - this.lastFetch;
        if (!force && cacheAge < this.cacheDuration && this.resources.length > 0) {
            console.log('[ResourceManager] Using cached data');
            return this.resources;
        }

        this.loading = true;

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin' // Include cookies (JWT)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.resources = data;
            this.lastFetch = Date.now();

            // Save to cache
            this.saveToCache();

            console.log(`[ResourceManager] Fetched ${this.resources.length} resources`);
            return this.resources;

        } catch (error) {
            console.error('[ResourceManager] Fetch error:', error);
            this.triggerEvent('onError', error);

            // Fallback to cache on error
            if (this.resources.length === 0) {
                this.loadFromCache();
            }

            throw error;
        } finally {
            this.loading = false;
        }
    }

    /**
     * Create new resource
     * @param {Object} data - Resource data
     */
    async createResource(data) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create resource');
            }

            const newResource = await response.json();
            this.resources.push(newResource);
            this.saveToCache();

            // Trigger event
            this.triggerEvent('onCreate', newResource);

            console.log('[ResourceManager] Resource created:', newResource.id);
            return newResource;

        } catch (error) {
            console.error('[ResourceManager] Create error:', error);
            this.triggerEvent('onError', error);

            // Offline mode: queue for sync
            if (!navigator.onLine) {
                this.queueOfflineOperation('CREATE', data);
                throw new Error('Offline: Operation queued for sync');
            }

            throw error;
        }
    }

    /**
     * Update existing resource
     * @param {number} id - Resource ID
     * @param {Object} data - Updated data
     */
    async updateResource(id, data) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to update resource');
            }

            const updatedResource = await response.json();

            // Update in local array
            const index = this.resources.findIndex(r => r.id === id);
            if (index !== -1) {
                this.resources[index] = updatedResource;
                this.saveToCache();
            }

            // Trigger event
            this.triggerEvent('onUpdate', updatedResource);

            console.log('[ResourceManager] Resource updated:', id);
            return updatedResource;

        } catch (error) {
            console.error('[ResourceManager] Update error:', error);
            this.triggerEvent('onError', error);

            // Offline mode: queue for sync
            if (!navigator.onLine) {
                this.queueOfflineOperation('UPDATE', { id, ...data });
                throw new Error('Offline: Operation queued for sync');
            }

            throw error;
        }
    }

    /**
     * Delete resource
     * @param {number} id - Resource ID
     */
    async deleteResource(id) {
        try {
            const response = await fetch(`${this.apiEndpoint}/${id}`, {
                method: 'DELETE',
                credentials: 'same-origin'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to delete resource');
            }

            // Remove from local array
            this.resources = this.resources.filter(r => r.id !== id);
            this.saveToCache();

            // Trigger event
            this.triggerEvent('onDelete', id);

            console.log('[ResourceManager] Resource deleted:', id);
            return true;

        } catch (error) {
            console.error('[ResourceManager] Delete error:', error);
            this.triggerEvent('onError', error);

            // Offline mode: queue for sync
            if (!navigator.onLine) {
                this.queueOfflineOperation('DELETE', { id });
                throw new Error('Offline: Operation queued for sync');
            }

            throw error;
        }
    }

    /**
     * Get resource by ID
     * @param {number} id - Resource ID
     */
    getResourceById(id) {
        return this.resources.find(r => r.id === id);
    }

    /**
     * Filter resources
     * @param {Function} predicate - Filter function
     */
    filterResources(predicate) {
        return this.resources.filter(predicate);
    }

    /**
     * Save resources to LocalStorage
     */
    saveToCache() {
        try {
            const cacheData = {
                resources: this.resources,
                timestamp: this.lastFetch
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('[ResourceManager] Cache save failed:', error);
        }
    }

    /**
     * Load resources from LocalStorage
     */
    loadFromCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (cached) {
                const cacheData = JSON.parse(cached);
                this.resources = cacheData.resources || [];
                this.lastFetch = cacheData.timestamp || 0;
                console.log(`[ResourceManager] Loaded ${this.resources.length} resources from cache`);
            }
        } catch (error) {
            console.warn('[ResourceManager] Cache load failed:', error);
        }
    }

    /**
     * Queue offline operation for sync
     */
    queueOfflineOperation(operation, data) {
        const queueKey = `${this.cacheKey}_queue`;
        const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
        queue.push({
            operation,
            data,
            timestamp: Date.now()
        });
        localStorage.setItem(queueKey, JSON.stringify(queue));
        console.log(`[ResourceManager] Queued ${operation} operation for sync`);
    }

    /**
     * Sync offline changes when back online
     */
    async syncOfflineChanges() {
        const queueKey = `${this.cacheKey}_queue`;
        const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');

        if (queue.length === 0) return;

        console.log(`[ResourceManager] Syncing ${queue.length} offline operations`);

        for (const item of queue) {
            try {
                switch (item.operation) {
                    case 'CREATE':
                        await this.createResource(item.data);
                        break;
                    case 'UPDATE':
                        await this.updateResource(item.data.id, item.data);
                        break;
                    case 'DELETE':
                        await this.deleteResource(item.data.id);
                        break;
                }
            } catch (error) {
                console.error('[ResourceManager] Sync error:', error);
                // Keep failed operations in queue
                break;
            }
        }

        // Clear synced operations
        localStorage.removeItem(queueKey);
        console.log('[ResourceManager] Sync completed');
    }

    /**
     * Register event handler
     * @param {string} event - Event name (onCreate, onUpdate, onDelete, onError)
     * @param {Function} handler - Event handler function
     */
    on(event, handler) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].push(handler);
        }
    }

    /**
     * Trigger event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    triggerEvent(event, data) {
        if (this.eventHandlers[event]) {
            this.eventHandlers[event].forEach(handler => handler(data));
        }
    }
}

// Auto-export for global usage
if (typeof window !== 'undefined') {
    window.ResourceManager = ResourceManager;
}
