/**
 * Dexie unit tests — plan-record lifecycle in budgetFacts.
 *
 * BUG-005 coverage: verify that facts with record_type='plan' flow through
 * create/query/delete, and that a transfer pair (shared transfer_group_id) is
 * stored intact.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';
import {
  createFact,
  deleteFact,
  queryFacts,
} from '@db/dexie/operations/factOperations';
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

function buildPlanFact(overrides: Partial<NewFact> = {}): NewFact {
  return {
    user_id: 1,
    article_id: 10,
    financial_center_id: 20,
    cost_center_id: null,
    date: '2026-05-01',
    amount: 1234.56,
    record_type: 'plan',
    comment: 'unit test plan',
    transfer_group_id: null,
    is_transfer: false,
    sync_hash: null,
    ...overrides,
  };
}

describe('Dexie budgetFacts — plan records', () => {
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

  it('createFact with record_type="plan" is retrievable via queryFacts', async () => {
    const tempId = await createFact(buildPlanFact());
    expect(tempId).toBeTruthy();

    const plans = await queryFacts({ user_id: 1, record_type: 'plan' });
    expect(plans).toHaveLength(1);
    expect(plans[0].temp_id).toBe(tempId);
    expect(plans[0].record_type).toBe('plan');
    // Stored as cents (1234.56 → 123456)
    expect(plans[0].amount).toBe(123456);
  });

  it('deleteFact soft-deletes the plan row (sync_status="deleted")', async () => {
    const tempId = await createFact(buildPlanFact());

    await deleteFact(tempId);

    const active = await queryFacts({ user_id: 1, record_type: 'plan' });
    expect(active.filter(f => f.sync_status !== 'deleted')).toHaveLength(0);

    const deleted = await queryFacts({
      user_id: 1,
      record_type: 'plan',
      sync_status: 'deleted',
    });
    expect(deleted).toHaveLength(1);
    expect(deleted[0].temp_id).toBe(tempId);
  });

  it('stores a transfer pair with shared transfer_group_id', async () => {
    const groupId = 'test-group-abc';

    const sourceTempId = await createFact(
      buildPlanFact({
        record_type: 'fact',
        amount: 100,
        financial_center_id: 20,
        transfer_group_id: groupId,
        is_transfer: true,
        comment: 'transfer source',
      })
    );
    const destTempId = await createFact(
      buildPlanFact({
        record_type: 'fact',
        amount: 100,
        financial_center_id: 21,
        transfer_group_id: groupId,
        is_transfer: true,
        comment: 'transfer destination',
      })
    );

    const all = (await db.budgetFacts.toArray()).filter(
      f => f.transfer_group_id === groupId
    );

    expect(all).toHaveLength(2);
    const tempIds = all.map(f => f.temp_id).sort();
    expect(tempIds).toEqual([sourceTempId, destTempId].sort());
    expect(all.every(f => f.is_transfer === true)).toBe(true);
  });
});
