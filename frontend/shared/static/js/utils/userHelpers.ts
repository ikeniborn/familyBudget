/**
 * User Helper Utilities
 * Shared functions for user identification
 */

/**
 * Get current user ID using multiple fallback mechanisms
 * Priority: window.currentUser.id → API /api/v1/users/me → throw Error
 */
export async function getCurrentUserId(): Promise<number> {
  // Fallback 1: window.currentUser
  if (typeof window !== 'undefined' && (window as any).currentUser?.id) {
    return (window as any).currentUser.id;
  }

  // Fallback 2: API call
  try {
    const response = await fetch('/api/v1/users/me', {
      credentials: 'include',
      signal: AbortSignal.timeout(2000),
    });

    if (response.ok) {
      const user = await response.json();
      if (user && typeof user.id === 'number') {
        return user.id;
      }
    }
  } catch (error) {
    console.warn('[userHelpers] Failed to fetch user from API:', error);
  }

  throw new Error('Cannot determine user ID. User must be authenticated.');
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
