/**
 * UI Refresh Utilities
 * Reusable functions for refreshing UI components after save operations
 *
 * @module shared/utils/uiRefresh
 */

declare const debugLog: (...args: any[]) => void;
declare const htmx: any;

/**
 * Structured logger for UI refresh operations
 */
const logger = {
  info: (message: string, ...args: any[]) => {
    if (typeof debugLog !== 'undefined') {
      debugLog(`[UI_REFRESH] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (typeof debugLog !== 'undefined') {
      debugLog(`[UI_REFRESH] ⚠️  ${message}`, ...args);
    } else {
      console.warn(`[UI_REFRESH] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[UI_REFRESH] ${message}`, ...args);
  },
};

interface RefreshConfig {
  /** Context name for logging (e.g., 'SaveFactModal', 'SavePlanModal') */
  context: string;
  /** Whether to reload facts table (facts.html) */
  reloadFacts?: boolean;
  /** Whether to reload plan table (plan.html) */
  reloadPlans?: boolean;
  /** Whether to refresh recent transactions (index.html) */
  refreshRecentTransactions?: boolean;
}

/**
 * Refresh UI components after save operation
 * @param config - Configuration for which components to refresh
 */
export async function refreshUIAfterSave(config: RefreshConfig): Promise<void> {
  logger.info(`[${config.context}] Refreshing UI components...`);

  try {
    // Check if HTMX is available
    if (typeof htmx === 'undefined') {
      logger.warn('HTMX undefined, falling back to page reload');
      window.location.reload();
      return;
    }

    // Refresh quick stats (index.html)
    const quickStatsEl = document.getElementById('quick-stats');
    if (quickStatsEl) {
      htmx.trigger(quickStatsEl, 'load');
    }

    // Refresh account balances (index.html)
    const accountBalancesEl = document.getElementById('account-balances');
    if (accountBalancesEl) {
      htmx.trigger(accountBalancesEl, 'load');
    }

    // Refresh recent transactions (index.html) - only for facts
    if (config.refreshRecentTransactions) {
      const recentTransactionsEl = document.getElementById('recent-transactions');
      if (recentTransactionsEl) {
        // Use htmx.ajax to re-fetch content (htmx.trigger doesn't work for hx-get)
        htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
          target: '#recent-transactions',
          swap: 'innerHTML',
        });
      }
    }

    // Reload facts table if on facts.html page
    if (config.reloadFacts && typeof (window as any).reloadFacts === 'function') {
      await (window as any).reloadFacts();
    }

    // Reload plan table if on plan.html page
    if (config.reloadPlans && typeof (window as any).reloadPlans === 'function') {
      await (window as any).reloadPlans();
    }

    logger.info(`[${config.context}] UI refresh completed`);
  } catch (error) {
    logger.error(`[${config.context}] Error refreshing UI:`, error);

    // Show error toast if available
    if (typeof (window as any).showToast === 'function') {
      (window as any).showToast('Не удалось обновить интерфейс. Перезагрузите страницу.', 'error');
    }

    // Non-critical error, don't throw (allows modal to close)
  }
}

/**
 * Refresh UI after fact save
 */
export async function refreshUIAfterFactSave(): Promise<void> {
  return refreshUIAfterSave({
    context: 'SaveFactModal',
    reloadFacts: true,
    refreshRecentTransactions: true,
  });
}

/**
 * Refresh UI after plan save
 */
export async function refreshUIAfterPlanSave(): Promise<void> {
  return refreshUIAfterSave({
    context: 'SavePlanModal',
    reloadPlans: true,
    refreshRecentTransactions: false,
  });
}
