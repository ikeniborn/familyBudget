/**
 * RTT Measurement Module
 * Tracks round-trip time for slow connection detection
 *
 * Extracted from budgetWSClient.js:1250-1289 (RTT FILTERING + measurement)
 */

import { getState, updateState } from '../core/WSState';

/**
 * Record RTT measurement from pong message
 */
export function recordRTT(rtt: number): void {
  const state = getState();

  // FILTER 1: Skip if navigating (page load window)
  const skipNavigating = state.isNavigating;

  // FILTER 2: Skip anomalous first measurement (> 10000ms = 2 * RTT_THRESHOLD)
  const skipAnomalous =
    state.rttMeasurements.length === 0 && rtt > state.RTT_THRESHOLD * 2;

  if (!skipNavigating && !skipAnomalous) {
    // Store measurement
    const measurements = [...state.rttMeasurements, rtt];

    // Keep only last RTT_WINDOW_SIZE measurements
    if (measurements.length > state.RTT_WINDOW_SIZE) {
      measurements.shift();
    }

    // Calculate rolling average
    const rttRollingAverage =
      measurements.reduce((a, b) => a + b, 0) / measurements.length;

    updateState({
      rttMeasurements: measurements,
      rttRollingAverage,
    });

    // Warn on slow connection
    if (rttRollingAverage > state.RTT_THRESHOLD) {
      console.warn('[BudgetWS] Slow connection detected', {
        avg_rtt: `${Math.round(rttRollingAverage)}ms`,
        threshold: `${state.RTT_THRESHOLD}ms`,
      });
    }
  }
}

/**
 * Reset RTT measurements (on new connection)
 */
export function resetRTT(): void {
  updateState({
    rttMeasurements: [],
    rttRollingAverage: 0,
  });
}

/**
 * Get current RTT rolling average
 */
export function getRTTAverage(): number {
  return getState().rttRollingAverage;
}

/**
 * Check if connection is slow
 */
export function isSlowConnection(): boolean {
  const state = getState();
  return !state.isNavigating && state.rttRollingAverage > state.RTT_THRESHOLD;
}

/**
 * Get RTT measurements history
 */
export function getRTTMeasurements(): number[] {
  return getState().rttMeasurements;
}
