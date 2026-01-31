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
import { getDexieManager } from '@db/pglite';
import type { DiagnosticData } from '@db/pglite';
import type { ConflictMetrics } from '@db/pglite/ConflictManager';
import { performanceMonitor } from '../../../monitoring/PerformanceMonitor';

export class DexieDiagnosticModal extends BaseModal {
  private diagnosticContainer: HTMLDivElement | null = null;
  private conflictMetrics: ConflictMetrics | null = null;

  constructor() {
    super({
      id: 'pglite-diagnostic-modal',
      title: '🔍 Dexie Diagnostics',
      size: 'max-w-4xl',
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

      const data = await pglite.getDiagnosticData();

      // Load conflict metrics (task-009)
      try {
        this.conflictMetrics = await pglite.getConflictMetrics();
      } catch (error) {
        console.warn('[CONFLICT_METRICS] Failed to load conflict metrics', error);
        this.conflictMetrics = null;
      }

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
      <!-- Status Overview -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="stat bg-base-200 rounded-lg p-3">
          <div class="stat-title text-xs">Status</div>
          <div class="stat-value text-lg">
            ${data.isEnabled && data.isInitialized ? '<span class="text-success">✓ Active</span>' : '<span class="text-warning">⚠ Inactive</span>'}
          </div>
        </div>
        <div class="stat bg-base-200 rounded-lg p-3">
          <div class="stat-title text-xs">DB Size</div>
          <div class="stat-value text-lg">${this.formatSize(data.dbSizeKB)}</div>
        </div>
        <div class="stat bg-base-200 rounded-lg p-3">
          <div class="stat-title text-xs">Last Sync</div>
          <div class="stat-value text-sm">${data.lastSyncTimestamp}</div>
        </div>
        <div class="stat bg-base-200 rounded-lg p-3">
          <div class="stat-title text-xs">Sync Status</div>
          <div class="stat-value text-lg">
            ${this.renderSyncStatus(data.syncStatus)}
          </div>
        </div>
      </div>

      <!-- Table Statistics -->
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4">
          <h4 class="font-semibold mb-3">📊 Table Statistics</h4>
          <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div class="text-center">
              <div class="text-2xl font-bold text-primary">${data.tableStats.articles}</div>
              <div class="text-sm opacity-70">Articles</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-secondary">${data.tableStats.financial_centers}</div>
              <div class="text-sm opacity-70">Financial Centers</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-accent">${data.tableStats.cost_centers}</div>
              <div class="text-sm opacity-70">Cost Centers</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-info">${data.tableStats.facts}</div>
              <div class="text-sm opacity-70">Facts</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-success">${data.tableStats.plans}</div>
              <div class="text-sm opacity-70">Plans</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4">
          <h4 class="font-semibold mb-3">⚡ Performance Metrics</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-sm opacity-70">Average Query Time</div>
              <div class="text-xl font-bold">${data.performanceMetrics.avgQueryTimeMs.toFixed(2)} ms</div>
            </div>
            <div>
              <div class="text-sm opacity-70">Total Queries Tracked</div>
              <div class="text-xl font-bold">${data.performanceMetrics.totalQueries}</div>
            </div>
          </div>
        </div>
      </div>

      ${this.renderAPIReductionBreakdown()}

      ${this.renderPruningMetrics(data)}

      ${this.renderConflictMetrics()}

      <!-- Actions -->
      <div class="flex justify-end gap-2 mt-4">
        <button type="button" class="btn btn-sm btn-outline" onclick="this.closest('dialog').close()">Close</button>
        <button type="button" class="btn btn-sm btn-primary" onclick="window.location.reload()">Refresh</button>
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
   * Render sync status badge
   */
  private renderSyncStatus(status: 'idle' | 'syncing' | 'error'): string {
    switch (status) {
      case 'idle':
        return '<span class="text-info">Idle</span>';
      case 'syncing':
        return '<span class="text-warning">Syncing...</span>';
      case 'error':
        return '<span class="text-error">Error</span>';
      default:
        return '<span class="text-base-content/50">Unknown</span>';
    }
  }

  /**
   * Render pruning metrics (task-010)
   */
  private renderPruningMetrics(data: DiagnosticData): string {
    if (!data.pruningStats) {
      return '';
    }

    const stats = data.pruningStats;

    return `
      <!-- Pruning Metrics (task-010) -->
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4">
          <h4 class="font-semibold mb-3">🗑️ Data Cleanup Metrics</h4>
          <div class="grid grid-cols-3 gap-4">
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Last Pruned</div>
              <div class="stat-value text-sm">${stats.lastPrunedAt}</div>
            </div>
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Total Pruned</div>
              <div class="stat-value text-lg text-warning">${stats.totalPruned.toLocaleString()}</div>
              <div class="stat-desc text-xs">Records removed</div>
            </div>
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Next Cleanup</div>
              <div class="stat-value text-sm">${stats.nextPruneEstimate}</div>
              <div class="stat-desc text-xs">
                ${stats.nextPruneEstimate === 'Never' ? 'Auto-pruning disabled' : 'Automatic'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render API calls reduction breakdown (task-015 Phase 5)
   */
  private renderAPIReductionBreakdown(): string {
    try {
      const stats = performanceMonitor.getDetailedStats();

      // Only show if there are tracked calls
      if (stats.api.count === 0 && stats.pglite.count === 0) {
        return '';
      }

      return `
        <!-- API Calls Reduction (task-015 Phase 5) -->
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body p-4">
            <h4 class="font-semibold mb-3">📉 API Calls Reduction</h4>

            <!-- Summary -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Reduction</div>
                <div class="stat-value text-lg text-success">${stats.reductionPercent.toFixed(1)}%</div>
                <div class="stat-desc text-xs">Target: ≥80%</div>
              </div>
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">API Calls Saved</div>
                <div class="stat-value text-lg text-primary">${stats.apiCallsReduced.toLocaleString()}</div>
                <div class="stat-desc text-xs">Served from Dexie</div>
              </div>
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Bandwidth Saved</div>
                <div class="stat-value text-lg text-secondary">${stats.totalBandwidthSaved.toFixed(1)} KB</div>
                <div class="stat-desc text-xs">~5KB per API call</div>
              </div>
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Speedup</div>
                <div class="stat-value text-lg text-accent">${stats.speedupFactor.toFixed(1)}×</div>
                <div class="stat-desc text-xs">Dexie vs API</div>
              </div>
            </div>

            <!-- Module Breakdown -->
            <div class="divider text-xs">Breakdown by Module</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${this.renderModuleBreakdownCard('Shopping Lists', stats.breakdown.shoppingLists, 'shopping-bag')}
              ${this.renderModuleBreakdownCard('Facts', stats.breakdown.facts, 'receipt')}
              ${this.renderModuleBreakdownCard('Recurring Plans', stats.breakdown.recurringPlans, 'calendar')}
              ${this.renderModuleBreakdownCard('Dashboard', stats.breakdown.dashboard, 'chart-bar')}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      // Silently skip if performance monitor not available
      return '';
    }
  }

  /**
   * Render individual module breakdown card
   */
  private renderModuleBreakdownCard(name: string, breakdown: { pglite: number; api: number; reductionPercent: number }, icon: string): string {
    const total = breakdown.pglite + breakdown.api;

    // Skip if no calls for this module
    if (total === 0) {
      return '';
    }

    // Determine badge color based on reduction percentage
    let badgeClass = 'badge-success'; // Green for ≥80%
    if (breakdown.reductionPercent < 50) {
      badgeClass = 'badge-error'; // Red for <50%
    } else if (breakdown.reductionPercent < 80) {
      badgeClass = 'badge-warning'; // Yellow for 50-80%
    }

    return `
      <div class="card bg-base-200 border border-base-300">
        <div class="card-body p-3">
          <h5 class="text-sm font-semibold flex items-center gap-2">
            <span class="opacity-70">${icon === 'shopping-bag' ? '🛒' : icon === 'receipt' ? '💰' : icon === 'calendar' ? '📅' : '📊'}</span>
            ${name}
          </h5>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div class="text-center">
              <div class="text-xs opacity-70">Dexie</div>
              <div class="text-lg font-bold text-primary">${breakdown.pglite}</div>
            </div>
            <div class="text-center">
              <div class="text-xs opacity-70">API</div>
              <div class="text-lg font-bold text-warning">${breakdown.api}</div>
            </div>
            <div class="text-center">
              <div class="text-xs opacity-70">Reduction</div>
              <div class="text-sm font-bold">
                <span class="badge ${badgeClass} badge-sm">${breakdown.reductionPercent.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render conflict metrics (task-009)
   */
  private renderConflictMetrics(): string {
    if (!this.conflictMetrics) {
      return '';
    }

    const metrics = this.conflictMetrics;

    // Determine badge color based on conflict rate
    let badgeClass = 'badge-success'; // Green for <0.5%
    if (metrics.conflictRate >= 1.0) {
      badgeClass = 'badge-error'; // Red for >=1%
    } else if (metrics.conflictRate >= 0.5) {
      badgeClass = 'badge-warning'; // Yellow for 0.5-1%
    }

    return `
      <!-- Conflict Metrics (task-009) -->
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body p-4">
          <h4 class="font-semibold mb-3">⚔️ Conflict Resolution (Last 30 Days)</h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Conflict Rate</div>
              <div class="stat-value text-lg">
                ${metrics.conflictRate.toFixed(2)}%
                <span class="badge ${badgeClass} badge-sm ml-2">
                  ${metrics.conflictRate < 0.5 ? '✓' : metrics.conflictRate < 1.0 ? '⚠' : '✗'}
                </span>
              </div>
              <div class="stat-desc text-xs">Target: &lt;1%</div>
            </div>
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Total Conflicts</div>
              <div class="stat-value text-lg">${metrics.totalConflicts}</div>
              <div class="stat-desc text-xs">
                Resolved: ${metrics.resolvedConflicts} | Pending: ${metrics.pendingConflicts}
              </div>
            </div>
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Server Wins</div>
              <div class="stat-value text-lg text-primary">${metrics.resolutionBreakdown.server}</div>
              <div class="stat-desc text-xs">LWW: Server newer</div>
            </div>
            <div class="stat bg-base-200 rounded-lg p-3">
              <div class="stat-title text-xs">Client Wins</div>
              <div class="stat-value text-lg text-secondary">${metrics.resolutionBreakdown.client}</div>
              <div class="stat-desc text-xs">LWW: Client newer</div>
            </div>
          </div>
        </div>
      </div>
    `;
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

  diagnosticModalInstance.open();
}
