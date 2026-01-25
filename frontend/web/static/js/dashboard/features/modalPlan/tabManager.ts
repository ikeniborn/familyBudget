/**
 * Tab Manager for Modal Plan
 * Handles tab switching and form data caching
 *
 * @module modalPlan/tabManager
 */

interface TabCache {
  transaction: FormData | null;
  transfer: FormData | null;
}

let tabCache: TabCache = {
  transaction: null,
  transfer: null
};

let currentTab: 'transaction' | 'transfer' = 'transaction';

/**
 * Switch active tab
 */
export function switchTab(newTab: 'transaction' | 'transfer'): void {
  const modalId = 'modal_plan';
  const transactionTab = document.getElementById(`${modalId}-tab-transaction`);
  const transferTab = document.getElementById(`${modalId}-tab-transfer`);

  if (!transactionTab || !transferTab) {
    console.error('[ModalPlan] Tab elements not found');
    return;
  }

  // Save current tab data before switching
  saveCurrentTabData(currentTab);

  // Toggle visibility
  if (newTab === 'transaction') {
    transactionTab.classList.remove('hidden');
    transferTab.classList.add('hidden');
  } else {
    transactionTab.classList.add('hidden');
    transferTab.classList.remove('hidden');
  }

  // Update radio buttons
  const tabInputs = document.querySelectorAll<HTMLInputElement>(`[name="${modalId}_tabs"]`);
  tabInputs.forEach(input => {
    input.checked = input.dataset.tab === newTab;
  });

  // Update hidden field
  const activeTabField = document.getElementById(`${modalId}-active-tab`) as HTMLInputElement;
  if (activeTabField) activeTabField.value = newTab;

  // Restore new tab data from cache
  restoreTabData(newTab);

  currentTab = newTab;
}

/**
 * Save current tab's form data to cache
 */
function saveCurrentTabData(tab: 'transaction' | 'transfer'): void {
  const form = document.getElementById('form_modal_plan') as HTMLFormElement;
  if (!form) return;

  const formData = new FormData(form);
  const filteredData = new FormData();

  if (tab === 'transaction') {
    // Transaction fields
    const transactionFields = [
      'plan_month', 'financial_center_id', 'plan_type',
      'article_id', 'cost_center_id', 'amount', 'description',
      'plan_mode', 'frequency_type', 'frequency_value_monthday',
      'frequency_value_yearly', 'duration_type', 'occurrences_count',
      'recurring_end_date', 'recurring_enable_reminder',
      'recurring_reminder_hour', 'recurring_reminder_minute',
      'reminder_date', 'reminder_hour', 'reminder_minute'
    ];
    transactionFields.forEach(field => {
      const value = formData.get(field);
      if (value !== null) {
        filteredData.append(field, value);
      }
    });
  } else {
    // Transfer fields
    const transferFields = [
      'transfer_plan_month', 'from_financial_center_id', 'from_article_id',
      'to_financial_center_id', 'to_article_id', 'amount', 'description'
    ];
    transferFields.forEach(field => {
      const value = formData.get(field);
      if (value !== null) {
        filteredData.append(field, value);
      }
    });
  }

  tabCache[tab] = filteredData;
}

/**
 * Restore tab's form data from cache
 */
function restoreTabData(tab: 'transaction' | 'transfer'): void {
  const cachedData = tabCache[tab];
  if (!cachedData) return;

  const form = document.getElementById('form_modal_plan') as HTMLFormElement;
  if (!form) return;

  // Populate fields from cached FormData
  for (const [key, value] of cachedData.entries()) {
    const input = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      `[name="${key}"]`
    );
    if (input) {
      if (input.type === 'radio' || input.type === 'checkbox') {
        (input as HTMLInputElement).checked = value === 'on' || value === input.value;
      } else {
        input.value = value as string;
      }
    }
  }
}

/**
 * Setup tab switch listeners
 */
export function setupTabListeners(): void {
  const modalId = 'modal_plan';
  const tabInputs = document.querySelectorAll<HTMLInputElement>(`[name="${modalId}_tabs"]`);

  tabInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.checked) {
        const newTab = target.dataset.tab as 'transaction' | 'transfer';
        switchTab(newTab);
      }
    });
  });
}

/**
 * Clear tab cache (on modal close)
 */
export function clearTabCache(): void {
  tabCache = {
    transaction: null,
    transfer: null
  };
  currentTab = 'transaction';
}

/**
 * Get current active tab
 */
export function getCurrentTab(): 'transaction' | 'transfer' {
  return currentTab;
}
