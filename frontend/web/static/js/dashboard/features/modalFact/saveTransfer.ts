/**
 * Save transfer operation for modal fact
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalFact/saveTransfer
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';

/**
 * Save fact transfer
 */
export async function saveFactTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Get display date and convert to API format
  const displayDate = formData.get('transfer_date') as string;
  const apiDate = (window as any).BudgetShared?.DateFormatter.formatForAPI(displayDate);

  if (!apiDate) {
    throw new Error('Failed to convert date to API format');
  }

  // Get values from transfer tab fields (form has duplicate field names across tabs)
  const transferTab = form.querySelector('[data-tab="transfer"]') as HTMLElement;
  const amountInput = transferTab?.querySelector('input[name="amount"]') as HTMLInputElement;
  const descriptionInput = transferTab?.querySelector('textarea[name="description"]') as HTMLTextAreaElement;

  // Build request data
  const data = {
    record_type: 'fact',
    transfer_date: apiDate, // YYYY-MM-DD (converted from DD.MM.YYYY)
    from_financial_center_id: parseIntOrNull(formData.get('from_financial_center_id'))!,
    to_financial_center_id: parseIntOrNull(formData.get('to_financial_center_id'))!,
    from_article_id: parseIntOrNull(formData.get('from_article_id')),
    to_article_id: parseIntOrNull(formData.get('to_article_id')),
    amount: parseFloat(amountInput?.value || '0'),
    description: descriptionInput?.value || null
  };

  // POST /api/v1/transfers
  const transferData = await postAPI<{ expense_fact_id?: number; income_fact_id?: number }>(
    '/api/v1/transfers', data, 'SaveFactModal'
  );

  // Try incremental row injection for facts page; fall back to full reload if unavailable
  const injectRow = (window as any).FactsManager?.fetchAndInjectRow;
  if (typeof injectRow === 'function') {
    const ids = [transferData.expense_fact_id, transferData.income_fact_id].filter(Boolean) as number[];
    const results = await Promise.all(ids.map(id => injectRow(id, 'create') as Promise<boolean>));
    if (results.some(Boolean)) return;
  }

  await refreshUIAfterFactSave();
}
