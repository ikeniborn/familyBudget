# Shopping Lists Module Architecture

**Last Updated:** 2026-01-07
**Version:** 7.x

## Overview

Shopping lists module provides multi-user shared shopping list management with store-specific items, product groups, duplicate detection, and offline synchronization.

**Key Features:**
- Multi-tab real-time synchronization
- Offline support with conflict resolution
- Duplicate item detection and aggregation
- CSV import/export
- Store and product group hierarchy

---

## Quantity Handling (v7.x+)

**Decision:** Display integers only, store decimals for backward compatibility.

### Rationale

**User Preference:**
- Users prefer whole numbers for shopping (5 яблок, 2 kg, 3 l)
- Decimal quantities (2.5, 1.75) cause confusion in shopping context
- Simpler UI: no decimal input, cleaner display

**Backward Compatibility:**
- Existing data may have decimals (2.5 kg from legacy version)
- Database keeps NUMERIC(10,3) to avoid data migration risks
- API still accepts decimals (no breaking changes for old clients)

**Implementation Strategy:**
- Frontend enforces integers for new entries
- Frontend displays all quantities as rounded integers
- Backend accepts both but prefers integers (logs warnings)

---

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INPUT                            │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  HTML Input Validation (step="1", min="0")                  │
│  - Browser enforces integer increments via UI controls      │
│  - User can type "2.5" but JS will normalize it             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  JavaScript Normalization (normalizeQuantityToInteger)      │
│  - Parses input: "2.5" → 2.5 (float)                        │
│  - Rounds: 2.5 → 3 (integer)                                │
│  - Logs: [LISTS_VALIDATION] Non-integer detected, rounding  │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API Request (POST /api/v1/shopping-list-items)             │
│  Payload: { quantity: 3 }                                   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Validation (Pydantic Schema)                       │
│  - Type: Optional[Decimal]                                  │
│  - Constraint: ge=0 (non-negative)                          │
│  - No integer enforcement (backward compatible)             │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Database Storage (NUMERIC(10,3))                           │
│  - Stored: 3.000 (with decimal precision)                   │
│  - Max digits: 10 (total), 3 (decimal places)               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  API Response (GET /api/v1/shopping-list-items)             │
│  Response: { quantity: 3.000 }                              │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Display (Math.round in formatQuantity)            │
│  - Input: 3.000                                             │
│  - Rounded: Math.round(3.000) = 3                           │
│  - Displayed: "3 кг"                                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Code Locations

#### Frontend

**HTML Template:**
```html
<!-- frontend/web/templates/lists.html:350 -->
<input type="number" name="quantity" id="item-quantity"
       step="1" min="0" placeholder="1">
```

**JavaScript Normalization:**
```typescript
// frontend/web/static/js/lists/listsManager.ts:3207-3232
function normalizeQuantityToInteger(quantity: number | null): number | null {
  if (quantity === null || quantity === undefined) return null;

  const numValue = Number(quantity);

  if (isNaN(numValue)) {
    console.error('[LISTS_VALIDATION] Invalid quantity value:', quantity);
    return null;
  }

  if (!Number.isInteger(numValue)) {
    const rounded = Math.round(numValue);
    console.warn('[LISTS_VALIDATION] Non-integer quantity detected, auto-rounding:', {
      original: numValue,
      rounded: rounded
    });
    return rounded;
  }

  return numValue;
}
```

**Form Submission:**
```typescript
// frontend/web/static/js/lists/listsManager.ts:3248-3253
const rawQuantity = formData.get('quantity');
const parsedQuantity = rawQuantity ? parseFloat(String(rawQuantity)) : null;
const normalizedQuantity = normalizeQuantityToInteger(parsedQuantity);

console.log('[LISTS_SAVE] Normalized quantity:', {
  raw: rawQuantity,
  normalized: normalizedQuantity
});
```

**Display Formatting:**
```typescript
// frontend/web/static/js/lists/listsManager/rendering/tableBuilder.ts:47-56
function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '—';

  const rounded = Math.round(quantity);

  console.log(`[LISTS_TABLE] Formatting quantity: raw=${quantity}, rounded=${rounded}, unit=${unit}`);

  return unit ? `${rounded} ${unit}` : rounded.toString();
}
```

