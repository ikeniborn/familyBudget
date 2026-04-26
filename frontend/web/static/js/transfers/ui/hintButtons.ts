/**
 * Transfer Module - Hint Buttons UI
 *
 * Hint button updates (clickable for plan, display-only for fact).
 * Migrated from: frontend/web/static/js/transfer.js (lines 243-308, 421-453)
 */

import type { HintsData } from '../types/transfer';

/**
 * Update plan hint buttons (clickable)
 * Migrated from: transfer.js updateTransferHintButtons() (lines 246-285)
 */
export function updatePlanHintButtons(
  direction: 'from' | 'to',
  data: HintsData | null
): void {
  const planBtn = document.getElementById(
    direction === 'from' ? 'transfer-hint-from-plan' : 'transfer-hint-to-plan'
  );
  const factBtn = document.getElementById(
    direction === 'from' ? 'transfer-hint-from-fact' : 'transfer-hint-to-fact'
  );

  if (!planBtn || !factBtn) return;

  if (data?.loading) {
    planBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
    factBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
    planBtn.classList.add('btn-disabled');
    factBtn.classList.add('btn-disabled');
    return;
  }

  if (!data) {
    planBtn.textContent = '--';
    factBtn.textContent = '--';
    planBtn.classList.add('btn-disabled');
    factBtn.classList.add('btn-disabled');
    return;
  }

  // Plan button (clickable)
  planBtn.textContent = formatCurrency(data.prev_period_plan_sum || 0);
  planBtn.classList.remove('btn-disabled');
  planBtn.classList.add('btn-outline', 'btn-info');
  (planBtn as any).onclick = () => setTransferAmount(data.prev_period_plan_sum || 0);

  // Fact button (clickable)
  factBtn.textContent = formatCurrency(data.prev_period_fact_sum || 0);
  factBtn.classList.remove('btn-disabled');
  factBtn.classList.add('btn-outline', 'btn-success');
  (factBtn as any).onclick = () => setTransferAmount(data.prev_period_fact_sum || 0);
}

/**
 * Update fact hint buttons (display-only)
 * Migrated from: transfer.js updateTransferFactHintButtons() (lines 421-453)
 */
export function updateFactHintButtons(
  direction: 'from' | 'to',
  data: HintsData | null
): void {
  const planBtn = document.getElementById(
    direction === 'from' ? 'transfer-hint-from-plan' : 'transfer-hint-to-plan'
  );
  const factBtn = document.getElementById(
    direction === 'from' ? 'transfer-hint-from-fact' : 'transfer-hint-to-fact'
  );

  if (!planBtn || !factBtn) return;

  if (data?.loading) {
    planBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
    factBtn.innerHTML = `<span class="loading loading-spinner loading-sm"></span>`;
    return;
  }

  if (!data) {
    planBtn.textContent = '--';
    factBtn.textContent = '--';
    return;
  }

  // Fact buttons are display-only (not clickable)
  planBtn.textContent = formatCurrency(data.period_plan_sum || 0);
  planBtn.classList.remove('btn-outline');
  planBtn.classList.add('btn-ghost', 'text-info');

  factBtn.textContent = formatCurrency(data.period_fact_sum || 0);
  factBtn.classList.remove('btn-outline');
  factBtn.classList.add('btn-ghost', 'text-success');
}

/**
 * Set transfer amount from hint
 * Migrated from: transfer.js setTransferAmount() (lines 287-308)
 */
export function setTransferAmount(amount: number): void {
  const amountInput = document.querySelector<HTMLInputElement>('#transfer_amount');
  if (amountInput) {
    amountInput.value = String(amount);
    amountInput.focus();
  }
}

/**
 * Format currency
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(value);
}
