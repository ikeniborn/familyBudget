/**
 * DexieDiagnosticModal - Diagnostic modal for Dexie monitoring
 *
 * Displays diagnostic information including DB size, table stats,
 * sync status, and performance metrics.
 *
 * @example
 * ```typescript
 * const modal = new DexieDiagnosticModal();
 * document.body.appendChild(modal.render());
 * modal.open(); // Will fetch fresh diagnostic data
 * ```
 *
 * @category Modal Components
 */

import { BaseModal } from './BaseModal';
import { getDexieManager } from '@db/dexie';
import { performanceMonitor } from '../../../monitoring/PerformanceMonitor';
import { logger } from '@db/dexie/utils/logger';

// TODO: Move these types to @db/dexie when getDiagnosticData is implemented
interface DiagnosticData {
  initializationStatus: string;
  lastSyncTimestamp: string;
  isEnabled: boolean;
  isInitialized: boolean;
  dbSize: number;
  dbSizeKB: number;
  tables: Record<string, number>;
  tableStats: {
    articles: number;
    financial_centers: number;
    cost_centers: number;
    facts: number;
    plans: number;
    stores: number;           // v11.4.2+
    productGroups: number;    // v11.4.2+
    shoppingLists: number;    // v11.4.2+
  };
  syncStatus: 'error' | 'idle' | 'syncing';
  performance: {
    avgQueryTime: number;
  };
  performanceMetrics?: {
    avgQueryTimeMs: number;
    totalQueries: number;
    avgLoadTimeMs: number;
    avgSaveTimeMs: number;
  };
  pruningStats: {
    enabled: boolean;
    lastPrune?: Date;
    lastPrunedAt: string;
    totalPruned: number;
    nextPruneEstimate: string;
  };
  syncPeriod: {
    facts: number;
    plans: number;
  };
  websocket?: {
    connected: boolean;
    state: string;
    enabled: boolean;
    offlineMode: boolean;
  };
}

interface ConflictMetrics {
  total: number;
  resolved: number;
  pending: number;
  resolvedConflicts: number;
  pendingConflicts: number;
  totalConflicts: number;
  conflictRate: number;
  resolutionBreakdown: {
    server: number;
    client: number;
  };
}

export class DexieDiagnosticModal extends BaseModal {
  private diagnosticContainer: HTMLDivElement | null = null;
  private conflictMetrics: ConflictMetrics | null = null;

  constructor() {
    super({
      id: 'dexie-diagnostic-modal',
      title: '🔍 Dexie Diagnostics',
      size: 'max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl',
      onOpen: () => {
        this.loadDiagnosticData();
      }
    });
  }

  /**
   * Render the modal with diagnostic content
   */
  render(): HTMLDialogElement {
    const dialog = super.render();

    // Create diagnostic container
    this.diagnosticContainer = document.createElement('div');
    this.diagnosticContainer.className = 'space-y-4';
    this.diagnosticContainer.innerHTML = '<div class="flex justify-center py-8"><span class="loading loading-spinner loading-lg"></span></div>';

    // Set as modal content
    const modalBox = dialog.querySelector('.modal-box');
    const titleContainer = modalBox?.querySelector('.flex.justify-between');
    if (titleContainer) {
      titleContainer.insertAdjacentElement('afterend', this.diagnosticContainer);
    }

    return dialog;
  }