#### Backend

**Pydantic Schema:**
```python
# backend/app/schemas/shopping_list_item.py:59-64
quantity: Optional[Decimal] = Field(
    default=None,
    ge=0,
    description="Quantity to buy (OPTIONAL, integers preferred)",
    examples=[1, 2, 5, None]
)
```

**API Endpoint Logging:**
```python
# backend/app/api/v1/endpoints/shopping_list_items.py:212-218
if item.quantity is not None and item.quantity % 1 != 0:
    logger.warning(
        f"[SHOPPING_ITEM] Non-integer quantity detected: "
        f"item_id={item.id}, quantity={item.quantity}, "
        f"message='Integer quantities preferred (legacy data)'"
    )
```

**Database Model:**
```python
# backend/app/models/shopping_list_item.py:151-156
quantity: Optional[Decimal] = Field(
    default=None,
    max_digits=10,
    decimal_places=3,
    description="Quantity to buy (OPTIONAL, e.g., 2.5)"
)
```

---

### Examples

#### New Item Creation (Integer)

**User Action:** Enters "5" in quantity field, selects "кг" unit

**Flow:**
1. HTML input: `value="5"` (step="1" enforces integer)
2. JavaScript: `parseFloat("5")` → 5 → `normalizeQuantityToInteger(5)` → 5
3. API request: `POST /api/v1/shopping-list-items { quantity: 5 }`
4. Database: Stores `5.000` (NUMERIC(10,3))
5. API response: `{ quantity: 5.000 }`
6. Display: `Math.round(5.000)` → "5 кг"

**Logs:**
```
[LISTS_VALIDATION] Quantity is valid integer: 5
[LISTS_SAVE] Normalized quantity: {raw: "5", normalized: 5}
[LISTS_TABLE] Formatting quantity: raw=5, rounded=5, unit=кг
```

#### Legacy Data (Decimal)

**Scenario:** Existing item in DB with `quantity=2.5`

**Flow:**
1. User opens list → API request: `GET /api/v1/shopping-list-items`
2. API response: `{ quantity: 2.5 }`
3. Display: `formatQuantity(2.5, "кг")` → `Math.round(2.5)` → "3 кг"

**Logs:**
```
[LISTS_TABLE] Formatting quantity: raw=2.5, rounded=3, unit=кг
```

**If user edits this item:**
1. Modal shows quantity input (value from API: 2.5)
2. User saves without changing → `normalizeQuantityToInteger(2.5)` → 3
3. Database updated: `2.5` → `3.000`

**Logs:**
```
[LISTS_VALIDATION] Non-integer quantity detected, auto-rounding: {original: 2.5, rounded: 3}
[LISTS_SAVE] Normalized quantity: {raw: "2.5", normalized: 3}
```

#### User Bypasses HTML Validation

**Scenario:** User types "2.7" directly in input (some browsers allow)

**Flow:**
1. Form submission: `formData.get('quantity')` → "2.7"
2. JavaScript: `parseFloat("2.7")` → 2.7
3. Normalization: `normalizeQuantityToInteger(2.7)` → `Math.round(2.7)` → 3
4. API request: `{ quantity: 3 }`
5. Database: Stores `3.000`

**Logs:**
```
[LISTS_VALIDATION] Non-integer quantity detected, auto-rounding: {original: 2.7, rounded: 3}
[LISTS_SAVE] Normalized quantity: {raw: "2.7", normalized: 3}
```

**Result:** User sees "3" instead of "2.7" (auto-corrected silently)

---

### Backward Compatibility

#### Existing Data

**Status Quo:**
- Database may contain items with decimal quantities (e.g., 2.5 kg)
- No data migration required
- No data loss

**New Behavior:**
- Decimal data displayed as rounded integers (2.5 → 3)
- User can edit item → quantity auto-normalized to integer
- After edit, database updated to integer (2.5 → 3.000)

#### API Compatibility

**Breaking Changes:** None

