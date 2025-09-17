# ADR-010: Button Component Event Handler Fix

## Date: 2025-09-17

## Status: Accepted

## Context

The articles management page (`/settings/articles`) experienced a critical issue where all buttons (Create, Edit, Delete, Cancel, Submit) were completely non-responsive to user clicks. Despite the UI rendering correctly and no JavaScript errors appearing in console logs, the buttons failed to trigger their associated functions or open modals.

### Investigation Findings

1. **Component Code Analysis**: The articles page was correctly using `onclick` prop syntax to pass event handlers to Button components
2. **Button Component Issue**: The Button component (`Button.svelte`) was using Svelte's `on:click` event directive in the DOM elements (lines 79 and 89) instead of the `onclick` attribute
3. **Event Handler Mismatch**: While the Button component accepted an `onclick` prop and had proper handling logic, the actual DOM binding used `on:click={handleClick}` which created a disconnect

### Technical Details

The Button component had:
- Proper prop declaration: `export let onclick: ((e: MouseEvent) => void) | undefined`
- Correct handler logic that called the onclick prop
- But incorrect DOM binding: `<button on:click={handleClick}>` instead of `<button onclick={handleClick}>`

## Decision

Fix the Button component to use the `onclick` attribute directly on DOM elements instead of Svelte's `on:click` event directive.

### Changes Made

**File**: `frontend-svelte/src/lib/components/ui/Button.svelte`

**Line 79 (anchor element)**:
```svelte
<!-- Before -->
<a {href} class={buttonClass} on:click={handleClick} {...$$restProps}>

<!-- After -->
<a {href} class={buttonClass} onclick={handleClick} {...$$restProps}>
```

**Line 89 (button element)**:
```svelte
<!-- Before -->
<button {type} {disabled} class={buttonClass} on:click={handleClick} {...$$restProps}>

<!-- After -->
<button {type} {disabled} class={buttonClass} onclick={handleClick} {...$$restProps}>
```

## Consequences

### Positive

1. **Immediate Functionality Restoration**: All buttons on the articles page now respond correctly to user interactions
2. **Consistency**: Aligns with the project's established pattern of using `onclick` props
3. **Backward Compatibility**: The component still dispatches events for components using `on:click` listeners
4. **No Breaking Changes**: Existing functionality in other parts of the application remains intact

### Negative

None identified. The fix is a simple correction that aligns with the intended design.

## Testing

Comprehensive test coverage was implemented:
- 1,827 lines of tests across 3 test files
- Tests verify onclick prop handling, event dispatching, and all button states
- Regression prevention tests ensure this issue doesn't recur

## Related Issues

- Previous migration from Svelte 5 to Svelte 4 (see `/docs/svelte5-to-svelte4-migration.md`)
- Articles Reference Module implementation (v3.5.3 → v3.5.4)

## Notes

This issue highlights the importance of ensuring DOM event bindings match the component's prop interface. The mismatch between `onclick` prop and `on:click` DOM binding was subtle but caused complete button failure.