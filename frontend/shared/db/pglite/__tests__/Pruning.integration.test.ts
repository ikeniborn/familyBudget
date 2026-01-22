/**
 * Integration tests for data pruning (task-010)
 * Tests complete workflow: feature flags + operations + manager API
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';
import {
  setPruningRetentionDays,
  setPruningEnabled,
  getPGliteFeatureFlags,
  MIN_PRUNING_RETENTION_DAYS,
  MAX_PRUNING_RETENTION_DAYS
} from '../features/featureFlags';

describe('Pruning Integration', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Clear localStorage
    localStorage.clear();

    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');

    // Initialize manager
    manager = new PGliteManager();

    // Use unique dataDir per test
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    await manager.init({ dataDir: `test-pruning-${testName}` });
  });

  afterEach(async () => {
    await manager.close();
    localStorage.clear();
  });

  describe('Feature Flag Validation', () => {
    it('should respect retention >= factsWindow constraint', () => {
      // Set factsWindow = 90
      localStorage.setItem('pgliteFactsWindow', '90');

      // Try to set retention = 60 (INVALID)
      expect(() => {
        setPruningRetentionDays(60);
      }).toThrow('Retention (60) must be >= Facts Window (90)');
    });

    it('should allow retention = factsWindow', () => {
      // Set factsWindow = 90
      localStorage.setItem('pgliteFactsWindow', '90');

      // Set retention = 90 (VALID)
      expect(() => {
        setPruningRetentionDays(90);
      }).not.toThrow();

      const flags = getPGliteFeatureFlags();
      expect(flags.pruningRetentionDays).toBe(90);
    });

    it('should enforce minimum retention days', () => {
      // Set factsWindow to minimum
      localStorage.setItem('pgliteFactsWindow', '30');

      // Try to set retention below minimum
      expect(() => {
        setPruningRetentionDays(MIN_PRUNING_RETENTION_DAYS - 1);
      }).toThrow();
    });

    it('should enforce maximum retention days', () => {
      // Set factsWindow to minimum
      localStorage.setItem('pgliteFactsWindow', '30');

      // Try to set retention above maximum
      expect(() => {
        setPruningRetentionDays(MAX_PRUNING_RETENTION_DAYS + 1);
      }).toThrow();
    });
  });

  describe('Database Size Reduction', () => {
    it('should calculate DB size reduction accurately', { timeout: 15000 }, async () => {
      // Create 100 old synced facts
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      for (let i = 0; i < 100; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: oldDate.toISOString().split('T')[0],
          amount: 100,
          record_type: 'fact',
          comment: `Test fact ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // Mark all as synced (simulate successful sync)
      const facts = await manager.queryFacts();
      for (const fact of facts) {
        await manager.confirmPendingOperation(fact.temp_id, 100 + facts.indexOf(fact));
      }

      // Prune
      const result = await manager.pruneFacts(90);

      // Verify DB size reduced
      expect(result.dbSizeBefore).toBeGreaterThan(0);
      expect(result.dbSizeAfter).toBeGreaterThan(0);
      expect(result.dbSizeBefore).toBeGreaterThanOrEqual(result.dbSizeAfter);
      expect(result.deletedCount).toBe(100);
    });
  });

  describe('Pruning Stats Tracking', () => {
    it('should track lastPrunedAt timestamp', async () => {
      // Create and prune old fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: 1,
        date: oldDate.toISOString().split('T')[0],
        amount: 100,
        record_type: 'fact',
        comment: 'Test',
        transfer_group_id: null,
          sync_hash: null,
        is_transfer: false
      });

      // Mark as synced
      const facts = await manager.queryFacts();
      await manager.confirmPendingOperation(facts[0].temp_id, 100);

      // Prune
      const beforePrune = Date.now();
      await manager.pruneFacts(90);
      const afterPrune = Date.now();

      // Check stats
      const stats = await manager.getPruningStats();
      expect(stats.lastPrunedAt).not.toBeNull();

      // Verify timestamp is recent
      const lastPruned = new Date(stats.lastPrunedAt!).getTime();
      expect(lastPruned).toBeGreaterThanOrEqual(beforePrune);
      expect(lastPruned).toBeLessThanOrEqual(afterPrune);
    });

    it('should accumulate totalPruned across multiple runs', async () => {
      // First pruning - 5 facts
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      for (let i = 0; i < 5; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: oldDate.toISOString().split('T')[0],
          amount: 100,
          record_type: 'fact',
          comment: `Batch 1 - ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // Mark as synced
      let facts = await manager.queryFacts();
      for (const fact of facts) {
        await manager.confirmPendingOperation(fact.temp_id, 100 + facts.indexOf(fact));
      }

      // Prune
      await manager.pruneFacts(90);
      const stats1 = await manager.getPruningStats();
      expect(stats1.totalPruned).toBe(5);

      // Second pruning - 3 more facts
      for (let i = 0; i < 3; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: oldDate.toISOString().split('T')[0],
          amount: 200,
          record_type: 'fact',
          comment: `Batch 2 - ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // Mark as synced
      facts = await manager.queryFacts();
      for (const fact of facts) {
        await manager.confirmPendingOperation(fact.temp_id, 200 + facts.indexOf(fact));
      }

      // Prune again
      await manager.pruneFacts(90);
      const stats2 = await manager.getPruningStats();
      expect(stats2.totalPruned).toBe(8); // 5 + 3 accumulated
    });
  });

  describe('Potential Pruning Calculation', () => {
    it('should calculate dry-run impact correctly', async () => {
      // Create mixed data
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      // 10 old synced (should be counted)
      for (let i = 0; i < 10; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: oldDate.toISOString().split('T')[0],
          amount: 100,
          record_type: 'fact',
          comment: `Old synced ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // Mark old as synced
      let facts = await manager.queryFacts({ sync_status: 'pending' });
      for (const fact of facts) {
        await manager.confirmPendingOperation(fact.temp_id, 100 + facts.indexOf(fact));
      }

      // 5 old pending (should NOT be counted)
      for (let i = 0; i < 5; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: oldDate.toISOString().split('T')[0],
          amount: 200,
          record_type: 'fact',
          comment: `Old pending ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // 3 recent synced (should NOT be counted)
      for (let i = 0; i < 3; i++) {
        await manager.createFact({
          user_id: 1,
          article_id: 1,
          financial_center_id: 1,
          cost_center_id: 1,
          date: recentDate.toISOString().split('T')[0],
          amount: 300,
          record_type: 'fact',
          comment: `Recent synced ${i}`,
          transfer_group_id: null,
          sync_hash: null,
          is_transfer: false
        });
      }

      // Mark recent as synced
      facts = await manager.queryFacts({ sync_status: 'pending' });
      const recentFacts = facts.filter(f => f.amount === 300);
      for (const fact of recentFacts) {
        await manager.confirmPendingOperation(fact.temp_id, 300 + recentFacts.indexOf(fact));
      }

      // Calculate potential pruning
      const count = await manager.calculatePotentialPruning(90);
      expect(count).toBe(10); // Only old synced facts
    });
  });

  describe('Diagnostic Data Integration', () => {
    it('should include pruning stats in diagnostic data', async () => {
      // Create and prune old fact
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 200);

      await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: 1,
        date: oldDate.toISOString().split('T')[0],
        amount: 100,
        record_type: 'fact',
        comment: 'Test',
        transfer_group_id: null,
          sync_hash: null,
        is_transfer: false
      });

      // Mark as synced
      const facts = await manager.queryFacts();
      await manager.confirmPendingOperation(facts[0].temp_id, 100);

      // Prune
      await manager.pruneFacts(90);

      // Get diagnostic data
      const diagnostic = await manager.getDiagnosticData();

      // Verify pruning stats included
      expect(diagnostic.pruningStats).toBeDefined();
      expect(diagnostic.pruningStats?.lastPrunedAt).not.toBe('Never');
      expect(diagnostic.pruningStats?.totalPruned).toBe(1);
    });

    it('should show correct nextPruneEstimate based on flag', async () => {
      // Disabled auto-pruning
      setPruningEnabled(false);
      let diagnostic = await manager.getDiagnosticData();
      expect(diagnostic.pruningStats?.nextPruneEstimate).toBe('Never');

      // Enabled auto-pruning
      setPruningEnabled(true);
      diagnostic = await manager.getDiagnosticData();
      expect(diagnostic.pruningStats?.nextPruneEstimate).toBe('in 7 days');
    });
  });
});
