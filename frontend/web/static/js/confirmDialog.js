/**
 * Custom Confirmation Dialog
 *
 * Replaces browser's native confirm() to avoid "Do not show again" checkbox issue.
 *
 * Usage:
 *   const confirmed = await showConfirmDialog('Delete this item?', 'Confirm Delete');
 *   if (confirmed) { ... }
 */

let confirmModalResolveCallback = null;

/**
 * Show custom confirmation dialog
 * @param {string} message - Message to display
 * @param {string} title - Dialog title (default: 'Подтверждение')
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled
 */
function showConfirmDialog(message, title = 'Подтверждение') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');

        if (!modal || !titleEl || !messageEl) {
            console.error('Confirm dialog elements not found in DOM');
            // Fallback to native confirm
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = title;
        messageEl.textContent = message;
        confirmModalResolveCallback = resolve;

        modal.showModal();
    });
}

/**
 * Internal function to resolve confirmation dialog promise
 * @param {boolean} result - User's choice (true = confirmed, false = cancelled)
 */
function confirmModalResolve(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) {
        modal.close();
    }

    if (confirmModalResolveCallback) {
        confirmModalResolveCallback(result);
        confirmModalResolveCallback = null;
    }
}

/**
 * Get HTML for confirmation dialog modal
 * Call this function to get the modal HTML and insert it into your page
 * @returns {string} - HTML string for confirmation dialog
 */
function getConfirmDialogHTML() {
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
