/**
 * Plans Operations
 * Handles create, update, delete operations for budget plans
 */

import { getState } from '../core/OfflineState';

/**
 * Create plan offline
 */
export async function createPlanOffline(data: any): Promise<any> {
  const state = getState();
  const tempId = `offline_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await state.db.addPlan({ tempId, ...data });

  await state.db.addToSyncQueue({
    entity_type: 'plan',
    operation: 'create',
    tempId,
    data,
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { ...data, tempId, _offline: true };
}

/**
 * Create recurring plan offline
 */
export async function createRecurringPlanOffline(data: any): Promise<any> {
  const state = getState();
  const tempId = `offline_recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  await state.db.addRecurringPlan({ tempId, ...data });

  await state.db.addToSyncQueue({
    entity_type: 'recurring_plan',
    operation: 'create',
    tempId,
    data,
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { ...data, tempId, _offline: true };
}
