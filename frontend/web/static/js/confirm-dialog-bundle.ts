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

// Window adapter for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).showConfirmDialog = ConfirmDialog.show.bind(ConfirmDialog);
  (window as any).confirmModalResolve = ConfirmDialog.resolve.bind(ConfirmDialog);
  (window as any).ConfirmDialog = ConfirmDialog;
  (window as any).getConfirmDialogHTML = getConfirmDialogHTML;
}

export { ConfirmDialog, getConfirmDialogHTML };
