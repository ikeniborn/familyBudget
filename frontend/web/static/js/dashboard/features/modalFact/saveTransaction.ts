/**
 * Save transaction operation for modal fact
 *
 * @module modalFact/saveTransaction
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { isDexieActive, factRepo, getTabId } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

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

  try {
    // POST /api/v1/facts
    const responseData = await postAPI<any>('/api/v1/facts', data, 'SaveFactModal', {
      'X-Tab-Id': getTabId(),
    });

    // Write to local Dexie DB immediately after successful API call
    if (isDexieActive()) {
      try {
        await factRepo.createFromAPI(responseData);
      } catch (dexieError) {
        console.warn('[SaveFactModal] Failed to write to Dexie (non-critical):', dexieError);
      }
    }

    // Update UI
    await refreshUIAfterFactSave();
  } catch (error) {
    // Offline fallback: enqueue in Dexie pendingOperations instead of losing data
    const isOffline = !navigator.onLine
      || (error instanceof TypeError && /fetch/i.test(error.message));

    if (isOffline && isDexieActive()) {
      try {
        const userId = await getCurrentUserId();
        await factRepo.createOffline({
          user_id: userId,
          article_id: data.article_id,
          financial_center_id: data.financial_center_id,
          cost_center_id: data.cost_center_id ?? null,
          date: data.fact_date,
          amount: data.amount,
          record_type: 'fact',
          comment: data.description as string | null,
          transfer_group_id: null,
          is_transfer: false,
          sync_hash: null
        });
        if (typeof (window as any).showToast === 'function') {
          (window as any).showToast('Сохранено offline — отправится при подключении', 'info');
        }
        await refreshUIAfterFactSave();
        return;
      } catch (offlineError) {
        console.error('[SaveFactModal] Failed to save offline:', offlineError);
      }
    }

    throw error; // Re-throw for upper layer handling
  }
}
