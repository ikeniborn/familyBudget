/**
 * Save transfer operation for modal plan
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalPlan/saveTransfer
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';

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
    amount: Number.parseInt(amountInput?.value || '0', 10),
    description: descriptionInput?.value || null
  };

  // POST /api/v1/transfers
  await postAPI('/api/v1/transfers', data, 'SavePlanModal');

  // Update UI
  await refreshUIAfterPlanSave();
}
