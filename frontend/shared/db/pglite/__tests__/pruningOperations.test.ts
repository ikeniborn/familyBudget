/**
 * Unit tests for pruning operations (task-010)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  pruneOldFacts,
  getPruningStats,
  calculatePotentialPruning
} from '../operations/pruningOperations';
import { runMigrations } from '../core/migrationManager';

describe('pruningOperations', () => {
  let db: PGlite;

  beforeEach(async () => {
    // Create in-memory database
    db = new PGlite();

    // Run migrations
    await runMigrations(db);
  });

  describe('pruneOldFacts', () => {
    it('should delete only synced records older than retention window', async () => {
      // Create old synced fact (200 days ago) - should DELETE
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-synced', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Create old pending fact (200 days ago) - should KEEP
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-pending', 1, 1, 1, 1, $1, 200, 'expense', 'pending', 'hash2')
      `, [oldDate.toISOString().split('T')[0]]);

      // Create recent synced fact (10 days ago) - should KEEP
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('recent-synced', 1, 1, 1, 1, $1, 300, 'expense', 'synced', 'hash3')
      `, [recentDate.toISOString().split('T')[0]]);

      // Prune with 90-day retention
      const result = await pruneOldFacts(db, 90);

      // Verify only 1 record deleted (old-synced)
      expect(result.deletedCount).toBe(1);

      // Verify correct records remain
      const remaining = await db.query('SELECT temp_id FROM local_budget_facts ORDER BY temp_id');
      expect(remaining.rows.length).toBe(2);
      const remainingRows = remaining.rows as Array<{ temp_id: string }>;
      expect(remainingRows.map(r => r.temp_id)).toEqual(['old-pending', 'recent-synced']);
    });

    it('should never delete pending operations', async () => {
      // Create old pending fact (200 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-pending', 1, 1, 1, 1, $1, 100, 'expense', 'pending', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Prune with 30-day retention
      const result = await pruneOldFacts(db, 30);

      // Verify 0 records deleted
      expect(result.deletedCount).toBe(0);

      // Verify pending record still exists
      const remaining = await db.query('SELECT temp_id FROM local_budget_facts');
      expect(remaining.rows.length).toBe(1);
    });

    it('should never delete conflicted records', async () => {
      // Create old conflicted fact (200 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-conflicted', 1, 1, 1, 1, $1, 100, 'expense', 'conflicted', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Prune with 30-day retention
      const result = await pruneOldFacts(db, 30);

      // Verify 0 records deleted
      expect(result.deletedCount).toBe(0);

      // Verify conflicted record still exists
      const remaining = await db.query('SELECT temp_id FROM local_budget_facts');
      expect(remaining.rows.length).toBe(1);
    });

    it('should update pruning metadata after deletion', async () => {
      // Create old synced fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-synced', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Prune
      await pruneOldFacts(db, 90);

      // Verify metadata updated
      const stats = await getPruningStats(db);
      expect(stats.lastPrunedAt).not.toBeNull();
      expect(stats.totalPruned).toBe(1);
    });

    it('should return correct DB size metrics', async () => {
      // Create old synced facts
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      for (let i = 0; i < 10; i++) {
        await db.query(`
          INSERT INTO local_budget_facts (
            temp_id, user_id, article_id, financial_center_id, cost_center_id,
            date, amount, record_type, sync_status, content_hash
          ) VALUES ($1, 1, 1, 1, 1, $2, 100, 'expense', 'synced', $3)
        `, [`old-${i}`, oldDate.toISOString().split('T')[0], `hash-${i}`]);
      }

      // Prune
      const result = await pruneOldFacts(db, 90);

      // Verify metrics
      expect(result.dbSizeBefore).toBeGreaterThan(0);
      expect(result.dbSizeAfter).toBeGreaterThan(0);
      expect(result.dbSizeBefore).toBeGreaterThanOrEqual(result.dbSizeAfter);
      expect(result.deletedCount).toBe(10);
    });
  });

  describe('getPruningStats', () => {
    it('should return default stats when no pruning has occurred', async () => {
      const stats = await getPruningStats(db);

      expect(stats.lastPrunedAt).toBeNull();
      expect(stats.totalPruned).toBe(0);
    });

    it('should return correct stats after pruning', async () => {
      // Create and prune old fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-synced', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      await pruneOldFacts(db, 90);

      // Check stats
      const stats = await getPruningStats(db);
      expect(stats.lastPrunedAt).not.toBeNull();
      expect(stats.totalPruned).toBe(1);
    });

    it('should accumulate totalPruned across multiple pruning runs', async () => {
      // First pruning
      const oldDate1 = new Date();
      oldDate1.setDate(oldDate1.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-1', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [oldDate1.toISOString().split('T')[0]]);

      await pruneOldFacts(db, 90);
      const stats1 = await getPruningStats(db);
      expect(stats1.totalPruned).toBe(1);

      // Second pruning
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-2', 1, 1, 1, 1, $1, 200, 'expense', 'synced', 'hash2')
      `, [oldDate1.toISOString().split('T')[0]]);

      await pruneOldFacts(db, 90);
      const stats2 = await getPruningStats(db);
      expect(stats2.totalPruned).toBe(2); // Accumulated
    });
  });

  describe('calculatePotentialPruning', () => {
    it('should return 0 when no old records exist', async () => {
      const count = await calculatePotentialPruning(db, 90);
      expect(count).toBe(0);
    });

    it('should calculate correct potential deletion count', async () => {
      // Create old synced facts
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      for (let i = 0; i < 5; i++) {
        await db.query(`
          INSERT INTO local_budget_facts (
            temp_id, user_id, article_id, financial_center_id, cost_center_id,
            date, amount, record_type, sync_status, content_hash
          ) VALUES ($1, 1, 1, 1, 1, $2, 100, 'expense', 'synced', $3)
        `, [`old-${i}`, oldDate.toISOString().split('T')[0], `hash-${i}`]);
      }

      // Create recent synced facts
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      for (let i = 0; i < 3; i++) {
        await db.query(`
          INSERT INTO local_budget_facts (
            temp_id, user_id, article_id, financial_center_id, cost_center_id,
            date, amount, record_type, sync_status, content_hash
          ) VALUES ($1, 1, 1, 1, 1, $2, 200, 'expense', 'synced', $3)
        `, [`recent-${i}`, recentDate.toISOString().split('T')[0], `hash-recent-${i}`]);
      }

      // Calculate potential pruning
      const count = await calculatePotentialPruning(db, 90);
      expect(count).toBe(5); // Only old synced facts
    });

    it('should not count pending operations in potential pruning', async () => {
      // Create old pending fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);
      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('old-pending', 1, 1, 1, 1, $1, 100, 'expense', 'pending', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Calculate potential pruning
      const count = await calculatePotentialPruning(db, 90);
      expect(count).toBe(0); // Pending should not be counted
    });
  });

  describe('Edge Cases (Defensive Checks)', () => {
    it('should handle empty database gracefully', async () => {
      // No facts in database
      const count = await calculatePotentialPruning(db, 90);
      expect(count).toBe(0);
    });

    it('should handle pruning with no old records', async () => {
      // Create only recent records (10 days ago)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('recent', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [recentDate.toISOString().split('T')[0]]);

      // Prune with 90-day retention
      const result = await pruneOldFacts(db, 90);

      expect(result.deletedCount).toBe(0);
      expect(result.dbSizeBefore).toBeGreaterThan(0);
      expect(result.dbSizeAfter).toBeGreaterThan(0);
    });

    it('should return 0 for calculatePotentialPruning with fresh data', async () => {
      // Create recent synced fact
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('recent', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [recentDate.toISOString().split('T')[0]]);

      // Calculate with 30-day retention
      const count = await calculatePotentialPruning(db, 30);
      expect(count).toBe(0);
    });

    it('should handle DB size calculation on empty database', async () => {
      // Get diagnostic data on empty DB
      const result = await pruneOldFacts(db, 90);

      expect(result.dbSizeBefore).toBeGreaterThan(0); // PostgreSQL overhead
      expect(result.dbSizeAfter).toBeGreaterThan(0);
      expect(result.deletedCount).toBe(0);
    });

    it('should maintain metadata consistency across failed operations', async () => {
      // Get initial stats
      const statsBefore = await getPruningStats(db);
      expect(statsBefore.lastPrunedAt).toBeNull();
      expect(statsBefore.totalPruned).toBe(0);

      // Prune empty database (no-op)
      await pruneOldFacts(db, 90);

      // Stats should be updated even for 0 deletions
      const statsAfter = await getPruningStats(db);
      expect(statsAfter.lastPrunedAt).not.toBeNull();
      expect(statsAfter.totalPruned).toBe(0);
    });

    it('should handle extreme retention values gracefully', async () => {
      // Create old fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);

      await db.query(`
        INSERT INTO local_budget_facts (
          temp_id, user_id, article_id, financial_center_id, cost_center_id,
          date, amount, record_type, sync_status, content_hash
        ) VALUES ('very-old', 1, 1, 1, 1, $1, 100, 'expense', 'synced', 'hash1')
      `, [oldDate.toISOString().split('T')[0]]);

      // Prune with maximum retention (365 days)
      const result = await pruneOldFacts(db, 365);

      expect(result.deletedCount).toBe(1); // 400 days > 365 days
    });
  });
});
