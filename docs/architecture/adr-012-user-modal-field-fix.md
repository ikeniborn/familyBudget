# ADR-012: UserModal Component Field Access and UI Improvements

## Status
Accepted

## Date
2025-09-19

## Context

The UserModal component in the user management system was experiencing several issues that affected the user experience and functionality:

1. **Input Component Prop Mismatch**: There was potential confusion between `error` vs `hasError` props in the Input component
2. **Username Field Editability**: The username field needed to be readonly when editing existing users to prevent accidental changes to login credentials
3. **Field Management**: Need for proper distinction between editable and readonly fields during user creation vs editing
4. **Error Display**: Proper error message display for form validation

## Decision

We decided to implement a comprehensive fix for the UserModal component with the following changes:

### 1. Input Component Prop Standardization
- Confirmed that the Input component uses `hasError` prop (not `error`)
- Ensured all Input instances in UserModal use correct `hasError={!!errors.fieldName}` pattern
- Maintained consistent error handling across all form fields

### 2. Username Field Access Control
- Made username field readonly when editing existing users (`readonly={isEditing}`)
- Added visual indicator in label: "Логин (только для чтения)" for editing mode
- Preserved username editability during user creation

### 3. Field Management Strategy
- **Editable fields during editing**: `user_name`, `user_email`, `password` (optional)
- **Readonly fields during editing**: `username`
- **All fields editable during creation**: All fields including `username`

### 4. Error Message Display
- Maintained proper error message display for all fields
- Used consistent error styling with red text and proper spacing
- Preserved validation logic for all form fields

## Implementation

### UserModal Component Changes

```typescript
// Username field with readonly control
<Input
  id="username"
  bind:value={formData.username}
  placeholder="Введите логин"
  hasError={!!errors.username}
  readonly={isEditing}  // Key change: readonly when editing
/>

// Label with context indicator
<label for="username" class="block text-sm font-medium text-gray-700">
  Логин {isEditing ? '(только для чтения)' : ''}
</label>

// Consistent error prop usage
<Input
  id="user_name"
  bind:value={formData.user_name}
  placeholder="Введите имя пользователя"
  hasError={!!errors.user_name}  // Correct prop name
  required
/>
```

### Technical Details

1. **Input Component Props**:
   - `hasError`: Boolean indicating validation error state
   - `readonly`: Boolean controlling field editability
   - `required`: Boolean for required field validation

2. **Form Validation**:
   - Maintained existing validation logic
   - Preserved error message display system
   - Kept consistent error styling

3. **User Experience**:
   - Clear visual indication of readonly fields
   - Proper error message display
   - Consistent form behavior across create/edit modes

## Rationale

### Why Make Username Readonly During Editing?
- **Security**: Prevents accidental changes to login credentials
- **Data Integrity**: Username often used as unique identifier
- **User Experience**: Reduces confusion about which fields can be changed
- **Best Practice**: Common pattern in user management systems

### Why Use `hasError` Prop Pattern?
- **Consistency**: Matches Input component's prop interface
- **Type Safety**: Boolean prop is more predictable than string/object
- **Performance**: Simple boolean check vs complex error object evaluation

### Why Keep Other Fields Editable?
- **Flexibility**: Users may need to update their display name and email
- **Admin Functionality**: Administrators should be able to update user information
- **Password Updates**: Support for password changes when needed

## Consequences

### Positive
- ✅ **Improved Security**: Username cannot be accidentally changed during editing
- ✅ **Better UX**: Clear indication of which fields are editable
- ✅ **Consistent Props**: Proper use of Input component interface
- ✅ **Maintained Functionality**: All existing features preserved
- ✅ **Type Safety**: Correct prop types prevent runtime errors

### Neutral
- Username changes require admin intervention (by design)
- Slight increase in visual complexity with readonly indicators

### Risks and Mitigations
- **Risk**: Users confused about readonly username
- **Mitigation**: Clear label indicating "(только для чтения)"

- **Risk**: Admins needing to change usernames
- **Mitigation**: Database-level username updates available if needed

## Related Decisions
- Related to overall user management architecture
- Connects to authentication and security policies
- Part of admin interface standardization

## Notes
- Implementation maintains backward compatibility
- No breaking changes to existing user data
- Preserves all existing validation logic
- Supports both create and edit operations seamlessly

## Validation

### Testing Requirements
- ✅ Form renders correctly in both create and edit modes
- ✅ Username field is readonly when editing existing users
- ✅ Username field is editable when creating new users
- ✅ Error messages display correctly for all fields
- ✅ Form submission works for both create and edit operations
- ✅ Validation logic preserved for all scenarios

### Success Criteria
- Users can successfully create new accounts with editable usernames
- Users can edit existing accounts with readonly usernames
- Error messages display properly for validation failures
- No prop mismatch errors in browser console
- Form behaves consistently across all user scenarios