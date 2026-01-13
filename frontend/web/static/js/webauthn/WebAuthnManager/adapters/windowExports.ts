/**
 * Window Exports Adapter
 *
 * Responsibilities:
 * - Expose WebAuthn functions to global window scope
 * - Enable inline onclick handlers to work
 *
 * This adapter is necessary because modal HTML uses:
 * - onclick="WebAuthnOnboarding.dismiss()"
 * - onclick="WebAuthnOnboarding.enable()"
 *
 * Functions must be globally accessible for these handlers to work.
 */

import { dismissOnboarding, enableOnboarding } from '../features/onboarding';

// Extend Window interface to include WebAuthnOnboarding
declare global {
  interface Window {
    WebAuthnOnboarding: {
      dismiss: () => void;
      enable: () => void;
    };
  }
}

// Expose functions globally
window.WebAuthnOnboarding = {
  dismiss: dismissOnboarding,
  enable: enableOnboarding
};
