import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Import the idb.ts file to ensure it loads and attaches to window
import '../../../web/static/js/offline/idb';

// Access IndexedDBManager from the global window object (how it's designed to work)
const IndexedDBManager = (window as any).IndexedDBManager;

// Local type definition (not exported from idb.ts)
interface OfflineFact {
    tempId: string;
    userId: number;
    article_id: number;
    financial_center_id: number;
    cost_center_id: number | null;
    amount: number;
    fact_date: string;
    description: string;
    record_type: 'INCOME' | 'EXPENSE';
    transfer_id: number | null;
    synced: boolean;
    serverId: number | null;
    createdAt: number;
    syncHash: string | null;
    contentHash: string | null;
}

describe('IndexedDBManager', () => {
    let db: IndexedDBManager;

    beforeEach(async () => {
        // Disable fake timers for IndexedDB tests (they interfere with async IDB operations)
        vi.useRealTimers();

        db = new IndexedDBManager();
        await db.init();
    });

    afterEach(async () => {
        // Clean up test DB
        if (db) {
            await db.clearAll();
        }
    });

    describe('init', () => {
        it('should initialize database with correct name', async () => {
            expect(db['db']).toBeDefined();
            expect(db['db']!.name).toBe('FamilyBudgetDB');
        });

        it('should have correct database version', async () => {
            expect(db['db']).toBeDefined();
            expect(db['db']!.version).toBe(5);
        });

        it('should have all 12 object stores', async () => {
            const storeNames = db['db']!.objectStoreNames;
            expect(storeNames.length).toBe(12);
            expect(storeNames.contains('offline_facts')).toBe(true);
            expect(storeNames.contains('offline_transfers')).toBe(true);
            expect(storeNames.contains('offline_plans')).toBe(true);
            expect(storeNames.contains('offline_recurring_plans')).toBe(true);
            expect(storeNames.contains('sync_queue')).toBe(true);
            expect(storeNames.contains('data_cache')).toBe(true);
            expect(storeNames.contains('offline_shopping_lists')).toBe(true);
            expect(storeNames.contains('offline_shopping_list_items')).toBe(true);
            expect(storeNames.contains('sync_queue_shopping')).toBe(true);
            expect(storeNames.contains('cached_stores')).toBe(true);
            expect(storeNames.contains('cached_product_groups')).toBe(true);
            expect(storeNames.contains('sync_metadata')).toBe(true);
        });

        it('should return same db instance on multiple init calls', async () => {
            const db1 = await db.init();
            const db2 = await db.init();
            expect(db1).toBe(db2);
        });
    });

    describe('CRUD operations - Facts', () => {
        it('should add fact to IndexedDB', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            const tempId = await db.addFact(fact);
            expect(tempId).toBe('temp-1');
        });

        it('should get fact by tempId', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact);
            const retrieved = await db.getFact('temp-1');

            expect(retrieved).toBeDefined();
            expect(retrieved!.amount).toBe(1000);
            expect(retrieved!.description).toBe('Test');
        });

        it('should return undefined for non-existent fact', async () => {
            const fact = await db.getFact('non-existent');
            expect(fact).toBeUndefined();
        });

        it('should update fact', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact);

            // Update fact
            fact.amount = 1500;
            fact.description = 'Updated';
            await db.updateFact(fact);

            const updated = await db.getFact('temp-1');
            expect(updated!.amount).toBe(1500);
            expect(updated!.description).toBe('Updated');
        });

        it('should delete fact', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact);
            await db.deleteFact('temp-1');

            const deleted = await db.getFact('temp-1');
            expect(deleted).toBeUndefined();
        });

        it('should get all facts', async () => {
            const fact1: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test 1',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            const fact2: OfflineFact = {
                ...fact1,
                tempId: 'temp-2',
                description: 'Test 2'
            };

            await db.addFact(fact1);
            await db.addFact(fact2);

            const allFacts = await db.getAllFacts();
            expect(allFacts).toHaveLength(2);
        });

        it('should count facts', async () => {
            const fact1: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact1);
            await db.addFact({ ...fact1, tempId: 'temp-2' });

            const count = await db.countFacts();
            expect(count).toBe(2);
        });
    });

    describe('index queries', () => {
        it('should query all facts', async () => {
            const fact1: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Unsynced',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            const fact2: OfflineFact = {
                ...fact1,
                tempId: 'temp-2',
                description: 'Synced',
                synced: true,
                serverId: 123
            };

            await db.addFact(fact1);
            await db.addFact(fact2);

            const allFacts = await db.getAllFacts();
            expect(allFacts).toHaveLength(2);

            // Manual filtering works around fake-indexeddb boolean index limitations
            const unsynced = allFacts.filter(f => f.synced === false);
            expect(unsynced).toHaveLength(1);
            expect(unsynced[0].tempId).toBe('temp-1');

            const synced = allFacts.filter(f => f.synced === true);
            expect(synced).toHaveLength(1);
            expect(synced[0].tempId).toBe('temp-2');
        });

        it('should count all facts', async () => {
            const fact1: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact1);
            await db.addFact({ ...fact1, tempId: 'temp-2' });

            const allFacts = await db.getAllFacts();
            expect(allFacts.length).toBe(2);

            // Verify all are unsynced
            const unsyncedCount = allFacts.filter(f => !f.synced).length;
            expect(unsyncedCount).toBe(2);
        });

        it('should get all facts count', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact);
            await db.addFact({ ...fact, tempId: 'temp-2' });

            const allFacts = await db.getAllFacts();
            expect(allFacts.length).toBe(2);
        });
    });

    describe('content hash', () => {
        it('should generate same hash for identical content', () => {
            const data1 = { article_id: 10, amount: 1000, description: 'Test', fact_date: '2025-01-03', record_type: 'EXPENSE' };
            const data2 = { article_id: 10, amount: 1000, description: 'Test', fact_date: '2025-01-03', record_type: 'EXPENSE' };

            const hash1 = db.generateContentHash(data1);
            const hash2 = db.generateContentHash(data2);

            expect(hash1).toBe(hash2);
            expect(hash1).toMatch(/^[a-f0-9]{32}$/); // MD5 format
        });

        it('should generate different hash for different content', () => {
            const data1 = { article_id: 10, amount: 1000, description: 'Test' };
            const data2 = { article_id: 10, amount: 1500, description: 'Test' };

            const hash1 = db.generateContentHash(data1);
            const hash2 = db.generateContentHash(data2);

            expect(hash1).not.toBe(hash2);
        });

        it('should detect duplicates by hash', async () => {
            const contentHash = db.generateContentHash({
                article_id: 10,
                amount: 1000,
                description: 'Test',
                fact_date: '2025-01-03'
            });

            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash
            };

            await db.addFact(fact);

            const duplicate = await db.checkDuplicateByHash(contentHash);
            expect(duplicate).toBeDefined();
            expect(duplicate.tempId).toBe('temp-1');
        });

        it('should not consider synced records as duplicates', async () => {
            const contentHash = db.generateContentHash({
                article_id: 10,
                amount: 1000,
                description: 'Test',
                fact_date: '2025-01-03'
            });

            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: true, // Already synced
                serverId: 123,
                createdAt: Date.now(),
                syncHash: null,
                contentHash
            };

            await db.addFact(fact);

            const duplicate = await db.checkDuplicateByHash(contentHash);
            expect(duplicate).toBeNull(); // Not a duplicate
        });

        it('should not consider old unsynced records as duplicates (>5min)', async () => {
            const contentHash = db.generateContentHash({
                article_id: 10,
                amount: 1000,
                description: 'Test',
                fact_date: '2025-01-03'
            });

            const oldTime = Date.now() - (6 * 60 * 1000); // 6 minutes ago

            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: oldTime, // Old timestamp
                syncHash: null,
                contentHash
            };

            await db.addFact(fact);

            const duplicate = await db.checkDuplicateByHash(contentHash);
            expect(duplicate).toBeNull(); // Too old to be duplicate
        });

        it('should detect recent unsynced duplicates (<5min)', async () => {
            const contentHash = db.generateContentHash({
                article_id: 10,
                amount: 1000,
                description: 'Test',
                fact_date: '2025-01-03'
            });

            const recentTime = Date.now() - (2 * 60 * 1000); // 2 minutes ago

            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: recentTime, // Recent timestamp
                syncHash: null,
                contentHash
            };

            await db.addFact(fact);

            const duplicate = await db.checkDuplicateByHash(contentHash);
            expect(duplicate).toBeDefined(); // Recent duplicate
            expect(duplicate.tempId).toBe('temp-1');
        });
    });

    describe('cache operations', () => {
        it('should set and get cache value', async () => {
            await db.setCache('test-key', { data: 'test-value' }, 3600);

            const value = await db.getCache('test-key');
            expect(value).toEqual({ data: 'test-value' });
        });

        it('should return null for non-existent cache key', async () => {
            const value = await db.getCache('non-existent');
            expect(value).toBeNull();
        });

        it('should return null for expired cache', async () => {
            // Set cache with 1 second TTL
            await db.setCache('expired-key', { data: 'value' }, 1);

            // Wait 1.1 seconds for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));

            const value = await db.getCache('expired-key');
            expect(value).toBeNull();
        });

        it('should update cache value', async () => {
            await db.setCache('update-key', { data: 'old' }, 3600);
            await db.setCache('update-key', { data: 'new' }, 3600);

            const value = await db.getCache('update-key');
            expect(value).toEqual({ data: 'new' });
        });

        it('should delete cache', async () => {
            await db.setCache('delete-key', { data: 'value' }, 3600);
            await db.deleteCache('delete-key');

            const value = await db.getCache('delete-key');
            expect(value).toBeNull();
        });

        it('should clear expired cache entries', async () => {
            // Add 2 expired entries + 1 valid
            await db.setCache('expired-1', 'val1', 1);
            await db.setCache('expired-2', 'val2', 1);
            await db.setCache('valid', 'val3', 3600);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 1100));

            const count = await db.clearExpiredCache();
            expect(count).toBe(2);

            // Valid entry should still exist
            const value = await db.getCache('valid');
            expect(value).toBe('val3');
        });
    });

    describe('sync queue operations', () => {
        it('should add item to sync queue', async () => {
            const queueItem = {
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: { amount: 1000 },
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            };

            const id = await db.addToSyncQueue(queueItem);
            expect(id).toBeGreaterThan(0);
        });

        it('should get sync queue item by id', async () => {
            const queueItem = {
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: { amount: 1000 },
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            };

            const id = await db.addToSyncQueue(queueItem);
            const item = await db.getSyncQueueItem(id);

            expect(item).toBeDefined();
            expect(item!.operation).toBe('CREATE');
            expect(item!.entity).toBe('fact');
        });

        it('should get all sync queue items', async () => {
            await db.addToSyncQueue({
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: {},
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });

            await db.addToSyncQueue({
                operation: 'UPDATE',
                entity: 'fact',
                entityId: 'temp-2',
                tempId: 'temp-2',
                data: {},
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });

            const queue = await db.getSyncQueue();
            expect(queue.length).toBeGreaterThanOrEqual(2);
        });

        it('should update sync queue item', async () => {
            const id = await db.addToSyncQueue({
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: {},
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });

            await db.updateSyncQueueItem(id, { status: 'completed', retries: 1 });

            const updated = await db.getSyncQueueItem(id);
            expect(updated!.status).toBe('completed');
            expect(updated!.retries).toBe(1);
        });

        it('should delete sync queue item', async () => {
            const id = await db.addToSyncQueue({
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: {},
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });

            await db.deleteSyncQueueItem(id);

            const deleted = await db.getSyncQueueItem(id);
            expect(deleted).toBeUndefined();
        });

        it('should clear completed sync queue items', async () => {
            // Add completed items
            await db.addToSyncQueue({
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-1',
                tempId: 'temp-1',
                data: {},
                status: 'completed',
                retries: 0,
                timestamp: Date.now()
            });

            await db.addToSyncQueue({
                operation: 'UPDATE',
                entity: 'fact',
                entityId: 'temp-2',
                tempId: 'temp-2',
                data: {},
                status: 'completed',
                retries: 0,
                timestamp: Date.now()
            });

            // Add pending item (should NOT be deleted)
            await db.addToSyncQueue({
                operation: 'DELETE',
                entity: 'fact',
                entityId: 'temp-3',
                tempId: 'temp-3',
                data: {},
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });

            const clearedCount = await db.clearCompletedSyncQueue();
            expect(clearedCount).toBe(2);

            const remaining = await db.getSyncQueue();
            expect(remaining.length).toBe(1);
            expect(remaining[0].status).toBe('pending');
        });
    });

    describe('shopping lists operations', () => {
        it('should add shopping list', async () => {
            const list = {
                tempId: 'list-1',
                name: 'Groceries',
                userId: 1,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            };

            const tempId = await db.addShoppingList(list);
            expect(tempId).toBe('list-1');
        });

        it('should get shopping list by tempId', async () => {
            const list = {
                tempId: 'list-1',
                name: 'Groceries',
                userId: 1,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            };

            await db.addShoppingList(list);
            const retrieved = await db.getShoppingList('list-1');

            expect(retrieved).toBeDefined();
            expect(retrieved!.name).toBe('Groceries');
        });

        it('should update shopping list', async () => {
            const list = {
                tempId: 'list-1',
                name: 'Groceries',
                userId: 1,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            };

            await db.addShoppingList(list);

            list.name = 'Updated List';
            await db.updateShoppingList(list);

            const updated = await db.getShoppingList('list-1');
            expect(updated!.name).toBe('Updated List');
        });

        it('should delete shopping list', async () => {
            const list = {
                tempId: 'list-1',
                name: 'Groceries',
                userId: 1,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            };

            await db.addShoppingList(list);
            await db.deleteShoppingList('list-1');

            const deleted = await db.getShoppingList('list-1');
            expect(deleted).toBeUndefined();
        });

        it('should add shopping list item', async () => {
            const item = {
                tempId: 'item-1',
                shoppingListId: 1,
                productName: 'Milk',
                quantity: 2,
                unit: 'л',
                isCompleted: false,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            };

            const tempId = await db.addShoppingListItem(item);
            expect(tempId).toBe('item-1');
        });

        it('should get shopping list items by list id', async () => {
            await db.addShoppingListItem({
                tempId: 'item-1',
                shoppingListId: 1,
                productName: 'Milk',
                quantity: 2,
                unit: 'л',
                isCompleted: false,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            });

            await db.addShoppingListItem({
                tempId: 'item-2',
                shoppingListId: 1,
                productName: 'Bread',
                quantity: 1,
                unit: 'шт',
                isCompleted: false,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            });

            await db.addShoppingListItem({
                tempId: 'item-3',
                shoppingListId: 2,
                productName: 'Eggs',
                quantity: 10,
                unit: 'шт',
                isCompleted: false,
                synced: false,
                serverId: null,
                createdAt: Date.now()
            });

            const items = await db.getShoppingListItemsByListId(1);
            expect(items.length).toBe(2);
            expect(items[0].productName).toBe('Milk');
            expect(items[1].productName).toBe('Bread');
        });
    });

    describe('clearAll', () => {
        it('should clear all stores', async () => {
            const fact: OfflineFact = {
                tempId: 'temp-1',
                userId: 1,
                article_id: 10,
                financial_center_id: 5,
                cost_center_id: null,
                amount: 1000,
                fact_date: '2025-01-03',
                description: 'Test',
                record_type: 'EXPENSE',
                transfer_id: null,
                synced: false,
                serverId: null,
                createdAt: Date.now(),
                syncHash: null,
                contentHash: null
            };

            await db.addFact(fact);
            expect(await db.countFacts()).toBe(1);

            await db.clearAll();

            expect(await db.countFacts()).toBe(0);
        });
    });
});
