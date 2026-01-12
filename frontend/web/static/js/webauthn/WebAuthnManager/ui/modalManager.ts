/**
 * Modal Manager for WebAuthn Onboarding
 *
 * Responsibilities:
 * - Create modal HTML dynamically
 * - Show/hide modal
 * - Manage modal lifecycle
 *
 * Used by: features/onboarding.ts
 */

const MODAL_ID = 'webauthn-onboarding-modal';

/**
 * Create the WebAuthn onboarding modal HTML and append to body
 *
 * @returns HTMLDialogElement reference
 */
export function createModal(): HTMLDialogElement | null {
  // Check if modal already exists
  const existing = document.getElementById(MODAL_ID);
  if (existing) {
    return existing as HTMLDialogElement;
  }

  const modalHTML = `
    <dialog id="${MODAL_ID}" class="modal">
      <div class="modal-box">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          Включить быстрый вход?
        </h3>
        <p class="py-4">
          Используйте отпечаток пальца или Face ID для быстрого и безопасного входа без пароля.
        </p>
        <ul class="list-disc list-inside text-sm opacity-70 space-y-1 mb-4">
          <li>Вход за секунду (без ввода пароля)</li>
          <li>Максимальная безопасность (криптографическая защита)</li>
          <li>Работает на iPhone, iPad, Android, Mac, Windows</li>
        </ul>
        <div class="modal-action">
          <button onclick="WebAuthnOnboarding.dismiss()" class="btn btn-ghost">
            Позже
          </button>
          <button onclick="WebAuthnOnboarding.enable()" class="btn btn-primary">
            Включить биометрию
          </button>
        </div>
      </div>
    </dialog>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  return document.getElementById(MODAL_ID) as HTMLDialogElement;
}

/**
 * Show the modal dialog
 *
 * @param modal - HTMLDialogElement to show
 */
export function showModal(modal: HTMLDialogElement | null): void {
  if (!modal) {
    console.error('[WEBAUTHN_MODAL] Modal element not found');
    return;
  }

  console.log('[WEBAUTHN_ONBOARDING] Showing onboarding modal');
  modal.showModal();
}

/**
 * Close the modal dialog
 *
 * @param modal - HTMLDialogElement to close
 */
export function closeModal(modal: HTMLDialogElement | null): void {
  if (!modal) {
    console.error('[WEBAUTHN_MODAL] Modal element not found');
    return;
  }

  console.log('[WEBAUTHN_ONBOARDING] Closing onboarding modal');
  modal.close();
}

/**
 * Get existing modal element
 *
 * @returns HTMLDialogElement or null
 */
export function getModal(): HTMLDialogElement | null {
  return document.getElementById(MODAL_ID) as HTMLDialogElement | null;
}
