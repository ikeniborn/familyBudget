/**
 * Plans Operations
 * Handles create, update, delete operations for budget plans and recurring plans
 */

import { getState, updateState } from '../core/OfflineState';
import { isOnline } from '../core/stateManager';
import type { SyncQueueItem } from '../types/dependencies';

// ============================================================================
// Plans (Budget Predictions)
// ============================================================================

/**
 * Create Plan (optimistic save)
 * Try online → fallback to offline on error
 *
 * @param data - Plan data
 * @returns Created plan
 */
export async function createPlan(data: any): Promise<any> {
  if (!isOnline()) {
    return await createPlanOffline(data);
  }

  const state = getState();
  const timeout = state.isFirstRequest
    ? state.firstRequestTimeout
    : state.normalTimeout;

  try {
    const result = await createPlanOnline(data, timeout);

    updateState({
      isFirstRequest: false,
      normalTimeout: state.optimizedTimeout,
    });

    return result;
  } catch (error) {
    return await createPlanOffline(data);
  }
}

/**
 * Create plan online with timeout
 * Plans use the same /api/v1/facts endpoint with record_type='plan'
 *
 * @param data - Plan data
 * @param timeout - Timeout in ms
 * @returns Created plan from server
 */
export async function createPlanOnline(data: any, timeout: number = 3000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/v1/facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, record_type: 'plan' }),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to create plan';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestSuccess();
    }

    return await response.json();
  } catch (error) {
    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestFailure();
    }
    throw error;
  }
}

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
 * Update plan (coordinator)
 *
 * @param planId - Plan ID
 * @param updates - Updated fields
 * @returns Updated plan
 */
export async function updatePlan(planId: number, updates: any): Promise<any> {
  if (!isOnline()) {
    return await updatePlanOffline(planId, updates);
  }

  try {
    const response = await fetch(`/api/v1/facts/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to update plan');
    }

    return await response.json();
  } catch (error) {
    return await updatePlanOffline(planId, updates);
  }
}

/**
 * Update plan offline
 */
async function updatePlanOffline(planId: number, updates: any): Promise<void> {
  const state = getState();

  await state.db.addToSyncQueue({
    entity_type: 'plan',
    operation: 'update',
    tempId: `update_${planId}`,
    data: { id: planId, ...updates },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Delete plan (coordinator)
 *
 * @param planId - Plan ID
 */
export async function deletePlan(planId: number): Promise<void> {
  if (!isOnline()) {
    return await deletePlanOffline(planId);
  }

  try {
    const response = await fetch(`/api/v1/facts/${planId}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete plan');
    }
  } catch (error) {
    return await deletePlanOffline(planId);
  }
}

/**
 * Delete plan offline
 */
async function deletePlanOffline(planId: number): Promise<void> {
  const state = getState();

  await state.db.addToSyncQueue({
    entity_type: 'plan',
    operation: 'delete',
    tempId: `delete_${planId}`,
    data: { id: planId },
    status: 'pending',
    retries: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// ============================================================================
// Recurring Plans (Automatic Budget Entries)
// ============================================================================

/**
 * Create Recurring Plan (optimistic save)
 * Try online → fallback to offline on error
 *
 * @param data - Recurring plan data
 * @returns Created recurring plan
 */
export async function createRecurringPlan(data: any): Promise<any> {
  if (!isOnline()) {
    return await createRecurringPlanOffline(data);
  }

  const state = getState();
  const timeout = state.isFirstRequest
    ? state.firstRequestTimeout
    : state.normalTimeout;

  try {
    const result = await createRecurringPlanOnline(data, timeout);

    updateState({
      isFirstRequest: false,
      normalTimeout: state.optimizedTimeout,
    });

    return result;
  } catch (error) {
    return await createRecurringPlanOffline(data);
  }
}

/**
 * Create recurring plan online with timeout
 *
 * @param data - Recurring plan data
 * @param timeout - Timeout in ms
 * @returns Created recurring plan from server
 */
export async function createRecurringPlanOnline(data: any, timeout: number = 3000): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/v1/recurring-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = 'Failed to create recurring plan';
      try {
        const error = await response.json();
        errorMessage = error.detail || error.message || errorMessage;
      } catch {
        // Ignore parse errors
      }
      throw new Error(errorMessage);
    }

    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestSuccess();
    }

    return await response.json();
  } catch (error) {
    const state = getState();
    if (state.networkDetector) {
      state.networkDetector.onRequestFailure();
    }
    throw error;
  }
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

/**
 * Get pending recurring plans (not synced yet)
 *
 * @returns Array of pending recurring plans
 */
export async function getPendingRecurringPlans(): Promise<any[]> {
  const state = getState();

  const queue = await state.db.getSyncQueue('pending');
  const recurringPlans = queue.filter((item: SyncQueueItem) => item.entity_type === 'recurring_plan');

  return recurringPlans.map((item: SyncQueueItem) => ({
    ...item.data,
    tempId: item.tempId,
    _offline: true,
    _synced: false,
  }));
}
