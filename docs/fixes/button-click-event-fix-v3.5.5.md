# Button Click Event Fix (v3.5.5)

## Issue
Buttons on the `/settings/articles` page were not responding to click events, preventing users from:
- Creating new articles ("Создать статью" button)
- Editing existing articles ("Изменить" button)
- Deleting articles ("Удалить" button)

## Root Cause
The Button component (`frontend-svelte/src/lib/components/ui/Button.svelte`) was incorrectly using the HTML `onclick` attribute instead of Svelte's `on:click` event directive for event handling.

### Incorrect Implementation (Before Fix)
```svelte
<!-- Lines 79 and 89 were using onclick attribute -->
<a {href} class={buttonClass} onclick={handleClick} {...$$restProps}>
<button {type} {disabled} class={buttonClass} onclick={handleClick} {...$$restProps}>
```

In Svelte 4, DOM elements need to use Svelte's event directives (`on:click`) for proper event binding, not HTML attributes (`onclick`).

## Solution
Changed the event binding syntax to use Svelte's `on:click` directive:

### Correct Implementation (After Fix)
```svelte
<!-- Lines 79 and 89 now use on:click directive -->
<a {href} class={buttonClass} on:click={handleClick} {...$$restProps}>
<button {type} {disabled} class={buttonClass} on:click={handleClick} {...$$restProps}>
```

## Technical Details

### Svelte Event Handling
- **`on:click`**: Svelte's event directive that properly binds event handlers with Svelte's reactive system
- **`onclick`**: HTML attribute that doesn't integrate with Svelte's event system

### Component Architecture
The Button component supports both:
1. **External onclick prop**: For backward compatibility with components expecting a callback
2. **Event dispatching**: Using `createEventDispatcher` for Svelte component communication

```typescript
// Component accepts onclick prop
export let onclick: ((e: MouseEvent) => void) | undefined = undefined;

// Handler calls both the prop and dispatches event
function handleClick(e: MouseEvent) {
  if (onclick) {
    onclick(e);  // Call external handler
  }
  dispatch('click', e);  // Dispatch for on:click listeners
}
```

## Files Modified
- `frontend-svelte/src/lib/components/ui/Button.svelte` (lines 79 and 89)

## Testing
Created comprehensive test suite in:
- `frontend-svelte/src/test/components/ui/button-click-fix.test.ts` (824 lines)
- Tests cover 43 scenarios including articles page specific functionality

## Version History
- **v3.5.4**: Initial attempt with incorrect fix (used `onclick` attribute)
- **v3.5.5**: Correct fix applied (using `on:click` directive)

## Verification Steps
1. Navigate to `/settings/articles`
2. Click "Создать статью" - modal should open
3. Select an article and click "Изменить" - edit modal should open
4. Select an article and click "Удалить" - delete confirmation should appear
5. All buttons should be responsive and trigger their respective actions

## Prevention
- Always use Svelte event directives (`on:click`, `on:submit`, etc.) for DOM elements
- Use HTML attributes only for non-Svelte specific attributes
- Test event handlers after any migration or syntax changes