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
   * Get detailed statistics per method
   *
   * @returns Per-method statistics
   */
  getDetailedStats(): Record<string, { api: CallMetric; pglite: CallMetric }> {
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
