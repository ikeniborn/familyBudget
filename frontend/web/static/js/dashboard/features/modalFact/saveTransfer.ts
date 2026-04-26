/**
 * Save transfer operation for modal fact
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalFact/saveTransfer
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { createFact, generateUUID, isDexieActive } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

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
    amount: Number.parseInt(amountInput?.value || '0', 10),
    description: descriptionInput?.value || null
  };

  try {
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
  } catch (error) {
    // Offline fallback: create both sides of the transfer in Dexie pendingOperations
    const isOffline = !navigator.onLine
      || (error instanceof TypeError && /fetch/i.test(error.message));

    if (isOffline && isDexieActive()) {
      try {
        const userId = await getCurrentUserId();
        const transferGroupId = generateUUID();

        // Debit side (expense): money leaving from_financial_center
        await createFact({
          user_id: userId,
          article_id: data.from_article_id ?? 0,
          financial_center_id: data.from_financial_center_id,
          cost_center_id: null,
          date: data.transfer_date,
          amount: -Math.abs(data.amount),
          record_type: 'fact',
          comment: data.description ?? null,
          transfer_group_id: transferGroupId,
          is_transfer: true,
          sync_hash: null
        });

        // Credit side (income): money arriving at to_financial_center
        await createFact({
          user_id: userId,
          article_id: data.to_article_id ?? 0,
          financial_center_id: data.to_financial_center_id,
          cost_center_id: null,
          date: data.transfer_date,
          amount: Math.abs(data.amount),
          record_type: 'fact',
          comment: data.description ?? null,
          transfer_group_id: transferGroupId,
          is_transfer: true,
          sync_hash: null
        });

        if (typeof (window as any).showToast === 'function') {
          (window as any).showToast('Перевод сохранён offline — отправится при подключении', 'info');
        }
        await refreshUIAfterFactSave();
        return;
      } catch (offlineError) {
        console.error('[SaveFactModal] Failed to save transfer offline:', offlineError);
      }
    }

    throw error;
  }
}
