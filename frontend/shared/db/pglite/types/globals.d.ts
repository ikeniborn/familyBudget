/**
 * Global type definitions for window object
 * Provides type-safe access to global functions defined in base.html
 */

/**
 * Toast notification type
 * Matches DaisyUI alert types
 */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/**
 * Global window interface extensions
 */
declare global {
  interface Window {
    /**
     * Show toast notification (defined in base.html)
     *
     * @param message - Message to display
     * @param type - Toast type (info, success, warning, error)
     *
     * @example
     * ```typescript
     * window.showToast('PGlite enabled', 'success');
     * ```
     */
    showToast?: (message: string, type: ToastType) => void;
  }
}

// This export is required for TypeScript to treat this file as a module
export {};
