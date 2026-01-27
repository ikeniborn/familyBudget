import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PGliteManager } from '../PGliteManager';

describe('PGliteManager', () => {
  let manager: PGliteManager;

  beforeEach(() => {
    // Enable PGlite for tests
    localStorage.setItem('enablePGlite', 'true');
    manager = new PGliteManager();
  });

  afterEach(async () => {
    // Cleanup
    if (manager.isReady()) {
      await manager.close();
    }
    localStorage.clear();
  });

  it('should initialize successfully', { timeout: 30000 }, async () => {
    // Act
    await manager.init({ dataDir: 'test-manager-init' });

    // Assert
    expect(manager.isReady()).toBe(true);
    expect(manager.getDatabase()).toBeTruthy();
  });

  it('should run migrations on init', async () => {
    // Act
    await manager.init({ dataDir: 'test-manager-migrations' });

    // Assert
    const db = manager.getDatabase();
    expect(db).toBeTruthy();

    if (!db) return; // TypeScript guard

    // Check tables exist (PostgreSQL syntax)
    const tables = await db.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
    `);

    const tableNames = (tables.rows as Array<{ tablename: string }>).map(r => r.tablename);
    expect(tableNames).toContain('local_articles');
    expect(tableNames).toContain('local_schema_migrations');
  });

  it('should track schema version', async () => {
    // Act
    await manager.init({ dataDir: 'test-manager-version' });

    // Assert
    const version = await manager.getSchemaVersion();
    expect(version).toBe(5); // v5 after expanding article types

    const isUpToDate = await manager.isSchemaUpToDate();
    expect(isUpToDate).toBe(true);
  });

  it('should create all expected tables', async () => {
    // Act
    await manager.init({ dataDir: 'test-manager-tables' });

    // Assert
    const db = manager.getDatabase();
    expect(db).toBeTruthy();

    if (!db) return;

    const expectedTables = [
      'local_schema_migrations',
      'local_articles',
      'local_financial_centers',
      'local_cost_centers',
      'local_article_hierarchy',
      'local_sync_metadata'
    ];

    for (const table of expectedTables) {
      const result = await db.query(`
        SELECT COUNT(*) as count FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      `, [table]);

      expect(parseInt((result.rows[0] as { count: string }).count)).toBe(1);
    }
  });

  it('should query articles (empty result)', async () => {
    // Arrange
    await manager.init({ dataDir: 'test-manager-articles' });

    // Act
    const articles = await manager.queryArticles({ user_id: 1 });

    // Assert
    expect(Array.isArray(articles)).toBe(true);
    expect(articles).toHaveLength(0);
  });

  it('should query financial centers (empty result)', async () => {
    // Arrange
    await manager.init({ dataDir: 'test-manager-fc' });

    // Act
    const centers = await manager.queryFinancialCenters(1);

    // Assert
    expect(Array.isArray(centers)).toBe(true);
    expect(centers).toHaveLength(0);
  });

  it('should query cost centers (empty result)', async () => {
    // Arrange
    await manager.init({ dataDir: 'test-manager-cc' });

    // Act
    const centers = await manager.queryCostCenters(1);

    // Assert
    expect(Array.isArray(centers)).toBe(true);
    expect(centers).toHaveLength(0);
  });

  it('should handle sync metadata', async () => {
    // Arrange
    await manager.init({ dataDir: 'test-manager-sync' });

    // Act
    await manager.updateSyncMetadata('articles', {
      last_sync_timestamp: new Date(),
      sync_version: 1,
      total_records: 10
    });

    const metadata = await manager.getSyncMetadata('articles');

    // Assert
    expect(metadata).toBeTruthy();
    expect(metadata?.entity_type).toBe('articles');
    expect(metadata?.sync_version).toBe(1);
    expect(metadata?.total_records).toBe(10);
  });

  it('should close database successfully', async () => {
    // Arrange
    await manager.init({ dataDir: 'test-manager-close' });
    expect(manager.isReady()).toBe(true);

    // Act
    await manager.close();

    // Assert
    expect(manager.isReady()).toBe(false);
    expect(manager.getDatabase()).toBeNull();
  });
});
