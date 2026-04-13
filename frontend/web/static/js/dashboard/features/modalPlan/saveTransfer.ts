/**
 * Save transfer operation for modal plan
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalPlan/saveTransfer
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { createFact, generateUUID, isDexieActive } from '@db/dexie';
import { getCurrentUserId } from '@shared/utils/userHelpers';

/**
 * Save plan transfer
 */
export async function savePlanTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Get values from transfer tab fields (form has duplicate field names across tabs)
  const transferTab = form.querySelector('[data-tab="transfer"]') as HTMLElement;
  const amountInput = transferTab?.querySelector('input[name="amount"]') as HTMLInputElement;
  const descriptionInput = transferTab?.querySelector('textarea[name="description"]') as HTMLTextAreaElement;

  // Convert transfer_plan_month (YYYY-MM) to transfer_date (YYYY-MM-01)
  const planMonth = formData.get('transfer_plan_month') as string; // "2025-12"
  const transferDate = `${planMonth}-01`; // "2025-12-01"

  // Build request data for plan transfer
  const data = {
    record_type: 'plan',
    transfer_date: transferDate, // YYYY-MM-DD (first day of selected month)
    from_financial_center_id: parseIntOrNull(formData.get('from_financial_center_id'))!,
    to_financial_center_id: parseIntOrNull(formData.get('to_financial_center_id'))!,
    from_article_id: parseIntOrNull(formData.get('from_article_id')),
    to_article_id: parseIntOrNull(formData.get('to_article_id')),
    amount: parseFloat(amountInput?.value || '0'),
    description: descriptionInput?.value || null
  };

  try {
    // POST /api/v1/transfers
    await postAPI('/api/v1/transfers', data, 'SavePlanModal');

    // Update UI
    await refreshUIAfterPlanSave();
  } catch (error) {
    // Offline fallback: create both plan sides as pending facts in Dexie
    const isOffline = !navigator.onLine
      || (error instanceof TypeError && /fetch/i.test(error.message));

    if (isOffline && isDexieActive()) {
      try {
        const userId = await getCurrentUserId();
        const transferGroupId = generateUUID();

        // Debit side (expense plan): money leaving from_financial_center
        await createFact({
          user_id: userId,
          article_id: data.from_article_id ?? 0,
          financial_center_id: data.from_financial_center_id,
          cost_center_id: null,
          date: data.transfer_date,
          amount: -Math.abs(data.amount),
          record_type: 'plan',
          comment: data.description ?? null,
          transfer_group_id: transferGroupId,
          is_transfer: true,
          sync_hash: null
        });

        // Credit side (income plan): money arriving at to_financial_center
        await createFact({
          user_id: userId,
          article_id: data.to_article_id ?? 0,
          financial_center_id: data.to_financial_center_id,
          cost_center_id: null,
          date: data.transfer_date,
          amount: Math.abs(data.amount),
          record_type: 'plan',
          comment: data.description ?? null,
          transfer_group_id: transferGroupId,
          is_transfer: true,
          sync_hash: null
        });

        if (typeof (window as any).showToast === 'function') {
          (window as any).showToast('Перевод-план сохранён offline — отправится при подключении', 'info');
        }
        await refreshUIAfterPlanSave();
        return;
      } catch (offlineError) {
        console.error('[SavePlanModal] Failed to save plan transfer offline:', offlineError);
      }
    }

    throw error;
  }
}
