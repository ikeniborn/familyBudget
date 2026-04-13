/**
 * Shared helpers for managing HTML5 `required` validation across tabbed modal forms.
 *
 * Problem (BUG #4, 2026-04-13):
 *   Tabbed modals (fact/plan) render both Transaction and Transfer tabs in the DOM
 *   simultaneously, with the inactive tab hidden via `.hidden` class. Both tabs
 *   declare `required` on their form controls in the Jinja templates. When the form
 *   is validated (`checkValidity()` / implicit submit on Enter), Chrome tries to
 *   focus the first invalid control — including those inside the hidden tab — and
 *   logs warnings such as:
 *     "An invalid form control with name='from_financial_center_id' is not focusable."
 *
 * Fix:
 *   Strip `required` from the inactive tab as soon as the modal is shown, and keep
 *   strip/restore symmetric on tab switches and save-time validation. The original
 *   `required` is preserved via a `data-was-required="true"` marker so it can be
 *   restored when the tab becomes active again.
 *
 * @module shared/utils/tabValidation
 */

/**
 * Strip `required` from all fields inside the inactive tab of a tabbed modal.
 * Each stripped field is marked with `data-was-required="true"` so the original
 * state can be restored later via {@link restoreRequiredValidation}.
 *
 * Idempotent: calling it repeatedly with the same active tab is a no-op.
 *
 * @param modalId - DOM id of the modal (e.g. `modal_fact` or `modal_plan`).
 * @param activeTab - Currently active tab; the OTHER tab gets its `required` stripped.
 */
export function disableInactiveTabValidation(
  modalId: string,
  activeTab: 'transaction' | 'transfer'
): void {
  const inactiveTab = activeTab === 'transaction' ? 'transfer' : 'transaction';
  const inactiveFields = document.querySelectorAll(
    `#${modalId}-tab-${inactiveTab} [required]`
  );

  inactiveFields.forEach((field) => {
    field.removeAttribute('required');
    field.setAttribute('data-was-required', 'true');
  });
}

/**
 * Restore `required` on every field previously marked by
 * {@link disableInactiveTabValidation} within the given modal.
 *
 * @param modalId - DOM id of the modal whose marked fields should be restored.
 */
export function restoreRequiredValidation(modalId: string): void {
  const fieldsToRestore = document.querySelectorAll(
    `#${modalId} [data-was-required="true"]`
  );
  fieldsToRestore.forEach((field) => {
    field.setAttribute('required', '');
    field.removeAttribute('data-was-required');
  });
}
