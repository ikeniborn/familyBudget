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

export async function setPGliteEnabled(enabled: boolean) {
  const module = await loadPGliteCore();
  return module.setPGliteEnabled(enabled);
}

export async function isPGliteEnabled() {
  const module = await loadPGliteCore();
  return module.isPGliteEnabled();
}

export async function setPGliteFactsWindow(days: number) {
  const module = await loadPGliteCore();
  return module.setPGliteFactsWindow(days);
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
