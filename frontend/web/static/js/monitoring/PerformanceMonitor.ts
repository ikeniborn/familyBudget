/**
 * Performance Monitor for tracking API call performance.
 *
 * @example
 * ```typescript
 * import { performanceMonitor } from './PerformanceMonitor';
 *
 * // Track API call
 * performanceMonitor.trackAPICall('getArticles', 150.5);
 *
 * // Get statistics
 * const stats = performanceMonitor.getStats();
 * ```
 *
 * @module monitoring/PerformanceMonitor
 */

/**
 * Metrics for a single call type
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
 * Performance statistics for API calls
 */
export interface PerformanceStats {
  /** API call metrics */
  api: CallMetric;
}

/**
 * Performance monitor for tracking API call performance
 */
export class PerformanceMonitor {
  private apiMetrics: Map<string, number[]> = new Map();

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
   * @returns Performance statistics for API calls
   */
  getStats(): PerformanceStats {
    const allApiDurations = Array.from(this.apiMetrics.values()).flat();
    const api = this.calculateMetric(allApiDurations);
    return { api };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.apiMetrics.clear();
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
