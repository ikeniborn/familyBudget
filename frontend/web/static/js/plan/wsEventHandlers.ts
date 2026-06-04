/**
 * Plan Page — WebSocket Event Handlers
 *
 * Incremental DOM updates only:
 * - plan_created / plan_updated → fetchAndInjectPlanRow
 * - plan_deleted → removePlanRow
 * - recurring_plan_* + facts_batch_deleted → debounced full reload
 */

import * as PlanFactsTable from './factsTable';

const WS_RELOAD_DEBOUNCE_MS = 500;
let wsReloadTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedReloadFacts(): void {
  if (wsReloadTimeout) clearTimeout(wsReloadTimeout);
  wsReloadTimeout = setTimeout(() => { PlanFactsTable.loadFacts(); }, WS_RELOAD_DEBOUNCE_MS);
}

async function handlePlanCreated(data: { id?: number }): Promise<void> {
  if (!data?.id) { debouncedReloadFacts(); return; }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(data.id, 'create');
  if (!injected) debouncedReloadFacts();
}

async function handlePlanUpdated(data: { id?: number }): Promise<void> {
  if (!data?.id) { debouncedReloadFacts(); return; }
  const injected = await PlanFactsTable.fetchAndInjectPlanRow(data.id, 'update');
  if (!injected) debouncedReloadFacts();
}

function handlePlanDeleted(data: { id?: number }): void {
  if (!data?.id) { debouncedReloadFacts(); return; }
  PlanFactsTable.removePlanRow(data.id);
}

function handleRecurringPlanChanged(_data: unknown): void { debouncedReloadFacts(); }

function handleFactsBatchDeleted(data: { record_type?: string }): void {
  if (!data.record_type || data.record_type === 'plan') debouncedReloadFacts();
}

async function handleTransferCreated(data: { expense_fact_id?: number; income_fact_id?: number }): Promise<void> {
  const ids = [data.expense_fact_id, data.income_fact_id].filter(Boolean) as number[];
  if (ids.length === 0) { debouncedReloadFacts(); return; }
  const results = await Promise.all(ids.map(id => PlanFactsTable.fetchAndInjectPlanRow(id, 'create')));
  if (!results.some(Boolean)) debouncedReloadFacts();
}

export function registerWSHandlers(): void {
  const c = (window as any).budgetWSClient;
  if (!c) return;
  c.on('plan_created', handlePlanCreated);
  c.on('plan_updated', handlePlanUpdated);
  c.on('plan_deleted', handlePlanDeleted);
  c.on('recurring_plan_created', handleRecurringPlanChanged);
  c.on('recurring_plan_updated', handleRecurringPlanChanged);
  c.on('recurring_plan_deleted', handleRecurringPlanChanged);
  c.on('recurring_plan_facts_generated', handleRecurringPlanChanged);
  c.on('facts_batch_deleted', handleFactsBatchDeleted);
  c.on('transfer_created', handleTransferCreated);
}

export function unregisterWSHandlers(): void {
  const c = (window as any).budgetWSClient;
  if (!c) return;
  c.off('plan_created', handlePlanCreated);
  c.off('plan_updated', handlePlanUpdated);
  c.off('plan_deleted', handlePlanDeleted);
  c.off('recurring_plan_created', handleRecurringPlanChanged);
  c.off('recurring_plan_updated', handleRecurringPlanChanged);
  c.off('recurring_plan_deleted', handleRecurringPlanChanged);
  c.off('recurring_plan_facts_generated', handleRecurringPlanChanged);
  c.off('facts_batch_deleted', handleFactsBatchDeleted);
  c.off('transfer_created', handleTransferCreated);
}
