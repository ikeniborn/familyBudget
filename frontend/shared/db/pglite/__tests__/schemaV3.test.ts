/**
 * Schema V3 Migration Tests (Shopping Lists)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGlite Schema V3 Migration', () => {
  let manager: PGliteManager;

  beforeEach(async () => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();
    await manager.init({ dataDir: 'test-schema-v3' });
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  it('should apply schema v3 migration', async () => {
    const version = await manager.getSchemaVersion();
    // PGliteManager always migrates to latest version (currently v4)
    expect(version).toBe(5);
  });

  it('should create all v3 tables', async () => {
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

    // V3 tables (Shopping Lists)
    expect(tableNames).toContain('local_stores');
    expect(tableNames).toContain('local_product_groups');
    expect(tableNames).toContain('local_product_group_hierarchy');
    expect(tableNames).toContain('local_shopping_lists');
    expect(tableNames).toContain('local_shopping_list_items');
  });

  it('should have indexes on local_stores', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_stores'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);
    expect(indexNames).toContain('idx_stores_active');
  });

  it('should have indexes on local_product_groups', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_product_groups'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);
    expect(indexNames).toContain('idx_product_groups_parent');
    expect(indexNames).toContain('idx_product_groups_active');
  });

  it('should have indexes on local_product_group_hierarchy', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_product_group_hierarchy'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);
    expect(indexNames).toContain('idx_pgh_ancestor');
    expect(indexNames).toContain('idx_pgh_descendant');
    expect(indexNames).toContain('idx_pgh_depth');
  });

  it('should have indexes on local_shopping_lists', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_shopping_lists'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);
    expect(indexNames).toContain('idx_shopping_lists_id');
    expect(indexNames).toContain('idx_shopping_lists_sync_status');
    expect(indexNames).toContain('idx_shopping_lists_active');
  });

  it('should have indexes on local_shopping_list_items', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'local_shopping_list_items'
    `);

    const indexNames = result.rows.map((r: unknown) => (r as { indexname: string }).indexname);
    expect(indexNames).toContain('idx_shopping_list_items_id');
    expect(indexNames).toContain('idx_shopping_list_items_list');
    expect(indexNames).toContain('idx_shopping_list_items_store');
    expect(indexNames).toContain('idx_shopping_list_items_product_group');
    expect(indexNames).toContain('idx_shopping_list_items_completed');
    expect(indexNames).toContain('idx_shopping_list_items_sync_status');
    expect(indexNames).toContain('idx_shopping_list_items_deleted');
  });

  it('should have correct schema for local_shopping_lists', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'local_shopping_lists'
      ORDER BY ordinal_position
    `);

    const columns = result.rows as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>;

    // Check key columns exist
    const columnNames = columns.map(c => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('temp_id');
    expect(columnNames).toContain('creator_id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('description');
    expect(columnNames).toContain('is_active');
    expect(columnNames).toContain('sync_status');
    expect(columnNames).toContain('sync_hash');
    expect(columnNames).toContain('content_hash');
    expect(columnNames).toContain('created_at');
    expect(columnNames).toContain('updated_at');
    expect(columnNames).toContain('synced_at');
  });

  it('should have correct schema for local_shopping_list_items', async () => {
    const db = manager.getDatabase();
    if (!db) throw new Error('DB not initialized');

    const result = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'local_shopping_list_items'
      ORDER BY ordinal_position
    `);

    const columns = result.rows as Array<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>;

    // Check key columns exist
    const columnNames = columns.map(c => c.column_name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('temp_id');
    expect(columnNames).toContain('creator_id');
    expect(columnNames).toContain('shopping_list_temp_id');
    expect(columnNames).toContain('store_id');
    expect(columnNames).toContain('product_group_id');
    expect(columnNames).toContain('product_name');
    expect(columnNames).toContain('quantity');
    expect(columnNames).toContain('unit');
    expect(columnNames).toContain('comment');
    expect(columnNames).toContain('is_completed');
    expect(columnNames).toContain('completed_at');
    expect(columnNames).toContain('sync_status');
    expect(columnNames).toContain('version');
    expect(columnNames).toContain('deleted_at');
    expect(columnNames).toContain('last_modified_by');
  });
});
