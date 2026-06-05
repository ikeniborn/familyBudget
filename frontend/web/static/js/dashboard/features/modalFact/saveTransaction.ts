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

  // Get display date and convert to API format
  const displayDate = formData.get('fact_date') as string;
  const apiDate = window.BudgetShared?.DateFormatter.formatForAPI(displayDate);

  if (!apiDate) {
    throw new Error('Failed to convert date to API format');
  }

  // Build request data
  const data = {
    record_type: 'fact', // Always "fact" for actual transactions (backend expects "fact" or "plan")
    fact_date: apiDate, // YYYY-MM-DD (converted from DD.MM.YYYY)
    financial_center_id: parseIntOrNull(formData.get('financial_center_id'))!,
    article_id: parseIntOrNull(formData.get('article_id'))!,
    cost_center_id: parseIntOrNull(formData.get('cost_center_id')),
    amount: Number.parseInt(formData.get('amount') as string, 10),
    description: formData.get('description') || null
  };

  // POST /api/v1/facts
  await postAPI<any>('/api/v1/facts', data, 'SaveFactModal');

  // Update UI
  await refreshUIAfterFactSave();
}
