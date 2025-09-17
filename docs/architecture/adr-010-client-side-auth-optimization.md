# ADR-010: Client-Side Authentication Optimization

## Status
RESOLVED (v3.5.1)

## Date
2025-09-17

## Context
The articles settings page (/settings/articles) was experiencing 401 (Unauthorized) errors when admin users tried to access it. The error occurred in the client-side authentication check (`/api/auth/me`) even though the user was already authenticated server-side.

### Problem Details
1. Users authenticated server-side through hooks.server.ts
2. Protected routes already validated authentication in +layout.server.ts
3. Client-side code in +layout.svelte and (protected)/+layout.ts redundantly called checkAuth()
4. This redundant call to `/api/auth/me` was failing with 401 errors
5. The 401 errors prevented CRUD operations on the articles page

### Root Cause Analysis
The issue stemmed from duplicate authentication checks:
- Server-side: hooks.server.ts → +layout.server.ts (working correctly)
- Client-side: +layout.svelte → authStore.checkAuth() (causing 401 errors)
- Protected layout: validateSession() when user data already available

## Decision
Optimize client-side authentication to avoid redundant checks when server-side authentication has already been validated.

### Changes Made

#### 1. Main Layout Optimization (/routes/+layout.svelte)
```typescript
// BEFORE: Always called checkAuth on mount
onMount(async () => {
  await authStore.checkAuth();
});

// AFTER: Only check auth if no user data exists
onMount(async () => {
  const currentState = get(authStore);
  if (!currentState?.user && !currentState?.isAuthenticated) {
    await authStore.checkAuth();
  }
});
```

#### 2. Protected Layout Optimization (/routes/(protected)/+layout.ts)
```typescript
// BEFORE: Validated session even with server user data
if (authState.user && !authState.sessionValidated) {
  await authStore.validateSession(); // Caused 401 errors
}
if (data?.user) {
  authStore.setUser(userData);
}

// AFTER: Prioritize server user data
if (data?.user) {
  authStore.setUser(userData);
} else {
  // Only validate if no server data
  if (authState.user && !authState.sessionValidated) {
    await authStore.validateSession();
  }
}
```

## Consequences

### Positive
1. ✅ Eliminated unnecessary 401 errors on authenticated pages
2. ✅ Improved page load performance (fewer API calls)
3. ✅ Better server-client authentication synchronization
4. ✅ Articles page CRUD operations now work correctly for admin users
5. ✅ Reduced server load from redundant auth checks

### Negative
None identified. The solution maintains security while improving performance.

## Implementation Notes

### Testing
- Verified admin login works: `curl -X POST /api/auth/login`
- Confirmed `/api/auth/me` returns 200 with session cookie
- Articles API endpoints accessible: `/api/articles`
- No 401 errors in browser console
- CRUD operations functional on articles page

### Files Modified
1. `/frontend-svelte/src/routes/+layout.svelte` - Conditional auth check
2. `/frontend-svelte/src/routes/(protected)/+layout.ts` - Server data prioritization

## Related Issues
- ADR-008: Admin Settings Auth Fix
- ADR-009: Backend URL Configuration Fix
- Articles Reference Module (v3.5.0)

## Lessons Learned
1. Server-side authentication should be the source of truth in SSR applications
2. Client-side validation should only occur when server data is unavailable
3. Redundant authentication checks can cause unexpected failures
4. Prioritize hydration of server data before client-side validation