  /**
   * Load and display diagnostic data
   */
  private async loadDiagnosticData(): Promise<void> {
    if (!this.diagnosticContainer) return;

    try {
      // getDexieManager() returns Promise due to window.Dexie Proxy
      const pglite = await getDexieManager();

      // Wait for Dexie initialization (with timeout)
      const maxWaitMs = 30000; // 30 seconds (increased from 10)
      const startTime = Date.now();
      let attempts = 0;
      while (!pglite.isReady() && (Date.now() - startTime) < maxWaitMs) {
        attempts++;

        // Check for initialization error at every iteration (early exit)
        try {
          const diagnosticData = await pglite.getDiagnosticData();

          // If initialization failed, exit immediately instead of waiting 30s
          if (diagnosticData.initializationStatus === 'error') {
            console.error('[DIAGNOSTIC] Initialization error detected, exiting wait loop early');
            break;
          }

          // Progress tracking every 2 seconds (silent)
        } catch (e) {
          // Silently retry if diagnostic data not yet available
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!pglite.isReady()) {
        let finalStatus;
        try {
          finalStatus = await pglite.getDiagnosticData();
        } catch (e) {
          finalStatus = { error: String(e) };
        }
        console.error('[DIAGNOSTIC] Dexie not ready after timeout', {
          elapsed: Date.now() - startTime,
          finalStatus
        });

        this.diagnosticContainer.innerHTML = `
          <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Dexie не удалось инициализировать за 30 секунд. Проверьте консоль браузера для деталей.</span>
          </div>
        `;
        return;
      }

      const baseData = await pglite.getDiagnosticData();

      // Add sync period information (v11.4.0+)
      const syncPeriodDays = pglite.getSyncPeriodDays?.() ?? 90;

      // Add WebSocket diagnostics (v11.4.0+)
      const budgetWSClient = (window as any).budgetWSClient;

      // Load conflict metrics (task-009)
      try {
        this.conflictMetrics = await pglite.getConflictMetrics();
      } catch (error) {
        console.warn('[CONFLICT_METRICS] Failed to load conflict metrics', error);
        this.conflictMetrics = null;
      }

      // Build complete diagnostic data object
      const data: DiagnosticData = {
        ...baseData,
        syncPeriod: {
          facts: syncPeriodDays,
          plans: syncPeriodDays
        },
        websocket: {
          connected: budgetWSClient?.ws?.readyState === 1,  // WebSocket.OPEN = 1
          state: budgetWSClient?.ws
            ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][budgetWSClient.ws.readyState]
            : 'NO_SOCKET',
          enabled: budgetWSClient?.enabled ?? false,
          offlineMode: budgetWSClient?._isOfflineModeActive?.() ?? false
        }
      };

      // Use DOMParser to safely render HTML (prevents XSS)
      this.renderDiagnosticContentSafe(data);
    } catch (error) {
      this.diagnosticContainer.innerHTML = `
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load diagnostic data: ${error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      `;
    }
  }

  /**
   * Safely render diagnostic content (prevents XSS)
   */
  private renderDiagnosticContentSafe(data: DiagnosticData): void {
    if (!this.diagnosticContainer) return;

    // Sanitize user-provided data to prevent XSS
    const safeData = {
      ...data,
      lastSyncTimestamp: this.escapeHtml(data.lastSyncTimestamp)
    };

    // Render HTML template
    const html = this.renderDiagnosticContent(safeData);

    // Use DOMParser for safer HTML parsing (prevents script execution)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Clear and append all parsed content (not just firstChild)
    this.diagnosticContainer.innerHTML = '';
    while (doc.body.firstChild) {
      this.diagnosticContainer.appendChild(doc.body.firstChild);
    }
  }

