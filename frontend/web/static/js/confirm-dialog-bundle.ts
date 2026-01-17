/**
 * ConfirmDialog Bundle - Entry point for standalone build
 *
 * Creates window adapter for backward compatibility with existing HTML onclick handlers.
 *
 * @module confirm-dialog-bundle
 * @version 1.0.0
 *
 * Window exports:
 * - window.showConfirmDialog(message, title) - Show dialog, returns Promise<boolean>
 * - window.confirmModalResolve(result) - Resolve dialog with result
 * - window.ConfirmDialog - Full class access
 * - window.getConfirmDialogHTML() - Get dialog HTML template
 */

import { ConfirmDialog, getConfirmDialogHTML } from './modules/uiComponents/modals/ConfirmDialog';

// Extend Window interface for type safety (only properties not defined elsewhere)
declare global {
  interface Window {
    confirmModalResolve: typeof ConfirmDialog.resolve;
    ConfirmDialog: typeof ConfirmDialog;
    getConfirmDialogHTML: typeof getConfirmDialogHTML;
  }
}

// Window adapter for backward compatibility
if (typeof window !== 'undefined') {
  // showConfirmDialog type is already defined in lists/listsManager/types/globals.d.ts
  (window as Window & { showConfirmDialog: typeof ConfirmDialog.show }).showConfirmDialog =
    ConfirmDialog.show.bind(ConfirmDialog);
  window.confirmModalResolve = ConfirmDialog.resolve.bind(ConfirmDialog);
  window.ConfirmDialog = ConfirmDialog;
  window.getConfirmDialogHTML = getConfirmDialogHTML;
}

export { ConfirmDialog, getConfirmDialogHTML };
