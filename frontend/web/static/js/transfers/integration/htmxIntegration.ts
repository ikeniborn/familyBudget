/**
 * Transfer Module - HTMX Integration
 *
 * HTMX conditional updates for recent transactions and quick stats.
 */

// Global dependencies
declare const htmx: any;

/**
 * Update recent transactions via HTMX
 */
export function updateRecentTransactions(): void {
  if (typeof htmx === 'undefined') return;

  const target = document.getElementById('recent-transactions');
  if (!target) return;

  htmx.ajax('GET', '/api/v1/facts/recent-html?limit=10', {
    target: '#recent-transactions',
    swap: 'innerHTML'
  });
}

/**
 * Update quick stats via HTMX
 */
export function updateQuickStats(): void {
  if (typeof htmx === 'undefined') return;

  const target = document.getElementById('quick-stats');
  if (!target) return;

  htmx.ajax('GET', '/api/v1/analytics/quick-stats-html', {
    target: '#quick-stats',
    swap: 'innerHTML'
  });
}
