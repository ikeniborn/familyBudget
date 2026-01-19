/**
 * Integration Module Entry Point
 *
 * Exports all integration-related functionality for the dashboard.
 */

// HTMX Refresh helpers
export {
  refreshDashboard,
  refreshRecentTransactions,
  refreshQuickStats,
  refreshAccountBalances,
  refreshDashboardWidgets,
} from './htmxRefresh';

// WebSocket Event Handlers
export { registerWSEventHandlers } from './wsEventHandlers';
