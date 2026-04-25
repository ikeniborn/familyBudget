/**
 * Dexie unit tests — stores table (reference data) CRUD + active filter.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalStore } from '@db/dexie/types/shopping';

function buildStore(overrides: Partial<LocalStore> = {}): LocalStore {
  return {
    id: 1,
    name: 'Pyaterochka',
    address: null,
    code: null,
    is_active: true,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Dexie stores — CRUD + active filter', () => {
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

  it('insert stores via raw table + queryStores active filter works', async () => {
    await db.stores.bulkAdd([
      buildStore({ id: 1, name: 'A', is_active: true }),
      buildStore({ id: 2, name: 'B', is_active: false }),
    ]);

    const all = await manager.queryStores();
    expect(all).toHaveLength(2);

    const active = await manager.queryStores({ is_active: true });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('A');
  });

  it('archive (is_active=false) removes store from active-view', async () => {
    await db.stores.add(buildStore({ id: 10, is_active: true }));

    await db.stores.update(10, { is_active: false });
    const active = await manager.queryStores({ is_active: true });
    expect(active).toHaveLength(0);
  });

  it('returns empty list when no stores exist (negative)', async () => {
    const res = await manager.queryStores();
    expect(res).toEqual([]);
  });
});
