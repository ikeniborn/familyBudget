/**
 * Dexie unit tests — productGroups table (reference data) CRUD + active filter.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalProductGroup } from '@db/dexie/types/shopping';

function buildGroup(overrides: Partial<LocalProductGroup> = {}): LocalProductGroup {
  return {
    id: 1,
    parent_id: null,
    name: 'Dairy',
    code: null,
    is_active: true,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Dexie productGroups — CRUD + active filter', () => {
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

  it('insert + queryProductGroups active filter excludes archived', async () => {
    await db.productGroups.bulkAdd([
      buildGroup({ id: 1, name: 'A', is_active: true }),
      buildGroup({ id: 2, name: 'B', is_active: false }),
    ]);

    const all = await manager.queryProductGroups();
    expect(all).toHaveLength(2);

    const active = await manager.queryProductGroups({ is_active: true });
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('A');
  });

  it('archive hides group from active-view', async () => {
    await db.productGroups.add(buildGroup({ id: 5, is_active: true }));
    await db.productGroups.update(5, { is_active: false });

    const active = await manager.queryProductGroups({ is_active: true });
    expect(active).toHaveLength(0);
  });

  it('returns empty list when no groups exist (negative)', async () => {
    const res = await manager.queryProductGroups();
    expect(res).toEqual([]);
  });
});