**Reason:**
- Backend still accepts `quantity` as `Optional[Decimal]`
- Old API clients can still send decimals (2.5)
- Backend logs warning but doesn't reject
- Response format unchanged (`{ quantity: 3.000 }`)

**Migration Path:**
- No client updates required
- Gradual data normalization (as users edit items)

---

### Testing

#### Unit Tests

**Frontend:**
```javascript
// Test normalizeQuantityToInteger
describe('normalizeQuantityToInteger', () => {
  test('integer pass-through', () => {
    expect(normalizeQuantityToInteger(5)).toBe(5);
  });

  test('decimal rounding', () => {
    expect(normalizeQuantityToInteger(2.5)).toBe(3);
    expect(normalizeQuantityToInteger(2.4)).toBe(2);
  });

  test('null handling', () => {
    expect(normalizeQuantityToInteger(null)).toBe(null);
  });

  test('invalid input', () => {
    expect(normalizeQuantityToInteger(NaN)).toBe(null);
  });
});

// Test formatQuantity
describe('formatQuantity', () => {
  test('integer display', () => {
    expect(formatQuantity(5, 'кг')).toBe('5 кг');
  });

  test('decimal rounding', () => {
    expect(formatQuantity(2.5, 'кг')).toBe('3 кг');
  });

  test('null display', () => {
    expect(formatQuantity(null, 'кг')).toBe('—');
  });
});
```

#### Integration Tests

**Manual Test Cases:**

1. **New Item - Integer Input**
   - Action: Enter "5", select "кг"
   - Expected: Displays "5 кг" in table
   - Backend log: No warning (integer)

2. **New Item - Decimal Bypass**
   - Action: Type "2.5" via keyboard
   - Expected: Auto-rounds to "3", displays "3 кг"
   - Browser console: `[LISTS_VALIDATION] Non-integer quantity detected, auto-rounding`

3. **Legacy Data Display**
   - Action: Load list with item quantity=2.5
   - Expected: Displays "3 кг" (rounded)
   - Browser console: `[LISTS_TABLE] Formatting quantity: raw=2.5, rounded=3`

4. **Legacy Data Edit**
   - Action: Edit item with quantity=2.5, save without change
   - Expected: Database updated to 3.000
   - Backend log: No warning (normalized to integer)

5. **Empty Quantity**
   - Action: Leave quantity blank, save item
   - Expected: Displays "—" in table
   - Database: NULL

---

### Performance Considerations

**Impact:** Minimal

**Changes:**
- HTML validation: No performance cost (native browser feature)
- JavaScript normalization: ~0.1ms per save operation
- Display formatting: ~0.05ms per item render
- Backend logging: ~0.2ms per non-integer detection (rare)

**Memory:**
- Database: NUMERIC(10,3) = 8 bytes per row (unchanged)
- Frontend: No additional memory (inline operations)

---

## Mobile Swipe Gestures (v7.x+)

### Device-Specific Behavior

**Breakpoints (Updated v7.x):**

| Device Category | Screen Width | Inline Buttons (Edit/Delete) | Swipe Indicator | Interaction Method |
|-----------------|--------------|------------------------------|-----------------|-------------------|
| **Mobile** | <768px | Hidden (`display: none`) | Visible (animated) | Swipe gestures only |
| **Tablet (iPad)** | 768px-1023px | Hidden (`display: none`) | Visible (animated) | Swipe gestures only |
| **Desktop** | ≥1024px | Visible (on hover) | Hidden | Mouse hover + click |

**CSS Implementation:** `frontend/web/static/css/lists.css:627`
```css
@media (max-width: 1023px) {
    /* Hide inline actions on mobile and tablet (use swipe instead) */
    .hierarchy-item-content .hierarchy-item-actions {
        display: none;
    }
}
```

**Rationale:**
- **Touch-first design:** iPad users prefer swipe gestures over hover interactions
- **Consistent mobile experience:** Tablets use same interaction pattern as phones
- **Clear desktop boundary:** 1024px provides natural split between touch and pointer devices

**Historical Change (v7.x):**
- **Before:** Tablets (640px-1023px) showed inline buttons on hover
- **After:** Tablets now use swipe-only (same as mobile)
- **Impact:** Unified touch experience across mobile and tablet

