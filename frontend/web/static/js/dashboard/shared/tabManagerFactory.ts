/**
 * Tab Manager Factory
 * Shared factory for creating tab managers with FormData caching
 *
 * @module shared/tabManagerFactory
 */

interface TabCache {
  transaction: FormData | null;
  transfer: FormData | null;
}

interface TabManagerConfig {
  modalId: string;
  formId: string;
  transactionFields: string[];
  transferFields: string[];
}

export interface TabManager {
  switchTab: (newTab: 'transaction' | 'transfer') => void;
  setupTabListeners: () => void;
  clearTabCache: () => void;
  getCurrentTab: () => 'transaction' | 'transfer';
}

/**
 * Create tab manager instance for a modal
 */
export function createTabManager(config: TabManagerConfig): TabManager {
  const { modalId, formId, transactionFields, transferFields } = config;

  let tabCache: TabCache = {
    transaction: null,
    transfer: null
  };

  let currentTab: 'transaction' | 'transfer' = 'transaction';

  /**
   * Switch active tab
   * Saves current tab data to cache before switching
   */
  function switchTab(newTab: 'transaction' | 'transfer'): void {
    const transactionTab = document.getElementById(`${modalId}-tab-transaction`);
    const transferTab = document.getElementById(`${modalId}-tab-transfer`);

    if (!transactionTab || !transferTab) {
      console.error(`[${modalId}] Tab elements not found`);
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
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);

    // Store only relevant fields for current tab
    const filteredData = new FormData();

    if (tab === 'transaction') {
      // Transaction fields
      transactionFields.forEach(field => {
        const value = formData.get(field);
        if (value !== null) {
          filteredData.append(field, value);
        }
      });
    } else {
      // Transfer fields
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

    const form = document.getElementById(formId) as HTMLFormElement;
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
  function setupTabListeners(): void {
    const tabInputs = document.querySelectorAll<HTMLInputElement>(`[name="${modalId}_tabs"]`);

    tabInputs.forEach(input => {
      // Prevent duplicate listeners
      if (input.dataset.listenerAttached === 'true') {
        return;
      }

      input.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          const newTab = target.dataset.tab as 'transaction' | 'transfer';
          switchTab(newTab);
        }
      });

      input.dataset.listenerAttached = 'true';
    });
  }

  /**
   * Clear tab cache (on modal close)
   */
  function clearTabCache(): void {
    tabCache = {
      transaction: null,
      transfer: null
    };
    currentTab = 'transaction';
  }

  /**
   * Get current active tab
   */
  function getCurrentTab(): 'transaction' | 'transfer' {
    return currentTab;
  }

  return {
    switchTab,
    setupTabListeners,
    clearTabCache,
    getCurrentTab
  };
}
