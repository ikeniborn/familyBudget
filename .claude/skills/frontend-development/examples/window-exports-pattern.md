# Window Exports Pattern: Onclick Handlers

Паттерн для безопасного использования TypeScript/ES Module функций в HTML inline onclick handlers.

## Problem

ES Modules не экспортируют функции в глобальную область видимости автоматически. Inline onclick handlers выполняются в global scope (window object), что приводит к `ReferenceError`.

## Files

- **Module**: `frontend/web/static/js/dashboard/adapters/windowExports.ts`
- **Components**: `frontend/web/static/js/modalFact/index.ts`, `frontend/web/static/js/modalPlan/index.ts`
- **Template**: `frontend/web/templates/components/fab_toolbar.html`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ modalFact/index.ts (ES Module)                          │
│                                                          │
│  export async function openModalFact(): Promise<void> { │
│    // Implementation                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
                      ↓ import
┌─────────────────────────────────────────────────────────┐
│ windowExports.ts (Window Bridge)                        │
│                                                          │
│  import { openModalFact } from '../modalFact';          │
│  import { openModalPlan } from '../modalPlan';          │
│                                                          │
│  // Export to window for onclick handlers               │
│  window.openModalFact = openModalFact;                  │
│  window.openModalPlan = openModalPlan;                  │
└─────────────────────────────────────────────────────────┘
                      ↓ available in window
┌─────────────────────────────────────────────────────────┐
│ fab_toolbar.html (Template)                             │
│                                                          │
│  <button onclick="window.openModalFact()">              │
│    Add Fact                                              │
│  </button>                                               │
└─────────────────────────────────────────────────────────┘
```

## Implementation

### Step 1: Define Module Function

**File**: `frontend/web/static/js/modalFact/index.ts`

```typescript
/**
 * Opens the fact transaction modal
 */
export async function openModalFact(): Promise<void> {
  const modal = document.getElementById('modal_fact') as HTMLDialogElement;
  if (!modal) {
    console.error('[modalFact] Modal element not found');
    return;
  }

  // Show modal
  modal.showModal();

  // Additional logic (form reset, data loading, etc.)
}
```

### Step 2: Export to Window Object

**File**: `frontend/web/static/js/dashboard/adapters/windowExports.ts`

```typescript
// Import module functions
import { openModalFact } from '../modalFact';
import { openModalPlan } from '../modalPlan';
import { openContextModal } from '../modals/contextModal';

// Export to window for onclick handlers
// Type assertion needed for window extension
(window as any).openModalFact = openModalFact;
(window as any).openModalPlan = openModalPlan;
(window as any).openContextModal = openContextModal;

// Optional: Add TypeScript declaration for type safety
declare global {
  interface Window {
    openModalFact: typeof openModalFact;
    openModalPlan: typeof openModalPlan;
    openContextModal: typeof openContextModal;
  }
}
```

### Step 3: Use in HTML Template

**File**: `frontend/web/templates/components/fab_toolbar.html`

```html
<!-- ❌ BAD: ReferenceError - function not in global scope -->
<button onclick="openModalFact()">Add Fact</button>

<!-- ✅ GOOD: Explicit window. prefix -->
<button onclick="window.openModalFact()">Add Fact</button>

<!-- ✅ ALSO GOOD: Multiple function calls -->
<button onclick="window.openModalFact(); window.closeFabMenu();">
  Add Fact
</button>
```

## Real-World Example: FAB Speed Dial (v11.1.24)

### Before (Broken)

```html
<!-- Desktop Speed Dial - Line 80 -->
<button onclick="openModalPlan(); closeDesktopFabMenu();"
        class="btn btn-circle btn-primary shadow-lg">
    <svg><!-- icon --></svg>
</button>

<!-- Browser console error: -->
<!-- Uncaught ReferenceError: openModalPlan is not defined -->
```

### After (Fixed)

```html
<!-- Desktop Speed Dial - Line 80 -->
<button onclick="window.openModalPlan(); window.closeDesktopFabMenu();"
        class="btn btn-circle btn-primary shadow-lg">
    <svg><!-- icon --></svg>
</button>

<!-- ✅ Works correctly -->
```

## Best Practices

### ✅ DO

1. **Centralize window exports** in dedicated module (windowExports.ts)
   ```typescript
   // ✅ Single source of truth
   import { openModalFact } from '../modalFact';
   window.openModalFact = openModalFact;
   ```

2. **Always use window. prefix** in HTML onclick
   ```html
   <!-- ✅ Explicit and clear -->
   <button onclick="window.openModalFact()">Add</button>
   ```

3. **Add TypeScript declarations** for type safety
   ```typescript
   declare global {
     interface Window {
       openModalFact: typeof openModalFact;
     }
   }
   ```

4. **Prefer addEventListener** over inline onclick when possible
   ```typescript
   // ✅ Modern approach
   document.getElementById('fab-btn')?.addEventListener('click', () => {
     openModalFact();
   });
   ```

### ❌ DON'T

1. **Don't omit window. prefix** in onclick
   ```html
   <!-- ❌ Will cause ReferenceError -->
   <button onclick="openModalFact()">Add</button>
   ```

2. **Don't export to window** in module definition
   ```typescript
   // ❌ Scattered window exports
   export function openModalFact() {
     // ...
   }
   window.openModalFact = openModalFact; // Bad: mixed concerns
   ```

3. **Don't use global functions** without window object
   ```typescript
   // ❌ Implicit global (will fail in ES Module)
   function openModalFact() {
     // ...
   }
   ```

## Why This Matters

### ES Modules vs Global Scope

**Traditional JavaScript (pre-ES6):**
```javascript
// Global scope by default
function openModal() {
  // ...
}

// Accessible from onclick
<button onclick="openModal()">Open</button>
```

**ES Modules (modern):**
```javascript
// Module scope (isolated)
export function openModal() {
  // ...
}

// NOT accessible from onclick
<button onclick="openModal()">Open</button> // ReferenceError!

// Need explicit window export
window.openModal = openModal;
<button onclick="window.openModal()">Open</button> // ✅ Works
```

### Inline Onclick Handler Execution Context

```javascript
// When browser executes:
<button onclick="openModalFact()">Add</button>

// It evaluates as:
function onClick(event) {
  openModalFact(); // Looks up in global scope (window object)
}

// ES Module exports are NOT in window object by default
// → ReferenceError: openModalFact is not defined
```

## Testing

### 1. Check Window Exports

```javascript
// Browser console
console.log(typeof window.openModalFact); // "function"
console.log(typeof window.openModalPlan); // "function"
```

### 2. Test Onclick Handler

```html
<!-- Click this button -->
<button onclick="window.openModalFact()">Test</button>

<!-- Expected: Modal opens without console errors -->
```

### 3. Validate TypeScript Types

```bash
# Should show no errors for window.openModalFact
npm run type-check
```

## Common Errors

### Error 1: ReferenceError in Browser Console

```
Uncaught ReferenceError: openModalFact is not defined
    at HTMLButtonElement.onclick (index:2695)
```

**Cause**: Onclick handler missing `window.` prefix

**Fix**: Add `window.` prefix to function call
```html
<!-- Before -->
<button onclick="openModalFact()">

<!-- After -->
<button onclick="window.openModalFact()">
```

### Error 2: TypeScript Error on window Assignment

```
TS2339: Property 'openModalFact' does not exist on type 'Window & typeof globalThis'
```

**Cause**: Missing TypeScript declaration

**Fix**: Add declaration in windowExports.ts
```typescript
declare global {
  interface Window {
    openModalFact: () => Promise<void>;
  }
}
```

## Migration Guide

### Migrating Existing Onclick Handlers

**Step 1**: Find all onclick handlers
```bash
grep -rn "onclick=\"[a-zA-Z]" frontend/web/templates/
```

**Step 2**: Identify functions without window. prefix
```bash
grep -rn "onclick=\"[a-zA-Z]" frontend/web/templates/ | grep -v "window\."
```

**Step 3**: Add window. prefix
```diff
- <button onclick="openModalFact()">
+ <button onclick="window.openModalFact()">
```

**Step 4**: Verify window exports exist
```bash
grep "window\\.openModalFact" frontend/web/static/js/dashboard/adapters/windowExports.ts
```

**Step 5**: Test in browser
- Open browser console
- Click button
- Verify no ReferenceError

## Related

- **Template**: [windowExports.template.ts](../templates/windowExports.template.ts)
- **Documentation**: [TypeScript Integration](../../../docs/architecture/typescript-integration.md)
- **Real Case**: fab_toolbar.html fix (v11.1.24, commit 5ad6cf60)

## References

- MDN: [inline event handlers](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes#event_handler_attributes)
- TypeScript: [Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- ES Modules: [Module scope](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
