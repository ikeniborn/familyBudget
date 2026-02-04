/**
 * Keyboard shortcuts for modal dialogs
 * Provides Escape to close and Ctrl+Enter to save
 *
 * @module shared/utils/keyboardShortcuts
 */

declare const debugLog: (...args: any[]) => void;

/**
 * Setup keyboard shortcuts for a modal dialog
 * @param modalId - Modal element ID
 * @param saveCallback - Function to call on Ctrl+Enter
 * @param closeCallback - Function to call on Escape
 */
export function setupModalKeyboardShortcuts(
  modalId: string,
  saveCallback: () => void,
  closeCallback: () => void
): () => void {
  const modal = document.getElementById(modalId) as HTMLDialogElement;

  if (!modal) {
    debugLog(`[KeyboardShortcuts] Modal ${modalId} not found`);
    return () => {}; // Return empty cleanup function
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    // Ignore if modal is not open
    if (!modal.open) {
      return;
    }

    // Escape to close
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeCallback();
      return;
    }

    // Ctrl+Enter (or Cmd+Enter on Mac) to save
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      saveCallback();
      return;
    }
  };

  // Attach listener to document (captures all keyboard events)
  document.addEventListener('keydown', handleKeyDown);

  debugLog(`[KeyboardShortcuts] Shortcuts enabled for ${modalId}`);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    debugLog(`[KeyboardShortcuts] Shortcuts removed for ${modalId}`);
  };
}
