/**
 * HTMX Refresh Helpers for Dashboard
 *
 * Provides functions to refresh dashboard widgets via HTMX.
 */

// ============================================================================
// Refresh Functions
// ============================================================================

/**
 * Refresh all dashboard widgets.
 */
export function refreshDashboard(): void {
  refreshRecentTransactions();
  refreshQuickStats();
  refreshAccountBalances();
}

/**
 * Refresh recent transactions widget.
 */
export function refreshRecentTransactions(): void {
  if (window.htmx) {
    window.htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
      target: '#recent-transactions',
      swap: 'innerHTML',
    });
  }
}

/**
 * Refresh quick stats widget.
 */
export function refreshQuickStats(): void {
  if (window.htmx) {
    window.htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
      target: '#quick-stats',
      swap: 'innerHTML',
    });
  }
}

/**
 * Refresh account balances widget.
 */
export function refreshAccountBalances(): void {
  if (window.htmx) {
    window.htmx.ajax('GET', '/api/v1/analytics/account-balances-html', {
      target: '#account-balances',
      swap: 'innerHTML',
    });
  }
}

/**
 * Refresh dashboard widgets (convenience wrapper).
 * Used after save/delete operations.
 */
export function refreshDashboardWidgets(): void {
  refreshDashboard();
}
