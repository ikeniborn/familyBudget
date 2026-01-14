/**
 * WebAuthn Onboarding Feature
 *
 * Responsibilities:
 * - Check if onboarding should be shown
 * - Handle user actions (dismiss, enable)
 * - Coordinate with state, API, and UI modules
 *
 * Main entry point for onboarding flow
 */

import { getState } from '../core/WebAuthnState';
import { checkWebAuthnStatus } from '../integration/apiClient';
import { createModal, showModal, closeModal, getModal } from '../ui/modalManager';

/**
 * Check if WebAuthn onboarding modal should be shown
 *
 * Conditions:
 * 1. WebAuthn API supported
 * 2. Platform authenticator available (TouchID/FaceID/Windows Hello)
 * 3. User hasn't dismissed onboarding
 * 4. On dashboard or analytics page
 * 5. First page load after login
 * 6. Didn't just come from 2FA setup
 * 7. User has no WebAuthn credentials
 */
export async function checkWebAuthnOnboarding(): Promise<void> {

  // Check 1: WebAuthn support
  if (!window.PublicKeyCredential) {
    return;
  }

  // Check 2: Platform authenticator availability
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      return;
    }
  } catch (error) {
    console.error('[WEBAUTHN_ONBOARDING] Error checking authenticator availability:', error);
    return;
  }

  // Check 3: User dismissal
  const state = getState();
  if (state.isDismissed()) {
    return;
  }

  // Check 4: Page location
  const currentPath = window.location.pathname;
  const shouldCheck = currentPath === '/' || currentPath.includes('/analytics');
  if (!shouldCheck) {
    return;
  }

  // Check 5: First page load after login
  const justLoggedIn = sessionStorage.getItem('just_logged_in');
  if (!justLoggedIn) {
    return;
  }

  // Check 6: From 2FA setup (onboarding already shown there)
  const from2faSetup = sessionStorage.getItem('from_2fa_setup_login');
  if (from2faSetup === 'true') {
    sessionStorage.removeItem('from_2fa_setup_login');
    sessionStorage.removeItem('just_logged_in');
    return;
  }

  // Clear the flag (show only once per session)
  sessionStorage.removeItem('just_logged_in');

  // Check 7: WebAuthn status from API
  try {
    const data = await checkWebAuthnStatus();
    state.setCredentials([]);  // Will be populated from API later if needed

    if (!data.has_credentials) {
      showOnboardingModal();
    }

  } catch (error) {
    console.error('[WEBAUTHN_ONBOARDING] Exception during status check:', error);
  }
}

/**
 * Show the onboarding modal
 */
function showOnboardingModal(): void {
  const modal = createModal();
  showModal(modal);
}

/**
 * User dismissed the onboarding modal
 * Called from onclick handler: WebAuthnOnboarding.dismiss()
 */
export function dismissOnboarding(): void {
  const state = getState();
  state.setDismissed(true);

  const modal = getModal();
  closeModal(modal);
}

/**
 * User chose to enable WebAuthn
 * Called from onclick handler: WebAuthnOnboarding.enable()
 */
export function enableOnboarding(): void {
  const modal = getModal();
  closeModal(modal);

  // Redirect to security settings with WebAuthn onboarding flag
  window.location.href = '/security?webauthn_onboarding=true';
}
