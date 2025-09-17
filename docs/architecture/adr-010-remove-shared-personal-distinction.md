# ADR-010: Remove Shared/Personal Data Distinction

**Date:** 2025-09-17
**Status:** Implemented
**Version:** 3.7.0

## Context

The Family Budget application originally implemented a shared/personal data model where reference data (справочники) could be either:
- **Shared** (user_id = NULL): Managed by admins, visible to all users
- **Personal** (user_id = specific user): Owned and visible only to specific user

This dual model added significant complexity to the codebase, including:
- Complex filtering logic in API endpoints
- Permission checks for shared vs personal data
- UI elements to distinguish between data types
- Database constraints and audit fields

## Decision

We have removed the shared/personal distinction entirely. All reference data is now strictly user-specific.

## Implementation

### Database Changes
- Made `user_id` NOT NULL in all reference tables
- Removed `created_by` and `managed_by` audit columns
- Updated unique constraints to be user-specific (not global)
- Migrated existing NULL user_id records to the first admin user

### Backend Changes
- Removed `is_shared` property from all models
- Simplified API queries to filter only by `user_id`
- Removed admin permission checks for shared data
- Always set `user_id` to current user in create operations

### Frontend Changes
- Removed shared/personal badges and filters
- Removed shared statistics from dashboards
- Simplified edit permissions (users can edit all their own data)
- Removed `is_shared` and `is_editable` fields from TypeScript types

## Consequences

### Positive
- **Simplified architecture**: Cleaner, more maintainable code
- **Better data isolation**: Stronger guarantee of user data privacy
- **Improved performance**: Simpler database queries
- **Reduced complexity**: No branching logic for shared vs personal
- **Consistent behavior**: All data follows the same rules

### Negative
- **No data sharing**: Users cannot share reference data
- **Duplication**: Common reference data must be created by each user
- **Migration required**: Existing shared data had to be assigned to users

## Technical Details

### Files Modified
- 5 SQLAlchemy models
- 5 Pydantic schemas
- 6 API endpoint modules
- 5 frontend component pages
- 1 TypeScript types file
- Multiple test files

### Migration Strategy
All NULL user_id records were assigned to the first admin user (ID: 1) to preserve data integrity.

### Test Coverage
- Created comprehensive user data isolation tests
- Updated existing tests to remove shared functionality
- All tests pass with user-specific data only

## Related Documents
- [Analysis Document](/requests/analyses.xml)
- [Implementation Plan](/requests/plan.xml)
- [Migration Script](/backend-fastapi/alembic/versions/7001f0ea49df_remove_shared_functionality.py)