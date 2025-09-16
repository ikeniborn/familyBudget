# ADR-010: Remove Sharing Functionality

**Status:** Accepted
**Date:** 2025-09-16
**Version:** v3.4.0

## Context

The Family Budget application included a sharing functionality that allowed users to share reference data (nomenclatures, cost centers, financial centers, and products) with other users. However, analysis showed that this functionality was:

1. **Unused by end users** - No actual sharing occurred in production
2. **Complex to maintain** - Additional API endpoints, models, and UI components
3. **Security overhead** - Additional attack surface and permission management
4. **Development overhead** - Extra code paths to test and maintain

## Decision

We have decided to remove the sharing functionality entirely from the Family Budget application.

### What was removed:

#### Backend Components
- **API Endpoints**: `/api/sharing/*` endpoints removed
  - `GET /api/sharing/my-shares` - List user's sharing configurations
  - `POST /api/sharing/` - Create new sharing configuration
  - `PUT /api/sharing/{id}` - Update sharing configuration
  - `DELETE /api/sharing/{id}` - Delete sharing configuration
  - `GET /api/sharing/available-users` - List users available for sharing
  - `GET /api/sharing/shared-with-me` - List resources shared with user

- **Database Models**: `app/models/sharing.py` removed
  - `Sharing` model with relationships to users and shared resources
  - Foreign key constraints and indexes

- **Schemas**: `app/schemas/sharing.py` removed
  - `SharingCreate`, `SharingUpdate`, `SharingResponse` schemas
  - `SharingListResponse`, `AvailableUsersResponse` schemas
  - `ResourceType` enum

- **Database Migration**: `migrations/create_sharing_table.sql` removed
  - Added cleanup migration: `migrations/drop_sharing_table.sql`

#### Frontend Components
- **Sharing Service**: `src/lib/services/sharingService.ts` removed
  - API client functions for sharing operations
  - Type definitions for sharing data

- **Sharing Page**: `src/routes/(protected)/settings/sharing/+page.svelte` removed
  - Complete sharing management interface
  - Sharing configuration forms
  - Shared resources list

- **Navigation Updates**: Removed sharing link from settings navigation
  - Updated `src/lib/components/settings/SettingsNavigation.svelte`
  - Cleaned up routing configuration

- **Type Definitions**: Removed sharing-related types from `src/lib/types/index.ts`

#### Testing Updates
- Updated security tests to remove sharing-related test cases
- Cleaned up access control tests for admin functionality
- Removed sharing endpoint tests

### Database Cleanup
- Created backup before removal: `backups/backup_before_sharing_removal_20250916_221533.sql`
- Applied migration to drop sharing tables: `migrations/drop_sharing_table.sql`
- Removed all sharing-related foreign key constraints

## Consequences

### Positive Consequences
1. **Reduced Complexity**: Simplified codebase with fewer API endpoints and UI components
2. **Improved Security**: Reduced attack surface by removing sharing functionality
3. **Lower Maintenance Overhead**: Fewer code paths to maintain and test
4. **Cleaner Architecture**: More focused feature set aligned with actual usage patterns
5. **Performance**: Reduced database queries and API overhead

### Neutral Consequences
1. **Feature Removal**: Users can no longer share reference data (no impact as feature was unused)
2. **Code Changes**: Multiple files modified across frontend and backend

### Risk Mitigation
1. **Backup Created**: Full database backup before removal
2. **Reversible**: Migration can be reversed if sharing functionality needed in future
3. **Testing**: Comprehensive testing of remaining functionality
4. **Documentation**: Clear documentation of what was removed and why

## Alternatives Considered

1. **Keep but deprecate**: Mark as deprecated but keep code - rejected due to maintenance overhead
2. **Disable via feature flag**: Keep code but disable - rejected due to code complexity
3. **Simplify implementation**: Reduce complexity but keep feature - rejected due to lack of usage

## Implementation Details

### Files Removed
```
backend-fastapi/app/api/v1/endpoints/sharing.py
backend-fastapi/app/models/sharing.py
backend-fastapi/app/schemas/sharing.py
backend-fastapi/migrations/create_sharing_table.sql
frontend-svelte/src/lib/services/sharingService.ts
frontend-svelte/src/routes/(protected)/settings/sharing/+page.svelte
```

### Files Modified
```
backend-fastapi/app/api/v1/endpoints/admin.py - Removed sharing-related endpoints
backend-fastapi/app/api/v1/router.py - Removed sharing router inclusion
backend-fastapi/app/models/__init__.py - Removed Sharing model import
backend-fastapi/app/schemas/__init__.py - Removed sharing schemas import
frontend-svelte/src/lib/components/settings/SettingsNavigation.svelte - Removed sharing nav link
frontend-svelte/src/lib/services/adminService.ts - Removed sharing admin functions
frontend-svelte/src/lib/types/index.ts - Removed sharing type definitions
```

### Database Changes
```sql
-- Migration: drop_sharing_table.sql
DROP TABLE IF EXISTS t_d_sharing CASCADE;
-- Cleanup any orphaned foreign key constraints
```

## Monitoring

- Monitor application performance after removal
- Verify no errors in application logs related to missing sharing functionality
- Confirm all tests pass without sharing-related code

## Documentation Updates

- Updated CLAUDE.md with sharing removal note
- Added this ADR to document the decision
- Updated changelog.md with version 3.4.0 changes

## Status

- **Implemented**: 2025-09-16
- **Tested**: All existing functionality verified working
- **Documented**: Architecture decision and changelog updated
- **Deployed**: Ready for production deployment

---

*This ADR documents the complete removal of sharing functionality from Family Budget v3.4.0 as an unused feature that added unnecessary complexity.*