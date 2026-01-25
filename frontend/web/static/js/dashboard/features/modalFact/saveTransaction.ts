/**
 * Save transaction operation for modal fact
 *
 * @module modalFact/saveTransaction
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';

declare const debugLog: (...args: any[]) => void;

/**
 * Save fact transaction
 */
export async function saveFactTransaction(form: HTMLFormElement): Promise<void> {
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
