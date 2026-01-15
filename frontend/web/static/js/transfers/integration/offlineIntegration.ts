/**
 * Transfer Module - Offline Integration
 *
 * Offline sync via offlineManager.
 */

import type { TransferFormData } from '../types/transfer';

// Global dependencies
declare const window: any;

/**
 * Create transfer offline
 */
export async function createTransferOffline(data: TransferFormData): Promise<void> {
  if (!window.offlineManager) {
    throw new Error('Offline manager not available');
  }

  await window.offlineManager.createTransfer({
    transfer_date: data.date,
    amount: data.amount,
    record_type: data.recordType,
    from_financial_center_id: data.fromFinancialCenterId,
    to_financial_center_id: data.toFinancialCenterId,
    from_article_id: data.fromArticleId,
    to_article_id: data.toArticleId,
    description: data.description
  });
}
