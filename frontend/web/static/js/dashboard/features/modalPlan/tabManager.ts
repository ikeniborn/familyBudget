/**
 * Tab Manager for Modal Plan
 * Handles tab switching and form data caching
 *
 * @module modalPlan/tabManager
 */

import { createTabManager } from '../../shared/tabManagerFactory';

// Transaction fields for modal_plan (includes recurring and reminder fields)
const TRANSACTION_FIELDS = [
  'plan_month', 'financial_center_id', 'plan_type',
  'article_id', 'cost_center_id', 'amount', 'description',
  'plan_mode', 'frequency_type', 'frequency_value_monthday',
  'frequency_value_yearly', 'duration_type', 'occurrences_count',
  'recurring_end_date', 'recurring_enable_reminder',
  'recurring_reminder_hour', 'recurring_reminder_minute',
  'reminder_date', 'reminder_hour', 'reminder_minute'
];

// Transfer fields for modal_plan
const TRANSFER_FIELDS = [
  'transfer_plan_month', 'from_financial_center_id', 'from_article_id',
  'to_financial_center_id', 'to_article_id', 'amount', 'description'
];

// Create tab manager instance
const tabManager = createTabManager({
  modalId: 'modal_plan',
  formId: 'form_modal_plan',
  transactionFields: TRANSACTION_FIELDS,
  transferFields: TRANSFER_FIELDS
});

// Export tab manager methods
export const { switchTab, setupTabListeners, clearTabCache, getCurrentTab } = tabManager;