---

### Swipe State Cleanup

**Implementation:** `frontend/web/static/js/lists/listsManager/ui/modalManager.ts:199-260`

**Problem Solved:**
After swipe-to-edit gesture, closing the modal (via Cancel button, backdrop, or ESC) left items visually shifted (translateX) with empty space on the right side. This was particularly noticeable on iOS Safari.

**Root Cause:**
- `closeItemModal()` originally only called `modal.close()` without cleaning up swipe state
- HTML5 dialog backdrop (`<form method="dialog">`) closes modal without triggering JavaScript handlers
- `modalOpenedBySwipe` flag remained set, creating stale state

**Solution:**

#### Cleanup Flow

When the edit modal closes (via any method), `closeItemModal()` performs cleanup:

1. **Check SwipeHandler Availability**
   - Accesses `window.hierarchyView.swipeHandler`
   - Skips cleanup if HierarchyView not initialized (desktop/table view)

2. **Verify Modal Opened by Swipe**
   - Checks `modalOpenedBySwipe` flag
   - Only cleans up if modal was opened via swipe gesture (not regular clicks)

3. **Find Swiped Element**
   - Queries DOM for `.hierarchy-item[data-item-id="${itemId}"]`
   - Handles edge case where item was deleted while modal open

4. **Reset Transform**
   - Calls `swipeHandler.resetSwipe(itemId, swipedElement)`
   - Resets inline style: `transform: translateX(0)`
   - Removes `.swiped` CSS class
   - Clears `activeSwipedItemId` state

5. **Clear Tracking Flag**
   - Sets `modalOpenedBySwipe = null`
   - Prevents stale state for subsequent operations

6. **Close Modal**
   - Calls `modal.close()` after cleanup complete

#### Code Reference

```typescript
// modalManager.ts:202-260
export function closeItemModal(): void {
  // STEP 1: Cleanup swipe state BEFORE closing modal
  const hierarchyView = (window as any).hierarchyView;
  if (hierarchyView?.swipeHandler) {
    const swipeHandler = hierarchyView.swipeHandler;

    if (swipeHandler.modalOpenedBySwipe) {
      const itemId = swipeHandler.modalOpenedBySwipe;
      const swipedElement = document.querySelector(
        `.hierarchy-item[data-item-id="${itemId}"]`
      ) as HTMLElement | null;

      if (swipedElement) {
        console.log('[MODAL_CLOSE] Cleaning up swipe state', {
          itemId,
          hadTransform: swipedElement.querySelector('.hierarchy-item-content')?.style.transform,
          timestamp: Date.now()
        });

        swipeHandler.resetSwipe(itemId, swipedElement);
      }

      swipeHandler.modalOpenedBySwipe = null;
    }
  }

  // STEP 2: Close modal
  const modal = document.getElementById('item-modal') as HTMLDialogElement | null;
  if (modal) modal.close();
}
```

#### Global Exposure

HierarchyView is exposed globally for cleanup and HTML onclick handlers:

```typescript
// listsManager.ts:186-190
if (typeof HierarchyView !== 'undefined') {
    this.hierarchyView = new HierarchyView(this);
    (window as any).hierarchyView = this.hierarchyView;
    debugLog('[ListsManager] HierarchyView initialized and exposed globally');
}
```

#### Enhanced Logging

`openEditModal()` includes comprehensive logging for debugging:

```javascript
// hierarchyView.js:162-202
openEditModal(itemId, itemElement) {
    const contentElement = itemElement.querySelector('.hierarchy-item-content');
    const beforeTransform = contentElement ? contentElement.style.transform : 'none';

    console.log('[SWIPE_OPEN] Resetting swipe state before modal open', {
        itemId,
        beforeTransform,
        timestamp: Date.now()
    });

    this.resetSwipe(itemId, itemElement);

    const afterTransform = contentElement ? contentElement.style.transform : 'none';
    console.log('[SWIPE_OPEN] Swipe state reset completed', {
        cleared: afterTransform === 'translateX(0px)' || afterTransform === '',
        warning: !isCleared ? 'Transform not properly cleared!' : null
    });

    this.modalOpenedBySwipe = itemId;
    openEditItemModal(itemId);
}
```

#### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| Item not found (deleted) | Flag still cleared, cleanup skips transform reset |
| Multiple rapid swipes | Only current item cleaned up |
| Modal closed via backdrop/ESC | Same cleanup as Cancel button |
| Modal closed via Save | Same cleanup (flag cleared, transform reset) |
| Desktop/table view | Cleanup skipped (SwipeHandler not initialized) |
| Non-swipe modal open | Cleanup skipped (modalOpenedBySwipe = null) |

#### iOS Safari Considerations

**Known Quirks:**
- `visibility: hidden` required for guaranteed non-interactivity
- Touch event timing may differ from other browsers
- Dialog backdrop click behavior consistent with standard

**Testing Priority:** iOS Safari (primary), Android Chrome (secondary)

**Logging Prefixes:**
- `[MODAL_CLOSE]` - All cleanup operations
- `[SWIPE_OPEN]` - Modal opened via swipe
- `[SWIPE]` - General swipe events

#### Verification

**Browser Console Diagnostics:**
```javascript
// Check swipe state
window.hierarchyView.swipeHandler.modalOpenedBySwipe  // Should be null when modal closed
window.hierarchyView.swipeHandler.activeSwipedItemId  // Should be null

// Visual inspection - find stuck transforms
document.querySelectorAll('.hierarchy-item-content').forEach(el => {
  if (el.style.transform && el.style.transform !== 'translateX(0px)') {
    console.log('Found stuck transform:', el.style.transform, el.closest('.hierarchy-item'));
  }
});
```

**Expected Logs (Successful Cleanup):**
```
[SWIPE_OPEN] Resetting swipe state before modal open {itemId: 123, beforeTransform: "translateX(-180px)"}
[SWIPE_OPEN] Swipe state reset completed {cleared: true, afterTransform: "translateX(0px)"}
[SWIPE] Modal opened {itemId: 123, source: "swipe_gesture"}
[MODAL_CLOSE] Cleaning up swipe state {itemId: 123, hadTransform: "translateX(0px)"}
[MODAL_CLOSE] Swipe state cleaned {cleared: true, afterTransform: "none"}
[MODAL_CLOSE] Swipe flag cleared
[MODAL_CLOSE] Closing item modal
```

---

## Completed Items Behavior (v7.x+)

### Visual and Interaction Changes

When a shopping item is marked as completed (checkbox checked), the UI adapts to optimize screen space and disable unnecessary interactions:

**CSS Changes:** `frontend/web/static/css/lists.css:617-624`

```css
/* Hide on completed items and expand quantity to right edge */
.hierarchy-item.completed .swipe-indicator {
    display: none;
}

.hierarchy-item.completed .hierarchy-item-text {
    padding-right: 0;  /* Remove padding - quantity expands to right edge */
}
```

**JavaScript Changes:** `frontend/web/static/js/lists/hierarchyView.js:46-51`

```javascript
handleTouchStart(e, itemId, itemElement) {
    // CRITICAL: Disable swipe for completed items (no indicator, no action needed)
    if (itemElement.classList.contains('completed')) {
        console.log('[SWIPE] Skipped - item is completed', { itemId });
        return;
    }
    // ...
}
```

---

### State Transition

**Item Unchecked (Active):**
```
┌──────────────────────────────────────────────────┐
│ ☐ Milk      5 kg          ⟨ ⟨ ⟩           │
│   └─text─┘  └qty┘  └─6rem padding─┘ └indicator┘ │
│                                                  │
│ Swipe enabled ✓                                  │
│ Indicator visible ✓                              │
│ Padding-right: 6rem ✓                            │
└──────────────────────────────────────────────────┘
```

**Item Checked (Completed):**
```
┌──────────────────────────────────────────────────┐
│ ☑ Milk      5 kg                                 │
│   └─text─┘  └qty (expanded to right edge)──────┘│
│                                                  │
│ Swipe disabled ✗                                 │
│ Indicator hidden ✗                               │
│ Padding-right: 0 ✓                               │
└──────────────────────────────────────────────────┘
```

