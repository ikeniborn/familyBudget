/**
 * Schema V2 Migration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGlite Schema V2 Migration', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();
    await manager.init({ dataDir: 'test-schema-v2' });
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  it('should apply schema v2 migration', async () => {
    const version = await manager.getSchemaVersion();
    expect(version).toBe(2);
  });

  it('should create all v2 tables', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'local_%'
      ORDER BY tablename
    `);

    const tableNames = result.rows.map((r: unknown) => (r as { tablename: string }).tablename);

    // V1 tables
    expect(tableNames).toContain('local_articles');
    expect(tableNames).toContain('local_financial_centers');
    expect(tableNames).toContain('local_cost_centers');
    expect(tableNames).toContain('local_article_hierarchy');
    expect(tableNames).toContain('local_sync_metadata');
    expect(tableNames).toContain('local_schema_migrations');

    // V2 tables
    expect(tableNames).toContain('local_budget_facts');
    expect(tableNames).toContain('local_pending_operations');
    expect(tableNames).toContain('local_sync_conflicts');
    expect(tableNames).toContain('local_recurring_plans');
  });

  it('should have indexes on local_budget_facts', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_budget_facts'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);

    expect(indexNames).toContain('idx_facts_user_date');
    expect(indexNames).toContain('idx_facts_article');
    expect(indexNames).toContain('idx_facts_financial_center');
    expect(indexNames).toContain('idx_facts_sync_status');
    expect(indexNames).toContain('idx_facts_temp_id');
    expect(indexNames).toContain('idx_facts_transfer_group');
  });

  it('should have UNIQUE constraint on pending_operations.content_hash', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'local_pending_operations'::regclass
      AND contype = 'u'
    `);

    const constraints = result.rows.map((r: unknown) => (r as { conname: string }).conname);
    expect(constraints.some(c => c.includes('content_hash'))).toBe(true);
  });
});
