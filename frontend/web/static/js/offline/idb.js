/**
 * IndexedDB Manager для Offline Storage
 * Family Budget PWA
 *
 * Database Schema:
 * - offline_facts: Offline транзакции
 * - offline_transfers: Offline переводы
 * - offline_plans: Offline планы
 * - offline_recurring_plans: Offline recurring plans
 * - offline_shopping_lists: Offline списки покупок
 * - offline_shopping_list_items: Offline items списков покупок
 * - sync_queue: Очередь синхронизации
 * - sync_queue_shopping: Очередь синхронизации для shopping lists
 * - data_cache: Кеш reference data (articles, accounts, cost locations)
 * - cached_stores: Кеш магазинов (для offline)
 * - cached_product_groups: Кеш групп товаров (для offline)
 * - sync_metadata: Метаданные синхронизации
 *
 * @version 2.0.0
 * @date 2026-01-05
 */
// Silent logger - only errors in production
const _idbLog = window.DEBUG_MODE ? console.log.bind(console) : function () { };
const _idbWarn = window.DEBUG_MODE ? console.warn.bind(console) : function () { };
const DB_NAME = 'FamilyBudgetDB';
const DB_VERSION = 5; // v5: Added offline_recurring_plans store
const STORES = {
    facts: 'offline_facts',
    transfers: 'offline_transfers',
    plans: 'offline_plans',
    recurringPlans: 'offline_recurring_plans',
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
                    const tx = event.target.transaction;
                    const factsStore = tx.objectStore(STORES.facts);
                    if (!factsStore.indexNames.contains('contentHash')) {
                        factsStore.createIndex('contentHash', 'contentHash', { unique: false });
                    }
                }
                // v5 migration: Add offline_recurring_plans store
                if (event.oldVersion < 5) {
                    if (!db.objectStoreNames.contains(STORES.recurringPlans)) {
                        const recurringPlansStore = db.createObjectStore(STORES.recurringPlans, {
                            keyPath: 'tempId',
                            autoIncrement: false
                        });
                        recurringPlansStore.createIndex('synced', 'synced', { unique: false });
                        recurringPlansStore.createIndex('createdAt', 'createdAt', { unique: false });
                        recurringPlansStore.createIndex('serverId', 'serverId', { unique: false });
                    }
                }
            };
        });
    }
    // ==================== MD5 HASHING ====================
    /**
     * Compact MD5 implementation for duplicate detection
     * Based on Joseph Myers' implementation (public domain)
     * @param str - Input string
     * @returns MD5 hash as hex string
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
                for (i = 0; i < 16; i++)
                    tail[i] = 0;
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
     * @param data - Fact/Plan data
     * @returns MD5 hash of key fields
     */
    generateContentHash(data) {
        const content = `${data.article_id || ''}|${data.amount || ''}|${data.fact_date || ''}|${data.description || ''}|${data.record_type || 'fact'}`;
        return this._md5(content);
    }
    /**
     * Check for duplicate by content hash
     * @param hash - Content hash to check
     * @returns Existing record or null
     */
    async checkDuplicateByHash(hash) {
        await this.init();
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(null);
                return;
            }
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
                // ⏰ Unsynced but old (>5 min) - not a duplicate
                const TIME_WINDOW = 5 * 60 * 1000; // 5 minutes
                const now = Date.now();
                const createdAt = new Date(result.createdAt).getTime();
                const timeDiff = now - createdAt;
                if (timeDiff > TIME_WINDOW) {
                    _idbLog('[IDB] Stale unsynced record (>5min), not considering duplicate');
                    resolve(null);
                    return;
                }
                // 🔴 Recent unsynced duplicate
                _idbLog('[IDB] Recent unsynced duplicate detected');
                resolve(result);
            };
            request.onerror = () => {
                _idbWarn('[IDB] Error checking duplicate:', request.error);
                resolve(null);
            };
        });
    }
    // ==================== GENERIC CRUD HELPERS ====================
    /**
     * Generic add to store
     */
    async _add(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
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
     * Generic get from store
     */
    async _get(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
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
     * Generic getAll from store
     */
    async _getAll(storeName, indexName = null, query = null) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let request;
            if (indexName) {
                const index = store.index(indexName);
                request = query !== null ? index.getAll(query) : index.getAll();
            }
            else {
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
     * Generic update in store
     */
    async _update(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
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
     * Generic delete from store
     */
    async _delete(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
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
     * Generic count in store
     */
    async _count(storeName, indexName = null, query = null) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('DB not initialized'));
                return;
            }
            const tx = this.db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            let request;
            if (indexName) {
                const index = store.index(indexName);
                request = query !== null ? index.count(query) : index.count();
            }
            else {
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
    // ==================== FACTS CRUD ====================
    async addFact(fact) {
        return this._add(STORES.facts, fact);
    }
    async getFact(tempId) {
        return this._get(STORES.facts, tempId);
    }
    async getAllFacts(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.facts, 'synced', synced);
        }
        return this._getAll(STORES.facts);
    }
    async updateFact(fact) {
        return this._update(STORES.facts, fact);
    }
    async deleteFact(tempId) {
        return this._delete(STORES.facts, tempId);
    }
    async countFacts(synced = null) {
        if (synced !== null) {
            return this._count(STORES.facts, 'synced', synced);
        }
        return this._count(STORES.facts);
    }
    // ==================== TRANSFERS CRUD ====================
    async addTransfer(transfer) {
        return this._add(STORES.transfers, transfer);
    }
    async getTransfer(tempId) {
        return this._get(STORES.transfers, tempId);
    }
    async getAllTransfers(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.transfers, 'synced', synced);
        }
        return this._getAll(STORES.transfers);
    }
    async updateTransfer(transfer) {
        return this._update(STORES.transfers, transfer);
    }
    async deleteTransfer(tempId) {
        return this._delete(STORES.transfers, tempId);
    }
    async countTransfers(synced = null) {
        if (synced !== null) {
            return this._count(STORES.transfers, 'synced', synced);
        }
        return this._count(STORES.transfers);
    }
    // ==================== PLANS CRUD ====================
    async addPlan(plan) {
        return this._add(STORES.plans, plan);
    }
    async getPlan(tempId) {
        return this._get(STORES.plans, tempId);
    }
    async getAllPlans(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.plans, 'synced', synced);
        }
        return this._getAll(STORES.plans);
    }
    async updatePlan(plan) {
        return this._update(STORES.plans, plan);
    }
    async deletePlan(tempId) {
        return this._delete(STORES.plans, tempId);
    }
    async countPlans(synced = null) {
        if (synced !== null) {
            return this._count(STORES.plans, 'synced', synced);
        }
        return this._count(STORES.plans);
    }
    // ==================== RECURRING PLANS CRUD ====================
    async addRecurringPlan(recurringPlan) {
        return this._add(STORES.recurringPlans, recurringPlan);
    }
    async getRecurringPlan(tempId) {
        return this._get(STORES.recurringPlans, tempId);
    }
    async getAllRecurringPlans(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.recurringPlans, 'synced', synced);
        }
        return this._getAll(STORES.recurringPlans);
    }
    async updateRecurringPlan(recurringPlan) {
        return this._update(STORES.recurringPlans, recurringPlan);
    }
    async deleteRecurringPlan(tempId) {
        return this._delete(STORES.recurringPlans, tempId);
    }
    async countRecurringPlans(synced = null) {
        if (synced !== null) {
            return this._count(STORES.recurringPlans, 'synced', synced);
        }
        return this._count(STORES.recurringPlans);
    }
    // ==================== SYNC QUEUE ====================
    async addToSyncQueue(item) {
        return this._add(STORES.syncQueue, item);
    }
    async getSyncQueueItem(id) {
        return this._get(STORES.syncQueue, id);
    }
    async getSyncQueue(status = null) {
        if (status) {
            return this._getAll(STORES.syncQueue, 'status', status);
        }
        return this._getAll(STORES.syncQueue);
    }
    async updateSyncQueueItem(id, updates) {
        const item = await this.getSyncQueueItem(id);
        if (!item) {
            throw new Error(`Sync queue item ${id} not found`);
        }
        const updated = { ...item, ...updates };
        return this._update(STORES.syncQueue, updated);
    }
    async deleteSyncQueueItem(id) {
        return this._delete(STORES.syncQueue, id);
    }
    async countSyncQueue(status = null) {
        if (status) {
            return this._count(STORES.syncQueue, 'status', status);
        }
        return this._count(STORES.syncQueue);
    }
    async clearCompletedSyncQueue() {
        // Увеличенная задержка чтобы IndexedDB успел обновить indexes
        await new Promise(resolve => setTimeout(resolve, 100));
        const completed = await this.getSyncQueue('completed');
        _idbLog(`[IDB] clearCompletedSyncQueue: found ${completed.length} completed items`);
        let count = 0;
        for (const item of completed) {
            try {
                await this.deleteSyncQueueItem(item.id);
                count++;
                _idbLog(`[IDB] Deleted sync queue item ${item.id} (tempId: ${item.tempId})`);
            }
            catch (e) {
                console.error(`[IDB] Failed to delete item ${item.id}:`, e);
            }
        }
        _idbLog(`[IDB] clearCompletedSyncQueue: deleted ${count} items`);
        return count;
    }
    // ==================== DATA CACHE ====================
    async setCache(key, value, ttl = 3600) {
        const data = {
            key,
            value,
            expires: Date.now() + (ttl * 1000),
            updatedAt: Date.now()
        };
        return this._update(STORES.cache, data);
    }
    async getCache(key) {
        const data = await this._get(STORES.cache, key);
        if (!data)
            return null;
        // Check if expired
        if (data.expires < Date.now()) {
            await this._delete(STORES.cache, key);
            return null;
        }
        return data.value;
    }
    async deleteCache(key) {
        return this._delete(STORES.cache, key);
    }
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
    async addShoppingList(list) {
        return this._add(STORES.shoppingLists, list);
    }
    async getShoppingList(tempId) {
        return this._get(STORES.shoppingLists, tempId);
    }
    async getAllShoppingLists(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.shoppingLists, 'synced', synced);
        }
        return this._getAll(STORES.shoppingLists);
    }
    async updateShoppingList(list) {
        return this._update(STORES.shoppingLists, list);
    }
    async deleteShoppingList(tempId) {
        return this._delete(STORES.shoppingLists, tempId);
    }
    async countShoppingLists(synced = null) {
        if (synced !== null) {
            return this._count(STORES.shoppingLists, 'synced', synced);
        }
        return this._count(STORES.shoppingLists);
    }
    // ==================== SHOPPING LIST ITEMS ====================
    async addShoppingListItem(item) {
        return this._add(STORES.shoppingListItems, item);
    }
    async getShoppingListItem(tempId) {
        return this._get(STORES.shoppingListItems, tempId);
    }
    async getShoppingListItemsByListId(shoppingListId) {
        return this._getAll(STORES.shoppingListItems, 'shoppingListId', shoppingListId);
    }
    async getAllShoppingListItems(synced = null) {
        if (synced !== null) {
            return this._getAll(STORES.shoppingListItems, 'synced', synced);
        }
        return this._getAll(STORES.shoppingListItems);
    }
    async getItemsBySyncStatus(syncStatus) {
        return this._getAll(STORES.shoppingListItems, 'syncStatus', syncStatus);
    }
    async updateShoppingListItem(item) {
        return this._update(STORES.shoppingListItems, item);
    }
    async deleteShoppingListItem(tempId) {
        return this._delete(STORES.shoppingListItems, tempId);
    }
    async countShoppingListItems(synced = null) {
        if (synced !== null) {
            return this._count(STORES.shoppingListItems, 'synced', synced);
        }
        return this._count(STORES.shoppingListItems);
    }
    // ==================== CACHED STORES ====================
    async cacheStores(stores) {
        const tx = (await this.init()).transaction(STORES.cachedStores, 'readwrite');
        const store = tx.objectStore(STORES.cachedStores);
        // Clear existing stores
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });
        // Add new stores
        for (const storeItem of stores) {
            const storeWithCache = {
                ...storeItem,
                cachedAt: new Date().toISOString()
            };
            await new Promise((resolve, reject) => {
                const addRequest = store.add(storeWithCache);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        }
    }
    async getCachedStores() {
        return this._getAll(STORES.cachedStores);
    }
    // ==================== CACHED PRODUCT GROUPS ====================
    async cacheProductGroups(groups) {
        const tx = (await this.init()).transaction(STORES.cachedProductGroups, 'readwrite');
        const store = tx.objectStore(STORES.cachedProductGroups);
        // Clear existing groups
        await new Promise((resolve, reject) => {
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => resolve();
            clearRequest.onerror = () => reject(clearRequest.error);
        });
        // Add new groups
        for (const group of groups) {
            const groupWithCache = {
                ...group,
                cachedAt: new Date().toISOString()
            };
            await new Promise((resolve, reject) => {
                const addRequest = store.add(groupWithCache);
                addRequest.onsuccess = () => resolve();
                addRequest.onerror = () => reject(addRequest.error);
            });
        }
    }
    async getCachedProductGroups() {
        return this._getAll(STORES.cachedProductGroups);
    }
    // ==================== SYNC QUEUE SHOPPING ====================
    async addToSyncQueueShopping(item) {
        return this._add(STORES.syncQueueShopping, item);
    }
    async getSyncQueueShoppingItem(id) {
        return this._get(STORES.syncQueueShopping, id);
    }
    async getSyncQueueShopping(status = null) {
        if (status) {
            return this._getAll(STORES.syncQueueShopping, 'status', status);
        }
        return this._getAll(STORES.syncQueueShopping);
    }
    async updateSyncQueueShoppingItem(id, updates) {
        const item = await this.getSyncQueueShoppingItem(id);
        if (!item) {
            throw new Error(`Sync queue shopping item ${id} not found`);
        }
        const updated = { ...item, ...updates };
        return this._update(STORES.syncQueueShopping, updated);
    }
    async deleteSyncQueueShoppingItem(id) {
        return this._delete(STORES.syncQueueShopping, id);
    }
    async clearCompletedSyncQueueShopping() {
        await new Promise(resolve => setTimeout(resolve, 100));
        const completed = await this.getSyncQueueShopping('completed');
        _idbLog(`[IDB] clearCompletedSyncQueueShopping: found ${completed.length} completed items`);
        let count = 0;
        for (const item of completed) {
            try {
                await this.deleteSyncQueueShoppingItem(item.id);
                count++;
            }
            catch (e) {
                console.error(`[IDB] Failed to delete shopping queue item ${item.id}:`, e);
            }
        }
        _idbLog(`[IDB] clearCompletedSyncQueueShopping: deleted ${count} items`);
        return count;
    }
    // ==================== SYNC METADATA ====================
    async setSyncMetadata(listId, timestamp) {
        const data = { listId, lastSyncTimestamp: timestamp };
        await this._update(STORES.syncMetadata, data);
    }
    async getSyncMetadata(listId) {
        return this._get(STORES.syncMetadata, listId);
    }
    async deleteSyncMetadata(listId) {
        return this._delete(STORES.syncMetadata, listId);
    }
    // ==================== UTILITY METHODS ====================
    /**
     * Get count of pending (unsynced) items across all stores
     */
    async getPendingCount() {
        const unsyncedFacts = await this.countFacts(false);
        const unsyncedTransfers = await this.countTransfers(false);
        const unsyncedPlans = await this.countPlans(false);
        return unsyncedFacts + unsyncedTransfers + unsyncedPlans;
    }
    /**
     * Get database info
     */
    async getInfo() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const stores = [];
        for (let i = 0; i < this.db.objectStoreNames.length; i++) {
            stores.push(this.db.objectStoreNames[i]);
        }
        return {
            dbName: DB_NAME,
            version: DB_VERSION,
            stores
        };
    }
    /**
     * Clear all stores (DANGEROUS!)
     */
    async clearAll() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const tx = this.db.transaction([
            STORES.facts,
            STORES.transfers,
            STORES.plans,
            STORES.recurringPlans,
            STORES.shoppingLists,
            STORES.shoppingListItems,
            STORES.syncQueue,
            STORES.syncQueueShopping,
            STORES.cache,
            STORES.cachedStores,
            STORES.cachedProductGroups,
            STORES.syncMetadata
        ], 'readwrite');
        const promises = [];
        for (const storeName of Object.values(STORES)) {
            const store = tx.objectStore(storeName);
            promises.push(new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }));
        }
        await Promise.all(promises);
    }
    /**
     * Hash arbitrary string (for sync_hash, etc.)
     */
    hashString(content) {
        return this._md5(content);
    }
}
// Export as global
if (typeof window !== 'undefined') {
    window.IndexedDBManager = IndexedDBManager;
}
// ES Module exports for testing
export { IndexedDBManager };
export default IndexedDBManager;
//# sourceMappingURL=idb.js.map