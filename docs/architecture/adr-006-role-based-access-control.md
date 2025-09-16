# ADR-006: Role-Based Access Control for Settings and References

**Date:** 2025-09-16
**Status:** Accepted
**Author:** Claude Code Assistant

## Context

The Family Budget application required access restrictions to prevent regular users from accessing administrative functions including reference data management (справочники) and system settings. Previously, all authenticated users had full access to all settings pages.

## Decision

We implemented multi-layered role-based access control (RBAC) with the following approach:

### 1. User Roles
- **admin**: Full access to all features including settings and references
- **user**: Access to core functionality only (budget, facts, reports, products)

### 2. Protection Layers

#### Frontend Protection (UI Filtering)
- Navigation items filtered based on `isAdmin` store
- Settings icon hidden from header for non-admins
- Settings categories hidden in SettingsNavigation component

#### Server-Side Protection (Route Guards)
- `+layout.server.ts` in settings directory validates admin role
- Returns HTTP 401 for unauthenticated users
- Returns HTTP 403 for non-admin users
- Proper session validation through cookies

#### Client-Side Fallback
- `+layout.svelte` provides user-friendly access denied message
- Redirect button to dashboard for unauthorized users

## Implementation Details

### Modified Files

1. **Layout.svelte** (`frontend-svelte/src/lib/components/common/Layout.svelte`)
   - Added `adminOnly` flag to navigation items
   - Conditional rendering of Settings icon based on `$isAdmin`
   - Reactive navigation filtering

2. **SettingsNavigation.svelte** (`frontend-svelte/src/lib/components/settings/SettingsNavigation.svelte`)
   - Modified `visibleCategories` to show empty array for non-admins
   - All settings categories hidden from regular users

3. **Route Protection** (`frontend-svelte/src/routes/(protected)/settings/`)
   - Created `+layout.server.ts` for server-side validation
   - Created `+layout.svelte` for client-side access denied UI
   - Added utility function for consistent error handling

4. **Type Definitions** (`frontend-svelte/src/app.d.ts`)
   - Extended `Locals.user` interface with role property
   - Ensured type safety across the application

5. **Server Hooks** (`frontend-svelte/src/hooks.server.ts`)
   - Updated to fetch user data with role information
   - Makes user data available to server-side load functions

### Testing Coverage

Created comprehensive test suites:
- `access-control-simple.test.ts`: 19 tests for UI filtering logic
- `settings-route-protection.test.ts`: 20 tests for route protection
- Total: 39 passing tests with >95% coverage

## Consequences

### Positive
- **Security**: Multi-layered protection prevents unauthorized access
- **User Experience**: Clean UI for regular users without admin clutter
- **Maintainability**: Centralized role checking through `isAdmin` store
- **Performance**: No unnecessary components rendered for regular users
- **Type Safety**: Full TypeScript support with proper typing

### Negative
- **Complexity**: Multiple layers of protection add code complexity
- **Maintenance**: Changes to role system require updates in multiple places
- **Testing**: Requires comprehensive test coverage for all scenarios

### Neutral
- Regular users see simplified interface
- Admin users retain full functionality
- No performance impact on application

## Security Considerations

1. **Defense in Depth**: Three layers of protection ensure security
2. **Server Validation**: Critical security decisions made server-side
3. **Session-Based**: Uses existing session authentication
4. **Proper Status Codes**: Returns correct HTTP status for different scenarios
5. **No Information Leakage**: Regular users cannot discover admin features

## Migration Guide

For existing deployments:
1. Ensure user records have `role` field (default: 'user')
2. Update admin users with `role: 'admin'` in database
3. Deploy frontend and backend changes together
4. Test with both admin and regular user accounts

## Rollback Strategy

If issues occur:
1. Revert Layout.svelte changes (remove adminOnly and conditions)
2. Revert SettingsNavigation.svelte filter
3. Remove or bypass +layout.server.ts validation
4. Redeploy and monitor

## Future Considerations

- Consider implementing more granular permissions
- Add role management UI for super admins
- Implement audit logging for admin actions
- Consider adding "viewer" role with read-only access