/**
 * Form Population for Edit Modal
 *
 * Handles populating form fields and setting up the edit modal state.
 */

import { getState, setEditCategoryTreeSelect } from '../../core/DashboardState';
import {
  loadCategoriesForEdit,
  loadEditFinancialCenters,
  loadEditCostCenters,
  loadRemindersForEdit,
  remindersMap,
} from './dropdownCache';
import {
  initEditReminderCalendarWidget,
  populateEditReminderFields,
  resetEditReminderFields,
} from './reminderHelpers';
import type { EditRecordType, FactType } from '../../types/dashboard.d';

// ============================================================================
// State Variables
// ============================================================================

// Current editing state
let currentEditingRecordType: EditRecordType = null;

export function getCurrentEditingRecordType(): EditRecordType {
  return currentEditingRecordType;
}

export function setCurrentEditingState(recordType: EditRecordType): void {
  currentEditingRecordType = recordType;
}

// ============================================================================
// Modal Mode Setup
// ============================================================================

/**
 * Set edit modal mode (show/hide reminder section based on record type).
 */
export function setEditModalMode(recordType: 'fact' | 'plan'): void {
  const reminderContainer = document.getElementById('edit-reminder-container');
  const reminderSettings = document.getElementById('edit-reminder-settings');

  currentEditingRecordType = recordType;

  if (recordType === 'fact') {
    // Hide reminder section for facts
    if (reminderContainer) reminderContainer.classList.add('hidden');
    if (reminderSettings) reminderSettings.classList.add('hidden');
  } else {
    // Show reminder section for plans
    if (reminderContainer) reminderContainer.classList.remove('hidden');
  }
}

// ============================================================================
// Category Type Helpers
// ============================================================================

/**
 * Update category type badge in edit modal.
 */
export function updateEditCategoryTypeBadge(type: FactType): void {
  const badge = document.getElementById('edit-category-type-label');
  if (!badge) return;

  const typeConfig: Record<FactType, { text: string; class: string }> = {
    expense: { text: 'Расход', class: 'badge-error' },
    income: { text: 'Доход', class: 'badge-success' },
    debit: { text: 'Списание', class: 'badge-info' },
    credit: { text: 'Пополнение', class: 'badge-warning' },
  };

  const config = typeConfig[type] || typeConfig.expense;
  badge.textContent = config.text;
  badge.className = `badge badge-sm ${config.class}`;
}

/**
 * Setup category type buttons handlers for edit modal.
 */
export function setupEditCategoryTypeButtons(): void {
  const typeButtons = document.querySelectorAll('.edit-category-type-btn') as NodeListOf<HTMLElement>;
  const state = getState();

  typeButtons.forEach(button => {
    // Remove any existing listeners to prevent duplicates
    const newButton = button.cloneNode(true) as HTMLElement;
    button.parentNode?.replaceChild(newButton, button);

    newButton.addEventListener('click', async function(this: HTMLElement) {
      // Remove btn-active from all buttons
      document.querySelectorAll('.edit-category-type-btn').forEach(btn => btn.classList.remove('btn-active'));

      // Add btn-active to current button
      this.classList.add('btn-active');

      // Check corresponding radio button
      const radio = this.querySelector('input[type="radio"]') as HTMLInputElement | null;
      if (radio) {
        radio.checked = true;
      }

      // Reload categories with new type
      const newType = this.dataset.type as FactType;

      // Update badge in collapse header
      updateEditCategoryTypeBadge(newType);

      if (state.editCategoryTreeSelect && state.allCategories.length > 0) {
        state.editCategoryTreeSelect.updateType(newType);
      }
    });
  });
}

// ============================================================================
// Category Tree Select Initialization
// ============================================================================

/**
 * Initialize CategoryTreeSelect for edit modal.
 */
export function initEditCategoryTreeSelect(
  categoryType: FactType,
  financialCenterId: number | null,
  articleId: number | null
): void {
  const state = getState();

  // Destroy previous instance if exists
  if (state.editCategoryTreeSelect) {
    try {
      state.editCategoryTreeSelect.destroy();
    } catch (e) {
      // Ignore cleanup errors
    }
    setEditCategoryTreeSelect(null);
  }

  const editSelect = document.getElementById('edit-article') as HTMLSelectElement | null;
  if (!editSelect) return;

  // Reset select
  editSelect.innerHTML = '<option value="" disabled hidden>-- Выберите категорию --</option>';

  if (!window.BudgetShared?.ChoicesCategoryTree) return;

  const newInstance = new window.BudgetShared.ChoicesCategoryTree('#edit-article', {
    type: categoryType,
    showLeafOnly: true,
    mode: 'edit', // Edit mode - preserves category even on initial FC filter
    financialCenterId: financialCenterId,
    onCategoryChange: () => {
      // Category changed callback - can be used for validation
    },
  });

  setEditCategoryTreeSelect(newInstance);

  // Wait for initialization, then set value
  if (articleId) {
    const initCheckInterval = setInterval(async () => {
      const currentState = getState();
      if (
        currentState.editCategoryTreeSelect &&
        (currentState.editCategoryTreeSelect as any).categoryMap &&
        (currentState.editCategoryTreeSelect as any).categoryMap.size > 0
      ) {
        const choicesStore = (currentState.editCategoryTreeSelect as any).choices._store?.choices || [];
        if (choicesStore.length > 0) {
          clearInterval(initCheckInterval);
          await currentState.editCategoryTreeSelect.setSelectedCategory(articleId);
        }
      }
    }, 100);

    // Timeout after 15 seconds (increased from 3s for slow connections)
    setTimeout(() => clearInterval(initCheckInterval), 15000);
  }
}

