/**
 * ConflictManager Unit Tests
 * Task-009: Conflict Resolution LWW
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';
import { ConflictManager } from '../ConflictManager';
import type { LocalBudgetFact } from '../types/fact';
import type { ServerBudgetFact } from '../ConflictManager';

describe('ConflictManager', () => {
  let manager: PGliteManager;
  let conflictManager: ConflictManager;

  beforeEach(async () => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();

    // Use unique dataDir per test
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    await manager.init({ dataDir: `test-conflict-${testName}` });

    const db = manager.getDatabase();
    if (!db) throw new Error('Database not initialized');
    conflictManager = new ConflictManager(db);
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  describe('detectConflicts', () => {
    it('should detect conflict when sync_hash differs', async () => {
      const localRecords: LocalBudgetFact[] = [
        {
          id: 1,
          temp_id: 'temp-001',
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
          sync_hash: 'hash_a',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const serverRecords: ServerBudgetFact[] = [
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
          sync_hash: 'hash_b', // Different hash!
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'), // Newer
          synced_at: null
        }
      ];

      const conflicts = await conflictManager.detectConflicts(localRecords, serverRecords);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].entityId).toBe(1);
      expect(conflicts[0].localRecord.sync_hash).toBe('hash_a');
      expect(conflicts[0].serverRecord.sync_hash).toBe('hash_b');
    });

    it('should not detect conflict when sync_hash matches', async () => {
      const localRecords: LocalBudgetFact[] = [
        {
          id: 1,
          temp_id: 'temp-001',
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
          sync_hash: 'same_hash',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const serverRecords: ServerBudgetFact[] = [
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
          sync_hash: 'same_hash', // Same hash!
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const conflicts = await conflictManager.detectConflicts(localRecords, serverRecords);

      expect(conflicts).toHaveLength(0);
    });

    it('should skip deleted records', async () => {
      const localRecords: LocalBudgetFact[] = [
        {
          id: 1,
          temp_id: 'temp-001',
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
          sync_status: 'deleted', // Deleted!
          sync_hash: 'hash_a',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const serverRecords: ServerBudgetFact[] = [
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
          sync_hash: 'hash_b',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const conflicts = await conflictManager.detectConflicts(localRecords, serverRecords);

      // Should skip deleted record
      expect(conflicts).toHaveLength(0);
    });

    it('should skip records with missing server sync_hash', async () => {
      const localRecords: LocalBudgetFact[] = [
        {
          id: 1,
          temp_id: 'temp-001',
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
          sync_hash: 'hash_a',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const serverRecords: ServerBudgetFact[] = [
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
          sync_hash: null, // Missing sync_hash!
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        }
      ];

      const conflicts = await conflictManager.detectConflicts(localRecords, serverRecords);

      // Should skip defensive check
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('resolveLWW', () => {
    it('should resolve to server when server timestamp is newer', () => {
      const conflict = {
        entityType: 'budget_fact' as const,
        entityId: 1,
        tempId: 'temp-001',
        localRecord: {} as LocalBudgetFact,
        serverRecord: {} as ServerBudgetFact,
        localUpdatedAt: new Date('2026-01-22T10:00:00Z'),
        serverUpdatedAt: new Date('2026-01-22T11:00:00Z') // Server newer!
      };

      const resolution = conflictManager.resolveLWW(conflict);

      expect(resolution).toBe('server');
    });

    it('should resolve to client when client timestamp is newer', () => {
      const conflict = {
        entityType: 'budget_fact' as const,
        entityId: 1,
        tempId: 'temp-001',
        localRecord: {} as LocalBudgetFact,
        serverRecord: {} as ServerBudgetFact,
        localUpdatedAt: new Date('2026-01-22T12:00:00Z'), // Client newer!
        serverUpdatedAt: new Date('2026-01-22T11:00:00Z')
      };

      const resolution = conflictManager.resolveLWW(conflict);

      expect(resolution).toBe('client');
    });

    it('should default to server when timestamps are equal', () => {
      const conflict = {
        entityType: 'budget_fact' as const,
        entityId: 1,
        tempId: 'temp-001',
        localRecord: {} as LocalBudgetFact,
        serverRecord: {} as ServerBudgetFact,
        localUpdatedAt: new Date('2026-01-22T10:00:00Z'),
        serverUpdatedAt: new Date('2026-01-22T10:00:00Z') // Equal!
      };

      const resolution = conflictManager.resolveLWW(conflict);

      // Default to server for consistency
      expect(resolution).toBe('server');
    });
  });

  describe('logConflict', () => {
    it('should log conflict to local_sync_conflicts table', async () => {
      const conflict = {
        entityType: 'budget_fact' as const,
        entityId: 1,
        tempId: 'temp-001',
        localRecord: {
          id: 1,
          temp_id: 'temp-001',
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
          sync_hash: 'hash_a',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T10:00:00Z'),
          synced_at: null
        } as LocalBudgetFact,
        serverRecord: {
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
          sync_hash: 'hash_b',
          content_hash: null,
          created_at: new Date('2026-01-22T10:00:00Z'),
          updated_at: new Date('2026-01-22T11:00:00Z'),
          synced_at: null
        } as ServerBudgetFact,
        localUpdatedAt: new Date('2026-01-22T10:00:00Z'),
        serverUpdatedAt: new Date('2026-01-22T11:00:00Z')
      };

      await conflictManager.logConflict(conflict, 'server');

      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      const logs = await db.query('SELECT * FROM local_sync_conflicts WHERE entity_id = 1');

      expect(logs.rows).toHaveLength(1);
      expect(logs.rows[0].entity_type).toBe('budget_fact');
      expect(logs.rows[0].resolution).toBe('server');
      expect(logs.rows[0].resolved_at).not.toBeNull();

      // Check JSONB versions
      const localVersion = JSON.parse(logs.rows[0].local_version);
      const serverVersion = JSON.parse(logs.rows[0].server_version);

      expect(localVersion.amount).toBe(100);
      expect(serverVersion.amount).toBe(150);
    });
  });

  describe('getConflictMetrics', () => {
    it('should return default metrics when no conflicts exist', async () => {
      const metrics = await conflictManager.getConflictMetrics();

      expect(metrics.totalConflicts).toBe(0);
      expect(metrics.resolvedConflicts).toBe(0);
      expect(metrics.pendingConflicts).toBe(0);
      expect(metrics.conflictRate).toBe(0);
      expect(metrics.resolutionBreakdown.server).toBe(0);
      expect(metrics.resolutionBreakdown.client).toBe(0);
      expect(metrics.resolutionBreakdown.merged).toBe(0);
      expect(metrics.resolutionBreakdown.pending).toBe(0);
    });

    it('should calculate metrics correctly with multiple conflicts', async () => {
      const db = manager.getDatabase();
      if (!db) throw new Error('Database not initialized');

      // Insert test conflicts
      await db.exec(`
        INSERT INTO local_sync_conflicts (entity_type, entity_id, temp_id, local_version, server_version, resolution, resolved_at, created_at)
        VALUES
          ('budget_fact', 1, 'temp-001', '{}', '{}', 'server', NOW(), NOW()),
          ('budget_fact', 2, 'temp-002', '{}', '{}', 'client', NOW(), NOW()),
          ('budget_fact', 3, 'temp-003', '{}', '{}', 'server', NOW(), NOW()),
          ('budget_fact', 4, 'temp-004', '{}', '{}', 'pending', NULL, NOW())
      `);

      const metrics = await conflictManager.getConflictMetrics();

      expect(metrics.totalConflicts).toBe(4);
      expect(metrics.resolvedConflicts).toBe(3); // server + client + server
      expect(metrics.pendingConflicts).toBe(1);
      expect(metrics.resolutionBreakdown.server).toBe(2);
      expect(metrics.resolutionBreakdown.client).toBe(1);
      expect(metrics.resolutionBreakdown.pending).toBe(1);
    });
  });
});
