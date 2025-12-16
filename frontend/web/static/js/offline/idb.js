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

// Silent logger - only errors in production
const _idbLog = window.DEBUG_MODE ? console.log.bind(console) : function() {};
const _idbWarn = window.DEBUG_MODE ? console.warn.bind(console) : function() {};

const DB_NAME = 'FamilyBudgetDB';
const DB_VERSION = 4;  // v4: Added contentHash index for duplicate detection

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

                // v4 migration: Add contentHash index to facts store
                if (event.oldVersion < 4) {
                    const factsStore = event.target.transaction.objectStore(STORES.facts);
                    if (!factsStore.indexNames.contains('contentHash')) {
                        factsStore.createIndex('contentHash', 'contentHash', { unique: false });
                    }
                }
            };
        });
    }

    // ==================== MD5 HASHING ====================

    /**
     * Compact MD5 implementation for duplicate detection
     * Based on Joseph Myers' implementation (public domain)
     * @param {string} str - Input string
     * @returns {string} MD5 hash as hex string
     */
    _md5(str) {
        const md5cycle = (x, k) => {
            let a = x[0], b = x[1], c = x[2], d = x[3];
            a = ff(a, b, c, d, k[0], 7, -680876936);
            d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);
            b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);
            d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);
            b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);
            d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);
            b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);
            d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290);
            b = ff(b, c, d, a, k[15], 22, 1236535329);
            a = gg(a, b, c, d, k[1], 5, -165796510);
            d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);
            b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);
            d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);
            b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);
            d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);
            b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);
            d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);
            b = gg(b, c, d, a, k[12], 20, -1926607734);
            a = hh(a, b, c, d, k[5], 4, -378558);
            d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);
            b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);
            d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);
            b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);
            d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);
            b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);
            d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);
            b = hh(b, c, d, a, k[2], 23, -995338651);
            a = ii(a, b, c, d, k[0], 6, -198630844);
            d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905);
            b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);
            d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);
            b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);
            d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);
            b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);
            d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);
            b = ii(b, c, d, a, k[9], 21, -343485551);
            x[0] = add32(a, x[0]);
            x[1] = add32(b, x[1]);
            x[2] = add32(c, x[2]);
            x[3] = add32(d, x[3]);
        };

        const cmn = (q, a, b, x, s, t) => {
            a = add32(add32(a, q), add32(x, t));
            return add32((a << s) | (a >>> (32 - s)), b);
        };
        const ff = (a, b, c, d, x, s, t) => cmn((b & c) | ((~b) & d), a, b, x, s, t);
        const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & (~d)), a, b, x, s, t);
        const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
        const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | (~d)), a, b, x, s, t);

        const add32 = (a, b) => (a + b) & 0xFFFFFFFF;

        const md5blk = (s) => {
            const md5blks = [];
            for (let i = 0; i < 64; i += 4) {
                md5blks[i >> 2] = s.charCodeAt(i) +
                    (s.charCodeAt(i + 1) << 8) +
                    (s.charCodeAt(i + 2) << 16) +
                    (s.charCodeAt(i + 3) << 24);
            }
            return md5blks;
        };

        const hex_chr = '0123456789abcdef'.split('');
        const rhex = (n) => {
            let s = '';
            for (let j = 0; j < 4; j++) {
                s += hex_chr[(n >> (j * 8 + 4)) & 0x0F] + hex_chr[(n >> (j * 8)) & 0x0F];
            }
            return s;
        };

        const hex = (x) => x.map(rhex).join('');

        const md5_1 = (s) => {
            const n = s.length;
            const state = [1732584193, -271733879, -1732584194, 271733878];
            let i;
            for (i = 64; i <= n; i += 64) {
                md5cycle(state, md5blk(s.substring(i - 64, i)));
            }
            s = s.substring(i - 64);
            const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            for (i = 0; i < s.length; i++) {
                tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
            }
            tail[i >> 2] |= 0x80 << ((i % 4) << 3);
            if (i > 55) {
                md5cycle(state, tail);
                for (i = 0; i < 16; i++) tail[i] = 0;
            }
            tail[14] = n * 8;
            md5cycle(state, tail);
            return state;
        };

        // Convert to UTF-8
        const toUTF8 = (s) => {
            return unescape(encodeURIComponent(s));
        };

        return hex(md5_1(toUTF8(str)));
    }

    /**
     * Generate content hash for duplicate detection
     * @param {Object} data - Fact/Plan data
     * @returns {string} MD5 hash of key fields
     */
    generateContentHash(data) {
        const content = `${data.article_id || ''}|${data.amount || ''}|${data.fact_date || ''}|${data.description || ''}|${data.record_type || 'fact'}`;
        return this._md5(content);
    }

    /**
     * Check for duplicate by content hash
     * @param {string} hash - Content hash to check
     * @returns {Promise<Object|null>} Existing record or null
     */
    async checkDuplicateByHash(hash) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORES.facts, 'readonly');
            const store = tx.objectStore(STORES.facts);

            // Check if contentHash index exists
            if (!store.indexNames.contains('contentHash')) {
                _idbWarn('[IDB] contentHash index not found, skipping duplicate check');
                resolve(null);
                return;
            }

            const index = store.index('contentHash');
            const request = index.get(hash);

            request.onsuccess = () => {
                const result = request.result;

                if (!result) {
                    resolve(null);
                    return;
                }

                // ✅ Synced records are NOT duplicates (already on server)
                if (result.synced) {
                    _idbLog('[IDB] Found synced record, not considering duplicate');
                    resolve(null);
                    return;
                }

                // ✅ Unsynced - check staleness (time window)
                const timeDiff = Date.now() - (result.createdAt || 0);
                const TIME_WINDOW = 5 * 60 * 1000; // 5 minutes

                if (timeDiff > TIME_WINDOW) {
                    _idbLog('[IDB] Stale unsynced record (>5min), not considering duplicate');
                    resolve(null);
                    return;
                }

                // Recent unsynced duplicate - reject
                _idbLog('[IDB] Recent unsynced duplicate detected');
                resolve(result);
            };

            request.onerror = () => {
                _idbWarn('[IDB] Error checking duplicate:', request.error);
                resolve(null);
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
        // Увеличенная задержка чтобы IndexedDB успел обновить indexes после status update
        // (50ms было недостаточно для надежной работы при manual offline mode exit)
        await new Promise(resolve => setTimeout(resolve, 100));

        const completed = await this.getSyncQueue('completed');
        _idbLog(`[IDB] clearCompletedSyncQueue: found ${completed.length} completed items`);

        let count = 0;
        for (const item of completed) {
            try {
                await this.deleteSyncQueueItem(item.id);
                count++;
                _idbLog(`[IDB] Deleted sync queue item ${item.id} (tempId: ${item.tempId})`);
            } catch (e) {
                console.error(`[IDB] Failed to delete item ${item.id}:`, e);
            }
        }

        _idbLog(`[IDB] clearCompletedSyncQueue: deleted ${count} items`);
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
