/**
 * IndexedDB Manager для Offline Storage
 * Family Budget PWA
 *
 * Database Schema:
 * - offline_facts: Offline транзакции
 * - offline_transfers: Offline переводы
 * - offline_plans: Offline планы
 * - offline_shopping_lists: Offline списки покупок
 * - offline_shopping_list_items: Offline items списков покупок
 * - sync_queue: Очередь синхронизации
 * - sync_queue_shopping: Очередь синхронизации для shopping lists
 * - data_cache: Кеш reference data (articles, accounts, cost locations)
 * - cached_stores: Кеш магазинов (для offline)
 * - cached_product_groups: Кеш групп товаров (для offline)
 *
 * @version 2.0.0 - Added Shopping Lists support
 */

const DB_NAME = 'FamilyBudgetDB';
const DB_VERSION = 3;  // v3: Added sync_metadata store

const STORES = {
    facts: 'offline_facts',
    transfers: 'offline_transfers',
    plans: 'offline_plans',
    shoppingLists: 'offline_shopping_lists',
    shoppingListItems: 'offline_shopping_list_items',
    syncQueue: 'sync_queue',
    syncQueueShopping: 'sync_queue_shopping',
    cache: 'data_cache',
    cachedStores: 'cached_stores',
    cachedProductGroups: 'cached_product_groups',
    syncMetadata: 'sync_metadata'
};

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.isInitialized = false;
    }

    /**
     * Инициализация IndexedDB
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.isInitialized && this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store 1: Offline Facts
                if (!db.objectStoreNames.contains(STORES.facts)) {
                    const factsStore = db.createObjectStore(STORES.facts, {
                        keyPath: 'tempId',
                        autoIncrement: false
                    });
                    factsStore.createIndex('synced', 'synced', { unique: false });
                    factsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    factsStore.createIndex('serverId', 'serverId', { unique: false });
                }

                // Store 2: Offline Transfers
                if (!db.objectStoreNames.contains(STORES.transfers)) {
                    const transfersStore = db.createObjectStore(STORES.transfers, {
                        keyPath: 'tempId',
                        autoIncrement: false
                    });
                    transfersStore.createIndex('synced', 'synced', { unique: false });
                    transfersStore.createIndex('createdAt', 'createdAt', { unique: false });
                    transfersStore.createIndex('serverId', 'serverId', { unique: false });
                }

                // Store 3: Offline Plans
                if (!db.objectStoreNames.contains(STORES.plans)) {
                    const plansStore = db.createObjectStore(STORES.plans, {
                        keyPath: 'tempId',
                        autoIncrement: false
                    });
                    plansStore.createIndex('synced', 'synced', { unique: false });
                    plansStore.createIndex('createdAt', 'createdAt', { unique: false });
                    plansStore.createIndex('serverId', 'serverId', { unique: false });
                }

                // Store 4: Sync Queue
                if (!db.objectStoreNames.contains(STORES.syncQueue)) {
                    const queueStore = db.createObjectStore(STORES.syncQueue, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    queueStore.createIndex('status', 'status', { unique: false });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                    queueStore.createIndex('entity', 'entity', { unique: false });
                    queueStore.createIndex('operation', 'operation', { unique: false });
                }

                // Store 5: Data Cache (reference data)
                if (!db.objectStoreNames.contains(STORES.cache)) {
                    const cacheStore = db.createObjectStore(STORES.cache, {
                        keyPath: 'key'
                    });
                    cacheStore.createIndex('expires', 'expires', { unique: false });
                }

                // Store 6: Offline Shopping Lists
                if (!db.objectStoreNames.contains(STORES.shoppingLists)) {
                    const shoppingListsStore = db.createObjectStore(STORES.shoppingLists, {
                        keyPath: 'tempId',
                        autoIncrement: false
                    });
                    shoppingListsStore.createIndex('synced', 'synced', { unique: false });
                    shoppingListsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    shoppingListsStore.createIndex('serverId', 'serverId', { unique: false });
                }

                // Store 7: Offline Shopping List Items
                if (!db.objectStoreNames.contains(STORES.shoppingListItems)) {
                    const itemsStore = db.createObjectStore(STORES.shoppingListItems, {
                        keyPath: 'tempId',
                        autoIncrement: false
                    });
                    itemsStore.createIndex('synced', 'synced', { unique: false });
                    itemsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    itemsStore.createIndex('serverId', 'serverId', { unique: false });
                    itemsStore.createIndex('shoppingListId', 'shoppingListId', { unique: false });
                    itemsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                }

                // Store 8: Sync Queue Shopping (separate queue for shopping lists)
                if (!db.objectStoreNames.contains(STORES.syncQueueShopping)) {
                    const queueStore = db.createObjectStore(STORES.syncQueueShopping, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    queueStore.createIndex('status', 'status', { unique: false });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                    queueStore.createIndex('entity', 'entity', { unique: false });
                    queueStore.createIndex('operation', 'operation', { unique: false });
                }

                // Store 9: Cached Stores (for offline)
                if (!db.objectStoreNames.contains(STORES.cachedStores)) {
                    const storesStore = db.createObjectStore(STORES.cachedStores, {
                        keyPath: 'id'
                    });
                    storesStore.createIndex('name', 'name', { unique: false });
                    storesStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                }

                // Store 10: Cached Product Groups (for offline)
                if (!db.objectStoreNames.contains(STORES.cachedProductGroups)) {
                    const productGroupsStore = db.createObjectStore(STORES.cachedProductGroups, {
                        keyPath: 'id'
                    });
                    productGroupsStore.createIndex('name', 'name', { unique: false });
                    productGroupsStore.createIndex('parentId', 'parentId', { unique: false });
                    productGroupsStore.createIndex('cachedAt', 'cachedAt', { unique: false });
                }

                // Store 11: Sync Metadata (lastSyncTimestamp per list)
                if (!db.objectStoreNames.contains(STORES.syncMetadata)) {
                    db.createObjectStore(STORES.syncMetadata, {
                        keyPath: 'listId'
                    });
                }
            };
        });
    }

    /**
     * Generic add method
     * @private
     */
    async _add(storeName, data) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Generic get method
     * @private
     */
    async _get(storeName, key) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Generic getAll method
     * @private
     */
    async _getAll(storeName, indexName = null, query = null) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);

            let request;
            if (indexName) {
                const index = store.index(indexName);
                request = query ? index.getAll(query) : index.getAll();
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Generic update method
     * @private
     */
    async _update(storeName, data) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Generic delete method
     * @private
     */
    async _delete(storeName, key) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Generic count method
     * @private
     */
    async _count(storeName, indexName = null, query = null) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);

            let request;
            if (indexName) {
                const index = store.index(indexName);
                request = query ? index.count(query) : index.count();
            } else {
                request = store.count();
            }

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // ==================== FACTS ====================

    /**
     * Add offline fact
     * @param {Object} fact - Fact data
     * @returns {Promise<string>} tempId
     */
    async addFact(fact) {
        return await this._add(STORES.facts, fact);
    }

    /**
     * Get fact by tempId
     * @param {string} tempId
     * @returns {Promise<Object>}
     */
    async getFact(tempId) {
        return await this._get(STORES.facts, tempId);
    }

    /**
     * Get all facts (optionally filter by synced status)
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<Array>}
     */
    async getAllFacts(synced = null) {
        if (synced !== null) {
            return await this._getAll(STORES.facts, 'synced', synced);
        }
        return await this._getAll(STORES.facts);
    }

    /**
     * Update fact
     * @param {Object} fact - Updated fact data
     * @returns {Promise<string>}
     */
    async updateFact(fact) {
        return await this._update(STORES.facts, fact);
    }

    /**
     * Delete fact by tempId
     * @param {string} tempId
     * @returns {Promise<void>}
     */
    async deleteFact(tempId) {
        return await this._delete(STORES.facts, tempId);
    }

    /**
     * Count facts (optionally filter by synced status)
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<number>}
     */
    async countFacts(synced = null) {
        if (synced !== null) {
            return await this._count(STORES.facts, 'synced', synced);
        }
        return await this._count(STORES.facts);
    }

    // ==================== TRANSFERS ====================

    async addTransfer(transfer) {
        return await this._add(STORES.transfers, transfer);
    }

    async getTransfer(tempId) {
        return await this._get(STORES.transfers, tempId);
    }

    async getAllTransfers(synced = null) {
        if (synced !== null) {
            return await this._getAll(STORES.transfers, 'synced', synced);
        }
        return await this._getAll(STORES.transfers);
    }

    async updateTransfer(transfer) {
        return await this._update(STORES.transfers, transfer);
    }

    async deleteTransfer(tempId) {
        return await this._delete(STORES.transfers, tempId);
    }

    async countTransfers(synced = null) {
        if (synced !== null) {
            return await this._count(STORES.transfers, 'synced', synced);
        }
        return await this._count(STORES.transfers);
    }

    // ==================== PLANS ====================

    async addPlan(plan) {
        return await this._add(STORES.plans, plan);
    }

    async getPlan(tempId) {
        return await this._get(STORES.plans, tempId);
    }

    async getAllPlans(synced = null) {
        if (synced !== null) {
            return await this._getAll(STORES.plans, 'synced', synced);
        }
        return await this._getAll(STORES.plans);
    }

    async updatePlan(plan) {
        return await this._update(STORES.plans, plan);
    }

    async deletePlan(tempId) {
        return await this._delete(STORES.plans, tempId);
    }

    async countPlans(synced = null) {
        if (synced !== null) {
            return await this._count(STORES.plans, 'synced', synced);
        }
        return await this._count(STORES.plans);
    }

    // ==================== SYNC QUEUE ====================

    /**
     * Add item to sync queue
     * @param {Object} item - Queue item
     * @returns {Promise<number>} id
     */
    async addToSyncQueue(item) {
        return await this._add(STORES.syncQueue, item);
    }

    /**
     * Get queue item by id
     * @param {number} id
     * @returns {Promise<Object>}
     */
    async getSyncQueueItem(id) {
        return await this._get(STORES.syncQueue, id);
    }

    /**
     * Get all sync queue items (optionally filter by status)
     * @param {string} status - Filter by status (null = all)
     * @returns {Promise<Array>}
     */
    async getSyncQueue(status = null) {
        if (status) {
            return await this._getAll(STORES.syncQueue, 'status', status);
        }
        return await this._getAll(STORES.syncQueue);
    }

    /**
     * Update sync queue item
     * @param {number} id
     * @param {Object} updates - Partial updates
     * @returns {Promise<number>}
     */
    async updateSyncQueueItem(id, updates) {
        const item = await this.getSyncQueueItem(id);
        if (!item) {
            throw new Error(`Sync queue item ${id} not found`);
        }

        const updated = { ...item, ...updates };
        return await this._update(STORES.syncQueue, updated);
    }

    /**
     * Delete sync queue item by id
     * @param {number} id
     * @returns {Promise<void>}
     */
    async deleteSyncQueueItem(id) {
        return await this._delete(STORES.syncQueue, id);
    }

    /**
     * Count sync queue items (optionally filter by status)
     * @param {string} status - Filter by status (null = all)
     * @returns {Promise<number>}
     */
    async countSyncQueue(status = null) {
        if (status) {
            return await this._count(STORES.syncQueue, 'status', status);
        }
        return await this._count(STORES.syncQueue);
    }

    /**
     * Clear completed items from sync queue
     * @returns {Promise<number>} Number of deleted items
     */
    async clearCompletedSyncQueue() {
        const completed = await this.getSyncQueue('completed');
        let count = 0;

        for (const item of completed) {
            await this.deleteSyncQueueItem(item.id);
            count++;
        }

        return count;
    }

    // ==================== DATA CACHE ====================

    /**
     * Set cache value
     * @param {string} key - Cache key
     * @param {*} value - Cache value
     * @param {number} ttl - Time to live in seconds (default: 3600)
     * @returns {Promise<string>}
     */
    async setCache(key, value, ttl = 3600) {
        const data = {
            key,
            value,
            expires: Date.now() + (ttl * 1000),
            updatedAt: Date.now()
        };
        return await this._update(STORES.cache, data);
    }

    /**
     * Get cache value
     * @param {string} key - Cache key
     * @returns {Promise<*>} Cache value or null if expired/not found
     */
    async getCache(key) {
        const data = await this._get(STORES.cache, key);
        if (!data) return null;

        // Check if expired
        if (data.expires < Date.now()) {
            await this._delete(STORES.cache, key);
            return null;
        }

        return data.value;
    }

    /**
     * Delete cache value
     * @param {string} key - Cache key
     * @returns {Promise<void>}
     */
    async deleteCache(key) {
        return await this._delete(STORES.cache, key);
    }

    /**
     * Clear expired cache entries
     * @returns {Promise<number>} Number of deleted entries
     */
    async clearExpiredCache() {
        const allCache = await this._getAll(STORES.cache);
        const now = Date.now();
        let count = 0;

        for (const item of allCache) {
            if (item.expires < now) {
                await this.deleteCache(item.key);
                count++;
            }
        }

        return count;
    }

    // ==================== SHOPPING LISTS ====================

    /**
     * Add offline shopping list
     * @param {Object} list - Shopping list data
     * @returns {Promise<string>} tempId
     */
    async addShoppingList(list) {
        return await this._add(STORES.shoppingLists, list);
    }

    /**
     * Get shopping list by tempId
     * @param {string} tempId
     * @returns {Promise<Object>}
     */
    async getShoppingList(tempId) {
        return await this._get(STORES.shoppingLists, tempId);
    }

    /**
     * Get all shopping lists
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<Array>}
     */
    async getAllShoppingLists(synced = null) {
        if (synced !== null) {
            return await this._getAll(STORES.shoppingLists, 'synced', synced);
        }
        return await this._getAll(STORES.shoppingLists);
    }

    /**
     * Update shopping list
     * @param {Object} list - Updated shopping list data
     * @returns {Promise<string>}
     */
    async updateShoppingList(list) {
        return await this._update(STORES.shoppingLists, list);
    }

    /**
     * Delete shopping list
     * @param {string} tempId
     * @returns {Promise<void>}
     */
    async deleteShoppingList(tempId) {
        return await this._delete(STORES.shoppingLists, tempId);
    }

    /**
     * Count shopping lists
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<number>}
     */
    async countShoppingLists(synced = null) {
        if (synced !== null) {
            return await this._count(STORES.shoppingLists, 'synced', synced);
        }
        return await this._count(STORES.shoppingLists);
    }

    // ==================== SHOPPING LIST ITEMS ====================

    /**
     * Add offline shopping list item
     * @param {Object} item - Shopping list item data
     * @returns {Promise<string>} tempId
     */
    async addShoppingListItem(item) {
        return await this._add(STORES.shoppingListItems, item);
    }

    /**
     * Get shopping list item by tempId
     * @param {string} tempId
     * @returns {Promise<Object>}
     */
    async getShoppingListItem(tempId) {
        return await this._get(STORES.shoppingListItems, tempId);
    }

    /**
     * Get all shopping list items for a shopping list
     * @param {number} shoppingListId - Shopping list ID (serverId)
     * @returns {Promise<Array>}
     */
    async getShoppingListItemsByListId(shoppingListId) {
        return await this._getAll(STORES.shoppingListItems, 'shoppingListId', shoppingListId);
    }

    /**
     * Get all shopping list items
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<Array>}
     */
    async getAllShoppingListItems(synced = null) {
        if (synced !== null) {
            return await this._getAll(STORES.shoppingListItems, 'synced', synced);
        }
        return await this._getAll(STORES.shoppingListItems);
    }

    /**
     * Get items by sync status
     * @param {string} syncStatus - Sync status ('synced', 'pending', 'conflict')
     * @returns {Promise<Array>}
     */
    async getItemsBySyncStatus(syncStatus) {
        return await this._getAll(STORES.shoppingListItems, 'syncStatus', syncStatus);
    }

    /**
     * Update shopping list item
     * @param {Object} item - Updated shopping list item data
     * @returns {Promise<string>}
     */
    async updateShoppingListItem(item) {
        return await this._update(STORES.shoppingListItems, item);
    }

    /**
     * Delete shopping list item
     * @param {string} tempId
     * @returns {Promise<void>}
     */
    async deleteShoppingListItem(tempId) {
        return await this._delete(STORES.shoppingListItems, tempId);
    }

    /**
     * Count shopping list items
     * @param {boolean} synced - Filter by synced status (null = all)
     * @returns {Promise<number>}
     */
    async countShoppingListItems(synced = null) {
        if (synced !== null) {
            return await this._count(STORES.shoppingListItems, 'synced', synced);
        }
        return await this._count(STORES.shoppingListItems);
    }

    // ==================== CACHED STORES ====================

    /**
     * Cache stores (for offline)
     * @param {Array} stores - Array of store objects
     * @returns {Promise<void>}
     */
    async cacheStores(stores) {
        await this.init();

        for (const store of stores) {
            await this._update(STORES.cachedStores, {
                ...store,
                cachedAt: new Date().toISOString()
            });
        }
    }

    /**
     * Get cached stores
     * @returns {Promise<Array>}
     */
    async getCachedStores() {
        return await this._getAll(STORES.cachedStores);
    }

    /**
     * Get cached store by ID
     * @param {number} id - Store ID
     * @returns {Promise<Object>}
     */
    async getCachedStore(id) {
        return await this._get(STORES.cachedStores, id);
    }

    // ==================== CACHED PRODUCT GROUPS ====================

    /**
     * Cache product groups (for offline)
     * @param {Array} productGroups - Array of product group objects
     * @returns {Promise<void>}
     */
    async cacheProductGroups(productGroups) {
        await this.init();

        for (const group of productGroups) {
            await this._update(STORES.cachedProductGroups, {
                ...group,
                cachedAt: new Date().toISOString()
            });
        }
    }

    /**
     * Get cached product groups
     * @returns {Promise<Array>}
     */
    async getCachedProductGroups() {
        return await this._getAll(STORES.cachedProductGroups);
    }

    /**
     * Get cached product group by ID
     * @param {number} id - Product group ID
     * @returns {Promise<Object>}
     */
    async getCachedProductGroup(id) {
        return await this._get(STORES.cachedProductGroups, id);
    }

    // ==================== SYNC QUEUE SHOPPING ====================

    /**
     * Add item to shopping sync queue
     * @param {Object} queueItem - Queue item
     * @returns {Promise<number>} Queue item ID
     */
    async addShoppingSyncQueueItem(queueItem) {
        const item = {
            ...queueItem,
            status: queueItem.status || 'pending',
            timestamp: queueItem.timestamp || new Date().toISOString(),
            retries: queueItem.retries || 0
        };
        return await this._add(STORES.syncQueueShopping, item);
    }

    /**
     * Get all shopping sync queue items
     * @param {string} status - Filter by status (null = all)
     * @returns {Promise<Array>}
     */
    async getShoppingSyncQueue(status = null) {
        if (status !== null) {
            return await this._getAll(STORES.syncQueueShopping, 'status', status);
        }
        return await this._getAll(STORES.syncQueueShopping);
    }

    /**
     * Update shopping sync queue item
     * @param {Object} queueItem - Updated queue item
     * @returns {Promise<number>}
     */
    async updateShoppingSyncQueueItem(queueItem) {
        return await this._update(STORES.syncQueueShopping, queueItem);
    }

    /**
     * Delete shopping sync queue item
     * @param {number} id - Queue item ID
     * @returns {Promise<void>}
     */
    async deleteShoppingSyncQueueItem(id) {
        return await this._delete(STORES.syncQueueShopping, id);
    }

    /**
     * Count shopping sync queue items
     * @param {string} status - Filter by status (null = all)
     * @returns {Promise<number>}
     */
    async countShoppingSyncQueue(status = null) {
        if (status !== null) {
            return await this._count(STORES.syncQueueShopping, 'status', status);
        }
        return await this._count(STORES.syncQueueShopping);
    }

    // ==================== SYNC METADATA ====================

    /**
     * Get sync metadata for a shopping list
     * @param {number} listId - Shopping list ID
     * @returns {Promise<Object|null>} Sync metadata or null
     */
    async getSyncMetadata(listId) {
        return await this._get(STORES.syncMetadata, listId);
    }

    /**
     * Set sync metadata for a shopping list
     * @param {number} listId - Shopping list ID
     * @param {string} lastSyncTimestamp - ISO timestamp of last sync
     * @param {Object} [extra] - Additional metadata
     * @returns {Promise<number>}
     */
    async setSyncMetadata(listId, lastSyncTimestamp, extra = {}) {
        return await this._update(STORES.syncMetadata, {
            listId,
            lastSyncTimestamp,
            ...extra,
            updatedAt: new Date().toISOString()
        });
    }

    /**
     * Get last sync timestamp for a shopping list
     * @param {number} listId - Shopping list ID
     * @returns {Promise<string|null>} ISO timestamp or null
     */
    async getLastSyncTimestamp(listId) {
        const metadata = await this.getSyncMetadata(listId);
        return metadata ? metadata.lastSyncTimestamp : null;
    }

    /**
     * Delete sync metadata for a shopping list
     * @param {number} listId - Shopping list ID
     * @returns {Promise<void>}
     */
    async deleteSyncMetadata(listId) {
        return await this._delete(STORES.syncMetadata, listId);
    }

    /**
     * Get all sync metadata
     * @returns {Promise<Array>}
     */
    async getAllSyncMetadata() {
        return await this._getAll(STORES.syncMetadata);
    }

    // ==================== UTILITY METHODS ====================

    /**
     * Get total pending items count
     * @returns {Promise<number>}
     */
    async getPendingCount() {
        const factsCount = await this.countFacts(false);
        const transfersCount = await this.countTransfers(false);
        const plansCount = await this.countPlans(false);
        const shoppingListsCount = await this.countShoppingLists(false);
        const shoppingListItemsCount = await this.countShoppingListItems(false);
        return factsCount + transfersCount + plansCount + shoppingListsCount + shoppingListItemsCount;
    }

    /**
     * Clear all offline data (DANGEROUS!)
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.init();

        const storeNames = [
            STORES.facts,
            STORES.transfers,
            STORES.plans,
            STORES.shoppingLists,
            STORES.shoppingListItems,
            STORES.syncQueue,
            STORES.syncQueueShopping,
            STORES.cache,
            STORES.cachedStores,
            STORES.cachedProductGroups
        ];

        for (const storeName of storeNames) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = () => {
                    reject(request.error);
                };
            });
        }
    }

    /**
     * Get database info
     * @returns {Promise<Object>}
     */
    async getInfo() {
        await this.init();

        return {
            name: DB_NAME,
            version: DB_VERSION,
            stores: Array.from(this.db.objectStoreNames),
            isInitialized: this.isInitialized,
            pendingCount: await this.getPendingCount(),
            syncQueueCount: await this.countSyncQueue('pending'),
            stats: {
                facts: {
                    total: await this.countFacts(),
                    pending: await this.countFacts(false),
                    synced: await this.countFacts(true)
                },
                transfers: {
                    total: await this.countTransfers(),
                    pending: await this.countTransfers(false),
                    synced: await this.countTransfers(true)
                },
                plans: {
                    total: await this.countPlans(),
                    pending: await this.countPlans(false),
                    synced: await this.countPlans(true)
                },
                shoppingLists: {
                    total: await this.countShoppingLists(),
                    pending: await this.countShoppingLists(false),
                    synced: await this.countShoppingLists(true)
                },
                shoppingListItems: {
                    total: await this.countShoppingListItems(),
                    pending: await this.countShoppingListItems(false),
                    synced: await this.countShoppingListItems(true)
                },
                syncQueue: {
                    total: await this.countSyncQueue(),
                    pending: await this.countSyncQueue('pending'),
                    syncing: await this.countSyncQueue('syncing'),
                    failed: await this.countSyncQueue('failed'),
                    completed: await this.countSyncQueue('completed')
                },
                syncQueueShopping: {
                    total: await this.countShoppingSyncQueue(),
                    pending: await this.countShoppingSyncQueue('pending'),
                    syncing: await this.countShoppingSyncQueue('syncing'),
                    failed: await this.countShoppingSyncQueue('failed'),
                    completed: await this.countShoppingSyncQueue('completed')
                }
            }
        };
    }
}

// Export as global for use in other scripts
if (typeof window !== 'undefined') {
    window.IndexedDBManager = IndexedDBManager;
}
