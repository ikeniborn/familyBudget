/**
 * API Client for WebAuthn endpoints
 *
 * Responsibilities:
 * - Fetch WebAuthn credential status from backend
 * - Type-safe API calls
 *
 * Used by: features/onboarding.ts
 */

export interface WebAuthnStatusResponse {
  has_credentials: boolean;
  user_id: number;
}

/**
 * Check if user has registered WebAuthn credentials
 *
 * @returns Promise with status data
 * @throws Error if API call fails
 */
export async function checkWebAuthnStatus(): Promise<WebAuthnStatusResponse> {
  const response = await fetch('/api/v1/auth/webauthn-status', {
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(`WebAuthn status check failed: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