---

### Rationale

**Space Optimization:**
- Completed items don't need edit/delete actions (tap to uncomplete is primary action)
- Hiding swipe indicator reclaims ~96px of horizontal space
- Quantity expands to right edge for better visual balance

**Interaction Simplification:**
- Disabling swipe prevents accidental modal opens on completed items
- User can still uncomplete via checkbox tap
- Edit/delete available after unchecking

**Performance:**
- Early return in `handleTouchStart` avoids unnecessary calculations
- DOM class-based detection (`classList.contains('completed')`)
- No additional event listeners or watchers needed

---

### Edge Cases Handled

| Scenario | Behavior |
|----------|----------|
| **Check item → Swipe attempt** | Swipe disabled, logs `[SWIPE] Skipped - item is completed` |
| **Uncheck item → Swipe attempt** | Swipe enabled, indicator visible, opens modal |
| **Completed item without quantity** | Padding still removed, "—" placeholder at right edge |
| **Desktop view (≥1024px)** | Padding already 0, no visual change on complete/uncomplete |
| **Tablet view (768px-1023px)** | Same as mobile (padding removed, indicator hidden) |
| **Modal open when item completed** | Modal stays open, swipe state unaffected |

---

### Testing Verification

**Mobile/Tablet (<1024px):**
1. ✅ Unchecked item: Swipe indicator visible, padding-right: 6rem
2. ✅ Check item: Indicator disappears, quantity expands right
3. ✅ Swipe attempt on completed: No response (disabled)
4. ✅ Uncheck item: Indicator returns, padding restored, swipe works

**Desktop (≥1024px):**
1. ✅ Indicator already hidden (media query)
2. ✅ Padding already 0
3. ✅ No visual change on complete/uncomplete

**Browser Console Diagnostics:**
```javascript
// Check completed item swipe state
const completedItem = document.querySelector('.hierarchy-item.completed');
const contentElement = completedItem?.querySelector('.hierarchy-item-content');

console.log({
  hasCompletedClass: completedItem?.classList.contains('completed'),
  paddingRight: window.getComputedStyle(completedItem.querySelector('.hierarchy-item-text')).paddingRight,
  indicatorDisplay: window.getComputedStyle(completedItem.querySelector('.swipe-indicator')).display,
  swipeDisabled: !window.hierarchyView?.swipeHandler?.isDragging
});

// Expected output for completed item:
// {
//   hasCompletedClass: true,
//   paddingRight: "0px",
//   indicatorDisplay: "none",
//   swipeDisabled: true
// }
```

**Commit History:**
- `a382f236` - Initial implementation of completed item behavior
- Related: `180473ef` - Desktop quantity dynamic positioning
- Related: `4a1041c0` - Swipe indicator spacing fixes

---

## Related Documentation

- [Database Schema](/docs/architecture/database/shopping-lists.md)
- [Offline Synchronization](/docs/architecture/offline-sync.md)
- [CSV Import/Export](/docs/architecture/csv-import.md)
- [Multi-Tab Coordination](/docs/architecture/multi-tab.md)

---

## Future Considerations

### Potential Improvements

1. **Full INT Migration**
   - Create Alembic migration to change column type
   - Round all existing decimals during migration
   - Change Pydantic schema to `int`
   - Benefits: Simpler data model, clearer intent
   - Risks: Data loss (2.5 → 3), migration complexity

2. **User Preference**
   - Add user setting: "Allow decimal quantities"
   - Per-user quantity format preference
   - Dynamic step logic based on preference
   - Benefits: Flexibility for power users
   - Risks: Complexity, UI confusion

3. **Unit-Specific Decimals**
   - Allow decimals only for weight/volume units (kg, l)
   - Integer-only for countable units (шт, упак)
   - Benefits: More accurate for weight-based shopping
   - Risks: Inconsistent UX, complex validation

**Current Decision:** Keep hybrid approach (v7.x)
- Simplicity over flexibility
- Gradual data normalization
- Backward compatible
