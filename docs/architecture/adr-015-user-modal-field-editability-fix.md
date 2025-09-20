# ADR-015: User Modal Field Editability Fix

## Status
Accepted

## Context
Users reported that in the user editing modal at `/settings/users`, the email and password fields appeared as readonly/disabled and could not be edited. This prevented administrators from updating user information properly.

## Decision
We explicitly set `readonly={false}` and `disabled={false}` props on email and password Input components in the UserModal to ensure they remain editable, while maintaining the security requirement that username fields stay readonly during editing (as per v3.8.1).

## Implementation Details

### Changes Made
**File**: `frontend-svelte/src/lib/components/modals/UserModal.svelte`

1. **Email Field** (lines 152-160):
   - Added `readonly={false}` prop
   - Added `disabled={false}` prop
   - Ensures field is always editable

2. **Password Field** (lines 188-197):
   - Added `readonly={false}` prop
   - Added `disabled={false}` prop
   - Ensures field is always editable

3. **Username Field** (lines 171-177):
   - Maintained `readonly={isEditing}` for security
   - Readonly only during editing, editable during creation

## Consequences

### Positive
- Administrators can now properly edit user email addresses
- Administrators can update user passwords
- User management functionality fully restored
- Security maintained by keeping username readonly during editing

### Negative
- None identified

## Security Considerations
- Username field remains protected from accidental changes during editing
- This prevents login credential confusion
- Aligns with security requirements from v3.8.1

## Testing
Comprehensive test suite created with 15 tests covering:
- Field editability in create mode
- Field editability in edit mode
- Security validation for username field
- Overall field state behavior

All critical functionality tests pass successfully.

## References
- Issue: User editing form fields not editable
- Related: ADR-012 (UserModal Component Field Fix v3.8.1)
- Related: ADR-014 (Input Component Readonly Styling v3.9.1)