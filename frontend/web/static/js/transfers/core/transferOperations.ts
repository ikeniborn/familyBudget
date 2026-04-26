/**
 * Transfer Module - Transfer Operations
 *
 * Submit, validate, and modal management.
 * Migrated from: frontend/web/static/js/transfer.js (lines 922-975, 980-1193, 1198-1228)
 */

import { getState, type TransferFormData } from './TransferState';
import { loadTransferData } from './dataLoader';

// Global dependencies (declared in types/globals.d.ts)
declare const BudgetShared: any;
declare function showToast(message: string, type?: 'success' | 'error' | 'warning' | 'info'): void;
declare function setSubmitLoading(loading: boolean): void;

/**
 * Open transfer modal with skeleton loader.
 * Shows skeleton during data loading for better perceived performance.
 * Migrated from: transfer.js openTransferModal() (lines 922-975)
 */
/**
 * Open transfer modal with skeleton loader.
 *
 * Shows skeleton during data loading for better perceived performance.
 * Uses DaisyUI modal-open class (not HTML Dialog API).
 * Caches FROM/TO category trees and financial centers.
 *
 * @returns Promise that resolves when modal is ready
 */
export async function openTransferModal(): Promise<void> {
  const modal = document.getElementById('transfer_modal');
  const skeleton = document.getElementById('transfer_modal-loading-skeleton');
  const formFields = document.getElementById('transfer_modal-form-fields');

  if (!modal) {
    console.error('[Transfer] transfer_modal not found');
    return;
  }

  // Open modal immediately for perceived performance
  modal.classList.add('modal-open');

  // Setup backdrop click handler (iOS Safari fix)
  setupBackdropClickHandler(modal);

  // Check if data is already cached
  const state = getState();
  const hasCachedData =
    state.fromCategoryTree !== null &&
    state.toCategoryTree !== null &&
    state.financialCenters.length > 0;

  if (hasCachedData) {
    // Data cached - show form immediately without skeleton
    if (skeleton) skeleton.classList.add('hidden');
    if (formFields) formFields.classList.remove('hidden');

    // Update widgets with current state
    await updateTransferWidgets(state);
  } else {
    // No cache - show skeleton during loading
    if (skeleton) skeleton.classList.remove('hidden');
    if (formFields) formFields.classList.add('hidden');

    try {
      // Load data
      await loadTransferData();

      // Hide skeleton, show form
      if (skeleton) skeleton.classList.add('hidden');
      if (formFields) formFields.classList.remove('hidden');

      // Update widgets after loading
      const updatedState = getState();
      await updateTransferWidgets(updatedState);
    } catch (error) {
      console.error('[Transfer] Failed to load data:', error);
      modal.classList.remove('modal-open');
      if (typeof showToast === 'function') {
        showToast('Ошибка загрузки данных', 'error');
      }
    }
  }
}

/**
 * Update transfer modal widgets with current state
 * Extracted from openTransferModal for reuse
 */
async function updateTransferWidgets(state: ReturnType<typeof getState>): Promise<void> {
  // 1. CRITICAL: Reset FC filter state (prevents phantom auto-select)
  if (state.fromCategoryTree) {
    state.fromCategoryTree.options.financialCenterId = null;
  }
  if (state.toCategoryTree) {
    state.toCategoryTree.options.financialCenterId = null;
  }

  // 2. Apply current FC filtering
  const fromFCSelect = document.querySelector<HTMLSelectElement>('#from_financial_center');
  const toFCSelect = document.querySelector<HTMLSelectElement>('#to_financial_center');

  const fromFCId = fromFCSelect?.value ? parseInt(fromFCSelect.value) : null;
  const toFCId = toFCSelect?.value ? parseInt(toFCSelect.value) : null;

  await state.fromCategoryTree?.updateFinancialCenter(fromFCId);
  await state.toCategoryTree?.updateFinancialCenter(toFCId);

  // 3. Set today's date for fact transfers
  if (state.recordType === 'fact' && state.dateWidget) {
    state.dateWidget.setDate(BudgetShared.DateFormatter.today());
  }
}

