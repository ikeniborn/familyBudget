/**
 * Save transfer operation for modal plan
 * Lazy-loaded only when transfer tab is used
 *
 * @module modalPlan/saveTransfer
 */

import { refreshUIAfterPlanSave } from '../../shared/utils/uiRefresh';

declare const debugLog: (...args: any[]) => void;

/**
 * Save plan transfer
 */
export async function savePlanTransfer(form: HTMLFormElement): Promise<void> {
  const formData = new FormData(form);

  // Build request data for plan transfer
  const data = {
    record_type: 'plan',
    transfer_period: formData.get('transfer_period'), // YYYY-MM
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

  debugLog('[SavePlanModal] Saving plan transfer:', data);

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
  debugLog('[SavePlanModal] Plan transfer saved:', result);

  // Update UI
  await refreshUIAfterPlanSave();
}
