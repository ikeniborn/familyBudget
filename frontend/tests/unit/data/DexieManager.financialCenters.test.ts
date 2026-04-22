/**
 * Regression guard for BUG-001 (2026-04-22): "Счёт" select in modal_fact /
 * modal_plan showed only 1 of 7 FCs for test3@test.com.
 *
 * Root cause: DexieManager.queryFinancialCenters filters Dexie rows by
 * `user_id === userId` (plus `user_id === 0` when includeGlobal). In the
 * "Shared Family Budget" architecture (backend/app/api/v1/endpoints/
 * financial_centers.py:70 — "All users see all financial centers") every FC
 * row carries its CREATOR's user_id, not the current viewer's. So the viewer
 * saw only FCs they personally created plus ones with user_id=0.
 *
 * Fix: queryFinancialCenters(userId, includeGlobal=true) must return every
 * stored FC (shared references), regardless of the stored user_id.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DexieManager, type LocalFinancialCenter } from '@db/dexie';

function makeFC(overrides: Partial<LocalFinancialCenter>): LocalFinancialCenter {
  return {
    id: 1,
    user_id: 1,
    name: 'FC',
    description: null,
    is_active: true,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    sync_status: 'synced',
    sync_hash: 'h',
    content_hash: 'c',
    version: 1,
    last_modified_by: 1,
    deleted_at: null,
    ...overrides,
  } as LocalFinancialCenter;
}

describe('DexieManager.queryFinancialCenters — shared references (BUG-001)', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
    // Seed FCs created by several different users (shared architecture).
    await manager.bulkInsertFinancialCenters([
      makeFC({ id: 1, user_id: 1, name: 'Создал user 1' }),
      makeFC({ id: 2, user_id: 2, name: 'Создал user 2' }),
      makeFC({ id: 3, user_id: 3, name: 'Создал user 3' }),
      makeFC({ id: 4, user_id: 4, name: 'Создал user 4' }),
      makeFC({ id: 5, user_id: 5, name: 'Создал user 5' }),
      makeFC({ id: 6, user_id: 6, name: 'Создал user 6' }),
      makeFC({ id: 7, user_id: 0, name: 'Глобальный' }),
    ]);
  });

  afterEach(async () => {
    await manager.deleteDatabase();
  });

  it('returns ALL FCs when called with includeGlobal=true (shared architecture)', async () => {
    // Current user is user 3 — under the old (buggy) filter they would see only
    // { id: 3, user_id: 3 } + { id: 7, user_id: 0 } = 2 rows. After the fix
    // they must see all 7 shared FCs.
    const result = await manager.queryFinancialCenters(3, true);

    expect(result.length).toBe(7);
    const ids = result.map((fc) => fc.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not lose the caller-own FC when another user also created some', async () => {
    const result = await manager.queryFinancialCenters(1, true);
    expect(result.find((fc) => fc.user_id === 1)).toBeDefined();
    expect(result.length).toBe(7);
  });
});
