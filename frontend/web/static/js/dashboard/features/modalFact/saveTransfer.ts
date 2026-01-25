/**
 * Save transfer operation for modal fact
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalFact/saveTransfer
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';

declare const debugLog: (...args: any[]) => void;

/**
 * Save fact transfer
 */
export async function saveFactTransfer(form: HTMLFormElement): Promise<void> {
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
