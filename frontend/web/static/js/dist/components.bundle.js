(function(pglite) {
  "use strict";
  class BaseModal {
    constructor(props) {
      this.props = props;
      this.dialog = null;
      this.modalBox = null;
      this.titleElement = null;
      this.contentContainer = null;
      this.closeButton = null;
      this.isOpen = false;
    }
    /**
     * Render the modal structure
     */
    render() {
      if (this.dialog) {
        return this.dialog;
      }
      this.dialog = document.createElement("dialog");
      this.dialog.id = this.props.id;
      this.dialog.className = "modal";
      this.modalBox = document.createElement("div");
      this.modalBox.className = `modal-box ${this.props.size || "max-w-2xl"} p-4 max-h-[90vh] overflow-y-auto my-auto`;
      if (this.props.title) {
        const titleContainer = document.createElement("div");
        titleContainer.className = "flex justify-between items-center mb-4";
        this.titleElement = document.createElement("h3");
        this.titleElement.className = "font-bold text-lg";
        this.titleElement.textContent = this.props.title;
        titleContainer.appendChild(this.titleElement);
        if (!this.props.hideCloseButton) {
          this.closeButton = document.createElement("button");
          this.closeButton.type = "button";
          this.closeButton.className = "btn btn-sm btn-circle btn-ghost";
          this.closeButton.innerHTML = "✕";
          this.closeButton.addEventListener("click", () => this.close());
          titleContainer.appendChild(this.closeButton);
        }
        this.modalBox.appendChild(titleContainer);
      }
      this.contentContainer = document.createElement("div");
      this.contentContainer.className = "modal-content";
      if (this.props.content instanceof HTMLElement) {
        this.contentContainer.appendChild(this.props.content);
      } else if (typeof this.props.content === "string") {
        this.contentContainer.innerHTML = this.props.content;
      }
      this.modalBox.appendChild(this.contentContainer);
      this.dialog.appendChild(this.modalBox);
      if (!this.props.disableBackdropClose) {
        const backdrop = document.createElement("form");
        backdrop.method = "dialog";
        backdrop.className = "modal-backdrop";
        const backdropButton = document.createElement("button");
        backdropButton.textContent = "close";
        backdrop.appendChild(backdropButton);
        this.dialog.appendChild(backdrop);
      }
      if (typeof ModalKeyboardAdapter !== "undefined") {
        try {
          const adapter = ModalKeyboardAdapter.getInstance();
          adapter.attachToModal(this.dialog);
        } catch (error) {
          console.warn("[BaseModal] Failed to attach ModalKeyboardAdapter:", error);
        }
      }
      this.dialog.addEventListener("close", () => {
        this.isOpen = false;
        if (this.props.onClose) {
          this.props.onClose();
        }
      });
      return this.dialog;
    }
    /**
     * Open the modal
     */
    open() {
      if (!this.dialog) {
        throw new Error("[BaseModal] Modal not rendered. Call render() first.");
      }
      if (this.isOpen) {
        return;
      }
      this.dialog.showModal();
      this.isOpen = true;
      if (this.props.onOpen) {
        this.props.onOpen();
      }
    }
    /**
     * Close the modal
     */
    close() {
      if (!this.dialog) {
        return;
      }
      if (!this.isOpen) {
        return;
      }
      this.dialog.close();
      this.isOpen = false;
    }
    /**
     * Toggle modal open/close
     */
    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
    /**
     * Check if modal is currently open
     */
    isModalOpen() {
      return this.isOpen;
    }
    /**
     * Update modal title
     */
    setTitle(title) {
      if (this.titleElement) {
        this.titleElement.textContent = title;
      }
    }
    /**
     * Update modal content
     */
    setContent(content) {
      if (!this.contentContainer) {
        return;
      }
      this.contentContainer.innerHTML = "";
      if (content instanceof HTMLElement) {
        this.contentContainer.appendChild(content);
      } else {
        this.contentContainer.innerHTML = content;
      }
      this.props.content = content;
    }
    /**
     * Get the dialog element
     */
    getElement() {
      return this.dialog;
    }
    /**
     * Get the content container
     */
    getContentContainer() {
      return this.contentContainer;
    }
    /**
     * Destroy the modal
     */
    destroy() {
      if (this.dialog) {
        this.close();
        this.dialog.remove();
        this.dialog = null;
        this.modalBox = null;
        this.titleElement = null;
        this.contentContainer = null;
        this.closeButton = null;
      }
    }
  }
  class PerformanceMonitor {
    constructor() {
      this.apiMetrics = /* @__PURE__ */ new Map();
      this.pgliteMetrics = /* @__PURE__ */ new Map();
    }
    /**
     * Track an API call
     *
     * @param method - Method name (e.g., 'getArticles')
     * @param durationMs - Call duration in milliseconds
     */
    trackAPICall(method, durationMs) {
      if (!this.apiMetrics.has(method)) {
        this.apiMetrics.set(method, []);
      }
      this.apiMetrics.get(method).push(durationMs);
    }
    /**
     * Track a PGlite call
     *
     * @param method - Method name (e.g., 'getArticles')
     * @param durationMs - Call duration in milliseconds
     */
    trackPGliteCall(method, durationMs) {
      if (!this.pgliteMetrics.has(method)) {
        this.pgliteMetrics.set(method, []);
      }
      this.pgliteMetrics.get(method).push(durationMs);
    }
    /**
     * Calculate metrics for a set of durations
     *
     * @param durations - Array of call durations in milliseconds
     * @returns Call metrics
     */
    calculateMetric(durations) {
      if (durations.length === 0) {
        return {
          count: 0,
          totalDurationMs: 0,
          avgDurationMs: 0,
          minDurationMs: 0,
          maxDurationMs: 0
        };
      }
      const total = durations.reduce((a, b) => a + b, 0);
      return {
        count: durations.length,
        totalDurationMs: total,
        avgDurationMs: total / durations.length,
        minDurationMs: Math.min(...durations),
        maxDurationMs: Math.max(...durations)
      };
    }
    /**
     * Get overall performance statistics
     *
     * @returns Performance statistics comparing API and PGlite
     */
    getStats() {
      const allApiDurations = Array.from(this.apiMetrics.values()).flat();
      const allPgliteDurations = Array.from(this.pgliteMetrics.values()).flat();
      const api = this.calculateMetric(allApiDurations);
      const pglite2 = this.calculateMetric(allPgliteDurations);
      const totalCalls = api.count + pglite2.count;
      const reductionPercent = totalCalls > 0 ? (1 - api.count / totalCalls) * 100 : 0;
      const speedupFactor = api.avgDurationMs > 0 && pglite2.avgDurationMs > 0 ? api.avgDurationMs / pglite2.avgDurationMs : 1;
      return {
        api,
        pglite: pglite2,
        reductionPercent: parseFloat(reductionPercent.toFixed(1)),
        speedupFactor: parseFloat(speedupFactor.toFixed(1))
      };
    }
    /**
     * Classify method by module
     * (task-015 Phase 5)
     *
     * @param method - Method name
     * @returns Module name
     */
    classifyMethod(method) {
      const lower = method.toLowerCase();
      if (lower.includes("shopping") || lower.includes("store") || lower.includes("productgroup")) {
        return "shoppingLists";
      }
      if (lower.includes("fact") || lower.includes("transfer")) {
        return "facts";
      }
      if (lower.includes("recurring") || lower.includes("plan")) {
        return "recurringPlans";
      }
      if (lower.includes("dashboard") || lower.includes("quickstat") || lower.includes("balance")) {
        return "dashboard";
      }
      return "other";
    }
    /**
     * Get detailed statistics with module breakdown
     * (task-015 Phase 5)
     *
     * @returns Detailed performance statistics
     */
    getDetailedStats() {
      const basicStats = this.getStats();
      const breakdown = {
        shoppingLists: { pglite: 0, api: 0, reductionPercent: 0 },
        facts: { pglite: 0, api: 0, reductionPercent: 0 },
        recurringPlans: { pglite: 0, api: 0, reductionPercent: 0 },
        dashboard: { pglite: 0, api: 0, reductionPercent: 0 },
        other: { pglite: 0, api: 0, reductionPercent: 0 }
      };
      const allMethods = /* @__PURE__ */ new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);
      for (const method of allMethods) {
        const module = this.classifyMethod(method);
        breakdown[module].pglite += (this.pgliteMetrics.get(method) || []).length;
        breakdown[module].api += (this.apiMetrics.get(method) || []).length;
      }
      for (const module of Object.keys(breakdown)) {
        const { pglite: pglite2, api } = breakdown[module];
        const total = pglite2 + api;
        breakdown[module].reductionPercent = total > 0 ? parseFloat(((1 - api / total) * 100).toFixed(1)) : 0;
      }
      const BYTES_PER_API_CALL = 5 * 1024;
      const apiCallsReduced = basicStats.pglite.count;
      const totalBandwidthSaved = parseFloat((apiCallsReduced * BYTES_PER_API_CALL / 1024).toFixed(1));
      return {
        ...basicStats,
        breakdown,
        apiCallsReduced,
        totalBandwidthSaved,
        avgSpeedupFactor: basicStats.speedupFactor
      };
    }
    /**
     * Get per-method statistics
     *
     * @returns Per-method statistics
     */
    getMethodStats() {
      const methods = /* @__PURE__ */ new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);
      const result = {};
      for (const method of methods) {
        result[method] = {
          api: this.calculateMetric(this.apiMetrics.get(method) || []),
          pglite: this.calculateMetric(this.pgliteMetrics.get(method) || [])
        };
      }
      return result;
    }
    /**
     * Reset all metrics
     */
    reset() {
      this.apiMetrics.clear();
      this.pgliteMetrics.clear();
    }
  }
  const performanceMonitor = new PerformanceMonitor();
  if (typeof window !== "undefined") {
    window.performanceMonitor = performanceMonitor;
  }
  class PGliteDiagnosticModal extends BaseModal {
    constructor() {
      super({
        id: "pglite-diagnostic-modal",
        title: "🔍 PGlite Diagnostics",
        size: "max-w-4xl",
        onOpen: () => {
          this.loadDiagnosticData();
        }
      });
      this.diagnosticContainer = null;
      this.conflictMetrics = null;
    }
    /**
     * Render the modal with diagnostic content
     */
    render() {
      const dialog = super.render();
      this.diagnosticContainer = document.createElement("div");
      this.diagnosticContainer.className = "space-y-4";
      this.diagnosticContainer.innerHTML = '<div class="flex justify-center py-8"><span class="loading loading-spinner loading-lg"></span></div>';
      const modalBox = dialog.querySelector(".modal-box");
      const titleContainer = modalBox?.querySelector(".flex.justify-between");
      if (titleContainer) {
        titleContainer.insertAdjacentElement("afterend", this.diagnosticContainer);
      }
      return dialog;
    }
    /**
     * Load and display diagnostic data
     */
    async loadDiagnosticData() {
      if (!this.diagnosticContainer) return;
      try {
        const pglite$1 = pglite.getPGliteManager();
        const data = await pglite$1.getDiagnosticData();
        try {
          this.conflictMetrics = await pglite$1.getConflictMetrics();
        } catch (error) {
          console.warn("[CONFLICT_METRICS] Failed to load conflict metrics", error);
          this.conflictMetrics = null;
        }
        this.renderDiagnosticContentSafe(data);
      } catch (error) {
        this.diagnosticContainer.innerHTML = `
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Failed to load diagnostic data: ${error instanceof Error ? error.message : "Unknown error"}</span>
        </div>
      `;
      }
    }
    /**
     * Safely render diagnostic content (prevents XSS)
     */
    renderDiagnosticContentSafe(data) {
      if (!this.diagnosticContainer) return;
      const safeData = {
        ...data,
        lastSyncTimestamp: this.escapeHtml(data.lastSyncTimestamp)
      };
      const html = this.renderDiagnosticContent(safeData);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      this.diagnosticContainer.innerHTML = "";
      this.diagnosticContainer.appendChild(doc.body.firstChild);
    }
    /**
     * Escape HTML special characters to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement("div");
      div.textContent = text;
      return div.innerHTML;
    }
    /**
     * Render diagnostic content HTML template
     */
    renderDiagnosticContent(data) {
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
    formatSize(kb) {
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
    renderSyncStatus(status) {
      switch (status) {
        case "idle":
          return '<span class="text-info">Idle</span>';
        case "syncing":
          return '<span class="text-warning">Syncing...</span>';
        case "error":
          return '<span class="text-error">Error</span>';
        default:
          return '<span class="text-base-content/50">Unknown</span>';
      }
    }
    /**
     * Render pruning metrics (task-010)
     */
    renderPruningMetrics(data) {
      if (!data.pruningStats) {
        return "";
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
                ${stats.nextPruneEstimate === "Never" ? "Auto-pruning disabled" : "Automatic"}
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
    renderAPIReductionBreakdown() {
      try {
        const stats = performanceMonitor.getDetailedStats();
        if (stats.api.count === 0 && stats.pglite.count === 0) {
          return "";
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
                <div class="stat-desc text-xs">Served from PGlite</div>
              </div>
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Bandwidth Saved</div>
                <div class="stat-value text-lg text-secondary">${stats.totalBandwidthSaved.toFixed(1)} KB</div>
                <div class="stat-desc text-xs">~5KB per API call</div>
              </div>
              <div class="stat bg-base-200 rounded-lg p-3">
                <div class="stat-title text-xs">Speedup</div>
                <div class="stat-value text-lg text-accent">${stats.speedupFactor.toFixed(1)}×</div>
                <div class="stat-desc text-xs">PGlite vs API</div>
              </div>
            </div>

            <!-- Module Breakdown -->
            <div class="divider text-xs">Breakdown by Module</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${this.renderModuleBreakdownCard("Shopping Lists", stats.breakdown.shoppingLists, "shopping-bag")}
              ${this.renderModuleBreakdownCard("Facts", stats.breakdown.facts, "receipt")}
              ${this.renderModuleBreakdownCard("Recurring Plans", stats.breakdown.recurringPlans, "calendar")}
              ${this.renderModuleBreakdownCard("Dashboard", stats.breakdown.dashboard, "chart-bar")}
            </div>
          </div>
        </div>
      `;
      } catch (error) {
        return "";
      }
    }
    /**
     * Render individual module breakdown card
     */
    renderModuleBreakdownCard(name, breakdown, icon) {
      const total = breakdown.pglite + breakdown.api;
      if (total === 0) {
        return "";
      }
      let badgeClass = "badge-success";
      if (breakdown.reductionPercent < 50) {
        badgeClass = "badge-error";
      } else if (breakdown.reductionPercent < 80) {
        badgeClass = "badge-warning";
      }
      return `
      <div class="card bg-base-200 border border-base-300">
        <div class="card-body p-3">
          <h5 class="text-sm font-semibold flex items-center gap-2">
            <span class="opacity-70">${icon === "shopping-bag" ? "🛒" : icon === "receipt" ? "💰" : icon === "calendar" ? "📅" : "📊"}</span>
            ${name}
          </h5>
          <div class="grid grid-cols-3 gap-2 mt-2">
            <div class="text-center">
              <div class="text-xs opacity-70">PGlite</div>
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
    renderConflictMetrics() {
      if (!this.conflictMetrics) {
        return "";
      }
      const metrics = this.conflictMetrics;
      let badgeClass = "badge-success";
      if (metrics.conflictRate >= 1) {
        badgeClass = "badge-error";
      } else if (metrics.conflictRate >= 0.5) {
        badgeClass = "badge-warning";
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
                  ${metrics.conflictRate < 0.5 ? "✓" : metrics.conflictRate < 1 ? "⚠" : "✗"}
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
  let diagnosticModalInstance = null;
  function openPGliteDiagnostic() {
    if (!diagnosticModalInstance) {
      diagnosticModalInstance = new PGliteDiagnosticModal();
      document.body.appendChild(diagnosticModalInstance.render());
    }
    diagnosticModalInstance.open();
  }
  const _ConfirmDialog = class _ConfirmDialog {
    constructor(modalId = "confirm-modal") {
      this.pendingResolve = null;
      this.modalId = modalId;
    }
    /**
     * Get singleton instance
     */
    static getInstance(modalId = "confirm-modal") {
      if (!_ConfirmDialog.instance || _ConfirmDialog.instance.modalId !== modalId) {
        _ConfirmDialog.instance = new _ConfirmDialog(modalId);
      }
      return _ConfirmDialog.instance;
    }
    /**
     * Show confirmation dialog
     *
     * @param message - Message to display
     * @param title - Dialog title (default: 'Подтверждение')
     * @returns Promise resolving to true if confirmed, false if cancelled
     */
    static show(message, title = "Подтверждение") {
      return new Promise((resolve) => {
        const instance = _ConfirmDialog.getInstance();
        const modal = document.getElementById(instance.modalId);
        const titleEl = document.getElementById("confirm-title");
        const messageEl = document.getElementById("confirm-message");
        if (!modal || !titleEl || !messageEl) {
          console.error("[ConfirmDialog] Elements not found, fallback to native confirm");
          resolve(window.confirm(message));
          return;
        }
        instance.pendingResolve = resolve;
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.showModal();
      });
    }
    /**
     * Resolve the pending confirmation dialog
     *
     * @param result - User's choice (true = confirmed, false = cancelled)
     */
    static resolve(result) {
      const instance = _ConfirmDialog.getInstance();
      const modal = document.getElementById(instance.modalId);
      if (modal) {
        modal.close();
      }
      if (instance.pendingResolve) {
        instance.pendingResolve(result);
        instance.pendingResolve = null;
      }
    }
  };
  _ConfirmDialog.instance = null;
  let ConfirmDialog = _ConfirmDialog;
  function getConfirmDialogHTML() {
    return `
<!-- Custom Confirmation Dialog -->
<dialog id="confirm-modal" class="modal">
    <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4" id="confirm-title">Подтверждение</h3>
        <p class="whitespace-pre-line mb-6" id="confirm-message"></p>
        <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="confirmModalResolve(false)">Отмена</button>
            <button type="button" class="btn btn-error" onclick="confirmModalResolve(true)">Подтвердить</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button onclick="confirmModalResolve(false)">close</button>
    </form>
</dialog>
`;
  }
  class FormModal {
    constructor(props) {
      this.props = props;
      this.submitButton = null;
      this.cancelButton = null;
      this.errorContainer = null;
      this.isSubmitting = false;
      const formWrapper = this.createFormWrapper();
      this.baseModal = new BaseModal({
        id: props.id,
        title: props.title,
        size: props.size,
        content: formWrapper,
        hideCloseButton: props.hideCloseButton,
        disableBackdropClose: props.disableBackdropClose,
        onOpen: props.onOpen,
        onClose: () => {
          this.clearError();
          if (props.onClose) {
            props.onClose();
          }
        }
      });
    }
    /**
     * Create form wrapper with action buttons
     */
    createFormWrapper() {
      const wrapper = document.createElement("div");
      if (this.props.formContent instanceof HTMLElement) {
        wrapper.appendChild(this.props.formContent);
      }
      this.errorContainer = document.createElement("div");
      this.errorContainer.className = "alert alert-error mt-4 hidden";
      this.errorContainer.role = "alert";
      wrapper.appendChild(this.errorContainer);
      const actions = document.createElement("div");
      actions.className = "modal-action mt-4";
      this.cancelButton = document.createElement("button");
      this.cancelButton.type = "button";
      this.cancelButton.className = "btn btn-sm btn-ghost";
      this.cancelButton.textContent = this.props.cancelLabel || "❌ Отмена";
      this.cancelButton.addEventListener("click", () => this.handleCancel());
      actions.appendChild(this.cancelButton);
      this.submitButton = document.createElement("button");
      this.submitButton.type = "button";
      this.submitButton.className = `btn btn-sm ${this.props.submitButtonClass || "btn-primary"}`;
      this.submitButton.textContent = this.props.submitLabel || "✅ Сохранить";
      this.submitButton.addEventListener("click", () => this.handleSubmit());
      actions.appendChild(this.submitButton);
      wrapper.appendChild(actions);
      return wrapper;
    }
    /**
     * Handle cancel action
     */
    handleCancel() {
      if (this.props.onCancel) {
        this.props.onCancel();
      }
      this.close();
    }
    /**
     * Handle submit action
     */
    async handleSubmit() {
      if (this.isSubmitting) {
        return;
      }
      this.clearError();
      if (this.props.onValidate) {
        const validation = this.props.onValidate();
        if (!validation.valid) {
          this.showError(validation.error || "Проверьте правильность заполнения полей");
          return;
        }
      }
      this.isSubmitting = true;
      this.setLoading(true);
      try {
        await this.props.onSubmit();
        if (this.props.onSuccess) {
          this.props.onSuccess();
        }
        if (!this.props.keepOpenOnSuccess) {
          this.close();
        }
      } catch (error) {
        console.error("[FormModal] Submit error:", error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          this.showError(error.message || "Ошибка при сохранении");
        }
      } finally {
        this.isSubmitting = false;
        this.setLoading(false);
      }
    }
    /**
     * Set loading state on submit button
     */
    setLoading(loading) {
      if (!this.submitButton)
        return;
      if (loading) {
        this.submitButton.disabled = true;
        this.submitButton.classList.add("loading");
        this.submitButton.textContent = "⏳ Сохранение...";
        if (this.cancelButton) {
          this.cancelButton.disabled = true;
        }
      } else {
        this.submitButton.disabled = false;
        this.submitButton.classList.remove("loading");
        this.submitButton.textContent = this.props.submitLabel || "✅ Сохранить";
        if (this.cancelButton) {
          this.cancelButton.disabled = false;
        }
      }
    }
    /**
     * Show error message
     */
    showError(message) {
      if (!this.errorContainer)
        return;
      this.errorContainer.textContent = message;
      this.errorContainer.classList.remove("hidden");
    }
    /**
     * Clear error message
     */
    clearError() {
      if (!this.errorContainer)
        return;
      this.errorContainer.textContent = "";
      this.errorContainer.classList.add("hidden");
    }
    /**
     * Render the modal
     */
    render() {
      return this.baseModal.render();
    }
    /**
     * Open the modal
     */
    open() {
      this.baseModal.open();
    }
    /**
     * Close the modal
     */
    close() {
      this.baseModal.close();
    }
    /**
     * Toggle modal open/close
     */
    toggle() {
      this.baseModal.toggle();
    }
    /**
     * Check if modal is currently open
     */
    isModalOpen() {
      return this.baseModal.isModalOpen();
    }
    /**
     * Update modal title
     */
    setTitle(title) {
      this.baseModal.setTitle(title);
      this.props.title = title;
    }
    /**
     * Update form content
     */
    setFormContent(content) {
      const container = this.baseModal.getContentContainer();
      if (!container)
        return;
      const firstChild = container.firstChild;
      if (firstChild && firstChild !== this.errorContainer) {
        container.replaceChild(content, firstChild);
      }
      this.props.formContent = content;
    }
    /**
     * Get the dialog element
     */
    getElement() {
      return this.baseModal.getElement();
    }
    /**
     * Get the content container
     */
    getContentContainer() {
      return this.baseModal.getContentContainer();
    }
    /**
     * Destroy the modal
     */
    destroy() {
      this.baseModal.destroy();
      this.submitButton = null;
      this.cancelButton = null;
      this.errorContainer = null;
    }
  }
  class CrudModal {
    constructor(props) {
      this.props = props;
      this.formModal = null;
      this.currentMode = "create";
      this.currentData = null;
      this.currentForm = null;
      this.deleteButton = null;
    }
    /**
     * Open modal for creating new entity
     */
    async openForCreate() {
      this.currentMode = "create";
      this.currentData = null;
      await this.setupModal();
      this.formModal.open();
    }
    /**
     * Open modal for editing existing entity
     */
    async openForEdit(data) {
      this.currentMode = "edit";
      this.currentData = data;
      await this.setupModal();
      this.formModal.open();
    }
    /**
     * Setup modal with current mode and data
     */
    async setupModal() {
      if (this.currentForm) {
        this.currentForm.destroy();
        this.currentForm = null;
      }
      if (this.formModal) {
        this.formModal.destroy();
        this.formModal = null;
      }
      this.currentForm = this.props.formBuilder(this.currentMode, this.currentData || void 0);
      const formContainer = document.createElement("div");
      formContainer.id = `${this.props.id}-form-container`;
      if (this.currentForm.render) {
        const result = this.currentForm.render(formContainer);
        if (result instanceof Promise) {
          await result;
        }
      }
      this.formModal = new FormModal({
        id: this.props.id,
        title: this.currentMode === "create" ? this.props.createTitle : this.props.editTitle,
        size: this.props.size,
        formContent: formContainer,
        submitLabel: this.currentMode === "create" ? "✅ Создать" : "💾 Обновить",
        onValidate: () => this.handleValidate(),
        onSubmit: () => this.handleSubmit(),
        onSuccess: () => this.handleSuccess(),
        onError: (error) => this.handleError(error),
        onClose: () => this.cleanup()
      });
      const dialog = this.formModal.render();
      if (!dialog.parentElement) {
        document.body.appendChild(dialog);
      }
      if (this.currentMode === "edit" && this.props.onDelete) {
        this.addDeleteButton();
      }
    }
    /**
     * Add delete button to modal
     */
    addDeleteButton() {
      if (!this.formModal)
        return;
      const container = this.formModal.getContentContainer();
      if (!container)
        return;
      const actions = container.querySelector(".modal-action");
      if (!actions)
        return;
      this.deleteButton = document.createElement("button");
      this.deleteButton.type = "button";
      this.deleteButton.className = "btn btn-sm btn-error mr-auto";
      this.deleteButton.textContent = "🗑️ Удалить";
      this.deleteButton.addEventListener("click", () => this.handleDelete());
      actions.insertBefore(this.deleteButton, actions.firstChild);
    }
    /**
     * Handle form validation
     */
    handleValidate() {
      if (!this.currentForm || !this.currentForm.validate) {
        return { valid: true };
      }
      return this.currentForm.validate();
    }
    /**
     * Handle form submission
     */
    async handleSubmit() {
      let data;
      if (this.currentForm.collectFormData) {
        data = this.currentForm.collectFormData();
      } else if (this.currentForm.getValue) {
        data = this.currentForm.getValue();
      } else {
        throw new Error("[CrudModal] Form must have collectFormData() or getValue() method");
      }
      if (this.currentMode === "create") {
        await this.props.onCreate(data);
      } else {
        const id = this.currentData?.id;
        if (!id) {
          throw new Error("[CrudModal] Entity ID is required for update");
        }
        await this.props.onUpdate(id, data);
      }
    }
    /**
     * Handle delete action
     */
    async handleDelete() {
      if (!this.props.onDelete || !this.currentData?.id) {
        return;
      }
      const message = this.props.deleteConfirmMessage || `Вы уверены, что хотите удалить ${this.props.entity}?`;
      if (!confirm(message)) {
        return;
      }
      if (this.deleteButton) {
        this.deleteButton.disabled = true;
        this.deleteButton.textContent = "⏳ Удаление...";
      }
      try {
        await this.props.onDelete(this.currentData.id);
        if (this.props.onSuccess) {
          this.props.onSuccess("delete", this.currentData);
        }
        if (this.formModal) {
          this.formModal.close();
        }
      } catch (error) {
        console.error("[CrudModal] Delete error:", error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          alert(error.message || "Ошибка при удалении");
        }
        if (this.deleteButton) {
          this.deleteButton.disabled = false;
          this.deleteButton.textContent = "🗑️ Удалить";
        }
      }
    }
    /**
     * Handle successful submission
     */
    handleSuccess() {
      if (this.props.onSuccess) {
        this.props.onSuccess(this.currentMode, this.currentData);
      }
    }
    /**
     * Handle submission error
     */
    handleError(error) {
      if (this.props.onError) {
        this.props.onError(error);
      } else {
        if (this.formModal) {
          this.formModal.showError(error.message || "Ошибка при выполнении операции");
        }
        console.error("[CrudModal] Error:", error);
      }
    }
    /**
     * Cleanup on modal close
     */
    cleanup() {
    }
    /**
     * Render the modal
     */
    render() {
      if (!this.formModal) {
        throw new Error("[CrudModal] Modal not initialized. Call openForCreate() or openForEdit() first.");
      }
      return this.formModal.render();
    }
    /**
     * Get the current form instance
     */
    getForm() {
      return this.currentForm;
    }
    /**
     * Get the current mode
     */
    getMode() {
      return this.currentMode;
    }
    /**
     * Destroy the modal
     */
    destroy() {
      if (this.currentForm && this.currentForm.destroy) {
        this.currentForm.destroy();
      }
      if (this.formModal) {
        this.formModal.destroy();
      }
      this.currentForm = null;
      this.formModal = null;
      this.deleteButton = null;
    }
  }
  class FormField {
    constructor(props) {
      this.props = props;
      this.element = null;
      this.labelElement = null;
      this.errorElement = null;
      this.helpElement = null;
    }
    /**
     * Render the form field wrapper
     */
    render() {
      if (this.element) {
        return this.element;
      }
      this.element = document.createElement("div");
      this.element.className = `form-control ${this.props.className || ""}`.trim();
      this.labelElement = document.createElement("label");
      this.labelElement.className = "label py-1";
      this.labelElement.htmlFor = this.props.name;
      const labelText = document.createElement("span");
      labelText.className = "label-text";
      labelText.textContent = this.props.label + (this.props.required ? " *" : "");
      this.labelElement.appendChild(labelText);
      this.element.appendChild(this.labelElement);
      this.props.children.id = this.props.name;
      this.element.appendChild(this.props.children);
      if (this.props.helpText) {
        this.helpElement = document.createElement("span");
        this.helpElement.className = "label-text-alt text-base-content/70 text-xs mt-1";
        this.helpElement.textContent = this.props.helpText;
        this.element.appendChild(this.helpElement);
      }
      if (this.props.error) {
        this.showError(this.props.error);
      }
      return this.element;
    }
    /**
     * Show error message
     */
    showError(message) {
      if (!this.element) {
        throw new Error("FormField must be rendered before showing errors");
      }
      this.clearError();
      this.errorElement = document.createElement("span");
      this.errorElement.className = "label-text-alt text-error text-xs mt-1";
      this.errorElement.textContent = message;
      this.props.children.classList.add("input-error");
      this.element.appendChild(this.errorElement);
    }
    /**
     * Clear error message
     */
    clearError() {
      if (this.errorElement) {
        this.errorElement.remove();
        this.errorElement = null;
      }
      this.props.children.classList.remove("input-error");
    }
    /**
     * Update label text
     */
    updateLabel(label) {
      if (this.labelElement) {
        const labelText = this.labelElement.querySelector(".label-text");
        if (labelText) {
          labelText.textContent = label + (this.props.required ? " *" : "");
        }
      }
      this.props.label = label;
    }
    /**
     * Update help text
     */
    updateHelpText(helpText) {
      if (helpText) {
        if (!this.helpElement) {
          this.helpElement = document.createElement("span");
          this.helpElement.className = "label-text-alt text-base-content/70 text-xs mt-1";
          this.element?.appendChild(this.helpElement);
        }
        this.helpElement.textContent = helpText;
      } else if (this.helpElement) {
        this.helpElement.remove();
        this.helpElement = null;
      }
      this.props.helpText = helpText || void 0;
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
        this.labelElement = null;
        this.errorElement = null;
        this.helpElement = null;
      }
    }
  }
  class TextInput {
    constructor(props) {
      this.props = props;
      this.element = null;
    }
    /**
     * Render the input element
     */
    render() {
      if (this.element) {
        return this.element;
      }
      this.element = document.createElement("input");
      this.element.type = this.props.type || "text";
      this.element.name = this.props.name;
      this.element.className = `input input-bordered w-full ${this.props.className || ""}`.trim();
      if (this.props.value !== void 0) {
        this.element.value = String(this.props.value);
      }
      if (this.props.placeholder) {
        this.element.placeholder = this.props.placeholder;
      }
      if (this.props.required) {
        this.element.required = true;
      }
      if (this.props.disabled) {
        this.element.disabled = true;
      }
      if (this.props.readonly) {
        this.element.readOnly = true;
      }
      if (this.props.maxLength) {
        this.element.maxLength = this.props.maxLength;
      }
      if (this.props.pattern) {
        this.element.pattern = this.props.pattern;
      }
      if (this.props.autocomplete) {
        this.element.setAttribute("autocomplete", this.props.autocomplete);
      }
      if (this.props.onChange) {
        this.element.addEventListener("input", (e) => {
          const target = e.target;
          this.props.onChange?.(target.value);
        });
      }
      return this.element;
    }
    /**
     * Validate the input
     */
    validate() {
      if (!this.element) {
        return { valid: false, error: "Input not rendered" };
      }
      const value = this.element.value.trim();
      if (this.props.required && !value) {
        return { valid: false, error: "Это поле обязательно" };
      }
      if (this.props.pattern && value) {
        const regex = new RegExp(this.props.pattern);
        if (!regex.test(value)) {
          return { valid: false, error: "Неверный формат" };
        }
      }
      if (this.props.maxLength && value.length > this.props.maxLength) {
        return {
          valid: false,
          error: `Максимальная длина: ${this.props.maxLength} символов`
        };
      }
      return { valid: true };
    }
    /**
     * Get current value
     */
    getValue() {
      return this.element?.value || "";
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (this.element) {
        this.element.value = value;
        this.props.onChange?.(value);
      }
    }
    /**
     * Focus the input
     */
    focus() {
      this.element?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }
  class TextareaInput {
    constructor(props) {
      this.props = props;
      this.element = null;
    }
    /**
     * Render the textarea element
     */
    render() {
      if (this.element) {
        return this.element;
      }
      this.element = document.createElement("textarea");
      this.element.name = this.props.name;
      this.element.className = `textarea textarea-bordered w-full ${this.props.className || ""}`.trim();
      if (this.props.value !== void 0) {
        this.element.value = String(this.props.value);
      }
      if (this.props.placeholder) {
        this.element.placeholder = this.props.placeholder;
      }
      if (this.props.rows) {
        this.element.rows = this.props.rows;
      }
      if (this.props.required) {
        this.element.required = true;
      }
      if (this.props.disabled) {
        this.element.disabled = true;
      }
      if (this.props.readonly) {
        this.element.readOnly = true;
      }
      if (this.props.maxLength) {
        this.element.maxLength = this.props.maxLength;
      }
      if (this.props.onChange) {
        this.element.addEventListener("input", (e) => {
          const target = e.target;
          this.props.onChange?.(target.value);
        });
      }
      return this.element;
    }
    /**
     * Validate the textarea
     */
    validate() {
      if (!this.element) {
        return { valid: false, error: "Textarea not rendered" };
      }
      const value = this.element.value.trim();
      if (this.props.required && !value) {
        return { valid: false, error: "Это поле обязательно" };
      }
      if (this.props.maxLength && value.length > this.props.maxLength) {
        return {
          valid: false,
          error: `Максимальная длина: ${this.props.maxLength} символов`
        };
      }
      return { valid: true };
    }
    /**
     * Get current value
     */
    getValue() {
      return this.element?.value || "";
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (this.element) {
        this.element.value = value;
        this.props.onChange?.(value);
      }
    }
    /**
     * Focus the textarea
     */
    focus() {
      this.element?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }
  class AmountInput {
    constructor(props) {
      this.props = props;
      this.element = null;
    }
    /**
     * Render the input element
     */
    render() {
      if (this.element) {
        return this.element;
      }
      this.element = document.createElement("input");
      this.element.type = "number";
      this.element.name = this.props.name;
      this.element.className = `input input-bordered w-full ${this.props.className || ""}`.trim();
      if (this.props.value !== void 0) {
        this.element.value = String(this.props.value);
      }
      if (this.props.placeholder) {
        this.element.placeholder = this.props.placeholder;
      }
      if (this.props.min !== void 0) {
        this.element.min = String(this.props.min);
      }
      if (this.props.max !== void 0) {
        this.element.max = String(this.props.max);
      }
      if (this.props.step !== void 0) {
        this.element.step = String(this.props.step);
      }
      if (this.props.required) {
        this.element.required = true;
      }
      if (this.props.disabled) {
        this.element.disabled = true;
      }
      if (this.props.readonly) {
        this.element.readOnly = true;
      }
      if (this.props.onChange) {
        this.element.addEventListener("input", (e) => {
          const target = e.target;
          const value = parseFloat(target.value);
          if (!isNaN(value)) {
            this.props.onChange?.(value);
          }
        });
      }
      if (this.props.onBlur) {
        this.element.addEventListener("blur", (e) => {
          const target = e.target;
          const value = parseFloat(target.value);
          if (!isNaN(value)) {
            this.props.onBlur?.(value);
          }
        });
      }
      return this.element;
    }
    /**
     * Validate the input
     */
    validate() {
      if (!this.element) {
        return { valid: false, error: "Input not rendered" };
      }
      const value = this.element.value.trim();
      if (this.props.required && !value) {
        return { valid: false, error: "Это поле обязательно" };
      }
      if (!value && !this.props.required) {
        return { valid: true };
      }
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        return { valid: false, error: "Введите корректное число" };
      }
      if (this.props.min !== void 0 && numValue < this.props.min) {
        return {
          valid: false,
          error: `Минимальное значение: ${this.props.min}`
        };
      }
      if (this.props.max !== void 0 && numValue > this.props.max) {
        return {
          valid: false,
          error: `Максимальное значение: ${this.props.max}`
        };
      }
      if (this.props.step !== void 0 && this.props.min !== void 0) {
        const diff = numValue - this.props.min;
        const remainder = diff % this.props.step;
        if (Math.abs(remainder) > 1e-3) {
          return {
            valid: false,
            error: `Значение должно быть кратно ${this.props.step}`
          };
        }
      }
      return { valid: true };
    }
    /**
     * Get current value as number
     */
    getValue() {
      const value = parseFloat(this.element?.value || "0");
      return isNaN(value) ? 0 : value;
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (this.element) {
        this.element.value = String(value);
        this.props.onChange?.(value);
      }
    }
    /**
     * Update max value dynamically
     */
    setMax(max) {
      this.props.max = max;
      if (this.element) {
        this.element.max = String(max);
      }
    }
    /**
     * Focus the input
     */
    focus() {
      this.element?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }
  class SelectDropdown {
    constructor(props) {
      this.props = props;
      this.element = null;
    }
    /**
     * Render the select element
     */
    render() {
      if (this.element) {
        return this.element;
      }
      this.element = document.createElement("select");
      this.element.name = this.props.name;
      this.element.className = `select select-bordered w-full ${this.props.className || ""}`.trim();
      if (this.props.required) {
        this.element.required = true;
      }
      if (this.props.disabled) {
        this.element.disabled = true;
      }
      if (this.props.multiple) {
        this.element.multiple = true;
      }
      if (this.props.size) {
        this.element.size = this.props.size;
      }
      this.updateOptions(this.props.options);
      if (this.props.value !== void 0) {
        this.element.value = String(this.props.value);
      }
      if (this.props.onChange) {
        this.element.addEventListener("change", (e) => {
          const target = e.target;
          if (this.props.multiple) {
            const selectedValues = Array.from(target.selectedOptions).map((opt) => opt.value);
            this.props.onChange?.(selectedValues);
          } else {
            this.props.onChange?.(target.value);
          }
        });
      }
      return this.element;
    }
    /**
     * Update options dynamically
     */
    updateOptions(options) {
      if (!this.element) {
        throw new Error("SelectDropdown must be rendered before updating options");
      }
      this.element.innerHTML = "";
      options.forEach((option) => {
        const optElement = document.createElement("option");
        optElement.value = String(option.value);
        optElement.textContent = option.label;
        if (option.disabled) {
          optElement.disabled = true;
        }
        if (option.selected) {
          optElement.selected = true;
        }
        this.element.appendChild(optElement);
      });
      this.props.options = options;
    }
    /**
     * Validate the select
     */
    validate() {
      if (!this.element) {
        return { valid: false, error: "Select not rendered" };
      }
      const value = this.element.value;
      if (this.props.required && !value) {
        return { valid: false, error: "Выберите значение из списка" };
      }
      return { valid: true };
    }
    /**
     * Get current value(s)
     */
    getValue() {
      if (!this.element) {
        return this.props.multiple ? [] : "";
      }
      if (this.props.multiple) {
        return Array.from(this.element.selectedOptions).map((opt) => opt.value);
      } else {
        return this.element.value;
      }
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (!this.element)
        return;
      if (Array.isArray(value)) {
        Array.from(this.element.options).forEach((opt) => {
          opt.selected = value.includes(opt.value);
        });
        this.props.onChange?.(value);
      } else {
        this.element.value = value;
        this.props.onChange?.(value);
      }
    }
    /**
     * Focus the select
     */
    focus() {
      this.element?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.element;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }
  }
  class DateInput {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.input = null;
      this.calendar = null;
      this.quickButtonsContainer = null;
    }
    /**
     * Render the date input component
     */
    render() {
      if (this.container) {
        return this.container;
      }
      this.container = document.createElement("div");
      this.container.className = "date-input-wrapper";
      if (this.props.quickButtons && this.props.quickButtons.length > 0) {
        this.quickButtonsContainer = this.createQuickButtons();
        this.container.appendChild(this.quickButtonsContainer);
      }
      this.input = document.createElement("input");
      this.input.type = "text";
      this.input.name = this.props.name;
      this.input.className = `input input-bordered w-full ${this.props.className || ""}`.trim();
      this.input.placeholder = "ДД.ММ.ГГГГ";
      this.input.maxLength = 10;
      this.input.autocomplete = "off";
      if (this.props.value) {
        this.input.value = String(this.props.value);
      }
      if (this.props.required) {
        this.input.required = true;
      }
      if (this.props.disabled) {
        this.input.disabled = true;
      }
      if (this.props.readonly) {
        this.input.readOnly = true;
      }
      this.container.appendChild(this.input);
      this.initCalendar();
      return this.container;
    }
    /**
     * Create quick date buttons
     */
    createQuickButtons() {
      const container = document.createElement("div");
      container.className = "flex gap-1 mb-1";
      this.props.quickButtons?.forEach((btn) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-xs btn-outline flex-1";
        button.textContent = btn.label;
        button.addEventListener("click", () => {
          this.setDateWithOffset(btn.offset);
        });
        container.appendChild(button);
      });
      return container;
    }
    /**
     * Initialize CalendarWidget (existing widget, ZERO refactoring)
     */
    initCalendar() {
      if (!this.input)
        return;
      if (typeof BudgetShared === "undefined" || !BudgetShared.CalendarWidget) {
        console.error("[DateInput] BudgetShared.CalendarWidget not loaded. Include budgetShared.bundle.js first.");
        return;
      }
      this.calendar = new BudgetShared.CalendarWidget({
        inputElement: this.input,
        mode: this.props.mode || "single",
        onDateSelect: (date) => {
          this.props.onChange?.(date);
        }
      });
    }
    /**
     * Set date with offset from today
     */
    setDateWithOffset(offsetDays) {
      if (!this.input || typeof BudgetShared === "undefined")
        return;
      const today = /* @__PURE__ */ new Date();
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + offsetDays);
      const formatted = BudgetShared.DateFormatter.formatForDisplay(targetDate.toISOString().split("T")[0]);
      this.input.value = formatted;
      if (this.props.mode === "single") {
        this.props.onChange?.(formatted);
      }
    }
    /**
     * Validate the date input
     */
    validate() {
      if (!this.input) {
        return { valid: false, error: "Input not rendered" };
      }
      const value = this.input.value.trim();
      if (this.props.required && !value) {
        return { valid: false, error: "Дата обязательна" };
      }
      if (!value && !this.props.required) {
        return { valid: true };
      }
      if (typeof BudgetShared !== "undefined" && BudgetShared.DateFormatter) {
        const isValid = BudgetShared.DateFormatter.isValidDisplayFormat(value);
        if (!isValid) {
          return { valid: false, error: "Неверный формат даты (ДД.ММ.ГГГГ)" };
        }
      }
      return { valid: true };
    }
    /**
     * Get current value
     */
    getValue() {
      if (this.props.mode === "range") {
        return this.input?.value || "";
      }
      return this.input?.value || "";
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (!this.input)
        return;
      if (typeof value === "string") {
        this.input.value = value;
        this.props.onChange?.(value);
      }
    }
    /**
     * Focus the input
     */
    focus() {
      this.input?.focus();
    }
    /**
     * Get the rendered container
     */
    getElement() {
      return this.container;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.calendar && typeof this.calendar.destroy === "function") {
        this.calendar.destroy();
      }
      if (this.container) {
        this.container.remove();
        this.container = null;
        this.input = null;
        this.calendar = null;
        this.quickButtonsContainer = null;
      }
    }
  }
  class HierarchySelect {
    constructor(props) {
      this.props = props;
      this.select = null;
      this.choicesInstance = null;
    }
    /**
     * Render the select element
     */
    render() {
      if (this.select) {
        return this.select;
      }
      this.select = document.createElement("select");
      this.select.name = this.props.name;
      this.select.id = this.props.name;
      this.select.className = "select select-bordered w-full";
      if (this.props.multiple) {
        this.select.multiple = true;
      }
      this.initHierarchyWidget();
      return this.select;
    }
    /**
     * Initialize ChoicesCategoryTree or ChoicesProductGroupTree (existing widgets, ZERO refactoring)
     */
    initHierarchyWidget() {
      if (!this.select)
        return;
      if (typeof BudgetShared === "undefined" || !BudgetShared.ChoicesCategoryTree) {
        console.error("[HierarchySelect] BudgetShared.ChoicesCategoryTree not loaded. Include budgetShared.bundle.js first.");
        return;
      }
      if (this.props.type === "category") {
        this.choicesInstance = new BudgetShared.ChoicesCategoryTree(`#${this.props.name}`, {
          type: this.props.articleType || "expense",
          financialCenterId: this.props.financialCenterId || null,
          onChange: (category) => {
            this.props.onChange?.(category);
          }
        });
      } else if (this.props.type === "productGroup") {
        if (BudgetShared.ChoicesProductGroupTree) {
          this.choicesInstance = new BudgetShared.ChoicesProductGroupTree(`#${this.props.name}`, {
            onChange: (group) => {
              this.props.onChange?.(group);
            }
          });
        } else {
          console.error("[HierarchySelect] ChoicesProductGroupTree not available in BudgetShared");
        }
      }
      if (this.props.value !== void 0 && this.choicesInstance) {
        setTimeout(() => {
          this.setValue(this.props.value);
        }, 100);
      }
    }
    /**
     * Update article type (for category selector)
     */
    updateType(type) {
      if (this.props.type !== "category" || !this.choicesInstance) {
        return;
      }
      if (typeof this.choicesInstance.updateType === "function") {
        this.choicesInstance.updateType(type);
        this.props.articleType = type;
      }
    }
    /**
     * Update financial center filter (for category selector)
     */
    updateFinancialCenter(fcId) {
      if (this.props.type !== "category" || !this.choicesInstance) {
        return;
      }
      if (typeof this.choicesInstance.updateFinancialCenter === "function") {
        this.choicesInstance.updateFinancialCenter(fcId);
        this.props.financialCenterId = fcId;
      }
    }
    /**
     * Validate the select
     */
    validate() {
      if (!this.select) {
        return { valid: false, error: "Select not rendered" };
      }
      const value = this.select.value;
      if (!value || value === "" || value === "null") {
        return { valid: false, error: "Выберите значение из списка" };
      }
      return { valid: true };
    }
    /**
     * Get current value
     */
    getValue() {
      if (!this.select)
        return null;
      if (this.props.multiple) {
        const values = Array.from(this.select.selectedOptions).map((opt) => parseInt(opt.value));
        return values.filter((v) => !isNaN(v));
      } else {
        const value = parseInt(this.select.value);
        return isNaN(value) ? null : value;
      }
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      if (!this.choicesInstance)
        return;
      if (Array.isArray(value)) {
        if (typeof this.choicesInstance.setChoiceByValue === "function") {
          value.forEach((v) => {
            this.choicesInstance.setChoiceByValue(String(v));
          });
        }
      } else {
        if (typeof this.choicesInstance.setChoiceByValue === "function") {
          this.choicesInstance.setChoiceByValue(String(value));
        }
      }
    }
    /**
     * Focus the select
     */
    focus() {
      this.select?.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.select;
    }
    /**
     * Destroy the component
     */
    destroy() {
      if (this.choicesInstance && typeof this.choicesInstance.destroy === "function") {
        this.choicesInstance.destroy();
      }
      if (this.select) {
        this.select.remove();
        this.select = null;
        this.choicesInstance = null;
      }
    }
  }
  class FinancialCenterSelect {
    constructor(props) {
      this.props = props;
      this.options = [];
      this.loaded = false;
      this.options = [
        { value: "", label: props.placeholder || "-- Выберите счет --" }
      ];
      this.select = new SelectDropdown({
        name: props.name,
        value: props.value?.toString(),
        options: this.options,
        required: props.required,
        disabled: props.disabled,
        className: props.className,
        onChange: (value) => {
          const fcId = value ? parseInt(value) : null;
          this.props.onChange?.(fcId);
        }
      });
    }
    /**
     * Load financial centers from API
     */
    async loadOptions() {
      try {
        const response = await fetch("/api/v1/financial-centers", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to load financial centers: ${response.statusText}`);
        }
        const data = await response.json();
        const centers = data.data || data;
        this.options = [
          { value: "", label: this.props.placeholder || "-- Выберите счет --" },
          ...centers.filter((fc) => fc.is_active).map((fc) => ({
            value: fc.id,
            label: fc.name
          }))
        ];
        this.select.updateOptions(this.options);
        this.loaded = true;
        if (this.props.value !== void 0) {
          this.setValue(this.props.value);
        }
      } catch (error) {
        console.error("[FinancialCenterSelect] Failed to load options:", error);
        throw error;
      }
    }
    /**
     * Render the select element
     */
    render() {
      return this.select.render();
    }
    /**
     * Validate the select
     */
    validate() {
      return this.select.validate();
    }
    /**
     * Get current value
     */
    getValue() {
      const value = this.select.getValue();
      return value ? parseInt(value) : null;
    }
    /**
     * Set value programmatically
     */
    setValue(fcId) {
      this.select.setValue(fcId?.toString() || "");
    }
    /**
     * Focus the select
     */
    focus() {
      this.select.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.select.getElement();
    }
    /**
     * Check if options are loaded
     */
    isLoaded() {
      return this.loaded;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.select.destroy();
    }
  }
  class ArticleSelect {
    constructor(props) {
      this.props = props;
      this.hierarchySelect = new HierarchySelect({
        name: props.name,
        type: "category",
        articleType: props.articleType,
        financialCenterId: props.financialCenterId,
        value: props.value,
        multiple: props.multiple,
        onChange: props.onChange
      });
    }
    /**
     * Render the select element
     */
    render() {
      return this.hierarchySelect.render();
    }
    /**
     * Update article type (expense/income)
     * Triggers re-filtering of categories in ChoicesCategoryTree
     */
    updateType(type) {
      this.hierarchySelect.updateType(type);
      this.props.articleType = type;
    }
    /**
     * Update financial center filter
     * Triggers re-filtering of categories based on whitelist
     */
    updateFinancialCenter(fcId) {
      this.hierarchySelect.updateFinancialCenter(fcId);
      this.props.financialCenterId = fcId;
    }
    /**
     * Validate the select
     */
    validate() {
      return this.hierarchySelect.validate();
    }
    /**
     * Get current value
     */
    getValue() {
      return this.hierarchySelect.getValue();
    }
    /**
     * Set value programmatically
     */
    setValue(value) {
      this.hierarchySelect.setValue(value);
    }
    /**
     * Focus the select
     */
    focus() {
      this.hierarchySelect.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.hierarchySelect.getElement();
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.hierarchySelect.destroy();
    }
  }
  class CostCenterSelect {
    constructor(props) {
      this.props = props;
      this.options = [];
      this.loaded = false;
      this.options = [
        { value: "", label: props.placeholder || "-- Выберите место затрат --" }
      ];
      this.select = new SelectDropdown({
        name: props.name,
        value: props.value?.toString(),
        options: this.options,
        required: props.required,
        disabled: props.disabled,
        className: props.className,
        onChange: (value) => {
          const ccId = value ? parseInt(value) : null;
          this.props.onChange?.(ccId);
        }
      });
    }
    /**
     * Load cost centers from API
     */
    async loadOptions() {
      try {
        const response = await fetch("/api/v1/cost-centers", {
          method: "GET",
          headers: {
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) {
          throw new Error(`Failed to load cost centers: ${response.statusText}`);
        }
        const data = await response.json();
        const centers = data.data || data;
        this.options = [
          { value: "", label: this.props.placeholder || "-- Выберите место затрат --" },
          ...centers.filter((cc) => cc.is_active).map((cc) => ({
            value: cc.id,
            label: cc.name
          }))
        ];
        this.select.updateOptions(this.options);
        this.loaded = true;
        if (this.props.value !== void 0) {
          this.setValue(this.props.value);
        }
      } catch (error) {
        console.error("[CostCenterSelect] Failed to load options:", error);
        throw error;
      }
    }
    /**
     * Render the select element
     */
    render() {
      return this.select.render();
    }
    /**
     * Validate the select
     */
    validate() {
      return this.select.validate();
    }
    /**
     * Get current value
     */
    getValue() {
      const value = this.select.getValue();
      return value ? parseInt(value) : null;
    }
    /**
     * Set value programmatically
     */
    setValue(ccId) {
      this.select.setValue(ccId?.toString() || "");
    }
    /**
     * Focus the select
     */
    focus() {
      this.select.focus();
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.select.getElement();
    }
    /**
     * Check if options are loaded
     */
    isLoaded() {
      return this.loaded;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.select.destroy();
    }
  }
  class RecurringPlanSettings {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.helpText = null;
      this.frequencyTypeSelect = new SelectDropdown({
        name: `${props.name}_frequency_type`,
        value: props.frequencyType || "monthly",
        options: [
          { value: "weekly", label: "Еженедельно" },
          { value: "monthly", label: "Ежемесячно" },
          { value: "yearly", label: "Ежегодно" }
        ],
        onChange: (value) => this.handleFrequencyTypeChange(value)
      });
      this.frequencyValueInput = new AmountInput({
        name: `${props.name}_frequency_value`,
        value: props.frequencyValue || 1,
        min: 1,
        max: this.getMaxFrequencyValue(props.frequencyType || "monthly"),
        step: 1,
        onChange: () => this.handleChange()
      });
      this.endDateInput = new DateInput({
        name: `${props.name}_end_date`,
        value: props.endDate || "",
        required: false,
        onChange: () => this.handleChange()
      });
    }
    /**
     * Get maximum frequency value based on frequency type
     */
    getMaxFrequencyValue(type) {
      switch (type) {
        case "weekly":
          return 7;
        // Days of week (1-7)
        case "monthly":
          return 31;
        // Days of month (1-31)
        case "yearly":
          return 1231;
        // MMDD encoding (0101-1231)
        default:
          return 31;
      }
    }
    /**
     * Handle frequency type change
     */
    handleFrequencyTypeChange(type) {
      const maxValue = this.getMaxFrequencyValue(type);
      this.frequencyValueInput.setMax(maxValue);
      const currentValue = this.frequencyValueInput.getValue();
      if (currentValue > maxValue) {
        this.frequencyValueInput.setValue(1);
      }
      this.updateHelpText(type);
      this.handleChange();
    }
    /**
     * Update help text based on frequency type
     */
    updateHelpText(type) {
      if (!this.helpText)
        return;
      let text = "";
      switch (type) {
        case "weekly":
          text = "Укажите день недели (1 = Понедельник, 7 = Воскресенье)";
          break;
        case "monthly":
          text = "Укажите день месяца (1-31)";
          break;
        case "yearly":
          text = "Укажите дату в формате ММДД (например, 315 = 15 марта)";
          break;
      }
      this.helpText.textContent = text;
    }
    /**
     * Notify parent of changes
     */
    handleChange() {
      if (this.props.onChange) {
        this.props.onChange(this.getValue());
      }
    }
    /**
     * Render the settings UI
     */
    render() {
      if (this.container) {
        return this.container;
      }
      this.container = document.createElement("div");
      this.container.className = `recurring-plan-settings ${this.props.className || ""}`.trim();
      const typeSection = document.createElement("div");
      typeSection.className = "form-control mb-4";
      const typeLabel = document.createElement("label");
      typeLabel.className = "label";
      typeLabel.innerHTML = '<span class="label-text">Периодичность</span>';
      typeSection.appendChild(typeLabel);
      typeSection.appendChild(this.frequencyTypeSelect.render());
      this.container.appendChild(typeSection);
      const valueSection = document.createElement("div");
      valueSection.className = "form-control mb-4";
      const valueLabel = document.createElement("label");
      valueLabel.className = "label";
      valueLabel.innerHTML = '<span class="label-text">Значение</span>';
      this.helpText = document.createElement("div");
      this.helpText.className = "label-text-alt text-base-content/70 text-xs mt-1";
      this.updateHelpText(this.props.frequencyType || "monthly");
      valueSection.appendChild(valueLabel);
      valueSection.appendChild(this.frequencyValueInput.render());
      valueSection.appendChild(this.helpText);
      this.container.appendChild(valueSection);
      const endDateSection = document.createElement("div");
      endDateSection.className = "form-control";
      const endDateLabel = document.createElement("label");
      endDateLabel.className = "label";
      endDateLabel.innerHTML = '<span class="label-text">Дата окончания (опционально)</span>';
      const endDateHelp = document.createElement("div");
      endDateHelp.className = "label-text-alt text-base-content/70 text-xs mt-1";
      endDateHelp.textContent = "Оставьте пустым для бессрочного плана";
      endDateSection.appendChild(endDateLabel);
      endDateSection.appendChild(this.endDateInput.render());
      endDateSection.appendChild(endDateHelp);
      this.container.appendChild(endDateSection);
      return this.container;
    }
    /**
     * Validate all settings
     */
    validate() {
      const typeValidation = this.frequencyTypeSelect.validate();
      if (!typeValidation.valid) {
        return typeValidation;
      }
      const valueValidation = this.frequencyValueInput.validate();
      if (!valueValidation.valid) {
        return valueValidation;
      }
      const endDateValidation = this.endDateInput.validate();
      if (!endDateValidation.valid) {
        return endDateValidation;
      }
      const type = this.frequencyTypeSelect.getValue();
      const value = this.frequencyValueInput.getValue();
      const maxValue = this.getMaxFrequencyValue(type);
      if (value < 1 || value > maxValue) {
        return {
          valid: false,
          error: `Значение должно быть от 1 до ${maxValue}`
        };
      }
      if (type === "yearly") {
        const mm = Math.floor(value / 100);
        const dd = value % 100;
        if (mm < 1 || mm > 12) {
          return {
            valid: false,
            error: "Неверный месяц в формате ММДД (месяц должен быть от 01 до 12)"
          };
        }
        if (dd < 1 || dd > 31) {
          return {
            valid: false,
            error: "Неверный день в формате ММДД (день должен быть от 01 до 31)"
          };
        }
      }
      return { valid: true };
    }
    /**
     * Get current settings
     */
    getValue() {
      const endDateValue = this.endDateInput.getValue();
      return {
        frequencyType: this.frequencyTypeSelect.getValue(),
        frequencyValue: this.frequencyValueInput.getValue(),
        endDate: (typeof endDateValue === "string" ? endDateValue : null) || null
      };
    }
    /**
     * Set settings programmatically
     */
    setValue(data) {
      if (data.frequencyType) {
        this.frequencyTypeSelect.setValue(data.frequencyType);
        this.updateHelpText(data.frequencyType);
      }
      if (data.frequencyValue !== void 0) {
        this.frequencyValueInput.setValue(data.frequencyValue);
      }
      if (data.endDate !== void 0) {
        this.endDateInput.setValue(data.endDate || "");
      }
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.container;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.frequencyTypeSelect.destroy();
      this.frequencyValueInput.destroy();
      this.endDateInput.destroy();
      if (this.container) {
        this.container.remove();
        this.container = null;
        this.helpText = null;
      }
    }
  }
  class ReminderSettings {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.enabledCheckbox = null;
      this.datetimeContainer = null;
      this.messageContainer = null;
      this.datetimeInput = new DateInput({
        name: `${props.name}_datetime`,
        value: props.datetime || "",
        required: false,
        onChange: () => this.handleChange()
      });
      this.messageInput = new TextareaInput({
        name: `${props.name}_message`,
        value: props.message || "",
        placeholder: "Текст напоминания (опционально)",
        maxLength: 200,
        rows: 2,
        onChange: () => this.handleChange()
      });
    }
    /**
     * Handle enabled checkbox change
     */
    handleEnabledChange() {
      const enabled = this.enabledCheckbox?.checked || false;
      if (this.datetimeContainer && this.messageContainer) {
        if (enabled) {
          this.datetimeContainer.classList.remove("hidden");
          this.messageContainer.classList.remove("hidden");
        } else {
          this.datetimeContainer.classList.add("hidden");
          this.messageContainer.classList.add("hidden");
        }
      }
      this.handleChange();
    }
    /**
     * Notify parent of changes
     */
    handleChange() {
      if (this.props.onChange) {
        this.props.onChange(this.getValue());
      }
    }
    /**
     * Render the settings UI
     */
    render() {
      if (this.container) {
        return this.container;
      }
      this.container = document.createElement("div");
      this.container.className = `reminder-settings ${this.props.className || ""}`.trim();
      const enabledSection = document.createElement("div");
      enabledSection.className = "form-control mb-4";
      const checkboxLabel = document.createElement("label");
      checkboxLabel.className = "label cursor-pointer justify-start gap-3";
      this.enabledCheckbox = document.createElement("input");
      this.enabledCheckbox.type = "checkbox";
      this.enabledCheckbox.name = `${this.props.name}_enabled`;
      this.enabledCheckbox.className = "checkbox";
      this.enabledCheckbox.checked = this.props.enabled || false;
      this.enabledCheckbox.addEventListener("change", () => this.handleEnabledChange());
      const checkboxText = document.createElement("span");
      checkboxText.className = "label-text";
      checkboxText.textContent = "Включить напоминание";
      checkboxLabel.appendChild(this.enabledCheckbox);
      checkboxLabel.appendChild(checkboxText);
      enabledSection.appendChild(checkboxLabel);
      this.container.appendChild(enabledSection);
      this.datetimeContainer = document.createElement("div");
      this.datetimeContainer.className = `form-control mb-4 ${this.props.enabled ? "" : "hidden"}`.trim();
      const datetimeLabel = document.createElement("label");
      datetimeLabel.className = "label";
      datetimeLabel.innerHTML = '<span class="label-text">Дата и время напоминания</span>';
      const datetimeHelp = document.createElement("div");
      datetimeHelp.className = "label-text-alt text-base-content/70 text-xs mt-1";
      datetimeHelp.textContent = "Вы получите уведомление в указанную дату";
      this.datetimeContainer.appendChild(datetimeLabel);
      this.datetimeContainer.appendChild(this.datetimeInput.render());
      this.datetimeContainer.appendChild(datetimeHelp);
      this.container.appendChild(this.datetimeContainer);
      this.messageContainer = document.createElement("div");
      this.messageContainer.className = `form-control ${this.props.enabled ? "" : "hidden"}`.trim();
      const messageLabel = document.createElement("label");
      messageLabel.className = "label";
      messageLabel.innerHTML = '<span class="label-text">Текст напоминания (опционально)</span>';
      const messageHelp = document.createElement("div");
      messageHelp.className = "label-text-alt text-base-content/70 text-xs mt-1";
      messageHelp.textContent = "Максимум 200 символов";
      this.messageContainer.appendChild(messageLabel);
      this.messageContainer.appendChild(this.messageInput.render());
      this.messageContainer.appendChild(messageHelp);
      this.container.appendChild(this.messageContainer);
      return this.container;
    }
    /**
     * Validate settings
     */
    validate() {
      const enabled = this.enabledCheckbox?.checked || false;
      if (!enabled) {
        return { valid: true };
      }
      const datetimeValidation = this.datetimeInput.validate();
      if (!datetimeValidation.valid) {
        return datetimeValidation;
      }
      const datetime = this.datetimeInput.getValue();
      if (!datetime) {
        return {
          valid: false,
          error: "Укажите дату напоминания"
        };
      }
      const messageValidation = this.messageInput.validate();
      if (!messageValidation.valid) {
        return messageValidation;
      }
      return { valid: true };
    }
    /**
     * Get current settings
     */
    getValue() {
      const enabled = this.enabledCheckbox?.checked || false;
      if (!enabled) {
        return {
          enabled: false,
          datetime: null,
          message: null
        };
      }
      const datetimeValue = this.datetimeInput.getValue();
      return {
        enabled: true,
        datetime: (typeof datetimeValue === "string" ? datetimeValue : null) || null,
        message: this.messageInput.getValue() || null
      };
    }
    /**
     * Set settings programmatically
     */
    setValue(data) {
      if (data.enabled !== void 0 && this.enabledCheckbox) {
        this.enabledCheckbox.checked = data.enabled;
        this.handleEnabledChange();
      }
      if (data.datetime !== void 0) {
        this.datetimeInput.setValue(data.datetime || "");
      }
      if (data.message !== void 0) {
        this.messageInput.setValue(data.message || "");
      }
    }
    /**
     * Get the rendered element
     */
    getElement() {
      return this.container;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.datetimeInput.destroy();
      this.messageInput.destroy();
      if (this.container) {
        this.container.remove();
        this.container = null;
        this.enabledCheckbox = null;
        this.datetimeContainer = null;
        this.messageContainer = null;
      }
    }
  }
  class TransactionForm {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.form = null;
      this.recordTypeButtons = /* @__PURE__ */ new Map();
      this.factHintsContainer = null;
      this.submitButton = null;
      this.isSubmitting = false;
      this.dateInput = new DateInput({
        name: "fact_date",
        value: props.initialData?.fact_date,
        required: true,
        quickButtons: [
          { label: "Сегодня", offset: 0 },
          { label: "Вчера", offset: -1 },
          { label: "Позавчера", offset: -2 }
        ],
        onChange: () => this.handleDateChange()
      });
      this.financialCenterSelect = new FinancialCenterSelect({
        name: "financial_center_id",
        value: props.initialData?.financial_center_id,
        required: true,
        onChange: (fcId) => this.handleFinancialCenterChange(fcId)
      });
      this.articleSelect = new ArticleSelect({
        name: "article_id",
        articleType: props.initialData?.record_type || "expense",
        financialCenterId: props.initialData?.financial_center_id,
        value: props.initialData?.article_id,
        required: true,
        onChange: (article) => this.handleArticleChange(article)
      });
      this.costCenterSelect = new CostCenterSelect({
        name: "cost_center_id",
        value: props.initialData?.cost_center_id || void 0,
        required: false
      });
      this.amountInput = new AmountInput({
        name: "amount",
        value: props.initialData?.amount,
        min: 1,
        step: 1,
        required: true,
        placeholder: "0"
      });
      this.descriptionInput = new TextareaInput({
        name: "description",
        value: props.initialData?.description,
        placeholder: "Комментарий",
        rows: 1
      });
    }
    /**
     * Initialize the form (load data, render)
     */
    async initialize() {
      this.render();
      await Promise.all([
        this.financialCenterSelect.loadOptions(),
        this.costCenterSelect.loadOptions()
      ]);
    }
    /**
     * Render the complete form
     */
    render() {
      if (typeof this.props.container === "string") {
        this.container = document.querySelector(this.props.container);
      } else {
        this.container = this.props.container;
      }
      if (!this.container) {
        throw new Error(`Container not found: ${this.props.container}`);
      }
      this.form = document.createElement("form");
      this.form.className = "space-y-2";
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      const dateField = new FormField({
        label: "Дата",
        name: "fact_date",
        required: true,
        children: this.dateInput.render()
      });
      this.form.appendChild(dateField.render());
      const fcField = new FormField({
        label: "Счет",
        name: "financial_center_id",
        required: true,
        helpText: "Первым для фильтрации категорий",
        children: this.financialCenterSelect.render()
      });
      this.form.appendChild(fcField.render());
      this.form.appendChild(this.createRecordTypeField());
      const articleField = new FormField({
        label: "Категория",
        name: "article_id",
        required: true,
        children: this.articleSelect.render()
      });
      this.form.appendChild(articleField.render());
      const ccField = new FormField({
        label: "Место затрат",
        name: "cost_center_id",
        required: false,
        children: this.costCenterSelect.render()
      });
      this.form.appendChild(ccField.render());
      this.factHintsContainer = this.createFactHintsContainer();
      this.form.appendChild(this.factHintsContainer);
      const amountField = new FormField({
        label: "Сумма",
        name: "amount",
        required: true,
        children: this.amountInput.render()
      });
      this.form.appendChild(amountField.render());
      const descField = new FormField({
        label: "Описание",
        name: "description",
        required: false,
        children: this.descriptionInput.render()
      });
      this.form.appendChild(descField.render());
      const actions = document.createElement("div");
      actions.className = "modal-action mt-3";
      this.submitButton = document.createElement("button");
      this.submitButton.type = "submit";
      this.submitButton.className = "btn btn-sm btn-primary";
      this.submitButton.textContent = this.props.mode === "create" ? "✅ Сохранить" : "💾 Обновить";
      actions.appendChild(this.submitButton);
      this.form.appendChild(actions);
      this.container.appendChild(this.form);
    }
    /**
     * Create record type radio buttons
     */
    createRecordTypeField() {
      const field = document.createElement("div");
      field.className = "form-control";
      const label = document.createElement("label");
      label.className = "label py-1";
      label.innerHTML = '<span class="label-text font-semibold">Тип операции *</span>';
      field.appendChild(label);
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-2 gap-2";
      const expenseLabel = document.createElement("label");
      expenseLabel.className = `btn btn-sm btn-outline btn-error transaction-type-btn ${this.props.initialData?.record_type === "expense" || !this.props.initialData ? "btn-active" : ""}`;
      expenseLabel.setAttribute("data-type", "expense");
      const expenseInput = document.createElement("input");
      expenseInput.type = "radio";
      expenseInput.name = "record_type";
      expenseInput.value = "expense";
      expenseInput.className = "hidden";
      expenseInput.checked = this.props.initialData?.record_type === "expense" || !this.props.initialData;
      expenseInput.addEventListener("change", () => this.handleRecordTypeChange("expense"));
      expenseLabel.appendChild(expenseInput);
      expenseLabel.appendChild(document.createTextNode("Расход"));
      this.recordTypeButtons.set("expense", expenseLabel);
      grid.appendChild(expenseLabel);
      const incomeLabel = document.createElement("label");
      incomeLabel.className = `btn btn-sm btn-outline btn-success transaction-type-btn ${this.props.initialData?.record_type === "income" ? "btn-active" : ""}`;
      incomeLabel.setAttribute("data-type", "income");
      const incomeInput = document.createElement("input");
      incomeInput.type = "radio";
      incomeInput.name = "record_type";
      incomeInput.value = "income";
      incomeInput.className = "hidden";
      incomeInput.checked = this.props.initialData?.record_type === "income";
      incomeInput.addEventListener("change", () => this.handleRecordTypeChange("income"));
      incomeLabel.appendChild(incomeInput);
      incomeLabel.appendChild(document.createTextNode("Доход"));
      this.recordTypeButtons.set("income", incomeLabel);
      grid.appendChild(incomeLabel);
      field.appendChild(grid);
      return field;
    }
    /**
     * Create fact hints container
     */
    createFactHintsContainer() {
      const container = document.createElement("div");
      container.id = "fact-hints-container";
      container.className = "grid grid-cols-2 gap-1";
      const planHint = document.createElement("button");
      planHint.type = "button";
      planHint.className = "btn btn-xs btn-ghost btn-disabled";
      planHint.id = "hint-period-plan";
      planHint.disabled = true;
      planHint.textContent = "План мес: --";
      container.appendChild(planHint);
      const factHint = document.createElement("button");
      factHint.type = "button";
      factHint.className = "btn btn-xs btn-ghost btn-disabled";
      factHint.id = "hint-period-fact";
      factHint.disabled = true;
      factHint.textContent = "Факт мес: --";
      container.appendChild(factHint);
      return container;
    }
    /**
     * Handle date change
     */
    handleDateChange() {
      this.updateFactHints();
    }
    /**
     * Handle financial center change
     */
    handleFinancialCenterChange(fcId) {
      this.articleSelect.updateFinancialCenter(fcId);
      this.updateFactHints();
    }
    /**
     * Handle record type change
     */
    handleRecordTypeChange(type) {
      this.recordTypeButtons.forEach((button, buttonType) => {
        if (buttonType === type) {
          button.classList.add("btn-active");
        } else {
          button.classList.remove("btn-active");
        }
      });
      this.articleSelect.updateType(type);
      this.updateFactHints();
    }
    /**
     * Handle article change
     */
    handleArticleChange(_article) {
      this.updateFactHints();
    }
    /**
     * Update fact hints (plan/fact for period)
     */
    async updateFactHints() {
      const date = this.dateInput.getValue();
      const fcId = this.financialCenterSelect.getValue();
      const articleId = this.articleSelect.getValue();
      if (!date || !fcId || !articleId) {
        this.clearFactHints();
        return;
      }
      try {
        const response = await fetch(`/api/v1/analytics/fact-hints?date=${date}&financial_center_id=${fcId}&article_id=${articleId}`);
        if (!response.ok) {
          this.clearFactHints();
          return;
        }
        const hints = await response.json();
        this.displayFactHints(hints);
      } catch (error) {
        console.error("[TransactionForm] Failed to fetch fact hints:", error);
        this.clearFactHints();
      }
    }
    /**
     * Display fact hints
     */
    displayFactHints(hints) {
      if (!this.factHintsContainer)
        return;
      const planButton = this.factHintsContainer.querySelector("#hint-period-plan");
      const factButton = this.factHintsContainer.querySelector("#hint-period-fact");
      if (planButton) {
        planButton.textContent = `План мес: ${hints.period_plan !== null ? hints.period_plan : "--"}`;
      }
      if (factButton) {
        factButton.textContent = `Факт мес: ${hints.period_fact !== null ? hints.period_fact : "--"}`;
      }
    }
    /**
     * Clear fact hints
     */
    clearFactHints() {
      if (!this.factHintsContainer)
        return;
      const planButton = this.factHintsContainer.querySelector("#hint-period-plan");
      const factButton = this.factHintsContainer.querySelector("#hint-period-fact");
      if (planButton) {
        planButton.textContent = "План мес: --";
      }
      if (factButton) {
        factButton.textContent = "Факт мес: --";
      }
    }
    /**
     * Validate the entire form
     */
    validate() {
      const validations = [
        this.dateInput.validate(),
        this.financialCenterSelect.validate(),
        this.articleSelect.validate(),
        this.amountInput.validate(),
        this.descriptionInput.validate()
      ];
      for (const validation of validations) {
        if (!validation.valid) {
          return validation;
        }
      }
      return { valid: true };
    }
    /**
     * Collect form data
     */
    collectFormData() {
      const recordTypeInput = this.form?.querySelector('input[name="record_type"]:checked');
      return {
        id: this.props.initialData?.id,
        fact_date: this.dateInput.getValue(),
        financial_center_id: this.financialCenterSelect.getValue(),
        record_type: recordTypeInput?.value || "expense",
        article_id: this.articleSelect.getValue(),
        cost_center_id: this.costCenterSelect.getValue(),
        amount: this.amountInput.getValue(),
        description: this.descriptionInput.getValue() || void 0
      };
    }
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
      event.preventDefault();
      if (this.isSubmitting) {
        return;
      }
      const validation = this.validate();
      if (!validation.valid) {
        alert(validation.error || "Проверьте правильность заполнения полей");
        return;
      }
      this.isSubmitting = true;
      if (this.submitButton) {
        this.submitButton.disabled = true;
        this.submitButton.textContent = "⏳ Сохранение...";
      }
      try {
        const data = this.collectFormData();
        await this.props.onSubmit(data);
        if (this.props.onSuccess) {
          this.props.onSuccess();
        }
      } catch (error) {
        console.error("[TransactionForm] Submit error:", error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          alert("Ошибка при сохранении транзакции");
        }
      } finally {
        this.isSubmitting = false;
        if (this.submitButton) {
          this.submitButton.disabled = false;
          this.submitButton.textContent = this.props.mode === "create" ? "✅ Сохранить" : "💾 Обновить";
        }
      }
    }
    /**
     * Get the rendered form element
     */
    getElement() {
      return this.form;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.dateInput.destroy();
      this.financialCenterSelect.destroy();
      this.articleSelect.destroy();
      this.costCenterSelect.destroy();
      this.amountInput.destroy();
      this.descriptionInput.destroy();
      if (this.form) {
        this.form.remove();
        this.form = null;
      }
      this.recordTypeButtons.clear();
      this.factHintsContainer = null;
      this.submitButton = null;
    }
  }
  class TransferForm {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.form = null;
      this.dateInput = null;
      this.submitButton = null;
      this.isSubmitting = false;
      if (props.transferType === "fact") {
        this.dateInput = new DateInput({
          name: "transfer_date",
          value: props.initialData?.transfer_date,
          required: true,
          quickButtons: [
            { label: "Сегодня", offset: 0 },
            { label: "Вчера", offset: -1 },
            { label: "Позавчера", offset: -2 }
          ]
        });
      }
      this.fromFcSelect = new FinancialCenterSelect({
        name: "from_financial_center_id",
        value: props.initialData?.from_financial_center_id,
        required: true,
        onChange: (fcId) => this.fromArticleSelect.updateFinancialCenter(fcId)
      });
      this.fromArticleSelect = new ArticleSelect({
        name: "from_article_id",
        articleType: "expense",
        // debit article
        financialCenterId: props.initialData?.from_financial_center_id,
        value: props.initialData?.from_article_id,
        required: true
      });
      this.fromCcSelect = new CostCenterSelect({
        name: "from_cost_center_id",
        value: props.initialData?.from_cost_center_id || void 0,
        required: false
      });
      this.toFcSelect = new FinancialCenterSelect({
        name: "to_financial_center_id",
        value: props.initialData?.to_financial_center_id,
        required: true,
        onChange: (fcId) => this.toArticleSelect.updateFinancialCenter(fcId)
      });
      this.toArticleSelect = new ArticleSelect({
        name: "to_article_id",
        articleType: "income",
        // credit article
        financialCenterId: props.initialData?.to_financial_center_id,
        value: props.initialData?.to_article_id,
        required: true
      });
      this.toCcSelect = new CostCenterSelect({
        name: "to_cost_center_id",
        value: props.initialData?.to_cost_center_id || void 0,
        required: false
      });
      this.amountInput = new AmountInput({
        name: "amount",
        value: props.initialData?.amount,
        min: 1,
        step: 1,
        required: true,
        placeholder: "0"
      });
      this.descriptionInput = new TextareaInput({
        name: "description",
        value: props.initialData?.description,
        placeholder: "Комментарий к переводу",
        rows: 2
      });
    }
    /**
     * Initialize the form
     */
    async initialize() {
      this.render();
      await Promise.all([
        this.fromFcSelect.loadOptions(),
        this.fromCcSelect.loadOptions(),
        this.toFcSelect.loadOptions(),
        this.toCcSelect.loadOptions()
      ]);
    }
    /**
     * Render the complete form
     */
    render() {
      if (typeof this.props.container === "string") {
        this.container = document.querySelector(this.props.container);
      } else {
        this.container = this.props.container;
      }
      if (!this.container) {
        throw new Error(`Container not found: ${this.props.container}`);
      }
      this.form = document.createElement("form");
      this.form.className = "space-y-2";
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      if (this.props.transferType === "fact" && this.dateInput) {
        const dateField = new FormField({
          label: "Дата перевода",
          name: "transfer_date",
          required: true,
          children: this.dateInput.render()
        });
        this.form.appendChild(dateField.render());
      }
      const fromSection = document.createElement("div");
      fromSection.className = "border border-error/20 rounded-lg p-3 bg-error/5 space-y-2";
      const fromHeader = document.createElement("h4");
      fromHeader.className = "font-semibold text-error text-sm mb-2";
      fromHeader.textContent = "📤 Откуда (списание)";
      fromSection.appendChild(fromHeader);
      const fromFcField = new FormField({
        label: "Счет",
        name: "from_financial_center_id",
        required: true,
        children: this.fromFcSelect.render()
      });
      fromSection.appendChild(fromFcField.render());
      const fromArticleField = new FormField({
        label: "Категория",
        name: "from_article_id",
        required: true,
        children: this.fromArticleSelect.render()
      });
      fromSection.appendChild(fromArticleField.render());
      const fromCcField = new FormField({
        label: "Место затрат",
        name: "from_cost_center_id",
        required: false,
        children: this.fromCcSelect.render()
      });
      fromSection.appendChild(fromCcField.render());
      this.form.appendChild(fromSection);
      const toSection = document.createElement("div");
      toSection.className = "border border-success/20 rounded-lg p-3 bg-success/5 space-y-2";
      const toHeader = document.createElement("h4");
      toHeader.className = "font-semibold text-success text-sm mb-2";
      toHeader.textContent = "📥 Куда (пополнение)";
      toSection.appendChild(toHeader);
      const toFcField = new FormField({
        label: "Счет",
        name: "to_financial_center_id",
        required: true,
        children: this.toFcSelect.render()
      });
      toSection.appendChild(toFcField.render());
      const toArticleField = new FormField({
        label: "Категория",
        name: "to_article_id",
        required: true,
        children: this.toArticleSelect.render()
      });
      toSection.appendChild(toArticleField.render());
      const toCcField = new FormField({
        label: "Место затрат",
        name: "to_cost_center_id",
        required: false,
        children: this.toCcSelect.render()
      });
      toSection.appendChild(toCcField.render());
      this.form.appendChild(toSection);
      const amountField = new FormField({
        label: "Сумма",
        name: "amount",
        required: true,
        children: this.amountInput.render()
      });
      this.form.appendChild(amountField.render());
      const descField = new FormField({
        label: "Описание",
        name: "description",
        required: false,
        children: this.descriptionInput.render()
      });
      this.form.appendChild(descField.render());
      const actions = document.createElement("div");
      actions.className = "modal-action mt-3";
      this.submitButton = document.createElement("button");
      this.submitButton.type = "submit";
      this.submitButton.className = "btn btn-sm btn-primary";
      this.submitButton.textContent = "✅ Создать перевод";
      actions.appendChild(this.submitButton);
      this.form.appendChild(actions);
      this.container.appendChild(this.form);
    }
    /**
     * Validate the entire form
     */
    validate() {
      const validations = [
        this.fromFcSelect.validate(),
        this.fromArticleSelect.validate(),
        this.toFcSelect.validate(),
        this.toArticleSelect.validate(),
        this.amountInput.validate()
      ];
      if (this.props.transferType === "fact" && this.dateInput) {
        validations.push(this.dateInput.validate());
      }
      const fromFc = this.fromFcSelect.getValue();
      const toFc = this.toFcSelect.getValue();
      if (fromFc === toFc) {
        return {
          valid: false,
          error: 'Счета "Откуда" и "Куда" должны быть разными'
        };
      }
      for (const validation of validations) {
        if (!validation.valid) {
          return validation;
        }
      }
      return { valid: true };
    }
    /**
     * Collect form data
     */
    collectFormData() {
      const data = {
        transfer_type: this.props.transferType,
        from_financial_center_id: this.fromFcSelect.getValue(),
        from_article_id: this.fromArticleSelect.getValue(),
        from_cost_center_id: this.fromCcSelect.getValue(),
        to_financial_center_id: this.toFcSelect.getValue(),
        to_article_id: this.toArticleSelect.getValue(),
        to_cost_center_id: this.toCcSelect.getValue(),
        amount: this.amountInput.getValue(),
        description: this.descriptionInput.getValue() || void 0
      };
      if (this.props.transferType === "fact" && this.dateInput) {
        data.transfer_date = this.dateInput.getValue();
      }
      return data;
    }
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
      event.preventDefault();
      if (this.isSubmitting) {
        return;
      }
      const validation = this.validate();
      if (!validation.valid) {
        alert(validation.error || "Проверьте правильность заполнения полей");
        return;
      }
      this.isSubmitting = true;
      if (this.submitButton) {
        this.submitButton.disabled = true;
        this.submitButton.textContent = "⏳ Создание...";
      }
      try {
        const data = this.collectFormData();
        await this.props.onSubmit(data);
        if (this.props.onSuccess) {
          this.props.onSuccess();
        }
      } catch (error) {
        console.error("[TransferForm] Submit error:", error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          alert("Ошибка при создании перевода");
        }
      } finally {
        this.isSubmitting = false;
        if (this.submitButton) {
          this.submitButton.disabled = false;
          this.submitButton.textContent = "✅ Создать перевод";
        }
      }
    }
    /**
     * Get the rendered form element
     */
    getElement() {
      return this.form;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.dateInput?.destroy();
      this.fromFcSelect.destroy();
      this.fromArticleSelect.destroy();
      this.fromCcSelect.destroy();
      this.toFcSelect.destroy();
      this.toArticleSelect.destroy();
      this.toCcSelect.destroy();
      this.amountInput.destroy();
      this.descriptionInput.destroy();
      if (this.form) {
        this.form.remove();
        this.form = null;
      }
      this.submitButton = null;
    }
  }
  class RecurringPlanForm {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.form = null;
      this.recordTypeButtons = /* @__PURE__ */ new Map();
      this.submitButton = null;
      this.isSubmitting = false;
      this.startDateInput = new DateInput({
        name: "start_date",
        value: props.initialData?.start_date,
        required: true,
        quickButtons: [
          { label: "Сегодня", offset: 0 },
          { label: "Завтра", offset: 1 },
          { label: "Послезавтра", offset: 2 }
        ]
      });
      this.financialCenterSelect = new FinancialCenterSelect({
        name: "financial_center_id",
        value: props.initialData?.financial_center_id,
        required: true,
        onChange: (fcId) => this.articleSelect.updateFinancialCenter(fcId)
      });
      this.articleSelect = new ArticleSelect({
        name: "article_id",
        articleType: props.initialData?.record_type || "expense",
        financialCenterId: props.initialData?.financial_center_id,
        value: props.initialData?.article_id,
        required: true
      });
      this.costCenterSelect = new CostCenterSelect({
        name: "cost_center_id",
        value: props.initialData?.cost_center_id || void 0,
        required: false
      });
      this.amountInput = new AmountInput({
        name: "amount",
        value: props.initialData?.amount,
        min: 1,
        step: 1,
        required: true,
        placeholder: "0"
      });
      this.descriptionInput = new TextareaInput({
        name: "description",
        value: props.initialData?.description,
        placeholder: "Описание платежа",
        rows: 2
      });
      this.recurringSettings = new RecurringPlanSettings({
        name: "recurring",
        frequencyType: props.initialData?.frequency_type,
        frequencyValue: props.initialData?.frequency_value,
        endDate: props.initialData?.end_date || null
      });
      this.reminderSettings = new ReminderSettings({
        name: "reminder",
        enabled: props.initialData?.reminder_enabled || false,
        datetime: props.initialData?.reminder_datetime || void 0,
        message: props.initialData?.reminder_message || void 0
      });
    }
    /**
     * Initialize the form
     */
    async initialize() {
      this.render();
      await Promise.all([
        this.financialCenterSelect.loadOptions(),
        this.costCenterSelect.loadOptions()
      ]);
    }
    /**
     * Render the complete form
     */
    render() {
      if (typeof this.props.container === "string") {
        this.container = document.querySelector(this.props.container);
      } else {
        this.container = this.props.container;
      }
      if (!this.container) {
        throw new Error(`Container not found: ${this.props.container}`);
      }
      this.form = document.createElement("form");
      this.form.className = "space-y-2";
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      const startDateField = new FormField({
        label: "Дата начала",
        name: "start_date",
        required: true,
        children: this.startDateInput.render()
      });
      this.form.appendChild(startDateField.render());
      const fcField = new FormField({
        label: "Счет",
        name: "financial_center_id",
        required: true,
        children: this.financialCenterSelect.render()
      });
      this.form.appendChild(fcField.render());
      this.form.appendChild(this.createRecordTypeField());
      const articleField = new FormField({
        label: "Категория",
        name: "article_id",
        required: true,
        children: this.articleSelect.render()
      });
      this.form.appendChild(articleField.render());
      const ccField = new FormField({
        label: "Место затрат",
        name: "cost_center_id",
        required: false,
        children: this.costCenterSelect.render()
      });
      this.form.appendChild(ccField.render());
      const amountField = new FormField({
        label: "Сумма",
        name: "amount",
        required: true,
        children: this.amountInput.render()
      });
      this.form.appendChild(amountField.render());
      const descField = new FormField({
        label: "Описание",
        name: "description",
        required: false,
        children: this.descriptionInput.render()
      });
      this.form.appendChild(descField.render());
      const recurringSection = document.createElement("div");
      recurringSection.className = "border border-primary/20 rounded-lg p-3 bg-primary/5";
      const recurringHeader = document.createElement("h4");
      recurringHeader.className = "font-semibold text-primary text-sm mb-3";
      recurringHeader.textContent = "🔄 Настройки повторения";
      recurringSection.appendChild(recurringHeader);
      recurringSection.appendChild(this.recurringSettings.render());
      this.form.appendChild(recurringSection);
      const reminderSection = document.createElement("div");
      reminderSection.className = "border border-warning/20 rounded-lg p-3 bg-warning/5";
      const reminderHeader = document.createElement("h4");
      reminderHeader.className = "font-semibold text-warning text-sm mb-3";
      reminderHeader.textContent = "🔔 Напоминание";
      reminderSection.appendChild(reminderHeader);
      reminderSection.appendChild(this.reminderSettings.render());
      this.form.appendChild(reminderSection);
      const actions = document.createElement("div");
      actions.className = "modal-action mt-3";
      this.submitButton = document.createElement("button");
      this.submitButton.type = "submit";
      this.submitButton.className = "btn btn-sm btn-primary";
      this.submitButton.textContent = this.props.mode === "create" ? "✅ Создать план" : "💾 Обновить план";
      actions.appendChild(this.submitButton);
      this.form.appendChild(actions);
      this.container.appendChild(this.form);
    }
    /**
     * Create record type radio buttons
     */
    createRecordTypeField() {
      const field = document.createElement("div");
      field.className = "form-control";
      const label = document.createElement("label");
      label.className = "label py-1";
      label.innerHTML = '<span class="label-text font-semibold">Тип операции *</span>';
      field.appendChild(label);
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-2 gap-2";
      const expenseLabel = document.createElement("label");
      expenseLabel.className = `btn btn-sm btn-outline btn-error ${this.props.initialData?.record_type === "expense" || !this.props.initialData ? "btn-active" : ""}`;
      const expenseInput = document.createElement("input");
      expenseInput.type = "radio";
      expenseInput.name = "record_type";
      expenseInput.value = "expense";
      expenseInput.className = "hidden";
      expenseInput.checked = this.props.initialData?.record_type === "expense" || !this.props.initialData;
      expenseInput.addEventListener("change", () => this.handleRecordTypeChange("expense"));
      expenseLabel.appendChild(expenseInput);
      expenseLabel.appendChild(document.createTextNode("Расход"));
      this.recordTypeButtons.set("expense", expenseLabel);
      grid.appendChild(expenseLabel);
      const incomeLabel = document.createElement("label");
      incomeLabel.className = `btn btn-sm btn-outline btn-success ${this.props.initialData?.record_type === "income" ? "btn-active" : ""}`;
      const incomeInput = document.createElement("input");
      incomeInput.type = "radio";
      incomeInput.name = "record_type";
      incomeInput.value = "income";
      incomeInput.className = "hidden";
      incomeInput.checked = this.props.initialData?.record_type === "income";
      incomeInput.addEventListener("change", () => this.handleRecordTypeChange("income"));
      incomeLabel.appendChild(incomeInput);
      incomeLabel.appendChild(document.createTextNode("Доход"));
      this.recordTypeButtons.set("income", incomeLabel);
      grid.appendChild(incomeLabel);
      field.appendChild(grid);
      return field;
    }
    /**
     * Handle record type change
     */
    handleRecordTypeChange(type) {
      this.recordTypeButtons.forEach((button, buttonType) => {
        if (buttonType === type) {
          button.classList.add("btn-active");
        } else {
          button.classList.remove("btn-active");
        }
      });
      this.articleSelect.updateType(type);
    }
    /**
     * Validate the entire form
     */
    validate() {
      const validations = [
        this.startDateInput.validate(),
        this.financialCenterSelect.validate(),
        this.articleSelect.validate(),
        this.amountInput.validate(),
        this.descriptionInput.validate(),
        this.recurringSettings.validate(),
        this.reminderSettings.validate()
      ];
      for (const validation of validations) {
        if (!validation.valid) {
          return validation;
        }
      }
      return { valid: true };
    }
    /**
     * Collect form data
     */
    collectFormData() {
      const recordTypeInput = this.form?.querySelector('input[name="record_type"]:checked');
      const recurringData = this.recurringSettings.getValue();
      const reminderData = this.reminderSettings.getValue();
      return {
        id: this.props.initialData?.id,
        start_date: this.startDateInput.getValue(),
        financial_center_id: this.financialCenterSelect.getValue(),
        record_type: recordTypeInput?.value || "expense",
        article_id: this.articleSelect.getValue(),
        cost_center_id: this.costCenterSelect.getValue(),
        amount: this.amountInput.getValue(),
        description: this.descriptionInput.getValue() || void 0,
        frequency_type: recurringData.frequencyType,
        frequency_value: recurringData.frequencyValue,
        end_date: recurringData.endDate,
        reminder_enabled: reminderData.enabled,
        reminder_datetime: reminderData.datetime,
        reminder_message: reminderData.message
      };
    }
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
      event.preventDefault();
      if (this.isSubmitting) {
        return;
      }
      const validation = this.validate();
      if (!validation.valid) {
        alert(validation.error || "Проверьте правильность заполнения полей");
        return;
      }
      this.isSubmitting = true;
      if (this.submitButton) {
        this.submitButton.disabled = true;
        this.submitButton.textContent = "⏳ Сохранение...";
      }
      try {
        const data = this.collectFormData();
        await this.props.onSubmit(data);
        if (this.props.onSuccess) {
          this.props.onSuccess();
        }
      } catch (error) {
        console.error("[RecurringPlanForm] Submit error:", error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          alert("Ошибка при сохранении плана");
        }
      } finally {
        this.isSubmitting = false;
        if (this.submitButton) {
          this.submitButton.disabled = false;
          this.submitButton.textContent = this.props.mode === "create" ? "✅ Создать план" : "💾 Обновить план";
        }
      }
    }
    /**
     * Get the rendered form element
     */
    getElement() {
      return this.form;
    }
    /**
     * Destroy the component
     */
    destroy() {
      this.startDateInput.destroy();
      this.financialCenterSelect.destroy();
      this.articleSelect.destroy();
      this.costCenterSelect.destroy();
      this.amountInput.destroy();
      this.descriptionInput.destroy();
      this.recurringSettings.destroy();
      this.reminderSettings.destroy();
      if (this.form) {
        this.form.remove();
        this.form = null;
      }
      this.recordTypeButtons.clear();
      this.submitButton = null;
    }
  }
  class AdminCrudForm {
    constructor(props) {
      this.props = props;
      this.container = null;
      this.form = null;
      this.fields = /* @__PURE__ */ new Map();
      this.submitButton = null;
      this.isSubmitting = false;
    }
    /**
     * Initialize and render the form
     */
    async render(container) {
      this.container = container;
      await this.loadAsyncOptions();
      this.form = document.createElement("form");
      this.form.className = "space-y-2 sm:space-y-4";
      this.form.addEventListener("submit", (e) => this.handleSubmit(e));
      for (const fieldDef of this.props.fields) {
        const fieldComponent = this.createField(fieldDef);
        if (fieldComponent) {
          this.fields.set(fieldDef.name, fieldComponent);
          if (fieldComponent.fieldWrapper) {
            this.form.appendChild(fieldComponent.fieldWrapper.render());
          } else if (fieldComponent.component instanceof HTMLElement) {
            this.form.appendChild(fieldComponent.component);
          }
        }
      }
      const actions = document.createElement("div");
      actions.className = "modal-action";
      this.submitButton = document.createElement("button");
      this.submitButton.type = "submit";
      this.submitButton.className = "btn btn-sm sm:btn-md btn-primary flex-1 sm:flex-initial";
      this.submitButton.textContent = this.props.mode === "create" ? "✅ Создать" : "✅ Сохранить";
      actions.appendChild(this.submitButton);
      this.form.appendChild(actions);
      this.container.appendChild(this.form);
    }
    /**
     * Load async options for select fields
     */
    async loadAsyncOptions() {
      const fieldsWithAsync = this.props.fields.filter((field) => field.asyncOptions);
      const promises = fieldsWithAsync.map(async (field) => {
        if (field.asyncOptions) {
          field.options = await field.asyncOptions();
        }
      });
      await Promise.all(promises);
    }
    /**
     * Create a field component based on definition
     */
    createField(def) {
      let component = null;
      let fieldWrapper = null;
      switch (def.type) {
        case "text":
          component = new TextInput({
            name: def.name,
            value: this.props.initialData?.[def.name],
            placeholder: def.placeholder,
            required: def.required,
            maxLength: def.maxLength,
            disabled: def.disabled
          });
          fieldWrapper = new FormField({
            label: def.label,
            name: def.name,
            required: def.required,
            helpText: def.helpText,
            children: component.render()
          });
          break;
        case "textarea":
          component = new TextareaInput({
            name: def.name,
            value: this.props.initialData?.[def.name],
            placeholder: def.placeholder,
            required: def.required,
            maxLength: def.maxLength,
            rows: def.rows,
            disabled: def.disabled
          });
          fieldWrapper = new FormField({
            label: def.label,
            name: def.name,
            required: def.required,
            helpText: def.helpText,
            children: component.render()
          });
          break;
        case "number":
          component = new AmountInput({
            name: def.name,
            value: this.props.initialData?.[def.name],
            min: def.min,
            max: def.max,
            step: def.step,
            required: def.required,
            placeholder: def.placeholder,
            disabled: def.disabled
          });
          fieldWrapper = new FormField({
            label: def.label,
            name: def.name,
            required: def.required,
            helpText: def.helpText,
            children: component.render()
          });
          break;
        case "select":
          component = new SelectDropdown({
            name: def.name,
            value: this.props.initialData?.[def.name]?.toString(),
            options: def.options || [],
            required: def.required,
            disabled: def.disabled
          });
          fieldWrapper = new FormField({
            label: def.label,
            name: def.name,
            required: def.required,
            helpText: def.helpText,
            children: component.render()
          });
          break;
        case "multi-select":
          component = new SelectDropdown({
            name: def.name,
            value: this.props.initialData?.[def.name],
            options: def.options || [],
            multiple: true,
            size: 5,
            required: def.required,
            disabled: def.disabled
          });
          fieldWrapper = new FormField({
            label: def.label,
            name: def.name,
            required: def.required,
            helpText: def.helpText,
            children: component.render()
          });
          break;
        case "checkbox":
          const checkboxContainer = document.createElement("div");
          checkboxContainer.className = "form-control";
          const checkboxLabel = document.createElement("label");
          checkboxLabel.className = "label cursor-pointer";
          const labelText = document.createElement("span");
          labelText.className = "label-text";
          labelText.textContent = def.label;
          component = document.createElement("input");
          component.type = "checkbox";
          component.name = def.name;
          component.className = "checkbox";
          component.checked = this.props.initialData?.[def.name] ?? def.defaultValue ?? false;
          component.disabled = def.disabled || false;
          checkboxLabel.appendChild(labelText);
          checkboxLabel.appendChild(component);
          checkboxContainer.appendChild(checkboxLabel);
          return {
            component: checkboxContainer,
            definition: def,
            fieldWrapper: null
          };
        default:
          console.warn(`[AdminCrudForm] Unknown field type: ${def.type}`);
          return null;
      }
      return { component, definition: def, fieldWrapper };
    }
    /**
     * Validate all fields
     */
    validate() {
      for (const [_, fieldComponent] of this.fields) {
        const { component, definition } = fieldComponent;
        if (definition.type === "checkbox") {
          continue;
        }
        if ("validate" in component && typeof component.validate === "function") {
          const validation = component.validate();
          if (!validation.valid) {
            return validation;
          }
        }
      }
      return { valid: true };
    }
    /**
     * Collect form data
     */
    collectFormData() {
      const data = {};
      if (this.props.mode === "edit" && this.props.initialData?.id) {
        data.id = this.props.initialData.id;
      }
      for (const [fieldName, fieldComponent] of this.fields) {
        const { component, definition } = fieldComponent;
        if (definition.type === "checkbox") {
          const checkbox = component.querySelector('input[type="checkbox"]');
          data[fieldName] = checkbox?.checked ?? false;
        } else if (definition.type === "multi-select") {
          const value = component.getValue();
          data[fieldName] = Array.isArray(value) ? value.filter((v) => v !== "") : [];
        } else if (definition.type === "number") {
          data[fieldName] = component.getValue();
        } else if (definition.type === "select") {
          const value = component.getValue();
          data[fieldName] = value === "" || value === null ? null : value;
        } else {
          const value = component.getValue();
          data[fieldName] = value || void 0;
        }
      }
      return data;
    }
    /**
     * Handle form submission
     */
    async handleSubmit(event) {
      event.preventDefault();
      if (this.isSubmitting) {
        return;
      }
      const validation = this.validate();
      if (!validation.valid) {
        alert(validation.error || "Проверьте правильность заполнения полей");
        return;
      }
      this.isSubmitting = true;
      if (this.submitButton) {
        this.submitButton.disabled = true;
        this.submitButton.textContent = "⏳ Сохранение...";
      }
      try {
        const data = this.collectFormData();
        await this.props.onSubmit(data);
        if (this.props.onSuccess) {
          this.props.onSuccess();
        }
      } catch (error) {
        console.error(`[AdminCrudForm] Submit error for ${this.props.entity}:`, error);
        if (this.props.onError) {
          this.props.onError(error);
        } else {
          alert(`Ошибка при сохранении ${this.props.entity}`);
        }
      } finally {
        this.isSubmitting = false;
        if (this.submitButton) {
          this.submitButton.disabled = false;
          this.submitButton.textContent = this.props.mode === "create" ? "✅ Создать" : "✅ Сохранить";
        }
      }
    }
    /**
     * Update field options dynamically
     */
    updateFieldOptions(fieldName, options) {
      const fieldComponent = this.fields.get(fieldName);
      if (!fieldComponent) {
        console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
        return;
      }
      if (fieldComponent.definition.type === "select" || fieldComponent.definition.type === "multi-select") {
        fieldComponent.component.updateOptions(options);
      }
    }
    /**
     * Set field value programmatically
     */
    setFieldValue(fieldName, value) {
      const fieldComponent = this.fields.get(fieldName);
      if (!fieldComponent) {
        console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
        return;
      }
      const { component, definition } = fieldComponent;
      if (definition.type === "checkbox") {
        const checkbox = component.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !!value;
        }
      } else if ("setValue" in component && typeof component.setValue === "function") {
        component.setValue(value);
      }
    }
    /**
     * Get field value
     */
    getFieldValue(fieldName) {
      const fieldComponent = this.fields.get(fieldName);
      if (!fieldComponent) {
        console.warn(`[AdminCrudForm] Field not found: ${fieldName}`);
        return null;
      }
      const { component, definition } = fieldComponent;
      if (definition.type === "checkbox") {
        const checkbox = component.querySelector('input[type="checkbox"]');
        return checkbox?.checked ?? false;
      } else if ("getValue" in component && typeof component.getValue === "function") {
        return component.getValue();
      }
      return null;
    }
    /**
     * Get the rendered form element
     */
    getElement() {
      return this.form;
    }
    /**
     * Destroy the component
     */
    destroy() {
      for (const [_, fieldComponent] of this.fields) {
        if (fieldComponent.fieldWrapper) {
          fieldComponent.fieldWrapper.destroy();
        }
        if ("destroy" in fieldComponent.component && typeof fieldComponent.component.destroy === "function") {
          fieldComponent.component.destroy();
        }
      }
      if (this.form) {
        this.form.remove();
        this.form = null;
      }
      this.fields.clear();
      this.submitButton = null;
    }
  }
  if (typeof window !== "undefined") {
    window.UIComponents = {
      // Modal functions
      openPGliteDiagnostic,
      // Modal classes
      PGliteDiagnosticModal,
      ConfirmDialog,
      getConfirmDialogHTML,
      BaseModal,
      FormModal,
      CrudModal,
      // Core components
      FormField,
      TextInput,
      TextareaInput,
      AmountInput,
      SelectDropdown,
      DateInput,
      HierarchySelect,
      // Composite components
      FinancialCenterSelect,
      ArticleSelect,
      CostCenterSelect,
      RecurringPlanSettings,
      ReminderSettings,
      // Form components
      TransactionForm,
      TransferForm,
      RecurringPlanForm,
      AdminCrudForm
    };
  }
})(PGlite);
//# sourceMappingURL=components.bundle.js.map
