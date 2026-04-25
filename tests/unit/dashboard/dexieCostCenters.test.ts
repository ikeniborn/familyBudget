/**
 * Dexie unit tests — costCenters table CRUD + active filter.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalCostCenter } from '@db/dexie/types/models';

function buildCC(overrides: Partial<LocalCostCenter> = {}): LocalCostCenter {
  return {
    id: 1,
    user_id: 1,
    name: 'Project A',
    financial_center_id: null,
    is_active: true,
    created_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Dexie costCenters — CRUD + active filter', () => {
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

  it('bulk-insert + queryCostCenters returns all user cost centers', async () => {
    await manager.bulkInsertCostCenters([
      buildCC({ id: 1 }),
      buildCC({ id: 2, name: 'Project B' }),
    ]);

    const res = await manager.queryCostCenters(1);
    expect(res).toHaveLength(2);
  });

  it('archiving filters out inactive cost centers via raw table check', async () => {
    await manager.bulkInsertCostCenters([
      buildCC({ id: 1, is_active: true }),
      buildCC({ id: 2, is_active: false }),
    ]);

    const active = (await db.costCenters.toArray()).filter(cc => cc.is_active);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(1);
  });

  it('returns empty for unknown user (negative)', async () => {
    const res = await manager.queryCostCenters(9999);
    expect(res).toEqual([]);
  });
});
