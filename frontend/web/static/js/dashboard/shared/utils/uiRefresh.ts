/**
 * UI Refresh Utilities
 * Reusable functions for refreshing UI components after save operations
 *
 * @module shared/utils/uiRefresh
 */

declare const debugLog: (...args: any[]) => void;
declare const htmx: any;

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
  debugLog(`[${config.context}] Refreshing UI components...`);

  try {
    // Check if HTMX is available
    if (typeof htmx === 'undefined') {
      console.warn('[UI_REFRESH] HTMX undefined, falling back to page reload');
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
        htmx.trigger(recentTransactionsEl, 'load');
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

    debugLog(`[${config.context}] UI refresh completed`);
  } catch (error) {
    console.error(`[${config.context}] Error refreshing UI:`, error);

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
