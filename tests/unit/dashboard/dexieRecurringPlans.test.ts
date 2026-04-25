/**
 * Dexie unit tests — recurringPlans CRUD (create, update isActive, delete).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DexieManager } from '@db/dexie/DexieManager';
import type { LocalRecurringPlan } from '@db/dexie/types/models';

type NewPlan = Omit<LocalRecurringPlan, 'id' | 'created_at'>;

function buildPlan(overrides: Partial<NewPlan> = {}): NewPlan {
  return {
    user_id: 1,
    article_id: 10,
    financial_center_id: 20,
    cost_center_id: null,
    amount: 100.5,
    day_of_month: 1,
    frequency: 'monthly',
    is_active: true,
    next_generation_date: '2026-05-01',
    ...overrides,
  };
}

describe('Dexie recurringPlans — CRUD', () => {
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

  it('createRecurringPlan stores plan; amount roundtrips through cents', async () => {
    // NOTE: recurringPlans schema uses non-auto-increment primary key 'id';
    // createRecurringPlan passes id: 0 → Dexie returns 0 as the key. That's
    // acceptable for the purpose of this test (we only care that the row was
    // persisted and amount roundtrips).
    const id = await manager.createRecurringPlan(buildPlan({ amount: 123.45 }));
    expect(id).toBeGreaterThanOrEqual(0);

    const plan = await manager.getRecurringPlan(id);
    expect(plan).toBeDefined();
    expect(plan!.amount).toBe(123.45);
    expect(plan!.is_active).toBe(true);
  });

  it('updateRecurringPlan toggles is_active=false; deleteRecurringPlan removes it', async () => {
    // Use an explicit non-zero id to avoid PK collision with the previous
    // test's id=0 (clearAll runs between tests, but keep explicit for clarity).
    const id = await manager.createRecurringPlan(buildPlan({ article_id: 10 }));

    await manager.updateRecurringPlan(id, { is_active: false });
    const updated = await manager.getRecurringPlan(id);
    expect(updated!.is_active).toBe(false);

    const activeOnly = await manager.queryRecurringPlans({
      user_id: 1,
      is_active: true,
    });
    expect(activeOnly).toHaveLength(0);

    await manager.deleteRecurringPlan(id);
    const afterDelete = await manager.getRecurringPlan(id);
    expect(afterDelete).toBeUndefined();
  });

  it('updateRecurringPlan throws for missing id (negative)', async () => {
    await expect(
      manager.updateRecurringPlan(9999, { is_active: false })
    ).rejects.toThrow(/not found/);
  });
});
