/**
 * Plan Page — WebSocket Event Handlers
 *
 * Registers WebSocket event handlers for real-time plan table updates.
 * Uses incremental row injection instead of full table reload where possible:
 * - plan_created → prepend new row (page 1, no extra filters)
 * - plan_updated → replace existing row
 * - plan_deleted → fade-remove row
 * - recurring_plan_* → full reload (multiple rows affected)
 */

import * as PlanFactsTable from './factsTable';

// ============================================================================
// Debouncing
// ============================================================================

const WS_RELOAD_DEBOUNCE_MS = 500;
let wsReloadTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedReloadFacts(): void {
  if (wsReloadTimeout) {
    clearTimeout(wsReloadTimeout);
  }
  wsReloadTimeout = setTimeout(() => {
    PlanFactsTable.loadFacts();
  }, WS_RELOAD_DEBOUNCE_MS);
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handlePlanCreated(data: { id?: number }): Promise<void> {
  const planId = data?.id;
  if (!planId) {
    debouncedReloadFacts();
    return;
  }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(planId, 'create');
  if (!injected) {
    debouncedReloadFacts();
  }
}

async function handlePlanUpdated(data: { id?: number }): Promise<void> {
  const planId = data?.id;
  if (!planId) {
    debouncedReloadFacts();
    return;
  }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(planId, 'update');
  if (!injected) {
    debouncedReloadFacts();
  }
}

function handlePlanDeleted(data: { id?: number }): void {
  const planId = data?.id;
  if (!planId) {
    debouncedReloadFacts();
    return;
  }
  PlanFactsTable.removePlanRow(planId);
}

function handleRecurringPlanChanged(_data: unknown): void {
  // Recurring plans affect multiple rows — always full reload
  debouncedReloadFacts();
}

function handleFactsBatchDeleted(data: { record_type?: string }): void {
  const shouldReload = !data.record_type || data.record_type === 'plan';
  if (shouldReload) {
    debouncedReloadFacts();
  }
}

// ============================================================================
// Registration
// ============================================================================

/**
 * Register WebSocket event handlers for the plan page.
 * Called during plan page initialization.
 */
export function registerWSHandlers(): void {
  if (typeof window === 'undefined' || !window.budgetWSClient) {
    return;
  }

  window.budgetWSClient.on('plan_created', handlePlanCreated);
  window.budgetWSClient.on('plan_updated', handlePlanUpdated);
  window.budgetWSClient.on('plan_deleted', handlePlanDeleted);

  window.budgetWSClient.on('recurring_plan_created', handleRecurringPlanChanged);
  window.budgetWSClient.on('recurring_plan_updated', handleRecurringPlanChanged);
  window.budgetWSClient.on('recurring_plan_deleted', handleRecurringPlanChanged);
  window.budgetWSClient.on('recurring_plan_facts_generated', handleRecurringPlanChanged);

  window.budgetWSClient.on('facts_batch_deleted', handleFactsBatchDeleted);
}

/**
 * Unregister WebSocket event handlers for cleanup.
 */
export function unregisterWSHandlers(): void {
  if (typeof window === 'undefined' || !window.budgetWSClient) {
    return;
  }

  window.budgetWSClient.off('plan_created', handlePlanCreated);
  window.budgetWSClient.off('plan_updated', handlePlanUpdated);
  window.budgetWSClient.off('plan_deleted', handlePlanDeleted);

  window.budgetWSClient.off('recurring_plan_created', handleRecurringPlanChanged);
  window.budgetWSClient.off('recurring_plan_updated', handleRecurringPlanChanged);
  window.budgetWSClient.off('recurring_plan_deleted', handleRecurringPlanChanged);
  window.budgetWSClient.off('recurring_plan_facts_generated', handleRecurringPlanChanged);

  window.budgetWSClient.off('facts_batch_deleted', handleFactsBatchDeleted);
}