  /**
   * Escape HTML special characters to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Render diagnostic content HTML template
   */
  private renderDiagnosticContent(data: DiagnosticData): string {
    return `
      <!-- Status Overview (Compact Table) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">Metric</th><th class="text-xs">Value</th></tr></thead>
          <tbody class="text-xs">
            <tr><td>Status</td><td>${data.isEnabled && data.isInitialized ? 'Active' : 'Inactive'}</td></tr>
            <tr><td>DB Size</td><td>${this.formatSize(data.dbSizeKB)}</td></tr>
            <tr><td>Last Sync</td><td>${data.lastSyncTimestamp}</td></tr>
            <tr><td>Sync Status</td><td>${this.renderSyncStatusText(data.syncStatus)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Table Statistics (Compact Table) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">Table</th><th class="text-xs">Count</th></tr></thead>
          <tbody class="text-xs">
            <tr><td>Articles</td><td>${data.tableStats.articles}</td></tr>
            <tr><td>Financial Centers</td><td>${data.tableStats.financial_centers}</td></tr>
            <tr><td>Cost Centers</td><td>${data.tableStats.cost_centers}</td></tr>
            <tr>
              <td>Facts</td>
              <td>${data.tableStats.facts} <span class="text-xs opacity-60">(${data.syncPeriod.facts} days)</span></td>
            </tr>
            <tr>
              <td>Plans</td>
              <td>${data.tableStats.plans} <span class="text-xs opacity-60">(${data.syncPeriod.plans} days)</span></td>
            </tr>
            <tr><td>Stores</td><td>${data.tableStats.stores}</td></tr>
            <tr><td>Product Groups</td><td>${data.tableStats.productGroups}</td></tr>
            <tr><td>Shopping Lists</td><td>${data.tableStats.shoppingLists}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Performance Metrics (Compact Table) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">Metric</th><th class="text-xs">Value</th></tr></thead>
          <tbody class="text-xs">
            <tr><td>Avg Query Time</td><td>${(data.performanceMetrics?.avgQueryTimeMs ?? data.performance.avgQueryTime).toFixed(2)} ms</td></tr>
            <tr><td>Total Queries</td><td>${data.performanceMetrics?.totalQueries ?? 0}</td></tr>
          </tbody>
        </table>
      </div>

      ${this.renderAPIReductionBreakdown()}

      ${this.renderPruningMetrics(data)}

      ${this.renderConflictMetrics()}

      ${this.renderWebSocketDiagnostics(data)}

      <!-- Sync Period Controls (v11.4.0+) -->
      <div class="mb-3">
        <h3 class="text-xs font-semibold mb-2">Sync Period (Offline Data Retention)</h3>

        <div class="form-control">
          <label class="label">
            <span class="label-text text-xs">Facts & Plans retention (days):</span>
          </label>
          <input type="range" min="30" max="180" step="30"
                 value="${data.syncPeriod.facts}"
                 class="range range-xs range-primary"
                 id="sync-period-slider"
                 oninput="window.updateSyncPeriodDisplay?.(this.value)"
                 onchange="window.updateSyncPeriod?.(this.value)">
          <div class="w-full flex justify-between text-xs px-2 opacity-60">
            <span>30</span><span>60</span><span>90</span><span>120</span><span>150</span><span>180</span>
          </div>
          <div class="text-xs text-center mt-1" id="sync-period-value">${data.syncPeriod.facts} days</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" class="btn btn-xs btn-outline" onclick="this.closest('dialog').close()">Close</button>
        <button type="button" class="btn btn-xs btn-ghost" onclick="window.location.reload()">Refresh</button>
      </div>
    `;
  }

  /**
   * Format size in KB to human-readable format
   */
  private formatSize(kb: number): string {
    if (kb < 1024) {
      return `${kb} KB`;
    } else if (kb < 1024 * 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    } else {
      return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
    }
  }

