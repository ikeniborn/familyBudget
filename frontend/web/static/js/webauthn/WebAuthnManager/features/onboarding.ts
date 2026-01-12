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
  console.log('[WEBAUTHN_ONBOARDING] Checking if onboarding modal should be shown...');

  // Check 1: WebAuthn support
  if (!window.PublicKeyCredential) {
    console.log('[WEBAUTHN_ONBOARDING] WebAuthn not supported on this device - skipping');
    return;
  }

  // Check 2: Platform authenticator availability
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    if (!available) {
      console.log('[WEBAUTHN_ONBOARDING] No biometric authenticator available on this device - skipping');
      return;
    }
    console.log('[WEBAUTHN_ONBOARDING] ✓ Biometric authenticator available - continuing check');
  } catch (error) {
    console.error('[WEBAUTHN_ONBOARDING] Error checking authenticator availability:', error);
    return;
  }

  // Check 3: User dismissal
  const state = getState();
  if (state.isDismissed()) {
    console.log('[WEBAUTHN_ONBOARDING] User previously dismissed onboarding - skipping');
    return;
  }

  // Check 4: Page location
  const currentPath = window.location.pathname;
  const shouldCheck = currentPath === '/' || currentPath.includes('/analytics');
  if (!shouldCheck) {
    console.log('[WEBAUTHN_ONBOARDING] Not on dashboard/analytics - skipping check');
    return;
  }

  // Check 5: First page load after login
  const justLoggedIn = sessionStorage.getItem('just_logged_in');
  if (!justLoggedIn) {
    console.log('[WEBAUTHN_ONBOARDING] Not first page load after login - skipping');
    return;
  }

  // Check 6: From 2FA setup (onboarding already shown there)
  const from2faSetup = sessionStorage.getItem('from_2fa_setup_login');
  if (from2faSetup === 'true') {
    console.log('[WEBAUTHN_ONBOARDING] ⊘ Came from 2FA setup - onboarding already shown, skipping');
    sessionStorage.removeItem('from_2fa_setup_login');
    sessionStorage.removeItem('just_logged_in');
    return;
  }

  // Clear the flag (show only once per session)
  sessionStorage.removeItem('just_logged_in');

  // Check 7: WebAuthn status from API
  try {
    console.log('[WEBAUTHN_ONBOARDING] Fetching WebAuthn status from /api/v1/auth/webauthn-status');

    const data = await checkWebAuthnStatus();
    console.log('[WEBAUTHN_ONBOARDING] Status received:', {
      has_credentials: data.has_credentials,
      user_id: data.user_id
    });

    state.setCredentials([]);  // Will be populated from API later if needed

    if (!data.has_credentials) {
      console.log('[WEBAUTHN_ONBOARDING] User has no credentials - showing onboarding modal');
      showOnboardingModal();
    } else {
      console.log('[WEBAUTHN_ONBOARDING] User already has credentials - skipping onboarding');
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
  console.log('[WEBAUTHN_ONBOARDING] User dismissed onboarding');

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
  console.log('[WEBAUTHN_ONBOARDING] User clicked enable - redirecting to security settings');

  const modal = getModal();
  closeModal(modal);

  // Redirect to security settings with WebAuthn onboarding flag
  window.location.href = '/security?webauthn_onboarding=true';
}
