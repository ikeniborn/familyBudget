/**
 * WebAuthnState - Core state management for WebAuthn onboarding
 *
 * Responsibilities:
 * - Track dismissal state (localStorage persistence)
 * - Track WebAuthn credentials status
 * - Provide state query methods
 *
 * ZERO external dependencies (core principle)
 */

export interface WebAuthnCredentialData {
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName?: string;
  createdAt?: string;
  lastUsedAt?: string;
}

export class WebAuthnState {
  private dismissed: boolean = false;
  private credentials: WebAuthnCredentialData[] = [];
  private hasCredentials: boolean = false;

  constructor() {
    // Load dismissal state from localStorage
    this.dismissed = localStorage.getItem('webauthn_onboarding_dismissed') === 'true';
  }

  // ============================================================================
  // State Queries
  // ============================================================================

  /**
   * Check if user has dismissed the onboarding modal
   */
  isDismissed(): boolean {
    return this.dismissed || localStorage.getItem('webauthn_onboarding_dismissed') === 'true';
  }

  /**
   * Check if user has registered WebAuthn credentials
   */
  hasWebAuthnCredentials(): boolean {
    return this.hasCredentials;
  }

  /**
   * Get all registered credentials
   */
  getCredentials(): WebAuthnCredentialData[] {
    return [...this.credentials];  // Return copy
  }

  // ============================================================================
  // State Mutations
  // ============================================================================

  /**
   * Set dismissal state and persist to localStorage
   */
  setDismissed(value: boolean): void {
    this.dismissed = value;
    if (value) {
      localStorage.setItem('webauthn_onboarding_dismissed', 'true');
    } else {
      localStorage.removeItem('webauthn_onboarding_dismissed');
    }
  }

  /**
   * Update credentials list
   */
  setCredentials(creds: WebAuthnCredentialData[]): void {
    this.credentials = creds;
    this.hasCredentials = creds.length > 0;
  }

  /**
   * Add a new credential to the list
   */
  addCredential(cred: WebAuthnCredentialData): void {
    this.credentials.push(cred);
    this.hasCredentials = true;
  }

  /**
   * Remove a credential by ID
   */
  removeCredential(credentialId: string): void {
    this.credentials = this.credentials.filter(c => c.credentialId !== credentialId);
    this.hasCredentials = this.credentials.length > 0;
  }

  /**
   * Reset all state (useful for testing)
   */
  reset(): void {
    this.dismissed = false;
    this.credentials = [];
    this.hasCredentials = false;
    localStorage.removeItem('webauthn_onboarding_dismissed');
  }
}

// Singleton instance
let stateInstance: WebAuthnState | null = null;

/**
 * Get the singleton WebAuthnState instance
 */
export function getState(): WebAuthnState {
  if (!stateInstance) {
    stateInstance = new WebAuthnState();
  }
  return stateInstance;
}

/**
 * Reset the state (for testing)
 */
export function resetState(): void {
  if (stateInstance) {
    stateInstance.reset();
  }
  stateInstance = null;
}
