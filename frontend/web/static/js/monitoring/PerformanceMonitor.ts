/**
 * Performance Monitor for tracking Data Layer performance
 *
 * Tracks API vs Dexie call performance with detailed metrics.
 *
 * @example
 * ```typescript
 * import { performanceMonitor } from './PerformanceMonitor';
 *
 * // Track API call
 * performanceMonitor.trackAPICall('getArticles', 150.5);
 *
 * // Track Dexie call
 * performanceMonitor.trackDexieCall('getArticles', 5.2);
 *
 * // Get statistics
 * const stats = performanceMonitor.getStats();
 * // Stats: { reductionPercent: 75.5, speedupFactor: 12.3 }
 * ```
 *
 * @module monitoring/PerformanceMonitor
 */

/**
 * Metrics for a single call type (API or Dexie)
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
 * Performance statistics comparing API and Dexie performance
 */
export interface PerformanceStats {
  /** API call metrics */
  api: CallMetric;
  /** Dexie call metrics */
  dexie: CallMetric;
  /** Percentage reduction in API calls (0-100) */
  reductionPercent: number;
  /** Speedup factor (api avg / dexie avg) */
  speedupFactor: number;
}

/**
 * Module-specific performance breakdown
 */
export interface ModuleBreakdown {
  /** PGlite call count */
  dexie: number;
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
  private dexieMetrics: Map<string, number[]> = new Map();

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
  trackDexieCall(method: string, durationMs: number): void {
    if (!this.dexieMetrics.has(method)) {
      this.dexieMetrics.set(method, []);
    }
    this.dexieMetrics.get(method)!.push(durationMs);
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
    const allDexieDurations = Array.from(this.dexieMetrics.values()).flat();

    const api = this.calculateMetric(allApiDurations);
    const dexie = this.calculateMetric(allDexieDurations);

    const totalCalls = api.count + dexie.count;
    const reductionPercent = totalCalls > 0 ? (1 - api.count / totalCalls) * 100 : 0;

    const speedupFactor =
      api.avgDurationMs > 0 && dexie.avgDurationMs > 0
        ? api.avgDurationMs / dexie.avgDurationMs
        : 1;

    return {
      api,
      dexie,
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
      shoppingLists: { dexie: 0, api: 0, reductionPercent: 0 },
      facts: { dexie: 0, api: 0, reductionPercent: 0 },
      recurringPlans: { dexie: 0, api: 0, reductionPercent: 0 },
      dashboard: { dexie: 0, api: 0, reductionPercent: 0 },
      other: { dexie: 0, api: 0, reductionPercent: 0 }
    };

    // Count calls per module
    const allMethods = new Set([...this.apiMetrics.keys(), ...this.dexieMetrics.keys()]);

    for (const method of allMethods) {
      const module = this.classifyMethod(method);
      breakdown[module].dexie += (this.dexieMetrics.get(method) || []).length;
      breakdown[module].api += (this.apiMetrics.get(method) || []).length;
    }

    // Calculate reduction percent per module
    for (const module of Object.keys(breakdown) as Array<keyof typeof breakdown>) {
      const { dexie, api } = breakdown[module];
      const total = dexie + api;
      breakdown[module].reductionPercent = total > 0 ? parseFloat(((1 - api / total) * 100).toFixed(1)) : 0;
    }

    // Calculate bandwidth saved (assume 5KB per API call)
    const BYTES_PER_API_CALL = 5 * 1024; // 5 KB
    const apiCallsReduced = basicStats.dexie.count;
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
  getMethodStats(): Record<string, { api: CallMetric; dexie: CallMetric }> {
    const methods = new Set([...this.apiMetrics.keys(), ...this.dexieMetrics.keys()]);

    const result: Record<string, { api: CallMetric; dexie: CallMetric }> = {};
    for (const method of methods) {
      result[method] = {
        api: this.calculateMetric(this.apiMetrics.get(method) || []),
        dexie: this.calculateMetric(this.dexieMetrics.get(method) || []),
      };
    }

    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.apiMetrics.clear();
    this.dexieMetrics.clear();
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
