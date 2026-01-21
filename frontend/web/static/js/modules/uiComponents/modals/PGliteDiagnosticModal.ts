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

export class PGliteDiagnosticModal extends BaseModal {
  private diagnosticContainer: HTMLDivElement | null = null;

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

      this.diagnosticContainer.innerHTML = this.renderDiagnosticContent(data);
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
   * Render diagnostic content HTML
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
