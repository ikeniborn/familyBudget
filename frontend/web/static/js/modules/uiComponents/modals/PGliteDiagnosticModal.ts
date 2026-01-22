/**
 * PGliteDiagnosticModal - Diagnostic modal for PGlite monitoring
 *
 * Displays diagnostic information including DB size, table stats,
 * sync status, and performance metrics.
 *
 * @example
 * ```typescript
 * const modal = new PGliteDiagnosticModal();
 * document.body.appendChild(modal.render());
 * modal.open(); // Will fetch fresh diagnostic data
 * ```
 *
 * @category Modal Components
 */

import { BaseModal } from './BaseModal';
import { getPGliteManager } from '@db/pglite';
import type { DiagnosticData } from '@db/pglite';
import type { ConflictMetrics } from '@db/pglite/ConflictManager';

export class PGliteDiagnosticModal extends BaseModal {
  private diagnosticContainer: HTMLDivElement | null = null;
  private conflictMetrics: ConflictMetrics | null = null;

  constructor() {
    super({
      id: 'pglite-diagnostic-modal',
      title: '🔍 PGlite Diagnostics',
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
      const pglite = getPGliteManager();
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

    // Clear and append parsed content
    this.diagnosticContainer.innerHTML = '';
    this.diagnosticContainer.appendChild(doc.body.firstChild as Node);
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
          <div class="grid grid-cols-3 gap-4">
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
let diagnosticModalInstance: PGliteDiagnosticModal | null = null;

/**
 * Open PGlite diagnostic modal (singleton)
 */
export function openPGliteDiagnostic(): void {
  if (!diagnosticModalInstance) {
    diagnosticModalInstance = new PGliteDiagnosticModal();
    document.body.appendChild(diagnosticModalInstance.render());
  }

  diagnosticModalInstance.open();
}
