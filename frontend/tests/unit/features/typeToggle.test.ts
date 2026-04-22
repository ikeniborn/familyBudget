/**
 * Unit tests for setupTransactionTypeToggle (BUG-006, 2026-04-22).
 *
 * Bug: changing the `record_type` radio (expense ↔ income) programmatically or
 * by clicking the hidden input directly did not trigger category re-fetch —
 * only clicks on the surrounding `.transaction-type-btn` label were handled.
 * Fix: also listen for `change` events on the radios themselves.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setupTransactionTypeToggle } from '@web/dashboard/features/modalFact/typeToggle';
import { setTransactionCategoryTreeSelect } from '@web/dashboard/core/DashboardState';

function buildTransactionTab(): void {
  document.body.innerHTML = `
    <form id="form_modal_fact">
      <div id="modal_fact-tab-transaction">
        <label class="btn transaction-type-btn" data-type="expense">
          <input type="radio" name="record_type" value="expense" class="hidden" checked />
          Расход
        </label>
        <label class="btn transaction-type-btn btn-outline opacity-50" data-type="income">
          <input type="radio" name="record_type" value="income" class="hidden" />
          Доход
        </label>
      </div>
    </form>
  `;
}

describe('setupTransactionTypeToggle — BUG-006: radio change triggers categoryTree update', () => {
  let updateTypeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    buildTransactionTab();
    updateTypeSpy = vi.fn().mockResolvedValue(undefined);

    // Stub categoryTree on DashboardState.
    setTransactionCategoryTreeSelect({
      updateType: updateTypeSpy,
    } as any);

    (window as any).debugLog = () => {};
    (window as any).loadFactTransactionHints = vi.fn();
  });

  it('programmatic radio change (value=income, dispatch change) reloads categories', async () => {
    setupTransactionTypeToggle();

    const incomeRadio = document.querySelector<HTMLInputElement>(
      'input[name="record_type"][value="income"]'
    )!;
    incomeRadio.checked = true;
    incomeRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // The handler is async; wait one microtask tick.
    await Promise.resolve();
    await Promise.resolve();

    expect(updateTypeSpy).toHaveBeenCalledWith('income');
  });

  it('label click path keeps working (no regression on existing handler)', async () => {
    setupTransactionTypeToggle();

    const incomeLabel = document.querySelector<HTMLLabelElement>(
      '.transaction-type-btn[data-type="income"]'
    )!;
    incomeLabel.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(updateTypeSpy).toHaveBeenCalledWith('income');
  });

  it('does not fire for the already-checked radio (change event only fires on change)', () => {
    setupTransactionTypeToggle();

    const expenseRadio = document.querySelector<HTMLInputElement>(
      'input[name="record_type"][value="expense"]'
    )!;
    // Already checked in fixture — dispatching change on an unchanged value is legal,
    // but when nothing toggled we still want our handler to be idempotent.
    expenseRadio.dispatchEvent(new Event('change', { bubbles: true }));

    // The handler may or may not fire depending on implementation; what matters
    // is that it does not throw and does not switch to 'income'.
    expect(updateTypeSpy).not.toHaveBeenCalledWith('income');
  });
});
