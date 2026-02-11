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

  // Build request data for plan transfer
  const data = {
    record_type: 'plan',
    transfer_period: formData.get('transfer_period'), // YYYY-MM
    from_financial_center_id: parseIntOrNull(formData.get('from_financial_center_id'))!,
    to_financial_center_id: parseIntOrNull(formData.get('to_financial_center_id'))!,
    from_article_id: parseIntOrNull(formData.get('from_article_id')),
    to_article_id: parseIntOrNull(formData.get('to_article_id')),
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  // POST /api/v1/transfers
  await postAPI('/api/v1/transfers', data, 'SavePlanModal');

  // Update UI
  await refreshUIAfterPlanSave();
}
