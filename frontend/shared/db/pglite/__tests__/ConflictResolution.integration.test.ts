/**
 * Conflict Resolution Integration Tests
 * Task-009: Full sync flow with conflict detection and LWW resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';
import type { ServerBudgetFact } from '../ConflictManager';

describe('Conflict Resolution Integration', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite and conflict resolution
    localStorage.setItem('enablePGlite', 'true');
    localStorage.setItem('pgliteEnableConflictResolution', 'true');

    manager = new PGliteManager();

    // Use unique dataDir per test
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    await manager.init({ dataDir: `test-conflict-integration-${testName}` });
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  describe('handleSyncIncremental - Server wins', () => {
    it('should resolve conflict during incremental sync (server wins)', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Setup: Create local record (older)
      await db.exec(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at
        ) VALUES (
          1, 'temp-001', 1, 10, 5, NULL,
          '2026-01-22', 100, 'fact', NULL,
          NULL, false,
          'synced', 'old_hash', NULL,
          '2026-01-22 10:00:00', '2026-01-22 10:00:00'
        )
      `);

      // Simulate server change (newer timestamp)
      const serverChanges: ServerBudgetFact[] = [
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 150,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'new_hash',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Newer!
          synced_at: null
        }
      ];

      const result = await manager.handleSyncIncremental({
        created: [],
        updated: serverChanges,
        deleted: []
      });

      // Verify conflict detected and resolved
      expect(result.conflicts).toBe(1);
      expect(result.applied).toBe(0); // Conflict handled, not applied
      expect(result.errors).toBe(0);

      // Verify server version applied
      const updated = await db.query(
        'SELECT amount, sync_hash FROM local_budget_facts WHERE id = 1'
      );
      expect(updated.rows[0].amount).toBe(150); // Server value
      expect(updated.rows[0].sync_hash).toBe('new_hash'); // Server hash

      // Verify conflict logged
      const conflicts = await db.query(
        'SELECT * FROM local_sync_conflicts WHERE entity_id = 1'
      );
      expect(conflicts.rows).toHaveLength(1);
      expect(conflicts.rows[0].resolution).toBe('server');

      const localVersion = JSON.parse(conflicts.rows[0].local_version);
      const serverVersion = JSON.parse(conflicts.rows[0].server_version);

      expect(localVersion.amount).toBe(100);
      expect(serverVersion.amount).toBe(150);
    });
  });

  describe('handleSyncIncremental - Client wins', () => {
    it('should resolve conflict during incremental sync (client wins)', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Setup: Create local record (newer)
      await db.exec(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at
        ) VALUES (
          1, 'temp-001', 1, 10, 5, NULL,
          '2026-01-22', 200, 'fact', NULL,
          NULL, false,
          'synced', 'newer_hash', NULL,
          '2026-01-22 12:00:00', '2026-01-22 12:00:00'
        )
      `);

      // Simulate server change (older timestamp)
      const serverChanges: ServerBudgetFact[] = [
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 150,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'old_hash',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Older!
          synced_at: null
        }
      ];

      const result = await manager.handleSyncIncremental({
        created: [],
        updated: serverChanges,
        deleted: []
      });

      // Verify conflict detected and resolved
      expect(result.conflicts).toBe(1);
      expect(result.errors).toBe(0);

      // Verify client version kept
      const updated = await db.query(
        'SELECT amount, sync_status FROM local_budget_facts WHERE id = 1'
      );
      expect(updated.rows[0].amount).toBe(200); // Client value
      expect(updated.rows[0].sync_status).toBe('pending'); // Marked for re-upload

      // Verify conflict logged
      const conflicts = await db.query(
        'SELECT * FROM local_sync_conflicts WHERE entity_id = 1'
      );
      expect(conflicts.rows).toHaveLength(1);
      expect(conflicts.rows[0].resolution).toBe('client');
    });
  });

  describe('handleSyncIncremental - No conflicts', () => {
    it('should apply non-conflicting changes', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Simulate server changes (new records)
      const serverChanges: ServerBudgetFact[] = [
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 100,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_1',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const result = await manager.handleSyncIncremental({
        created: serverChanges,
        updated: [],
        deleted: []
      });

      // Verify no conflicts
      expect(result.conflicts).toBe(0);
      expect(result.applied).toBe(1);
      expect(result.errors).toBe(0);

      // Verify record created
      const facts = await db.query('SELECT * FROM local_budget_facts WHERE id = 1');
      expect(facts.rows).toHaveLength(1);
      expect(facts.rows[0].amount).toBe(100);
    });
  });

  describe('handleSyncIncremental - Multiple conflicts', () => {
    it('should resolve multiple conflicts correctly', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Setup: Create 3 local records
      await db.exec(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at
        ) VALUES
          (1, 'temp-001', 1, 10, 5, NULL, '2026-01-22', 100, 'fact', NULL, NULL, false, 'synced', 'hash_1_old', NULL, '2026-01-22 10:00:00', '2026-01-22 10:00:00'),
          (2, 'temp-002', 1, 10, 5, NULL, '2026-01-22', 200, 'fact', NULL, NULL, false, 'synced', 'hash_2_old', NULL, '2026-01-22 12:00:00', '2026-01-22 12:00:00'),
          (3, 'temp-003', 1, 10, 5, NULL, '2026-01-22', 300, 'fact', NULL, NULL, false, 'synced', 'hash_3_old', NULL, '2026-01-22 10:00:00', '2026-01-22 10:00:00')
      `);

      // Simulate server changes
      const serverChanges: ServerBudgetFact[] = [
        // Record 1: Server newer (server wins)
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 150,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_1_new',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Newer!
          synced_at: null
        },
        // Record 2: Client newer (client wins)
        {
          id: 2,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 250,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_2_new',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Older!
          synced_at: null
        },
        // Record 3: Server newer (server wins)
        {
          id: 3,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 350,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_3_new',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Newer!
          synced_at: null
        }
      ];

      const result = await manager.handleSyncIncremental({
        created: [],
        updated: serverChanges,
        deleted: []
      });

      // Verify 3 conflicts detected
      expect(result.conflicts).toBe(3);
      expect(result.errors).toBe(0);

      // Verify resolutions
      const facts = await db.query(
        'SELECT id, amount, sync_status FROM local_budget_facts ORDER BY id'
      );

      // Record 1: Server wins (150)
      expect(facts.rows[0].amount).toBe(150);
      expect(facts.rows[0].sync_status).toBe('synced');

      // Record 2: Client wins (200)
      expect(facts.rows[1].amount).toBe(200);
      expect(facts.rows[1].sync_status).toBe('pending'); // Marked for re-upload

      // Record 3: Server wins (350)
      expect(facts.rows[2].amount).toBe(350);
      expect(facts.rows[2].sync_status).toBe('synced');

      // Verify conflicts logged
      const conflicts = await db.query(
        'SELECT entity_id, resolution FROM local_sync_conflicts ORDER BY entity_id'
      );
      expect(conflicts.rows).toHaveLength(3);
      expect(conflicts.rows[0].resolution).toBe('server'); // Record 1
      expect(conflicts.rows[1].resolution).toBe('client'); // Record 2
      expect(conflicts.rows[2].resolution).toBe('server'); // Record 3
    });
  });

  describe('Feature flag - Conflict resolution disabled', () => {
    it('should skip conflict resolution when feature flag is disabled', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Disable conflict resolution
      localStorage.setItem('pgliteEnableConflictResolution', 'false');

      // Setup: Create local record
      await db.exec(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at
        ) VALUES (
          1, 'temp-001', 1, 10, 5, NULL,
          '2026-01-22', 100, 'fact', NULL,
          NULL, false,
          'synced', 'old_hash', NULL,
          '2026-01-22 10:00:00', '2026-01-22 10:00:00'
        )
      `);

      // Simulate server change
      const serverChanges: ServerBudgetFact[] = [
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 150,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'new_hash',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'),
          synced_at: null
        }
      ];

      const result = await manager.handleSyncIncremental({
        created: [],
        updated: serverChanges,
        deleted: []
      });

      // Verify no conflicts detected (feature disabled)
      expect(result.conflicts).toBe(0);
      expect(result.applied).toBe(1); // Server change applied directly
      expect(result.errors).toBe(0);

      // Verify server version applied
      const updated = await db.query(
        'SELECT amount FROM local_budget_facts WHERE id = 1'
      );
      expect(updated.rows[0].amount).toBe(150); // Server value

      // Verify no conflicts logged
      const conflicts = await db.query(
        'SELECT * FROM local_sync_conflicts WHERE entity_id = 1'
      );
      expect(conflicts.rows).toHaveLength(0);
    });
  });

  describe('getConflictMetrics', () => {
    it('should aggregate metrics correctly after sync', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Setup: Create local records
      await db.exec(`
        INSERT INTO local_budget_facts (
          id, temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, comment,
          transfer_group_id, is_transfer,
          sync_status, sync_hash, content_hash,
          created_at, updated_at
        ) VALUES
          (1, 'temp-001', 1, 10, 5, NULL, '2026-01-22', 100, 'fact', NULL, NULL, false, 'synced', 'hash_1_old', NULL, '2026-01-22 10:00:00', '2026-01-22 10:00:00'),
          (2, 'temp-002', 1, 10, 5, NULL, '2026-01-22', 200, 'fact', NULL, NULL, false, 'synced', 'hash_2_old', NULL, '2026-01-22 12:00:00', '2026-01-22 12:00:00')
      `);

      // Simulate server changes
      const serverChanges: ServerBudgetFact[] = [
        {
          id: 1,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 150,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_1_new',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'),
          synced_at: null
        },
        {
          id: 2,
          user_id: 1,
          article_id: 10,
          financial_center_id: 5,
          cost_center_id: null,
          date: '2026-01-22',
          amount: 250,
          record_type: 'fact',
          comment: null,
          transfer_group_id: null,
          is_transfer: false,
          sync_status: 'synced',
          sync_hash: 'hash_2_new',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'),
          synced_at: null
        }
      ];

      await manager.handleSyncIncremental({
        created: [],
        updated: serverChanges,
        deleted: []
      });

      // Get metrics
      const metrics = await manager.getConflictMetrics();

      expect(metrics.totalConflicts).toBe(2);
      expect(metrics.resolvedConflicts).toBe(2);
      expect(metrics.pendingConflicts).toBe(0);
      expect(metrics.resolutionBreakdown.server).toBe(1); // Record 1
      expect(metrics.resolutionBreakdown.client).toBe(1); // Record 2
    });
  });
});
