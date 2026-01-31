/**
 * DexieManager Unit Tests
 * Базовые тесты для core functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexieManager } from '../DexieManager';
import { db } from '../core/database';

describe('DexieManager', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
  });

  afterEach(async () => {
    await manager.clearAll();
    await manager.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      expect(manager.isReady()).toBe(true);
      expect(manager.getStatus()).toBe('ready');
    });

    it('should not re-initialize if already ready', async () => {
      await manager.init(); // Second init
      expect(manager.isReady()).toBe(true);
    });

    it('should close database', async () => {
      await manager.close();
      expect(manager.getStatus()).toBe('not_started');
    });
  });

  describe('Articles CRUD', () => {
    it('should query articles', async () => {
      const articles = await manager.queryArticles({ user_id: 1 });
      expect(Array.isArray(articles)).toBe(true);
    });

    it('should filter articles by type', async () => {
      // Insert test articles
      await db.articles.bulkAdd([
        {
          id: 1,
          user_id: 1,
          parent_id: null,
          name: 'Income Article',
          type: 'income',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 2,
          user_id: 1,
          parent_id: null,
          name: 'Expense Article',
          type: 'expense',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      const incomeArticles = await manager.queryArticles({
        user_id: 1,
        type: 'income'
      });

      expect(incomeArticles.length).toBe(1);
      expect(incomeArticles[0].type).toBe('income');
    });
  });

  describe('Facts CRUD', () => {
    it('should create fact', async () => {
      const temp_id = await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 123.45, // dollars
        record_type: 'fact',
        comment: 'Test fact',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      expect(temp_id).toBeDefined();
      expect(typeof temp_id).toBe('string');
    });

    it('should query facts', async () => {
      // Create test fact
      await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0,
        record_type: 'fact',
        comment: 'Test',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      const facts = await manager.queryFacts({ user_id: 1 });

      expect(facts.length).toBeGreaterThan(0);
      expect(facts[0].user_id).toBe(1);
    });

    it('should update fact', async () => {
      const temp_id = await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0,
        record_type: 'fact',
        comment: 'Original',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      await manager.updateFact(temp_id, {
        amount: 200.0,
        comment: 'Updated'
      });

      const facts = await manager.queryFacts({ user_id: 1 });
      const updatedFact = facts.find(f => f.temp_id === temp_id);

      expect(updatedFact).toBeDefined();
      expect(updatedFact!.amount).toBe(200.0);
      expect(updatedFact!.comment).toBe('Updated');
    });

    it('should delete fact (soft)', async () => {
      const temp_id = await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0,
        record_type: 'fact',
        comment: 'To delete',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      await manager.deleteFact(temp_id);

      const deletedFact = await db.budgetFacts.where('temp_id').equals(temp_id).first();

      expect(deletedFact).toBeDefined();
      expect(deletedFact!.sync_status).toBe('deleted');
    });
  });

  describe('Bulk Operations', () => {
    it('should bulk insert facts', async () => {
      const facts = Array.from({ length: 100 }, (_, i) => ({
        id: null,
        temp_id: `temp_${i}`,
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0 + i,
        record_type: 'fact' as const,
        comment: `Fact ${i}`,
        transfer_group_id: null,
        is_transfer: false,
        sync_status: 'synced' as const,
        sync_hash: null,
        content_hash: null,
        created_at: new Date(),
        updated_at: new Date(),
        synced_at: new Date()
      }));

      await manager.bulkInsertFacts(facts);

      const count = await db.budgetFacts.count();
      expect(count).toBe(100);
    });
  });

  describe('Sync Operations', () => {
    it('should get pending operations', async () => {
      // Create fact (creates pending operation)
      await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0,
        record_type: 'fact',
        comment: 'Pending',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      const pending = await manager.getPendingOperations();

      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].sync_status).toBe('pending');
    });

    it('should confirm pending operation', async () => {
      const temp_id = await manager.createFact({
        user_id: 1,
        article_id: 1,
        financial_center_id: 1,
        cost_center_id: null,
        date: '2026-01-31',
        amount: 100.0,
        record_type: 'fact',
        comment: 'Confirm',
        transfer_group_id: null,
        is_transfer: false,
        sync_hash: null
      });

      await manager.confirmPendingOperation(temp_id, 999);

      const fact = await db.budgetFacts.where('temp_id').equals(temp_id).first();

      expect(fact).toBeDefined();
      expect(fact!.id).toBe(999);
      expect(fact!.sync_status).toBe('synced');
    });
  });
});
