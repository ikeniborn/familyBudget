/**
 * Debug logger for Network Detection Module
 * Silent in production, verbose in DEBUG_MODE
 *
 * @version 3.0.0
 * @date 2026-01-16
 */

/**
 * Network log - only outputs in DEBUG_MODE
 */
export const _networkLog = (window as any).DEBUG_MODE
  ? console.log.bind(console)
  : function(): void {};

/**
 * Network warning - only outputs in DEBUG_MODE
 */
export const _networkWarn = (window as any).DEBUG_MODE
  ? console.warn.bind(console)
  : function(): void {};
