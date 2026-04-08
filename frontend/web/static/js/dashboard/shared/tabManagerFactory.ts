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
  let switching = false; // Guard to prevent recursive calls when using input.click()

  /**
   * Switch active tab
   * Saves current tab data to cache before switching
   */
  function switchTab(newTab: 'transaction' | 'transfer'): void {
    if (switching) return;
    switching = true;
    const transactionTab = document.getElementById(`${modalId}-tab-transaction`);
    const transferTab = document.getElementById(`${modalId}-tab-transfer`);

    if (!transactionTab || !transferTab) {
      console.error(`[${modalId}] Tab elements not found`);
      return;
    }

    // Save current tab data before switching
    saveCurrentTabData(currentTab);

    // Toggle visibility
    const hiddenTab = newTab === 'transaction' ? transferTab : transactionTab;
    const visibleTab = newTab === 'transaction' ? transactionTab : transferTab;

    visibleTab.classList.remove('hidden');
    hiddenTab.classList.add('hidden');

    // Disable HTML5 validation on hidden tab fields (browser validates all fields regardless of visibility)
    hiddenTab.querySelectorAll<HTMLElement>('[required]').forEach(el => {
      el.removeAttribute('required');
      el.setAttribute('data-was-required', 'true');
    });
    // Restore validation on visible tab fields
    visibleTab.querySelectorAll<HTMLElement>('[data-was-required]').forEach(el => {
      el.setAttribute('required', 'required');
      el.removeAttribute('data-was-required');
    });

    // Update radio buttons — use input.click() so DaisyUI :checked CSS and change listeners fire
    const tabInputs = document.querySelectorAll<HTMLInputElement>(`[name="${modalId}_tabs"]`);
    tabInputs.forEach(input => {
      if (input.dataset.tab === newTab && !input.checked) {
        input.click(); // Triggers :checked CSS update + change event (guard prevents recursion)
      }
    });

    // Update hidden field
    const activeTabField = document.getElementById(`${modalId}-active-tab`) as HTMLInputElement;
    if (activeTabField) activeTabField.value = newTab;

    // Restore new tab data from cache
    restoreTabData(newTab);

    currentTab = newTab;
    switching = false;
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