// ============================================================================
// Open Edit Modal for Online Record
// ============================================================================

/**
 * Open edit modal for online fact/plan record with skeleton loader.
 * Shows skeleton during data loading for better perceived performance.
 */
/**
 * Open edit modal for online record (fact or plan).
 *
 * Fetches record data from API, loads dropdowns, and populates form for editing.
 * Handles reminders for plan records.
 * Always shows skeleton during data loading.
 *
 * @param recordType - Type of record ('fact' or 'plan')
 * @param recordId - Database record ID
 * @returns Promise that resolves when modal is ready
 */
export async function openEditModal(recordType: 'fact' | 'plan', recordId: number): Promise<void> {
  const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
  const skeleton = document.getElementById('edit-loading-skeleton');
  const formFields = document.getElementById('edit-form-fields');

  if (!modal) {
    console.error('[openEditModal] Modal not found');
    return;
  }

  try {
    // Set mode
    setEditModalMode(recordType);

    // Open modal immediately with skeleton
    modal.showModal();
    if (skeleton) skeleton.classList.remove('hidden');
    if (formFields) formFields.classList.add('hidden');

    // Load data
    const endpoint = recordType === 'fact' ? `/api/v1/facts/${recordId}` : `/api/v1/plans/${recordId}`;
    const response = await fetch(endpoint, { credentials: 'include' });

    if (!response.ok) {
      throw new Error(`Ошибка загрузки записи: ${response.status}`);
    }

    const data = await response.json();

    // Load dropdowns in parallel
    await Promise.all([
      loadCategoriesForEdit(),
      loadEditFinancialCenters(data.financial_center_id),
      loadEditCostCenters(data.cost_center_id),
    ]);

    // Hide skeleton, show form
    if (skeleton) skeleton.classList.add('hidden');
    if (formFields) formFields.classList.remove('hidden');

    // Fill basic fields
    const editIdEl = document.getElementById('edit-id') as HTMLInputElement | null;
    const editAmountEl = document.getElementById('edit-amount') as HTMLInputElement | null;
    const editDateEl = document.getElementById('edit-date') as HTMLInputElement | null;
    const editDescEl = document.getElementById('edit-description') as HTMLTextAreaElement | null;

    if (editIdEl) editIdEl.value = String(data.id);
    if (editAmountEl) editAmountEl.value = String(Number.parseInt(String(data.amount), 10) || 0);
    if (editDateEl && window.BudgetShared?.DateFormatter) {
      const dateField = recordType === 'fact' ? data.fact_date : data.plan_date;
      if (dateField) {
        editDateEl.value = window.BudgetShared.DateFormatter.formatForDisplay(dateField);
      }
    }
    if (editDescEl) editDescEl.value = data.description || '';

    // Determine category type
    const state = getState();
    const selectedArticle = state.allCategories.find(a => a.id === data.article_id);
    const categoryType = (selectedArticle?.type || data.fact_type || data.plan_type || 'expense') as FactType;

    // Set category type radio buttons
    document.querySelectorAll('.edit-category-type-btn').forEach(btn => {
      const radio = (btn as HTMLElement).querySelector('input[type="radio"]') as HTMLInputElement | null;
      const btnEl = btn as HTMLElement;
      if (btnEl.dataset.type === categoryType) {
        btn.classList.add('btn-active');
        if (radio) radio.checked = true;
      } else {
        btn.classList.remove('btn-active');
        if (radio) radio.checked = false;
      }
    });

    updateEditCategoryTypeBadge(categoryType);

    // Initialize category tree select
    initEditCategoryTreeSelect(categoryType, data.financial_center_id, data.article_id);

    // Setup category type button handlers
    setupEditCategoryTypeButtons();

    // Handle reminder for plans
    if (recordType === 'plan') {
      await loadRemindersForEdit([recordId]);
      const reminder = remindersMap.get(recordId);

      const enableReminderCheckbox = document.getElementById('edit-enable-reminder') as HTMLInputElement | null;
      const reminderSettings = document.getElementById('edit-reminder-settings');

      if (reminder && reminder.reminder_datetime) {
        if (enableReminderCheckbox) enableReminderCheckbox.checked = true;
        if (reminderSettings) reminderSettings.classList.remove('hidden');
        initEditReminderCalendarWidget();
        populateEditReminderFields(reminder.reminder_datetime);
      } else {
        if (enableReminderCheckbox) enableReminderCheckbox.checked = false;
        if (reminderSettings) reminderSettings.classList.add('hidden');
        resetEditReminderFields();
      }
    }

    // Modal already opened above (with skeleton)
  } catch (error) {
    console.error('[openEditModal] Error:', error);

    // Close modal on error
    const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
    modal?.close();

    showToast('Ошибка открытия записи: ' + (error as Error).message, 'error');
  }
}

// ============================================================================
// Close Edit Modal
// ============================================================================

/**
 * Close edit modal and reset state.
 */
export function closeEditModal(): void {
  const modal = document.getElementById('edit-modal') as HTMLDialogElement | null;
  const form = document.getElementById('edit-form') as HTMLFormElement | null;

  modal?.close();
  form?.reset();

  currentEditingRecordType = null;
}
