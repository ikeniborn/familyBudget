import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  bulkInsertArticles,
  bulkInsertFinancialCenters,
  bulkInsertCostCenters,
  bulkInsertHierarchy,
} from '../operations/bulkOperations';
import type {
  LocalArticle,
  LocalFinancialCenter,
  LocalCostCenter,
  LocalArticleHierarchy,
} from '../types/models';

describe('Bulk Operations', () => {
  let db: PGlite;

  beforeEach(async () => {
    // Initialize test database with unique name per test
    const testName = expect.getState().currentTestName?.replace(/[^a-z0-9]/gi, '-') || 'test';
    db = new PGlite(`idb://test-bulk-ops-${testName}`);

    // Create test schema
    await db.exec(`
      CREATE TABLE IF NOT EXISTS local_articles (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS local_financial_centers (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('account', 'wallet', 'card')),
        currency TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS local_cost_centers (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS local_article_hierarchy (
        ancestor_id INTEGER NOT NULL,
        descendant_id INTEGER NOT NULL,
        depth INTEGER NOT NULL,
        PRIMARY KEY (ancestor_id, descendant_id)
      );
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('bulkInsertArticles', () => {
    it('should insert articles in bulk', async () => {
      const articles: LocalArticle[] = [
        {
          id: 1,
          user_id: 1,
          parent_id: null,
          name: 'Income',
          type: 'income',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 2,
          user_id: 1,
          parent_id: 1,
          name: 'Salary',
          type: 'income',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      await bulkInsertArticles(db, articles);

      const result = await db.query('SELECT * FROM local_articles ORDER BY id');
      expect(result.rows).toHaveLength(2);
      expect((result.rows[0] as any).name).toBe('Income');
      expect((result.rows[1] as any).name).toBe('Salary');
    });

    it('should handle empty array', async () => {
      await bulkInsertArticles(db, []);

      const result = await db.query('SELECT * FROM local_articles');
      expect(result.rows).toHaveLength(0);
    });

    it('should update on conflict', async () => {
      const article: LocalArticle = {
        id: 1,
        user_id: 1,
        parent_id: null,
        name: 'Income',
        type: 'income',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Insert first time
      await bulkInsertArticles(db, [article]);

      // Insert again with updated name
      const updatedArticle = { ...article, name: 'Income Updated' };
      await bulkInsertArticles(db, [updatedArticle]);

      const result = await db.query('SELECT * FROM local_articles WHERE id = 1');
      expect((result.rows[0] as any).name).toBe('Income Updated');
    });

    it('should report progress', async () => {
      const articles: LocalArticle[] = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        user_id: 1,
        parent_id: null,
        name: `Article ${i + 1}`,
        type: 'income' as const,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      const progressUpdates: Array<{ current: number; total: number }> = [];
      await bulkInsertArticles(db, articles, (current, total) => {
        progressUpdates.push({ current, total });
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].current).toBe(10);
      expect(progressUpdates[progressUpdates.length - 1].total).toBe(10);
    });
  });

  describe('bulkInsertFinancialCenters', () => {
    it('should insert financial centers in bulk', async () => {
      const centers: LocalFinancialCenter[] = [
        {
          id: 1,
          user_id: 1,
          name: 'Main Account',
          type: 'account',
          currency: 'USD',
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 2,
          user_id: 1,
          name: 'Cash Wallet',
          type: 'wallet',
          currency: 'USD',
          is_active: true,
          created_at: new Date(),
        },
      ];

      await bulkInsertFinancialCenters(db, centers);

      const result = await db.query('SELECT * FROM local_financial_centers ORDER BY id');
      expect(result.rows).toHaveLength(2);
      expect((result.rows[0] as any).type).toBe('account');
      expect((result.rows[1] as any).type).toBe('wallet');
    });
  });

  describe('bulkInsertCostCenters', () => {
    it('should insert cost centers in bulk', async () => {
      const centers: LocalCostCenter[] = [
        {
          id: 1,
          user_id: 1,
          name: 'Project A',
          is_active: true,
          created_at: new Date(),
        },
        {
          id: 2,
          user_id: 1,
          name: 'Department B',
          is_active: true,
          created_at: new Date(),
        },
      ];

      await bulkInsertCostCenters(db, centers);

      const result = await db.query('SELECT * FROM local_cost_centers ORDER BY id');
      expect(result.rows).toHaveLength(2);
      expect((result.rows[0] as any).name).toBe('Project A');
    });
  });

  describe('bulkInsertHierarchy', () => {
    it('should insert hierarchy in bulk', async () => {
      const hierarchy: LocalArticleHierarchy[] = [
        { ancestor_id: 1, descendant_id: 1, depth: 0 },
        { ancestor_id: 1, descendant_id: 2, depth: 1 },
        { ancestor_id: 2, descendant_id: 2, depth: 0 },
      ];

      await bulkInsertHierarchy(db, hierarchy);

      const result = await db.query('SELECT * FROM local_article_hierarchy ORDER BY ancestor_id, descendant_id');
      expect(result.rows).toHaveLength(3);
      expect((result.rows[1] as any).depth).toBe(1);
    });
  });
});
