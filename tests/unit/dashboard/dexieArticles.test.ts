/**
 * Dexie unit tests — articles table CRUD + active filter.
 * Uses fake-indexeddb (loaded via frontend/tests/setup.ts).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalArticle } from '@db/dexie/types/models';

function buildArticle(overrides: Partial<LocalArticle> = {}): LocalArticle {
  return {
    id: 1,
    user_id: 1,
    parent_id: null,
    name: 'Groceries',
    type: 'expense',
    is_active: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Dexie articles — CRUD + active filter', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  it('bulk-inserts articles and active-only query filters archived rows', async () => {
    await manager.bulkInsertArticles([
      buildArticle({ id: 1, name: 'Active', is_active: true }),
      buildArticle({ id: 2, name: 'Archived', is_active: false }),
    ]);

    const all = await manager.queryArticles({ user_id: 1, type: 'expense' });
    expect(all).toHaveLength(2);

    const active = await manager.queryArticles({
      user_id: 1,
      type: 'expense',
      is_active: true,
    });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('Active');
  });

  it('archives an article (is_active=false) via direct table modify', async () => {
    await manager.bulkInsertArticles([buildArticle({ id: 42 })]);

    await db.articles.update(42, { is_active: false });
    const active = await manager.queryArticles({
      user_id: 1,
      type: 'expense',
      is_active: true,
    });
    expect(active).toHaveLength(0);
  });

  it('returns empty array when querying non-existent user (negative)', async () => {
    const results = await manager.queryArticles({ user_id: 9999 });
    expect(results).toEqual([]);
  });
});
