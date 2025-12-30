// WebAuthn Onboarding Flow
// Automatically checks if user should be prompted to enable biometric authentication

async function checkWebAuthnOnboarding() {
    console.log('[WEBAUTHN_ONBOARDING] Checking if onboarding modal should be shown...');

    // Check if WebAuthn is supported
    if (!window.PublicKeyCredential) {
        console.log('[WEBAUTHN_ONBOARDING] WebAuthn not supported on this device - skipping');
        return;
    }

    // Check if platform authenticator (biometric) is available
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

    // Check if user already dismissed onboarding (local storage flag)
    const dismissed = localStorage.getItem('webauthn_onboarding_dismissed');
    if (dismissed === 'true') {
        console.log('[WEBAUTHN_ONBOARDING] User previously dismissed onboarding - skipping');
        return;
    }

    // Check if we're on a page that should show onboarding (dashboard or after login)
    const currentPath = window.location.pathname;
    const shouldCheck = currentPath === '/' || currentPath.includes('/analytics');

    if (!shouldCheck) {
        console.log('[WEBAUTHN_ONBOARDING] Not on dashboard/analytics - skipping check');
        return;
    }

    // Check if this is first page load after login (via sessionStorage flag)
    const justLoggedIn = sessionStorage.getItem('just_logged_in');
    if (!justLoggedIn) {
        console.log('[WEBAUTHN_ONBOARDING] Not first page load after login - skipping');
        return;
    }

    // Check if user came from 2FA setup (onboarding already shown there)
    const from2faSetup = sessionStorage.getItem('from_2fa_setup_login');
    if (from2faSetup === 'true') {
        console.log('[WEBAUTHN_ONBOARDING] ⊘ Came from 2FA setup - onboarding already shown, skipping');
        sessionStorage.removeItem('from_2fa_setup_login');
        sessionStorage.removeItem('just_logged_in');
        return;
    }

    // Clear the flag (show only once per session)
    sessionStorage.removeItem('just_logged_in');

    try {
        // Check WebAuthn status
        console.log('[WEBAUTHN_ONBOARDING] Fetching WebAuthn status from /api/v1/auth/webauthn-status');
        console.log('[WEBAUTHN_ONBOARDING] Request headers: credentials=include');

        const response = await fetch('/api/v1/auth/webauthn-status', {
            credentials: 'include'
        });

        console.log('[WEBAUTHN_ONBOARDING] Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });

        if (!response.ok) {
            console.error(
                '[WEBAUTHN_ONBOARDING] Failed to fetch status:',
                {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.url
                }
            );

            // Try to read error response body
            try {
                const errorData = await response.json();
                console.error('[WEBAUTHN_ONBOARDING] Error details:', errorData);
            } catch (e) {
                console.error('[WEBAUTHN_ONBOARDING] Could not parse error response');
            }

            return;
        }

        const data = await response.json();
        console.log('[WEBAUTHN_ONBOARDING] Status received:', {
            has_credentials: data.has_credentials,
            user_id: data.user_id
        });

        if (!data.has_credentials) {
            console.log('[WEBAUTHN_ONBOARDING] User has no credentials - showing onboarding modal');
            showWebAuthnOnboardingModal();
        } else {
            console.log('[WEBAUTHN_ONBOARDING] User already has credentials (credential_count: N/A) - skipping onboarding');
        }

    } catch (error) {
        console.error('[WEBAUTHN_ONBOARDING] Exception during status check:', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
    }
}

function showWebAuthnOnboardingModal() {
    console.log('[WEBAUTHN_ONBOARDING] Showing onboarding modal');

    // Create modal if not exists
    let modal = document.getElementById('webauthn-onboarding-modal');
    if (!modal) {
        const modalHTML = `
            <dialog id="webauthn-onboarding-modal" class="modal">
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
                        <button onclick="dismissWebAuthnOnboarding()" class="btn btn-ghost">
                            Позже
                        </button>
                        <button onclick="enableWebAuthnFromOnboarding()" class="btn btn-primary">
                            Включить биометрию
                        </button>
                    </div>
                </div>
            </dialog>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('webauthn-onboarding-modal');
    }

    modal.showModal();
}

function dismissWebAuthnOnboarding() {
    console.log('[WEBAUTHN_ONBOARDING] User dismissed onboarding');
    localStorage.setItem('webauthn_onboarding_dismissed', 'true');
    document.getElementById('webauthn-onboarding-modal').close();
}

async function enableWebAuthnFromOnboarding() {
    console.log('[WEBAUTHN_ONBOARDING] User clicked enable - redirecting to security settings');
    document.getElementById('webauthn-onboarding-modal').close();

    // Redirect to security settings with WebAuthn onboarding flag
    window.location.href = '/security?webauthn_onboarding=true';
}

// Run check on page load (if user just logged in)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkWebAuthnOnboarding, 1000); // 1 second delay to let page load
});
