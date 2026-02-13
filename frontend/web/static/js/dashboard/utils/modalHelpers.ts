/**
 * Modal Helpers - Shared utilities for modal window management
 *
 * Provides reusable skeleton loader pattern for consistent UX
 * across all modal windows (transaction, plan, transfer, edit)
 */

/**
 * Show modal with skeleton loader during data loading
 *
 * Provides consistent UX across all modal windows:
 * - Opens modal immediately for perceived performance (< 100ms)
 * - Shows skeleton loader if data needs loading
 * - Skips skeleton if data is cached
 * - Handles errors gracefully (close modal + toast)
 *
 * @param modalId - Modal element ID (e.g., 'modal_add_transaction')
 * @param checkCache - Function to check if data is cached
 * @param loadData - Async function to load modal data
 * @param setupUI - Optional sync UI setup function (e.g., set default date)
 * @returns Promise that resolves when modal is ready
 *
 * @example
 * ```typescript
 * await showModalWithSkeleton(
 *   'modal_add_transaction',
 *   () => state.transactionCategoryTreeSelect !== null,
 *   async () => {
 *     await Promise.all([
 *       loadTransactionCategoriesImpl(),
 *       loadFinancialCentersImpl(),
 *       loadCostCentersImpl()
 *     ]);
 *   }
 * );
 * ```
 */
export async function showModalWithSkeleton(
  modalId: string,
  checkCache: () => boolean,
  loadData: () => Promise<void>,
  setupUI?: () => void
): Promise<void> {
  const modal = document.getElementById(modalId) as HTMLDialogElement | null;
  const skeleton = document.getElementById(`${modalId}-loading-skeleton`);
  const formFields = document.getElementById(`${modalId}-form-fields`);

  if (!modal) {
    console.error(`[showModalWithSkeleton] Modal ${modalId} not found`);
    return;
  }

  // Graceful degradation: if skeleton elements not found, show modal normally
  if (!skeleton || !formFields) {
    console.warn(`[showModalWithSkeleton] Skeleton elements not found for ${modalId}`);
    modal.showModal();
    setupUI?.();
    await loadData();
    return;
  }

  // Open modal immediately for perceived performance
  modal.showModal();

  // Check if data is already cached
  if (checkCache()) {
    // Data cached - show form immediately without skeleton
    skeleton.classList.add('hidden');
    formFields.classList.remove('hidden');
    setupUI?.();
    await loadData(); // Update widgets even with cached data
  } else {
    // No cache - show skeleton during loading
    skeleton.classList.remove('hidden');
    formFields.classList.add('hidden');

    try {
      setupUI?.();
      await loadData();

      // Hide skeleton, show form
      skeleton.classList.add('hidden');
      formFields.classList.remove('hidden');
    } catch (error) {
      console.error(`[showModalWithSkeleton] Failed to load data for ${modalId}:`, error);
      modal.close();
      if (typeof showToast === 'function') {
        showToast('Ошибка загрузки данных', 'error');
      }
    }
  }
}
