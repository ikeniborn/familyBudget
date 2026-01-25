/**
 * Tab Manager for Modal Fact
 * Handles tab switching and form data caching
 *
 * @module modalFact/tabManager
 */

import { createTabManager } from '../../shared/tabManagerFactory';

// Transaction fields for modal_fact
const TRANSACTION_FIELDS = [
  'fact_date', 'financial_center_id', 'record_type',
  'article_id', 'cost_center_id', 'amount', 'description'
];

// Transfer fields for modal_fact
const TRANSFER_FIELDS = [
  'transfer_date', 'from_financial_center_id', 'from_article_id',
  'to_financial_center_id', 'to_article_id', 'amount', 'description'
];

// Create tab manager instance
const tabManager = createTabManager({
  modalId: 'modal_fact',
  formId: 'form_modal_fact',
  transactionFields: TRANSACTION_FIELDS,
  transferFields: TRANSFER_FIELDS
});

// Export tab manager methods
export const { switchTab, setupTabListeners, clearTabCache, getCurrentTab } = tabManager;
