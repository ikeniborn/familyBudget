/**
 * Unit tests for tabValidation helpers.
 *
 * Covers BUG-005 (2026-04-22): inactive tab inputs with shared `name` (e.g. `amount`,
 * `description`) were included in `new FormData(form)`, overwriting active-tab values
 * with empty strings and producing 422 on POST /api/v1/facts. The fix introduces
 * `disableInactiveTabInputs` / `restoreInactiveTabInputs` which toggle the `disabled`
 * attribute so excluded inputs drop out of FormData.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  disableInactiveTabValidation,
  restoreRequiredValidation,
  disableInactiveTabInputs,
  restoreInactiveTabInputs,
} from '@web/dashboard/shared/utils/tabValidation';

function buildModal(modalId: string): HTMLFormElement {
  document.body.innerHTML = `
    <dialog id="${modalId}">
      <form id="form_${modalId}">
        <div id="${modalId}-tab-transaction">
          <input name="fact_date" value="2026-04-22" required />
          <input name="financial_center_id" value="42" required />
          <input name="article_id" value="100" required />
          <input name="amount" value="222" required />
          <input name="description" value="PW_TEST" />
          <input type="radio" name="record_type" value="expense" checked />
          <input type="radio" name="record_type" value="income" />
        </div>
        <div id="${modalId}-tab-transfer" class="hidden">
          <input name="transfer_date" value="" required />
          <input name="from_financial_center_id" value="" required />
          <input name="to_financial_center_id" value="" required />
          <input name="amount" value="" required />
          <input name="description" value="" />
        </div>
      </form>
    </dialog>
  `;
  return document.getElementById(`form_${modalId}`) as HTMLFormElement;
}

describe('tabValidation — disableInactiveTabInputs (BUG-005)', () => {
  const modalId = 'modal_fact';
  let form: HTMLFormElement;

  beforeEach(() => {
    form = buildModal(modalId);
  });

  it('FormData from active transaction tab must NOT contain empty amount from transfer tab', () => {
    disableInactiveTabInputs(modalId, 'transaction');

    const formData = new FormData(form);
    const amounts = formData.getAll('amount');
    const descriptions = formData.getAll('description');

    expect(amounts).toEqual(['222']);
    expect(descriptions).toEqual(['PW_TEST']);
    expect(formData.get('amount')).toBe('222');
  });

  it('adds disabled attribute only to inactive tab inputs and marks them for restore', () => {
    disableInactiveTabInputs(modalId, 'transaction');

    const inactive = document.querySelectorAll<HTMLInputElement>('#modal_fact-tab-transfer input');
    inactive.forEach((el) => {
      expect(el.disabled).toBe(true);
      expect(el.getAttribute('data-was-disabled')).toBe('true');
    });

    const active = document.querySelectorAll<HTMLInputElement>('#modal_fact-tab-transaction input');
    active.forEach((el) => {
      expect(el.disabled).toBe(false);
    });
  });

  it('restoreInactiveTabInputs removes disabled and data-was-disabled markers', () => {
    disableInactiveTabInputs(modalId, 'transaction');
    restoreInactiveTabInputs(modalId);

    const all = document.querySelectorAll<HTMLInputElement>(`#${modalId} input`);
    all.forEach((el) => {
      expect(el.disabled).toBe(false);
      expect(el.hasAttribute('data-was-disabled')).toBe(false);
    });
  });

  it('is idempotent — calling disable twice does not stack markers or corrupt state', () => {
    disableInactiveTabInputs(modalId, 'transaction');
    disableInactiveTabInputs(modalId, 'transaction');
    restoreInactiveTabInputs(modalId);

    const all = document.querySelectorAll<HTMLInputElement>(`#${modalId} input`);
    all.forEach((el) => {
      expect(el.disabled).toBe(false);
    });
  });

  it('does NOT disable inputs that were already disabled for a different reason', () => {
    const preDisabled = document.querySelector<HTMLInputElement>(
      '#modal_fact-tab-transfer input[name="to_financial_center_id"]'
    )!;
    preDisabled.disabled = true;

    disableInactiveTabInputs(modalId, 'transaction');
    restoreInactiveTabInputs(modalId);

    // Pre-existing disabled state must survive the disable/restore cycle.
    expect(preDisabled.disabled).toBe(true);
    expect(preDisabled.hasAttribute('data-was-disabled')).toBe(false);
  });

  it('symmetric case: disable transaction when active=transfer', () => {
    disableInactiveTabInputs(modalId, 'transfer');

    const formData = new FormData(form);
    expect(formData.getAll('amount')).toEqual(['']); // only transfer.amount (empty in test fixture)

    const transactionInputs = document.querySelectorAll<HTMLInputElement>(
      '#modal_fact-tab-transaction input'
    );
    transactionInputs.forEach((el) => {
      expect(el.disabled).toBe(true);
    });
  });
});

describe('tabValidation — existing helpers still work alongside disable', () => {
  const modalId = 'modal_fact';

  beforeEach(() => {
    buildModal(modalId);
  });

  it('disableInactiveTabValidation and disableInactiveTabInputs can be applied together', () => {
    disableInactiveTabValidation(modalId, 'transaction');
    disableInactiveTabInputs(modalId, 'transaction');

    const transferAmount = document.querySelector<HTMLInputElement>(
      '#modal_fact-tab-transfer input[name="amount"]'
    )!;
    expect(transferAmount.hasAttribute('required')).toBe(false);
    expect(transferAmount.disabled).toBe(true);

    restoreInactiveTabInputs(modalId);
    restoreRequiredValidation(modalId);

    expect(transferAmount.hasAttribute('required')).toBe(true);
    expect(transferAmount.disabled).toBe(false);
  });
});
