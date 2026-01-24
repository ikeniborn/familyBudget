(function() {
  "use strict";
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
      const pglite = this.calculateMetric(allPgliteDurations);
      const totalCalls = api.count + pglite.count;
      const reductionPercent = totalCalls > 0 ? (1 - api.count / totalCalls) * 100 : 0;
      const speedupFactor = api.avgDurationMs > 0 && pglite.avgDurationMs > 0 ? api.avgDurationMs / pglite.avgDurationMs : 1;
      return {
        api,
        pglite,
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
        const { pglite, api } = breakdown[module];
        const total = pglite + api;
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
})();
//# sourceMappingURL=components.bundle.js.map
