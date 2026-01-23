/**
 * PGlite Browser Entry Point
 * Re-exports everything from index.ts and exposes to window.PGlite
 */

// Re-export everything from index.ts
export * from './index';

// Import namespace для window assignment (will be tree-shaken if not needed)
import * as PGliteModule from './index';

// Expose to window global
if (typeof window !== 'undefined') {
  (window as any).PGlite = PGliteModule;
}
