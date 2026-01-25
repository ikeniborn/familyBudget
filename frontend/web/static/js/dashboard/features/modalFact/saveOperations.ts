/**
 * Save operations for modal fact
 * Handles both transaction and transfer save
 *
 * @module modalFact/saveOperations
 */

import { closeModalFact } from './index';
import { getCurrentTab } from './tabManager';
import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';

declare const debugLog: (...args: any[]) => void;

/**
 * Set button loading state
 */
function setButtonLoading(button: HTMLElement, loading: boolean): void {
  const btn = button as HTMLButtonElement;
  btn.disabled = loading;

  if (loading) {
    btn.classList.add('loading');
  } else {
    btn.classList.remove('loading');
  }
}

/**
 * Save fact transaction
 */
async function saveFactTransaction(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Build request data
  const data = {
    record_type: formData.get('record_type'), // expense/income
    fact_date: formData.get('fact_date'), // DD.MM.YYYY
    financial_center_id: parseInt(formData.get('financial_center_id') as string),
    article_id: parseInt(formData.get('article_id') as string),
    cost_center_id: formData.get('cost_center_id')
      ? parseInt(formData.get('cost_center_id') as string)
      : null,
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  debugLog('[SaveFactModal] Saving transaction:', data);

  // POST /api/v1/facts
  const response = await fetch('/api/v1/facts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog('[SaveFactModal] Transaction saved:', result);

  // Update UI
  await refreshUIAfterFactSave();
}

/**
 * Save fact transfer
 */
async function saveFactTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Build request data
  const data = {
    record_type: 'fact',
    transfer_date: formData.get('transfer_date'), // DD.MM.YYYY
    from_financial_center_id: parseInt(formData.get('from_financial_center_id') as string),
    to_financial_center_id: parseInt(formData.get('to_financial_center_id') as string),
    from_article_id: formData.get('from_article_id')
      ? parseInt(formData.get('from_article_id') as string)
      : null,
    to_article_id: formData.get('to_article_id')
      ? parseInt(formData.get('to_article_id') as string)
      : null,
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  debugLog('[SaveFactModal] Saving transfer:', data);

  // POST /api/v1/admin/transfers
  const response = await fetch('/api/v1/admin/transfers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  debugLog('[SaveFactModal] Transfer saved:', result);

  // Update UI
  await refreshUIAfterFactSave();
}

/**
 * Save fact modal (router function)
 * Determines which tab is active and calls appropriate save function
 */
export async function saveFactModal(button: HTMLElement): Promise<void> {
  if ((button as HTMLButtonElement).disabled) return;

  const form = document.getElementById('form_modal_fact') as HTMLFormElement;

  if (!form) {
    debugLog('[SaveFactModal] Form not found');
    return;
  }

  const activeTab = getCurrentTab();

  // Set button loading state
  setButtonLoading(button, true);

  // Validate form
  if (!form.checkValidity()) {
    setButtonLoading(button, false);
    form.reportValidity();
    return;
  }

  try {
    if (activeTab === 'transaction') {
      await saveFactTransaction(form);
    } else {
      await saveFactTransfer(form);
    }

    // Close modal on success
    closeModalFact();

    // Show success toast
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Факт сохранён', 'success');
    }

  } catch (error) {
    debugLog('[SaveFactModal] Error:', error);
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Ошибка сохранения', 'error');
    }
  } finally {
    setButtonLoading(button, false);
  }
}
