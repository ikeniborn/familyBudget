/**
 * Performance Monitor for tracking Data Layer performance
 *
 * Tracks API vs PGlite call performance with detailed metrics.
 *
 * @example
 * ```typescript
 * import { performanceMonitor } from './PerformanceMonitor';
 *
 * // Track API call
 * performanceMonitor.trackAPICall('getArticles', 150.5);
 *
 * // Track PGlite call
 * performanceMonitor.trackPGliteCall('getArticles', 5.2);
 *
 * // Get statistics
 * const stats = performanceMonitor.getStats();
 * // Stats: { reductionPercent: 75.5, speedupFactor: 12.3 }
 * ```
 *
 * @module monitoring/PerformanceMonitor
 */

/**
 * Metrics for a single call type (API or PGlite)
 */
export interface CallMetric {
  /** Total number of calls */
  count: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Average duration in milliseconds */
  avgDurationMs: number;
  /** Minimum duration in milliseconds */
  minDurationMs: number;
  /** Maximum duration in milliseconds */
  maxDurationMs: number;
}

/**
 * Performance statistics comparing API and PGlite performance
 */
export interface PerformanceStats {
  /** API call metrics */
  api: CallMetric;
  /** PGlite call metrics */
  pglite: CallMetric;
  /** Percentage reduction in API calls (0-100) */
  reductionPercent: number;
  /** Speedup factor (api avg / pglite avg) */
  speedupFactor: number;
}

/**
 * Module-specific performance breakdown
 */
export interface ModuleBreakdown {
  /** PGlite call count */
  pglite: number;
  /** API call count */
  api: number;
  /** Reduction percentage for this module */
  reductionPercent: number;
}

/**
 * Detailed performance statistics with module breakdown
 * (task-015 Phase 5)
 */
export interface DetailedPerformanceStats extends PerformanceStats {
  /** Breakdown by module */
  breakdown: {
    shoppingLists: ModuleBreakdown;
    facts: ModuleBreakdown;
    recurringPlans: ModuleBreakdown;
    dashboard: ModuleBreakdown;
    other: ModuleBreakdown;
  };
  /** Total API calls reduced (count) */
  apiCallsReduced: number;
  /** Estimated bandwidth saved in KB (assuming 5KB per API call) */
  totalBandwidthSaved: number;
  /** Average speedup factor across all modules */
  avgSpeedupFactor: number;
}

/**
 * Performance monitor for tracking API and PGlite call performance
 */
export class PerformanceMonitor {
  private apiMetrics: Map<string, number[]> = new Map();
  private pgliteMetrics: Map<string, number[]> = new Map();

  /**
   * Track an API call
   *
   * @param method - Method name (e.g., 'getArticles')
   * @param durationMs - Call duration in milliseconds
   */
  trackAPICall(method: string, durationMs: number): void {
    if (!this.apiMetrics.has(method)) {
      this.apiMetrics.set(method, []);
    }
    this.apiMetrics.get(method)!.push(durationMs);
  }

  /**
   * Track a PGlite call
   *
   * @param method - Method name (e.g., 'getArticles')
   * @param durationMs - Call duration in milliseconds
   */
  trackPGliteCall(method: string, durationMs: number): void {
    if (!this.pgliteMetrics.has(method)) {
      this.pgliteMetrics.set(method, []);
    }
    this.pgliteMetrics.get(method)!.push(durationMs);
  }

  /**
   * Calculate metrics for a set of durations
   *
   * @param durations - Array of call durations in milliseconds
   * @returns Call metrics
   */
  private calculateMetric(durations: number[]): CallMetric {
    if (durations.length === 0) {
      return {
        count: 0,
        totalDurationMs: 0,
        avgDurationMs: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
      };
    }

    const total = durations.reduce((a, b) => a + b, 0);
    return {
      count: durations.length,
      totalDurationMs: total,
      avgDurationMs: total / durations.length,
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
    };
  }

