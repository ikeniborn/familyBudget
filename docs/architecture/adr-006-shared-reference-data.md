# ADR-006: Shared Reference Data Management

## Status
Accepted

## Context
Previously, each user had their own isolated reference data (periods, financial centers, cost centers, nomenclatures). This led to data duplication and inconsistency across the organization. We needed a centralized reference data management system.

## Decision
Implement admin-managed shared reference data system where:
1. All reference data is visible to all users
2. Only administrators can create, update, or delete reference data
3. Regular users have read-only access to reference data
4. Maintain backward compatibility with existing user-specific data

## Implementation

### Database Changes
- Added `code` fields for global uniqueness
- Made `user_id` nullable for shared records
- Added `created_by` and `managed_by` audit fields
- Dropped per-user unique constraints, added global constraints

### API Changes
- GET operations: No user_id filtering, show all shared + own data
- POST/PUT/DELETE: Require admin role via `require_admin_access`
- Added `is_editable` and `is_shared` flags to responses

### Frontend Changes
- Admin-only access to settings pages with auto-redirect
- Visual indicators for shared vs personal data
- Read-only mode for non-editable items
- Backward compatibility with old field names

## Consequences

### Positive
- Unified reference data across organization
- Reduced data duplication
- Improved data consistency
- Clear audit trail
- Better performance

### Negative
- Migration complexity for existing data
- Users lose ability to customize their own reference data
- Dependency on administrators for changes

### Neutral
- Role-based access control becomes critical
- Need for proper admin user management
- Regular backup and rollback procedures required

## Migration Plan
1. Backup existing database
2. Run Alembic migration for schema changes
3. Execute data consolidation script
4. Update application with new code
5. Validate data integrity
6. Monitor for issues

## Rollback Plan
1. Stop application services
2. Restore database from backup
3. Revert code changes via git
4. Restart services with original configuration

## Date
2025-09-14

## Authors
- System Architecture Team