/**
 * PGlite Browser Entry Point
 * Lazy-loaded wrapper with manual chunks for optimal bundle size
 *
 * Architecture:
 * - Main bundle (~80KB): API wrappers, state management, utils
 * - pglite-core chunk (~350KB): @electric-sql/pglite library
 * - pglite-wasm chunk (~7.5MB): PostgreSQL WASM runtime
 *
 * Loading strategy:
 * - Main bundle loads immediately
 * - Core chunk loads on first getPGliteManager() call
 * - WASM chunk loads when database initializes
 */

// Lazy loading state
let pgliteCoreLoaded = false;
let pgliteCorePromise: Promise<any> | null = null;

/**
 * Lazy load PGlite core library
 * Загружает @electric-sql/pglite только при первом обращении
 */
async function loadPGliteCore() {
  if (pgliteCoreLoaded) {
    return pgliteCorePromise;
  }

  if (pgliteCorePromise) {
    return pgliteCorePromise;
  }

  pgliteCorePromise = import('./index').then((module) => {
    pgliteCoreLoaded = true;

    // Expose to window global after loading
    if (typeof window !== 'undefined') {
      (window as any).PGlite = module;
    }

    return module;
  });

  return pgliteCorePromise;
}

// Re-export all named exports from index.ts
// This maintains ES module compatibility for TypeScript imports
export async function getPGliteManager() {
  const module = await loadPGliteCore();
  return module.getPGliteManager();
}

/**
 * Synchronous feature flag getters/setters
 * These access localStorage directly without loading PGlite core
 */
export function isPGliteEnabled(): boolean {
  return localStorage.getItem('enablePGlite') === 'true';
}

export function setPGliteEnabled(enabled: boolean): void {
  localStorage.setItem('enablePGlite', enabled ? 'true' : 'false');

  // Show notification via global showToast (from base.html)
  if (typeof window !== 'undefined' && (window as any).showToast) {
    const message = enabled
      ? 'PGlite включен. Обновите страницу для инициализации offline режима.'
      : 'PGlite отключен. Обновите страницу для online-only режима.';

    (window as any).showToast(message, 'info');
  }
}

export function setPGliteFactsWindow(days: number): void {
  const MIN_FACTS_WINDOW_DAYS = 30;
  const MAX_FACTS_WINDOW_DAYS = 365;

  if (days < MIN_FACTS_WINDOW_DAYS || days > MAX_FACTS_WINDOW_DAYS) {
    throw new Error(`Facts window must be between ${MIN_FACTS_WINDOW_DAYS} and ${MAX_FACTS_WINDOW_DAYS} days`);
  }

  localStorage.setItem('pgliteFactsWindow', days.toString());

  // No reload needed, will apply on next sync
  if (typeof window !== 'undefined' && (window as any).showToast) {
    (window as any).showToast(`Facts window обновлен до ${days} дней`, 'success');
  }
}

// Re-export types (no runtime overhead)
export type { DiagnosticData } from './PGliteManager';
export type * from './core/PGliteState';
export type * from './types/dependencies';
export type * from './types/models';
export type * from './types/errors';
export type * from './types/pglite';

// Create lightweight proxy object для window.PGlite
// Методы загрузят core library при первом вызове
if (typeof window !== 'undefined') {
  (window as any).PGlite = new Proxy({}, {
    get(_target, prop) {
      // Synchronous getters возвращают Promise
      return async (...args: any[]) => {
        const module = await loadPGliteCore();
        const fn = (module as any)[prop];

        if (typeof fn === 'function') {
          return fn(...args);
        }

        return fn;
      };
    }
  });
}