  /**
   * Get overall performance statistics
   *
   * @returns Performance statistics comparing API and PGlite
   */
  getStats(): PerformanceStats {
    // Flatten all metrics
    const allApiDurations = Array.from(this.apiMetrics.values()).flat();
    const allPgliteDurations = Array.from(this.pgliteMetrics.values()).flat();

    const api = this.calculateMetric(allApiDurations);
    const pglite = this.calculateMetric(allPgliteDurations);

    const totalCalls = api.count + pglite.count;
    const reductionPercent = totalCalls > 0 ? (1 - api.count / totalCalls) * 100 : 0;

    const speedupFactor =
      api.avgDurationMs > 0 && pglite.avgDurationMs > 0
        ? api.avgDurationMs / pglite.avgDurationMs
        : 1;

    return {
      api,
      pglite,
      reductionPercent: parseFloat(reductionPercent.toFixed(1)),
      speedupFactor: parseFloat(speedupFactor.toFixed(1)),
    };
  }

  /**
   * Classify method by module
   * (task-015 Phase 5)
   *
   * @param method - Method name
   * @returns Module name
   */
  private classifyMethod(method: string): keyof DetailedPerformanceStats['breakdown'] {
    const lower = method.toLowerCase();

    if (lower.includes('shopping') || lower.includes('store') || lower.includes('productgroup')) {
      return 'shoppingLists';
    }

    if (lower.includes('fact') || lower.includes('transfer')) {
      return 'facts';
    }

    if (lower.includes('recurring') || lower.includes('plan')) {
      return 'recurringPlans';
    }

    if (lower.includes('dashboard') || lower.includes('quickstat') || lower.includes('balance')) {
      return 'dashboard';
    }

    return 'other';
  }

  /**
   * Get detailed statistics with module breakdown
   * (task-015 Phase 5)
   *
   * @returns Detailed performance statistics
   */
  getDetailedStats(): DetailedPerformanceStats {
    const basicStats = this.getStats();

    // Initialize breakdown
    const breakdown: DetailedPerformanceStats['breakdown'] = {
      shoppingLists: { pglite: 0, api: 0, reductionPercent: 0 },
      facts: { pglite: 0, api: 0, reductionPercent: 0 },
      recurringPlans: { pglite: 0, api: 0, reductionPercent: 0 },
      dashboard: { pglite: 0, api: 0, reductionPercent: 0 },
      other: { pglite: 0, api: 0, reductionPercent: 0 }
    };

    // Count calls per module
    const allMethods = new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);

    for (const method of allMethods) {
      const module = this.classifyMethod(method);
      breakdown[module].pglite += (this.pgliteMetrics.get(method) || []).length;
      breakdown[module].api += (this.apiMetrics.get(method) || []).length;
    }

    // Calculate reduction percent per module
    for (const module of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
      const { pglite, api } = breakdown[module];
      const total = pglite + api;
      breakdown[module].reductionPercent = total > 0 ? parseFloat(((1 - api / total) * 100).toFixed(1)) : 0;
    }

    // Calculate bandwidth saved (assume 5KB per API call)
    const BYTES_PER_API_CALL = 5 * 1024; // 5 KB
    const apiCallsReduced = basicStats.pglite.count;
    const totalBandwidthSaved = parseFloat(((apiCallsReduced * BYTES_PER_API_CALL) / 1024).toFixed(1)); // KB

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
  getMethodStats(): Record<string, { api: CallMetric; pglite: CallMetric }> {
    const methods = new Set([...this.apiMetrics.keys(), ...this.pgliteMetrics.keys()]);

    const result: Record<string, { api: CallMetric; pglite: CallMetric }> = {};
    for (const method of methods) {
      result[method] = {
        api: this.calculateMetric(this.apiMetrics.get(method) || []),
        pglite: this.calculateMetric(this.pgliteMetrics.get(method) || []),
      };
    }

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.apiMetrics.clear();
    this.pgliteMetrics.clear();
  }
}

/**
 * Global singleton performance monitor
 */
export const performanceMonitor = new PerformanceMonitor();

/**
 * Expose to window for debugging
 */
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}
