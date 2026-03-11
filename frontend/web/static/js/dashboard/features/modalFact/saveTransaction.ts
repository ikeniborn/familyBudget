/**
 * Save transaction operation for modal fact
 *
 * @module modalFact/saveTransaction
 */

import { refreshUIAfterFactSave } from '../../shared/utils/uiRefresh';
import { parseIntOrNull, postAPI } from '../../shared/utils/apiHelpers';
import { getDexieManager, isDexieActive, mapAPIFactToLocal, toCents, db } from '@db/dexie';

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
    amount: parseFloat(formData.get('amount') as string),
    description: formData.get('description') || null
  };

  try {
    // POST /api/v1/facts
    const responseData = await postAPI<any>('/api/v1/facts', data, 'SaveFactModal');

    // Write to local Dexie DB immediately after successful API call
    if (isDexieActive()) {
      try {
        const manager = getDexieManager();
        if (manager.isReady()) {
          const localFact = mapAPIFactToLocal(responseData);
          await db.budgetFacts.put({ ...localFact, amount: toCents(localFact.amount) });
        }
      } catch (dexieError) {
        console.warn('[SaveFactModal] Failed to write to Dexie (non-critical):', dexieError);
      }
    }

    // Update UI
    await refreshUIAfterFactSave();
  } catch (error) {
    console.error('[SaveFactModal] Failed to save transaction:', error);
    throw error; // Re-throw for upper layer handling
  }
}
