/**
 * WebAuthn Manager - Entry Point
 *
 * Modular TypeScript implementation of WebAuthn onboarding
 * Following listsManager pattern (v7.0.0+)
 *
 * Architecture:
 * - core/: State management (ZERO dependencies)
 * - features/: Onboarding logic
 * - ui/: Modal management
 * - integration/: API client
 * - adapters/: Window exports for inline onclick handlers
 *
 * Usage:
 * ```html
 * <script src="/static/js/webauthn-onboarding.min.js?v=PLACEHOLDER"></script>
 * ```
 *
 * Auto-initializes on DOMContentLoaded + 1000ms delay
 */

// ============================================================================
// Public API Exports
// ============================================================================

export { getState, resetState } from './core/WebAuthnState';
export type { WebAuthnState, WebAuthnCredentialData } from './core/WebAuthnState';

export {
  checkWebAuthnOnboarding,
  dismissOnboarding,
  enableOnboarding
} from './features/onboarding';

export {
  createModal,
  showModal,
  closeModal,
  getModal
} from './ui/modalManager';

export {
  checkWebAuthnStatus
} from './integration/apiClient';
export type { WebAuthnStatusResponse } from './integration/apiClient';

// ============================================================================
// Auto-initialization
// ============================================================================

// Import window exports adapter to register global functions
import './adapters/windowExports';

// Import main onboarding check function
import { checkWebAuthnOnboarding } from './features/onboarding';

/**
 * Initialize WebAuthn onboarding check
 * Defensive pattern: works regardless of when script loads
 */
function initWebAuthnOnboarding(): void {

  // Only show modal if page is visible and focused
  if (document.hidden) {
    document.addEventListener('visibilitychange', function onVisible() {
      if (!document.hidden) {
        document.removeEventListener('visibilitychange', onVisible);
        setTimeout(() => { checkWebAuthnOnboarding(); }, 1000);
      }
    }, { once: true });
    return;
  }

  // 1 second delay to let page fully load
  setTimeout(() => { checkWebAuthnOnboarding(); }, 1000);
}

// Defensive initialization pattern (works if DOM already loaded OR still loading)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWebAuthnOnboarding);
} else {
  // DOM already loaded - execute immediately
  initWebAuthnOnboarding();
}
