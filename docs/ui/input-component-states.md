# Input Component Visual States Guide

**Version:** v3.9.1
**Last Updated:** 2025-09-20

## Overview

The Input component supports multiple visual states to provide clear user feedback and accessibility. This guide documents all available states and their visual characteristics.

## Visual States

### 1. Default (Editable)
**Appearance:**
- White background (`bg-white`)
- Gray border (`border-gray-300`)
- Blue focus ring on interaction (`focus:ring-blue-500`)
- Normal cursor behavior

**Usage:**
```svelte
<Input bind:value={editableField} placeholder="Enter text..." />
```

### 2. Readonly
**Appearance:**
- Light gray background (`bg-gray-50`)
- Subtle gray border (`border-gray-200`)
- Lock icon (🔒) on the right side
- Disabled cursor (`cursor-default`)
- No focus states

**Usage:**
```svelte
<Input bind:value={username} readonly={true} />
```

**When to Use:**
- Fields that should be visible but not editable (e.g., username during profile editing)
- Display-only data that users need to see but cannot modify
- System-generated values (IDs, timestamps)

### 3. Disabled
**Appearance:**
- Gray background (standard browser disabled styling)
- Reduced opacity
- No interactive states
- No special icons

**Usage:**
```svelte
<Input bind:value={field} disabled={true} />
```

**When to Use:**
- Fields temporarily unavailable (loading states)
- Conditional fields that depend on other selections
- Form submission in progress

### 4. Error State
**Appearance:**
- Red border (`border-red-500`)
- Red focus ring (`focus:ring-red-500`)
- Can be combined with readonly/disabled states

**Usage:**
```svelte
<Input bind:value={field} hasError={true} />
```

## State Combinations

### Readonly + Error
- Gray background with red border
- Lock icon present
- Error styling takes precedence for border/focus

### Disabled + Error
- Standard disabled appearance
- Error state not visually apparent (by design)

## Accessibility Features

1. **Visual Indicators:**
   - Lock icon for readonly fields
   - Color contrast compliance
   - Clear state differentiation

2. **Keyboard Navigation:**
   - Readonly fields are focusable but not editable
   - Disabled fields are not focusable
   - Proper tab order maintained

3. **Screen Reader Support:**
   - Readonly attribute properly exposed
   - Error states announced
   - Label associations maintained

## Implementation Examples

### User Profile Form
```svelte
<!-- Username is readonly during editing -->
<Input
  bind:value={user.username}
  readonly={isEditing}
  label="Username"
/>

<!-- Email can be edited -->
<Input
  bind:value={user.email}
  label="Email"
  hasError={emailError}
/>
```

### Settings Forms
```svelte
<!-- ID fields are always readonly -->
<Input
  bind:value={item.id}
  readonly={true}
  label="ID"
/>

<!-- Name can be edited -->
<Input
  bind:value={item.name}
  label="Name"
  placeholder="Enter name..."
/>
```

## Design Tokens

```css
/* State-specific styling */
.input-editable {
  background: white;
  border: 1px solid #d1d5db;
}

.input-readonly {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  cursor: default;
}

.input-error {
  border-color: #ef4444;
}

.readonly-indicator {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  pointer-events: none;
}
```

## Testing

All visual states are covered by comprehensive tests:
- State rendering validation
- Visual indicator presence
- Accessibility compliance
- State transition behavior

## Related Components

- **UserModal:** Uses readonly username field during editing
- **Settings Forms:** Various readonly ID fields
- **Forms:** Error state handling across all input fields

## Migration Notes

**v3.9.1 Changes:**
- Added lock icon indicator for readonly fields
- Enhanced visual distinction between states
- Improved accessibility compliance
- No breaking changes to existing API