/**
 * TypeScript type definitions for WebAuthn Manager
 *
 * Extends global types for:
 * - WebAuthn API (PublicKeyCredential)
 * - Window object extensions
 */

// ============================================================================
// WebAuthn API Types (built-in, but ensure they're available)
// ============================================================================

// PublicKeyCredential should be available from lib.dom.d.ts
// This file just ensures the types are recognized

declare global {
  interface PublicKeyCredential extends Credential {
    readonly rawId: ArrayBuffer;
    readonly response: AuthenticatorResponse;
    getClientExtensionResults(): AuthenticationExtensionsClientOutputs;
  }

  interface PublicKeyCredentialStatic {
    isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean>;
    isConditionalMediationAvailable?(): Promise<boolean>;
  }

  const PublicKeyCredential: PublicKeyCredentialStatic;
}

// ============================================================================
// Window Extensions
// ============================================================================

// WebAuthnOnboarding is defined in adapters/windowExports.ts
// This declaration ensures TypeScript recognizes it

declare global {
  interface Window {
    WebAuthnOnboarding: {
      dismiss: () => void;
      enable: () => void;
    };
  }
}

export {};
