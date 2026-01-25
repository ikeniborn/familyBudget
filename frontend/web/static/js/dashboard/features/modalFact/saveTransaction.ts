/**
 * Save transaction operation for modal fact
 *
 * @module modalFact/saveTransaction
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';

/**
 * Save fact transaction
 */
export async function saveFactTransaction(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Build request data
  const data = {
    record_type: formData.get('record_type'), // expense/income
    fact_date: formData.get('fact_date'), // DD.MM.YYYY
    financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
    article_id: parseIntOrNull(formData.get('article_id'))!,
    cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  // POST /api/v1/facts
  await postAPI('/api/v1/facts', data, 'SaveFactModal');

  // Update UI
  await refreshUIAfterFactSave();
}