  /**
   * Render sync status as plain text (for table cells)
   */
  private renderSyncStatusText(status: 'idle' | 'syncing' | 'error'): string {
    switch (status) {
      case 'idle':
        return 'Idle';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  }

  /**
   * Render pruning metrics (task-010) - Compact Table
   */
  private renderPruningMetrics(data: DiagnosticData): string {
    if (!data.pruningStats) {
      return '';
    }

    const stats = data.pruningStats;

    return `
      <!-- Pruning Metrics (Compact Table) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">Cleanup Metric</th><th class="text-xs">Value</th></tr></thead>
          <tbody class="text-xs">
            <tr><td>Last Pruned</td><td>${stats.lastPrunedAt}</td></tr>
            <tr><td>Total Pruned</td><td>${stats.totalPruned.toLocaleString()} records</td></tr>
            <tr><td>Next Cleanup</td><td>${stats.nextPruneEstimate}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render API calls reduction breakdown (task-015 Phase 5) - Compact Table
   */
  private renderAPIReductionBreakdown(): string {
    try {
      const stats = performanceMonitor.getDetailedStats();

      // Only show if there are tracked calls
      if (stats.api.count === 0 && stats.dexie.count === 0) {
        return '';
      }

      return `
        <!-- API Reduction Summary (Compact Table) -->
        <div class="overflow-x-auto mb-3">
          <table class="table table-xs table-zebra w-full">
            <thead><tr><th class="text-xs">API Metric</th><th class="text-xs">Value</th></tr></thead>
            <tbody class="text-xs">
              <tr><td>Reduction</td><td>${stats.reductionPercent.toFixed(1)}% (target ≥80%)</td></tr>
              <tr><td>API Calls Saved</td><td>${stats.apiCallsReduced.toLocaleString()}</td></tr>
              <tr><td>Bandwidth Saved</td><td>${stats.totalBandwidthSaved.toFixed(1)} KB</td></tr>
              <tr><td>Speedup</td><td>${stats.speedupFactor.toFixed(1)}×</td></tr>
            </tbody>
          </table>
        </div>
      `;
    } catch (error) {
      // Silently skip if performance monitor not available
      return '';
    }
  }

  /**
   * Render conflict metrics (task-009) - Compact Table
   */
  private renderConflictMetrics(): string {
    if (!this.conflictMetrics) {
      return '';
    }

    const metrics = this.conflictMetrics;

    return `
      <!-- Conflict Metrics (Compact Table) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">Conflict Metric</th><th class="text-xs">Value</th></tr></thead>
          <tbody class="text-xs">
            <tr><td>Conflict Rate (30d)</td><td>${metrics.conflictRate.toFixed(2)}% (target &lt;1%)</td></tr>
            <tr><td>Total Conflicts</td><td>${metrics.totalConflicts}</td></tr>
            <tr><td>Resolved</td><td>${metrics.resolvedConflicts}</td></tr>
            <tr><td>Pending</td><td>${metrics.pendingConflicts}</td></tr>
            <tr><td>Server Wins</td><td>${metrics.resolutionBreakdown.server}</td></tr>
            <tr><td>Client Wins</td><td>${metrics.resolutionBreakdown.client}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Render WebSocket diagnostics (v11.4.0+)
   */
  private renderWebSocketDiagnostics(data: DiagnosticData): string {
    if (!data.websocket) {
      return '';
    }

    const ws = data.websocket;
    const stateClass = ws.connected ? 'text-success' : 'text-error';
    const stateIcon = ws.connected ? '✓' : '✗';

    return `
      <!-- WebSocket Diagnostics (v11.4.0+) -->
      <div class="overflow-x-auto mb-3">
        <table class="table table-xs table-zebra w-full">
          <thead><tr><th class="text-xs">WebSocket</th><th class="text-xs">Value</th></tr></thead>
          <tbody class="text-xs">
            <tr>
              <td>Connection</td>
              <td class="${stateClass}">${stateIcon} ${ws.connected ? 'Connected' : 'Disconnected'}</td>
            </tr>
            <tr><td>State</td><td>${ws.state}</td></tr>
            <tr><td>Enabled</td><td>${ws.enabled ? 'Yes' : 'No'}</td></tr>
            <tr><td>Offline Mode</td><td>${ws.offlineMode ? 'Active' : 'Inactive'}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Update sync period display (real-time slider feedback)
   */
  private updateSyncPeriodDisplay(days: number): void {
    const valueEl = document.getElementById('sync-period-value');
    if (valueEl) {
      valueEl.textContent = `${days} days`;
    }
  }

  /**
   * Update sync period and trigger pruning
   */
  private async updateSyncPeriod(days: number): Promise<void> {
    try {
      // Save to localStorage
      localStorage.setItem('budget_dexie_sync_period', days.toString());

      // Update display
      this.updateSyncPeriodDisplay(days);

      // Get DexieManager instance
      const dexieManager = await getDexieManager();

      // Trigger pruning with new period
      if (dexieManager?.pruneFacts) {
        await dexieManager.pruneFacts(days);
        logger.info('[SYNC_PERIOD] Facts pruned with new period:', days);

        // Refresh modal data
        await this.loadDiagnosticData();
      }
    } catch (error) {
      logger.error('[SYNC_PERIOD] Failed to update sync period', error);
    }
  }
}

/**
 * Singleton instance
 */
let diagnosticModalInstance: DexieDiagnosticModal | null = null;

/**
 * Open Dexie diagnostic modal (singleton)
 */
export function openDexieDiagnostic(): void {
  if (!diagnosticModalInstance) {
    diagnosticModalInstance = new DexieDiagnosticModal();
    document.body.appendChild(diagnosticModalInstance.render());
  }

  // Export handlers to window for onclick/oninput usage
  (window as any).updateSyncPeriodDisplay = (days: number) => {
    diagnosticModalInstance?.['updateSyncPeriodDisplay'](days);
  };

  (window as any).updateSyncPeriod = (days: number) => {
    diagnosticModalInstance?.['updateSyncPeriod'](days);
  };

  diagnosticModalInstance.open();
}
