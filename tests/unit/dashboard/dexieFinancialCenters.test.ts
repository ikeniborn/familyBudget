/**
 * Dexie unit tests — financialCenters table CRUD + active filter.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalFinancialCenter } from '@db/dexie/types/models';

function buildFC(overrides: Partial<LocalFinancialCenter> = {}): LocalFinancialCenter {
  return {
    id: 1,
    user_id: 1,
    name: 'Main wallet',
    description: null,
    code: null,
    is_active: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('Dexie financialCenters — CRUD + active filter', () => {
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

  it('bulk-insert + queryFinancialCenters returns all user FCs', async () => {
    await manager.bulkInsertFinancialCenters([
      buildFC({ id: 1 }),
      buildFC({ id: 2, name: 'Savings', is_active: false }),
    ]);

    const all = await manager.queryFinancialCenters(1);
    expect(all).toHaveLength(2);
  });

  it('archiving (is_active=false) is visible in raw table; active-filter excludes it', async () => {
    await manager.bulkInsertFinancialCenters([
      buildFC({ id: 1, is_active: true }),
      buildFC({ id: 2, is_active: false }),
    ]);

    const activeOnly = (await db.financialCenters.toArray()).filter(
      fc => fc.is_active === true
    );
    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].id).toBe(1);
  });

  it('returns empty array for unknown user (negative)', async () => {
    const res = await manager.queryFinancialCenters(9999);
    expect(res).toEqual([]);
  });
});
