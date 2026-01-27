/**
 * Incremental Sync Tests (task-007)
 * Tests for bulkInsertFacts, bulkUpdateFacts, bulkSoftDeleteFacts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGlite Incremental Sync (task-007)', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();

    // Use unique dataDir per test
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    await manager.init({ dataDir: `test-incremental-sync-${testName}` });
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  describe('bulkInsertFacts()', () => {
    it('should bulk insert created facts from server', async () => {
      const serverFacts = [
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',  // renamed from fact_date
          amount: 1500.50,
          comment: 'Server fact 1',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash1',
          sync_hash: 'synchash1',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-20T10:00:00Z'),
        },
        {
          id: 102,
          user_id: 1,
          article_id: 20,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-21',
          amount: 2000.00,
          comment: 'Server fact 2',
          record_type: 'fact' as const,
          transfer_group_id: null,
          is_transfer: false,
          content_hash: 'hash2',
          sync_hash: 'synchash2',
          sync_status: 'synced' as const,
          synced_at: new Date(),
          created_at: new Date('2026-01-21T11:00:00Z'),
          updated_at: new Date('2026-01-21T11:00:00Z'),
        },
      ];

      // Bulk insert
      await manager.bulkInsertFacts(serverFacts);

      // Verify facts exist with srv-{id} prefix
      const facts = await manager.queryFacts();
      expect(facts).toHaveLength(2);

      // Check first fact
      const fact1 = facts.find(f => f.id === 101);
      expect(fact1).toBeDefined();
      expect(fact1!.temp_id).toBe('srv-101'); // Server prefix
      expect(fact1!.sync_status).toBe('synced');
      expect(fact1!.amount).toBe(1500.50);

      // Check second fact
      const fact2 = facts.find(f => f.id === 102);
      expect(fact2).toBeDefined();
      expect(fact2!.temp_id).toBe('srv-102');
      expect(fact2!.sync_status).toBe('synced');
      expect(fact2!.amount).toBe(2000.00);
    });

    it('should handle UPSERT on duplicate bulkInsertFacts', async () => {
      const serverFact = {
        id: 101,
        user_id: 1,
        article_id: 10,
        financial_center_id: 5,
        cost_center_id: null,
        date: '2026-01-20',
        amount: 1500.50,
        comment: 'Original',
        record_type: 'fact' as const,
        transfer_group_id: null,
        is_transfer: false,
        content_hash: 'hash1',
        sync_hash: 'synchash1',
        sync_status: 'synced' as const,
        synced_at: new Date(),
        created_at: new Date('2026-01-20T10:00:00Z'),
        updated_at: new Date('2026-01-20T10:00:00Z'),
      };

      // First insert
      await manager.bulkInsertFacts([serverFact]);

      // Second insert (same temp_id) with updated data
      const updatedFact = {
        ...serverFact,
        amount: 2000.00,
        comment: 'Updated',
      };
      await manager.bulkInsertFacts([updatedFact]);

      // Verify only 1 fact exists (UPSERT, not duplicate)
      const facts = await manager.queryFacts();
      expect(facts).toHaveLength(1);
      expect(facts[0].amount).toBe(2000.00);
      expect(facts[0].comment).toBe('Updated');
    });
  });

  describe('bulkUpdateFacts()', () => {
    it('should bulk update existing server facts', async () => {
      // Setup: insert initial facts
      const initialFacts = [
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',
          amount: 1000.00,
          comment: 'Initial',
          record_type: 'fact' as const,
          transfer_group_id: null,
          is_transfer: false,
          content_hash: 'hash1',
          sync_hash: 'synchash1',
          sync_status: 'synced' as const,
          synced_at: new Date(),
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-20T10:00:00Z'),
        },
      ];
      await manager.bulkInsertFacts(initialFacts);

      // Update
      const updatedFacts = [
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',
          amount: 1500.50, // Changed
          comment: 'Updated comment', // Changed
          record_type: 'fact' as const,
          transfer_group_id: null,
          is_transfer: false,
          content_hash: 'hash1_updated',
          sync_hash: 'synchash1_updated',
          sync_status: 'synced' as const,
          synced_at: new Date(),
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-20T12:00:00Z'), // Changed
        },
      ];
      await manager.bulkUpdateFacts(updatedFacts);

      // Verify update
      const facts = await manager.queryFacts();
      expect(facts).toHaveLength(1);
      expect(facts[0].amount).toBe(1500.50);
      expect(facts[0].comment).toBe('Updated comment');
      expect(facts[0].sync_status).toBe('synced');
    });
  });

  describe('bulkSoftDeleteFacts()', () => {
    it('should soft delete facts (set sync_status=deleted)', async () => {
      // Setup: insert facts
      const initialFacts = [
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',  // renamed from fact_date
          amount: 1000.00,
          comment: 'To be deleted',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash1',
          sync_hash: 'synchash1',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-20T10:00:00Z'),
        },
      ];
      await manager.bulkInsertFacts(initialFacts);

      // Soft delete
      await manager.bulkSoftDeleteFacts([101]);

      // Verify soft delete: fact still exists but with sync_status='deleted'
      const db = manager.getDatabase();
      if (!db) throw new Error('DB not initialized');

      const result = await db.query(
        `SELECT * FROM local_budget_facts WHERE temp_id = 'srv-101'`
      );
      expect(result.rows).toHaveLength(1);
      expect((result.rows[0] as Record<string, unknown>).sync_status).toBe('deleted');

      // QueryFacts should NOT return deleted facts (filtered by sync_status != 'deleted')
      const visibleFacts = await manager.queryFacts();
      expect(visibleFacts).toHaveLength(0);
    });
  });

  describe('Incremental Sync Workflow', () => {
    it('should simulate full incremental sync (created + updated + deleted)', async () => {
      // Setup: initial facts
      await manager.bulkInsertFacts([
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',  // renamed from fact_date
          amount: 1000.00,
          comment: 'Initial fact 1',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash1',
          sync_hash: 'synchash1',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-20T10:00:00Z'),
        },
        {
          id: 102,
          user_id: 1,
          article_id: 20,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-21',  // renamed from fact_date
          amount: 2000.00,
          comment: 'Initial fact 2',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash2',
          sync_hash: 'synchash2',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-21T11:00:00Z'),
          updated_at: new Date('2026-01-21T11:00:00Z'),
        },
      ]);

      // Simulate incremental sync response
      // Created: 1 new fact
      await manager.bulkInsertFacts([
        {
          id: 103,
          user_id: 1,
          article_id: 30,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',  // renamed from fact_date
          amount: 3000.00,
          comment: 'New fact',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash3',
          sync_hash: 'synchash3',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-22T12:00:00Z'),
          updated_at: new Date('2026-01-22T12:00:00Z'),
        },
      ]);

      // Updated: fact 101 amount changed
      await manager.bulkUpdateFacts([
        {
          id: 101,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-20',  // renamed from fact_date
          amount: 1500.00, // Changed
          comment: 'Updated fact 1',  // renamed from description
          record_type: 'fact' as const,
          transfer_group_id: null,  // renamed from transfer_id
          is_transfer: false,  // added
          content_hash: 'hash1_updated',
          sync_hash: 'synchash1_updated',
          sync_status: 'synced' as const,  // added
          synced_at: new Date(),  // added
          created_at: new Date('2026-01-20T10:00:00Z'),
          updated_at: new Date('2026-01-22T13:00:00Z'),
        },
      ]);

      // Deleted: fact 102 deleted
      await manager.bulkSoftDeleteFacts([102]);

      // Verify final state
      const facts = await manager.queryFacts();
      expect(facts).toHaveLength(2); // 101 (updated) + 103 (new), 102 (deleted)

      const fact101 = facts.find(f => f.id === 101);
      expect(fact101!.amount).toBe(1500.00); // Updated amount

      const fact103 = facts.find(f => f.id === 103);
      expect(fact103!.amount).toBe(3000.00); // New fact

      const fact102 = facts.find(f => f.id === 102);
      expect(fact102).toBeUndefined(); // Soft deleted, not visible
    });
  });
});
