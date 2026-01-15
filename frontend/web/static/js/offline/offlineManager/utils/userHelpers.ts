/**
 * User Helper Utilities
 * Shared functions for user identification across offline operations
 */

/**
 * Get current user ID using multiple fallback mechanisms
 *
 * Priority order:
 * 1. window.currentUser.id (set by backend template)
 * 2. fetch /api/v1/users/me (API call)
 * 3. throw Error (cannot proceed without user ID)
 *
 * @returns User ID
 * @throws Error if user ID cannot be determined
 *
 * @example
 * ```typescript
 * const userId = await getCurrentUserId();
 * // Returns: 42
 * ```
 */
export async function getCurrentUserId(): Promise<number> {
  // Fallback 1: Try window.currentUser (set by backend template)
  if (typeof window !== 'undefined' && (window as any).currentUser?.id) {
    return (window as any).currentUser.id;
  }

  // Fallback 2: Try fetch /api/v1/users/me
  try {
    const response = await fetch('/api/v1/users/me', {
      credentials: 'include',
      signal: AbortSignal.timeout(2000), // 2s timeout
    });

    if (response.ok) {
      const user = await response.json();
      if (user && typeof user.id === 'number') {
        return user.id;
      }
    }
  } catch (error) {
    // Network error or timeout - fall through to error
    console.warn('[userHelpers] Failed to fetch user from API:', error);
  }

  // Fallback 3: Throw error (cannot proceed without user ID)
  throw new Error('Cannot determine user ID for offline operation. User must be authenticated.');
}

/**
 * Check if user is authenticated
 * Returns true if user ID can be determined
 *
 * @returns true if authenticated, false otherwise
 *
 * @example
 * ```typescript
 * if (await isUserAuthenticated()) {
 *   // Proceed with offline operations
 * }
 * ```
 */
export async function isUserAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUserId();
    return true;
  } catch {
    return false;
  }
}
