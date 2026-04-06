/**
 * ConfirmDialog - Standalone confirmation dialog component
 *
 * Replaces browser's native confirm() to avoid "Do not show again" checkbox issue.
 * Uses existing #confirm-modal DOM element (not BaseModal composition).
 *
 * @module uiComponents/modals/ConfirmDialog
 * @version 1.0.0
 *
 * @example
 * ```typescript
 * // Promise-based usage
 * const confirmed = await ConfirmDialog.show('Delete this item?', 'Confirm Delete');
 * if (confirmed) { ... }
 *
 * // From onclick handler (HTML)
 * onclick="ConfirmDialog.resolve(true)"
 * ```
 */

export interface ConfirmDialogOptions {
  modalId?: string;
}

/**
 * Singleton confirmation dialog manager
 *
 * Uses existing DOM elements:
 * - #confirm-modal (dialog element)
 * - #confirm-title (title text)
 * - #confirm-message (message text)
 */
export class ConfirmDialog {
  private static instance: ConfirmDialog | null = null;
  private pendingResolve: ((value: boolean) => void) | null = null;
  private readonly modalId: string;

  private constructor(modalId = 'confirm-modal') {
    this.modalId = modalId;
  }

  /**
   * Get singleton instance
   */
  static getInstance(modalId = 'confirm-modal'): ConfirmDialog {
    if (!ConfirmDialog.instance || ConfirmDialog.instance.modalId !== modalId) {
      ConfirmDialog.instance = new ConfirmDialog(modalId);
    }
    return ConfirmDialog.instance;
  }

  /**
   * Show confirmation dialog
   *
   * @param message - Message to display
   * @param title - Dialog title (default: 'Подтверждение')
   * @returns Promise resolving to true if confirmed, false if cancelled
   */
  static show(message: string, title = 'Подтверждение'): Promise<boolean> {
    return new Promise((resolve) => {
      const instance = ConfirmDialog.getInstance();
      const modal = document.getElementById(instance.modalId) as HTMLDialogElement | null;
      const titleEl = document.getElementById('confirm-title');
      const messageEl = document.getElementById('confirm-message');

      if (!modal || !titleEl || !messageEl) {
        console.error('[ConfirmDialog] Elements not found, fallback to native confirm');
        resolve(window.confirm(message));
        return;
      }

      // Cancel any pending dialog before showing new one
      if (instance.pendingResolve) {
        instance.pendingResolve(false);
        instance.pendingResolve = null;
      }

      instance.pendingResolve = resolve;
      titleEl.textContent = title;
      messageEl.textContent = message;
      modal.showModal();
    });
  }

  /**
   * Resolve the pending confirmation dialog
   *
   * @param result - User's choice (true = confirmed, false = cancelled)
   */
  static resolve(result: boolean): void {
    const instance = ConfirmDialog.getInstance();

    if (!instance.pendingResolve) return; // Already resolved

    const modal = document.getElementById(instance.modalId) as HTMLDialogElement | null;

    if (modal) {
      modal.close();
    }

    instance.pendingResolve(result);
    instance.pendingResolve = null;
  }
}

/**
 * Get HTML for confirmation dialog modal
 * Call this function to get the modal HTML and insert it into your page
 *
 * @returns HTML string for confirmation dialog
 *
 * @example
 * ```typescript
 * // Insert dialog into page
 * document.body.insertAdjacentHTML('beforeend', getConfirmDialogHTML());
 * ```
 */
export function getConfirmDialogHTML(): string {
  return `
<!-- Custom Confirmation Dialog -->
<dialog id="confirm-modal" class="modal">
    <div class="modal-box max-w-lg">
        <h3 class="font-bold text-lg mb-4" id="confirm-title">Подтверждение</h3>
        <p class="whitespace-pre-line mb-6" id="confirm-message"></p>
        <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="confirmModalResolve(false)">Отмена</button>
            <button type="button" class="btn btn-error" onclick="confirmModalResolve(true)">Подтвердить</button>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button onclick="confirmModalResolve(false)">close</button>
    </form>
</dialog>
`;
}