/**
 * Setup backdrop click handler (one-time)
 * Migrated from: transfer.js lines 963-973
 */
function setupBackdropClickHandler(modal: HTMLElement | null): void {
  if (!modal || modal.dataset.backdropHandlerAdded) return;

  modal.addEventListener('click', (e: Event) => {
    const modalBox = modal.querySelector('.modal-box');
    // CRITICAL: Use !contains instead of e.target === modal (Choices.js dropdown fix)
    if (modalBox && !modalBox.contains(e.target as Node)) {
      closeTransferModal();
    }
  });

  modal.dataset.backdropHandlerAdded = 'true';
}

/**
 * Close transfer modal
 */
export function closeTransferModal(): void {
  const modal = document.getElementById('transfer_modal');
  modal?.classList.remove('modal-open');

  // Reset form
  const form = document.querySelector<HTMLFormElement>('#form_transfer');
  form?.reset();
}

/**
 * Validate transfer data
 * Migrated from: transfer.js validateTransferData() (lines 1198-1228)
 */
export function validateTransferData(data: TransferFormData): string | null {
  if (!data.fromFinancialCenterId) return 'Выберите счёт списания';
  if (!data.toFinancialCenterId) return 'Выберите счёт зачисления';
  if (data.fromFinancialCenterId === data.toFinancialCenterId) {
    return 'Счета списания и зачисления должны быть разными';
  }
  if (!data.amount || data.amount <= 0) return 'Введите корректную сумму';
  if (data.recordType === 'fact' && !data.date) return 'Выберите дату';
  if (data.recordType === 'plan' && !data.period) return 'Выберите период';

  return null; // Valid
}

/**
 * Handle transfer submit
 * Called from HTML templates' saveTransfer() function
 * Migrated from: transfer.js handleTransferSubmit() (lines 980-1193)
 */
export async function handleTransferSubmit(event: Event): Promise<void> {
  event.preventDefault();

  const form = event.target as HTMLFormElement;
  const formData = new FormData(form);

  // 1. Collect data
  const state = getState();
  const transferData: TransferFormData = {
    fromFinancialCenterId: parseInt(formData.get('from_financial_center') as string),
    toFinancialCenterId: parseInt(formData.get('to_financial_center') as string),
    amount: Number.parseInt(formData.get('amount') as string, 10),
    recordType: state.recordType,
    date: state.recordType === 'fact' ? (formData.get('transfer_date') as string) : '',
    period: state.recordType === 'plan' ? (formData.get('transfer_plan_month') as string) : undefined,
    description: (formData.get('description') as string) || '',
    fromArticleId: state.fromCategoryTree?.getSelectedCategoryId() || undefined,
    toArticleId: state.toCategoryTree?.getSelectedCategoryId() || undefined
  };

  // 2. Validate
  const error = validateTransferData(transferData);
  if (error) {
    showToast(error, 'error');
    return;
  }

  // 3. Submit
  setSubmitLoading(true);

  try {
    if (navigator.onLine) {
      const { createTransfer } = await import('../integration/apiService');
      await createTransfer(transferData);
      showToast('Перевод создан', 'success');
    } else {
      const { createTransferOffline } = await import('../integration/offlineIntegration');
      await createTransferOffline(transferData);
      showToast('Перевод сохранён (оффлайн)', 'info');
    }

    closeTransferModal();

    // Trigger UI updates (if elements exist)
    const { updateRecentTransactions, updateQuickStats } = await import('../integration/htmxIntegration');
    updateRecentTransactions();
    updateQuickStats();

  } catch (err) {
    console.error('[Transfer] Submit error:', err);
    showToast('Ошибка при создании перевода', 'error');
  } finally {
    setSubmitLoading(false);
  }
}
