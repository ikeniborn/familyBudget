/**
 * User Helper Utilities
 * Shared functions for user identification
 */

/**
 * Cached user ID from API (to avoid repeated API calls)
 * Set to null initially, populated on first API fallback
 */
let cachedUserId: number | null = null;

/**
 * Get current user ID using robust fallback chain
 * Priority:
 * 1. window.userData.id (set by base.html - PRIMARY)
 * 2. window.currentUser.id (legacy compatibility - deprecated)
 * 3. Cached user ID from previous API call
 * 4. API call /api/v1/users/me (last resort)
 *
 */
export async function getCurrentUserId(): Promise<number> {
  // PRIMARY: window.userData (set in base.html)
  if (typeof window !== 'undefined' && (window as any).userData?.id) {
    return (window as any).userData.id;
  }

  // FALLBACK 1: Legacy window.currentUser (deprecated)
  if (typeof window !== 'undefined' && (window as any).currentUser?.id) {
    console.warn('[userHelpers] Using deprecated window.currentUser.id - update code to use window.userData.id');
    return (window as any).currentUser.id;
  }

  // FALLBACK 2: Cached user ID from previous API call
  if (cachedUserId !== null) {
    return cachedUserId;
  }

  // FALLBACK 3: API call (last resort)
  try {
    const response = await fetch('/api/v1/users/me', {
      credentials: 'include',
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const user = await response.json();
      if (user && typeof user.id === 'number') {
        console.info('[userHelpers] User ID from API:', user.id);
        cachedUserId = user.id; // Cache the result
        return user.id;
      }
    }
  } catch (error) {
    console.warn('[userHelpers] Failed to fetch user from API:', error);
  }

  throw new Error('Cannot determine user ID. User must be authenticated.');
}

/**
 * Get user ID or throw error (for critical operations)
 * Alias for getCurrentUserId() for clarity in critical code paths
 */
export function requireUserId(): Promise<number> {
  return getCurrentUserId();
}

/**
 * Clear cached user ID (useful on logout or user change)
 */
export function clearUserIdCache(): void {
  cachedUserId = null;
}

/**
 * Check if user is authenticated
 */
export async function isUserAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUserId();
    return true;
  } catch {
    return false;
  }
}
