/**
 * Transfer Split Operations
 *
 * Handles splitting pending transfers into two separate facts (expense + income).
 * This is needed when user wants to edit one side of a transfer separately.
 */

import type { PendingRecord } from '../../types/dashboard.d';
import { loadPendingRecords } from './syncOperations';

// ============================================================================
// Transfer Split
// ============================================================================

/**
 * Split pending transfer into two separate facts (expense + income)
 *
 * @param itemId - IndexedDB sync queue item ID
 * @param side - 'from' (expense/debit) or 'to' (income/credit) - which to open for editing
 * @returns ID of the fact to edit, or null on error
 */
export async function splitTransferToFacts(itemId: number, side: 'from' | 'to' = 'from'): Promise<number | null> {
  if (!window.offlineManager) {
    showToast('Менеджер синхронизации недоступен', 'error');
    return null;
  }

  const { items } = await window.offlineManager.getAllUnsyncedItems();
  const transferItem = items.find((i: PendingRecord) => i.id === itemId && i.entity === 'transfer');

  if (!transferItem) {
    showToast('Перевод не найден', 'error');
    return null;
  }

  const data = transferItem.data;
  const db = window.offlineManager.db;
  const entity = data.record_type === 'plan' ? 'plan' : 'fact';

  /**
   * Helper: create fact with proper hashes for sync
   */
  async function createFactWithHashes(factData: object, tempId: string): Promise<number> {
    // 1. Generate content hash for deduplication
    const contentHash = db.generateContentHash(factData);

    // 2. Generate sync hash = MD5(content_hash|user_id|created_date)
    const userId = await window.offlineManager!.getCurrentUserId();
    const createdDate = new Date().toISOString().split('T')[0];
    const syncHash = db._md5(`${contentHash}|${userId}|${createdDate}`);

    // 3. Add to facts entity store (REQUIRED for sync to work!)
    await db.addFact({
      tempId,
      data: factData,
      contentHash,
      syncHash,
      synced: false,
      createdAt: Date.now(),
      error: null,
      serverId: null,
    });

    // 4. Add to sync queue
    return await db.addToSyncQueue({
      operation: 'create',
      entity: entity,
      tempId,
      data: factData,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
      error: null,
    });
  }

  // Expense fact data (FROM side)
  // Use 'debit' type to match transfer category type
  const expenseData = {
    fact_date: data.transfer_date,
    amount: data.amount,
    record_type: data.record_type,
    description: data.description || '',
    financial_center_id: data.from_financial_center_id,
    financial_center_name: data.from_financial_center_name,
    article_id: data.from_article_id,
    article_name: data.from_article_name,
    fact_type: 'debit',
    cost_center_id: data.from_cost_center_id || null,
  };

  // Income fact data (TO side)
  // Use 'credit' type to match transfer category type
  const incomeData = {
    fact_date: data.transfer_date,
    amount: data.amount,
    record_type: data.record_type,
    description: data.description || '',
    financial_center_id: data.to_financial_center_id,
    financial_center_name: data.to_financial_center_name,
    article_id: data.to_article_id,
    article_name: data.to_article_name,
    fact_type: 'credit',
    cost_center_id: data.to_cost_center_id || null,
  };

  // Generate unique temp IDs
  const expenseTempId = `offline_${entity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const incomeTempId = `offline_${entity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_2`;

  let expenseItemId: number | null = null;
  let incomeItemId: number | null = null;

  try {
    // Create both facts with proper hashes
    expenseItemId = await createFactWithHashes(expenseData, expenseTempId);
    incomeItemId = await createFactWithHashes(incomeData, incomeTempId);

    // Remove original transfer from sync queue
    await window.offlineManager.removePendingItem(itemId);

    // Also remove from transfers entity store
    if (transferItem.tempId) {
      try {
        await db.deleteTransfer(transferItem.tempId);
      } catch (e) {
        console.warn('Could not delete transfer from entity store:', e);
      }
    }

    return side === 'from' ? expenseItemId : incomeItemId;

  } catch (error) {
    // Rollback on failure
    console.error('Error splitting transfer:', error);

    if (expenseItemId) {
      try {
        await window.offlineManager.removePendingItem(expenseItemId);
      } catch (e) {
        // Ignore rollback errors
      }
      try {
        await db.deleteFact(expenseTempId);
      } catch (e) {
        // Ignore rollback errors
      }
    }

    if (incomeItemId) {
      try {
        await window.offlineManager.removePendingItem(incomeItemId);
      } catch (e) {
        // Ignore rollback errors
      }
      try {
        await db.deleteFact(incomeTempId);
      } catch (e) {
        // Ignore rollback errors
      }
    }

    throw error;
  }
}

/**
 * Handle click on transfer edit button - split and open edit modal
 *
 * @param itemId - IndexedDB sync queue item ID
 * @param side - 'from' (expense) or 'to' (income)
 */
export async function handleTransferEditClick(itemId: number, side: 'from' | 'to'): Promise<void> {
  try {
    showToast('Разделяю перевод на две записи...', 'info');

    const factIdToEdit = await splitTransferToFacts(itemId, side);
    if (!factIdToEdit) return;

    await loadPendingRecords();
    showToast('Перевод разделён на две записи', 'success');

    // Open edit modal for the new fact
    const { items } = await window.offlineManager!.getAllUnsyncedItems();
    const newFact = items.find((i: PendingRecord) => i.id === factIdToEdit);

    // Call global openEditPendingRecord (will be implemented in edit modal phase)
    if (typeof (window as any).openEditPendingRecord === 'function') {
      await (window as any).openEditPendingRecord(factIdToEdit, newFact?.entity || 'fact');
    } else if (window.Dashboard?.openEditPendingRecord) {
      await window.Dashboard.openEditPendingRecord(factIdToEdit, newFact?.entity || 'fact');
    } else {
      console.warn('[handleTransferEditClick] openEditPendingRecord not available');
    }

  } catch (error) {
    console.error('Error splitting transfer:', error);
    showToast('Ошибка: ' + (error as Error).message, 'error');
  }
}
