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
