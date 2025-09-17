# ADR-010: Button Component onclick Prop Migration

## Date
2025-09-17

## Status
Accepted and Implemented

## Context
Users reported that buttons on the articles management page (`/settings/articles`) were not responding to clicks. The issue affected all interactive buttons including:
- Create Article button
- Edit buttons in table rows
- Delete buttons in table rows
- Modal Cancel buttons
- Modal Submit buttons
- Error state Retry button

Investigation revealed that the Button component (`Button.svelte`) had been updated to prioritize an `onclick` prop over Svelte's event dispatching mechanism, but the articles page was still using the old `on:click` event binding syntax.

## Problem Analysis
The Button component implementation revealed:
1. The component accepts an `onclick` prop (line 14: `export let onclick`)
2. The `handleClick` function first checks for the `onclick` prop (line 56)
3. Only dispatches the 'click' event if `onclick` is not provided (line 61)
4. The articles page used `on:click` which doesn't set the `onclick` prop

This mismatch meant button clicks weren't triggering the intended handlers.

## Decision
Update all Button components in the articles page from `on:click` event binding to `onclick` prop usage.

### Changes Implemented
9 Button components were updated in `/frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte`:
1. Line 241: Create Article button - `onclick={openCreateModal}`
2. Line 347: Retry button - `onclick={loadArticles}`
3. Line 357: Create button in empty state - `onclick={openCreateModal}`
4. Line 436: Edit button - `onclick={() => openEditModal(article)}`
5. Line 447: Delete button - `onclick={() => openDeleteModal(article)}`
6. Line 544: Cancel in create modal - `onclick={() => (showCreateModal = false)}`
7. Line 610: Cancel in edit modal - `onclick={() => (showEditModal = false)}`
8. Line 634: Cancel in delete modal - `onclick={() => (showDeleteModal = false)}`
9. Line 641: Delete confirmation - `onclick={handleDelete}`

## Consequences

### Positive
- All button interactions on the articles page now work correctly
- Consistent with the updated Button component implementation
- Maintains modern Svelte patterns
- No breaking changes to other components

### Negative
- None identified

### Neutral
- Other pages may need similar updates if they use Button components with `on:click`
- The Button component maintains backward compatibility through event dispatching

## Implementation Notes
- The fix was straightforward: simple prop conversion with no logic changes
- All functionality was restored immediately upon implementation
- No additional code changes were required

## Testing
- Manual testing confirmed all buttons respond correctly
- Modal operations (open/close) work as expected
- CRUD operations (create, edit, delete) function properly
- Form submissions work correctly

## References
- Original issue: Buttons not responding on articles page
- Related files:
  - `/frontend-svelte/src/lib/components/ui/Button.svelte`
  - `/frontend-svelte/src/routes/(protected)/settings/articles/+page.svelte`
- Version: v3.5.3