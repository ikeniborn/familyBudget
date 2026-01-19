/**
 * WebSocket Event Handlers for Dashboard
 *
 * Registers handlers for WebSocket events to update the dashboard in real-time.
 * Uses IncrementalUpdates when available, otherwise falls back to full refresh.
 */

import { invalidateCache } from '../core/DashboardState';
import {
  refreshDashboard,
  refreshRecentTransactions,
  refreshQuickStats,
  refreshAccountBalances,
} from './htmxRefresh';



declare const debugLog: (...args: any[]) => void;
// ============================================================================
// Types
// ============================================================================

interface FactEventData {
  id: number;
  [key: string]: unknown;
}

interface BatchDeleteEventData {
  deleted_count: number;
  record_type?: string;
}

// ============================================================================
// Event Handler Registration
// ============================================================================

/**
 * Register all WebSocket event handlers for dashboard updates.
 * Should be called once after DOMContentLoaded.
 */
export function registerWSEventHandlers(): void {
  // Wait for budgetWSClient to be available (loaded in base.html)
  setTimeout(() => {
    if (!window.budgetWSClient) {
      debugLog('[WS] budgetWSClient not available');
      return;
    }

    const hasIncrementalUpdates = !!window.IncrementalUpdates;
    debugLog('[WS] IncrementalUpdates available:', hasIncrementalUpdates);

    // Register fact event handlers
    registerFactHandlers(hasIncrementalUpdates);

    // Register plan event handlers
    registerPlanHandlers(hasIncrementalUpdates);

    // Register transfer event handlers
    registerTransferHandlers(hasIncrementalUpdates);

    // Register cache invalidation handlers
    registerCacheInvalidationHandlers();

    debugLog('[WS] Event handlers registered');
  }, 1000);
}

// ============================================================================
// Fact Event Handlers
// ============================================================================

function registerFactHandlers(hasIncrementalUpdates: boolean): void {
  if (!window.budgetWSClient) return;

  window.budgetWSClient.on('fact_created', (data: FactEventData) => {
    debugLog('[WS] Fact created:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onFactCreated(data);
    } else {
      refreshDashboard();
    }
  });

  window.budgetWSClient.on('fact_updated', (data: FactEventData) => {
    debugLog('[WS] Fact updated:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onFactUpdated(data);
    } else {
      refreshDashboard();
    }
  });

  window.budgetWSClient.on('fact_deleted', (data: FactEventData) => {
    debugLog('[WS] Fact deleted:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onFactDeleted(data);
    } else {
      refreshDashboard();
    }
  });

  // Batch delete handler
  window.budgetWSClient.on('facts_batch_deleted', (data: BatchDeleteEventData) => {
    debugLog('[FACTS_DELETE] facts_batch_deleted event:', data);

    // Filter: Skip if this is plan-type batch delete (record_type='plan')
    // Index page shows income/expense facts, NOT plan facts
    const shouldReload = !data.record_type || data.record_type !== 'plan';

    if (shouldReload) {
      debugLog(`[FACTS_DELETE] Auto-reloading after batch delete: ${data.deleted_count} facts`);
      // Batch delete - full refresh is safer than incremental
      refreshDashboard();
    } else {
      if (window.DEBUG_MODE) {
        debugLog(`[FACTS_DELETE] Skipping reload (record_type='${data.record_type}', expected income/expense)`);
      }
    }
    // NO TOAST HERE - toast shown by initiating client only
  });
}

// ============================================================================
// Plan Event Handlers
// ============================================================================

function registerPlanHandlers(hasIncrementalUpdates: boolean): void {
  if (!window.budgetWSClient) return;

  window.budgetWSClient.on('plan_created', (data: FactEventData) => {
    debugLog('[WS] Plan created:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onPlanCreated(data);
    } else {
      refreshQuickStats();
    }
  });

  window.budgetWSClient.on('plan_updated', (data: FactEventData) => {
    debugLog('[WS] Plan updated:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onPlanUpdated(data);
    } else {
      refreshQuickStats();
    }
  });

  window.budgetWSClient.on('plan_deleted', (data: FactEventData) => {
    debugLog('[WS] Plan deleted:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onPlanDeleted(data);
    } else {
      refreshQuickStats();
    }
  });
}

// ============================================================================
// Transfer Event Handlers
// ============================================================================

function registerTransferHandlers(hasIncrementalUpdates: boolean): void {
  if (!window.budgetWSClient) return;

  window.budgetWSClient.on('transfer_created', (data: FactEventData) => {
    debugLog('[WS] Transfer created:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onTransferCreated(data);
    } else {
      refreshRecentTransactions();
      refreshAccountBalances();
    }
  });

  window.budgetWSClient.on('transfer_deleted', (data: FactEventData) => {
    debugLog('[WS] Transfer deleted:', data.id);
    if (hasIncrementalUpdates && window.IncrementalUpdates) {
      window.IncrementalUpdates.onTransferDeleted(data);
    } else {
      refreshRecentTransactions();
      refreshAccountBalances();
    }
  });
}

// ============================================================================
// Cache Invalidation Handlers
// ============================================================================

function registerCacheInvalidationHandlers(): void {
  if (!window.budgetWSClient) return;

  // Article (category) cache invalidation
  window.budgetWSClient.on('article_updated', () => {
    invalidateCache('categories');
  });

  window.budgetWSClient.on('article_created', () => {
    invalidateCache('categories');
  });

  window.budgetWSClient.on('article_deleted', () => {
    invalidateCache('categories');
  });

  // Financial center cache invalidation
  window.budgetWSClient.on('financial_center_updated', () => {
    invalidateCache('financialCenters');
  });

  window.budgetWSClient.on('financial_center_created', () => {
    invalidateCache('financialCenters');
  });

  window.budgetWSClient.on('financial_center_deleted', () => {
    invalidateCache('financialCenters');
  });

  // Cost center cache invalidation
  window.budgetWSClient.on('cost_center_updated', () => {
    invalidateCache('costCenters');
  });

  window.budgetWSClient.on('cost_center_created', () => {
    invalidateCache('costCenters');
  });

  window.budgetWSClient.on('cost_center_deleted', () => {
    invalidateCache('costCenters');
  });
}
