/**
 * Dexie unit tests — budgetFacts soft-delete (tombstone) behaviour.
 * By design: deleteFact sets sync_status='deleted', row stays in table
 * until delta-sync confirms server-side deletion. Document this contract.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import type { LocalBudgetFact } from '@db/dexie/types/fact';

type NewFact = Omit<
  LocalBudgetFact,
  | 'id'
  | 'temp_id'
  | 'sync_status'
  | 'content_hash'
  | 'created_at'
  | 'updated_at'
  | 'synced_at'
>;

function buildFact(overrides: Partial<NewFact> = {}): NewFact {
  return {
    user_id: 1,
    article_id: 10,
    financial_center_id: 20,
    cost_center_id: null,
    date: '2026-05-01',
    amount: 50,
    record_type: 'fact',
    comment: null,
    transfer_group_id: null,
    is_transfer: false,
    sync_hash: null,
    ...overrides,
  };
}

describe('Dexie budgetFacts — tombstone on delete', () => {
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

  it('deleteFact leaves tombstone row with sync_status="deleted"', async () => {
    const tempId = await manager.createFact(buildFact());
    await manager.deleteFact(tempId);

    // Raw table check: the row still physically exists
    const rawRow = await db.budgetFacts.where('temp_id').equals(tempId).first();
    expect(rawRow).toBeDefined();
    expect(rawRow!.sync_status).toBe('deleted');

    // Active view hides it
    const active = await manager.queryFacts({ user_id: 1 });
    const stillVisible = active.filter(f => f.sync_status !== 'deleted');
    expect(stillVisible).toHaveLength(0);

    // Explicit deleted filter surfaces the tombstone
    const tombstones = await manager.queryFacts({
      user_id: 1,
      sync_status: 'deleted',
    });
    expect(tombstones).toHaveLength(1);
    expect(tombstones[0].temp_id).toBe(tempId);
  });

  it('deleteFact on unknown temp_id is a silent no-op (negative)', async () => {
    await expect(manager.deleteFact('does-not-exist')).resolves.toBeUndefined();

    const all = await db.budgetFacts.toArray();
    expect(all).toHaveLength(0);
  });
});
