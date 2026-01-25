/**
 * Button State Management Utilities
 * Reusable functions for managing button loading states
 *
 * @module shared/utils/buttonState
 */

/**
 * Set button loading state
 * @param button - Button element to update
 * @param loading - Whether button should be in loading state
 */
export function setButtonLoading(button: HTMLElement | null, loading: boolean): void {
  if (!button) return;

  const btn = button as HTMLButtonElement;
  btn.disabled = loading;

  if (loading) {
    // Save original HTML if not already saved
    if (!btn.dataset.originalHtml) {
      btn.dataset.originalHtml = btn.innerHTML;
    }

    // Show spinner
    const spinner = document.createElement('span');
    spinner.className = 'loading loading-spinner loading-xs';
    btn.replaceChildren(spinner);
  } else {
    // Restore original HTML
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.originalHtml;
    }
  }
}

/**
 * Set multiple buttons loading state
 * @param buttons - Array of button elements
 * @param loading - Whether buttons should be in loading state
 */
export function setButtonsLoading(buttons: HTMLElement[], loading: boolean): void {
  buttons.forEach(btn => setButtonLoading(btn, loading));
}

/**
 * Disable button
 * @param button - Button element to disable
 */
export function disableButton(button: HTMLElement | null): void {
  if (!button) return;
  (button as HTMLButtonElement).disabled = true;
}

/**
 * Enable button
 * @param button - Button element to enable
 */
export function enableButton(button: HTMLElement | null): void {
  if (!button) return;
  (button as HTMLButtonElement).disabled = false;
}
