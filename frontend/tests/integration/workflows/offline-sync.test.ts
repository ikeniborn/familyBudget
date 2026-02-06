/**
 * Integration Test: Offline Sync Workflow
 * Tests complete offline-to-online sync cycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// TODO(v11.0): Update test after Dexie migration
// Legacy test imports offline/idb which was removed in v11.0
// Requires full rewrite to use Dexie API instead of IndexedDBManager
// Related: Dexie migration (docs/architecture/core/dexie-integration.md)

// Import IndexedDB manager
// import '../../../web/static/js/offline/idb';  // REMOVED in v11.0
// const IndexedDBManager = (window as any).IndexedDBManager;

describe.skip('Offline Sync Workflow', () => {
    let db: any;
    let mockFetch: any;

    beforeEach(async () => {
        // Disable fake timers for integration tests
        vi.useRealTimers();

        db = new IndexedDBManager();
        await db.init();

        // Mock fetch API
        mockFetch = vi.fn();
        global.fetch = mockFetch;
    });

    afterEach(async () => {
        if (db) {
            await db.clearAll();
        }
        vi.clearAllMocks();
    });

    it('should complete full offline-to-online sync cycle', async () => {
        // ========== STEP 1: Go Offline ==========
        const isOnline = false;

        // ========== STEP 2: Create Transaction Offline ==========
        const offlineFact = {
            tempId: `temp-${Date.now()}`,
            userId: 1,
            article_id: 10,
            financial_center_id: 5,
            cost_center_id: null,
            amount: 1000,
            fact_date: '2025-01-06',
            description: 'Offline Transaction',
            record_type: 'EXPENSE',
            transfer_id: null,
            synced: false,
            serverId: null,
            createdAt: Date.now(),
            syncHash: null,
            contentHash: null
        };

        // Save to IndexedDB
        const tempId = await db.addFact(offlineFact);
        expect(tempId).toBe(offlineFact.tempId);

        // Add to sync queue
        const queueItem = {
            operation: 'CREATE',
            entity: 'fact',
            entityId: tempId,
            tempId: tempId,
            data: offlineFact,
            status: 'pending',
            retries: 0,
            timestamp: Date.now()
        };

        const queueId = await db.addToSyncQueue(queueItem);
        expect(queueId).toBeGreaterThan(0);

        // ========== STEP 3: Verify Offline State ==========
        const savedFact = await db.getFact(tempId);
        expect(savedFact).toBeDefined();
        expect(savedFact.synced).toBe(false);
        expect(savedFact.amount).toBe(1000);

        const pendingQueue = await db.getSyncQueue();
        expect(pendingQueue.length).toBeGreaterThanOrEqual(1);

        // ========== STEP 4: Go Online & Trigger Sync ==========
        // Mock successful API response
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    id: 12345,
                    ...offlineFact,
                    is_synced: true,
                    created_at: new Date().toISOString()
                }
            })
        });

        // Simulate sync process
        const pendingItems = await db.getSyncQueue();

        for (const item of pendingItems) {
            try {
                // Sync to server
                const response = await fetch('http://localhost:8000/api/v1/facts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });

                expect(response.ok).toBe(true);
                const result = await response.json();
                const serverId = result.data.id;

                // Update fact with serverId
                const fact = await db.getFact(item.tempId);
                fact.synced = true;
                fact.serverId = serverId;
                await db.updateFact(fact);

                // Mark queue item as completed
                await db.updateSyncQueueItem(item.id!, { status: 'completed' });

            } catch (error) {
                console.error('Sync failed:', error);
                // Mark as failed
                await db.updateSyncQueueItem(item.id!, {
                    status: 'failed',
                    retries: item.retries + 1
                });
            }
        }

        // ========== STEP 5: Verify Synced State ==========
        const syncedFact = await db.getFact(tempId);
        expect(syncedFact.synced).toBe(true);
        expect(syncedFact.serverId).toBeGreaterThan(0);

        // ========== STEP 6: Clear Completed Queue ==========
        const clearedCount = await db.clearCompletedSyncQueue();
        expect(clearedCount).toBe(1);

        const remainingQueue = await db.getSyncQueue();
        expect(remainingQueue.length).toBe(0);
    });

    it('should handle sync failures with retry', async () => {
        // Mock API error response
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Internal Server Error' })
        });

        // Create offline fact
        const offlineFact = {
            tempId: `temp-${Date.now()}`,
            userId: 1,
            article_id: 10,
            financial_center_id: 5,
            cost_center_id: null,
            amount: 2000,
            fact_date: '2025-01-06',
            description: 'Failed Transaction',
            record_type: 'EXPENSE',
            transfer_id: null,
            synced: false,
            serverId: null,
            createdAt: Date.now(),
            syncHash: null,
            contentHash: null
        };

        await db.addFact(offlineFact);

        const queueItem = {
            operation: 'CREATE',
            entity: 'fact',
            entityId: offlineFact.tempId,
            tempId: offlineFact.tempId,
            data: offlineFact,
            status: 'pending',
            retries: 0,
            timestamp: Date.now()
        };

        const queueId = await db.addToSyncQueue(queueItem);

        // Try to sync (should fail)
        const pendingItems = await db.getSyncQueue();
        const item = pendingItems[0];

        try {
            const response = await fetch('http://localhost:8000/api/v1/facts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            // Mark as failed with retry
            await db.updateSyncQueueItem(item.id!, {
                status: 'failed',
                retries: item.retries + 1
            });
        }

        // Verify failed state
        const failedItem = await db.getSyncQueueItem(queueId);
        expect(failedItem!.status).toBe('failed');
        expect(failedItem!.retries).toBe(1);

        // Fact should still be unsynced
        const fact = await db.getFact(offlineFact.tempId);
        expect(fact.synced).toBe(false);
        expect(fact.serverId).toBeNull();
    });

    it('should prevent duplicate syncs using contentHash', async () => {
        // Create first fact
        const contentHash = db.generateContentHash({
            article_id: 10,
            amount: 1000,
            description: 'Duplicate Test',
            fact_date: '2025-01-06'
        });

        const fact1 = {
            tempId: 'temp-1',
            userId: 1,
            article_id: 10,
            financial_center_id: 5,
            cost_center_id: null,
            amount: 1000,
            fact_date: '2025-01-06',
            description: 'Duplicate Test',
            record_type: 'EXPENSE',
            transfer_id: null,
            synced: false,
            serverId: null,
            createdAt: Date.now(),
            syncHash: null,
            contentHash
        };

        await db.addFact(fact1);

        // Try to create duplicate (within 5 min window)
        const duplicate = await db.checkDuplicateByHash(contentHash);
        expect(duplicate).toBeDefined();
        expect(duplicate.tempId).toBe('temp-1');

        // Should NOT add duplicate to queue
        if (duplicate) {
            console.log('[DEDUP] Duplicate detected, skipping sync');
        } else {
            // Would add to queue
            await db.addToSyncQueue({
                operation: 'CREATE',
                entity: 'fact',
                entityId: 'temp-2',
                tempId: 'temp-2',
                data: fact1,
                status: 'pending',
                retries: 0,
                timestamp: Date.now()
            });
        }

        const queue = await db.getSyncQueue();
        expect(queue.length).toBe(0); // No duplicate queued
    });
});
