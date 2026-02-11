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

  // Convert YYYY-MM to YYYY-MM-01 (first day of month)
  const period = formData.get('transfer_plan_month') as string; // YYYY-MM (field name from plan_transfer_tab.html)
  const transferDate = period ? `${period}-01` : null; // YYYY-MM-01

  // Build request data for plan transfer
  const data = {
    record_type: 'plan',
    transfer_date: transferDate, // YYYY-MM-01 (backend expects transfer_date, not transfer_period)
    from_financial_center_id: parseIntOrNull(formData.get('from_financial_center_id'))!,
    to_financial_center_id: parseIntOrNull(formData.get('to_financial_center_id'))!,
    from_article_id: parseIntOrNull(formData.get('from_article_id'))!, // required field (HTML required attr ensures non-null)
    to_article_id: parseIntOrNull(formData.get('to_article_id'))!,     // required field (HTML required attr ensures non-null)
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  // POST /api/v1/transfers
  await postAPI('/api/v1/transfers', data, 'SavePlanModal');

  // Update UI
  await refreshUIAfterPlanSave();
}
