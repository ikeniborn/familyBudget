# Table Optimization Patterns v2.0

**Version:** 2.0.0 (Client-Side Rendering)
**Date:** 2026-02-10
**Status:** ✅ Production (v11.4.25)

## Overview

Unified design patterns for rendering transaction tables across Dashboard and Facts pages. Implements responsive desktop/mobile layouts with consistent styling, icons, and user interactions.

## Architecture Decision

**Problem:** Original implementation used server-side HTML rendering (`/api/v1/facts/recent-html`), causing:
- Tight coupling between frontend and backend
- Duplicate rendering logic
- Slower response times
- Difficult to maintain consistency

**Solution:** Migrate to client-side JSON rendering:
- Backend returns structured JSON (`/api/v1/facts/recent`)
- TypeScript renders HTML on client
- Shared UI patterns between Dashboard and Facts pages
- Faster initial load (JSON smaller than HTML)

## Design Patterns

### 1. Responsive Layout Pattern

**Desktop Table (Tablet+):**
```html
<div class="hidden md:block overflow-x-auto">
  <table class="table table-zebra table-sm">
    <!-- Full feature table with all columns -->
  </table>
</div>
```

**Mobile List (Phone):**
```html
<div class="block md:hidden divide-y divide-base-200">
  <!-- Compact two-line list items -->
  <div class="py-2 cursor-pointer hover:bg-base-200" onclick="openEditFromDashboard(id)">
    <div class="flex items-center gap-2">
      <span class="badge">...</span>
      <span class="flex-1">Category</span>
      <span class="text-error font-bold">-1 234</span>
    </div>
    <div class="text-xs text-base-content/60 mt-1">
      01.02 • Account • Description
    </div>
  </div>
</div>
```

**Key Points:**
- Desktop: `hidden md:block` - full table with all columns
- Mobile: `block md:hidden` - compact list with tap-to-edit
- Breakpoint: `md` (768px)
- Mobile optimized for thumb navigation

### 2. Amount Color Coding Pattern

**Color Classes by Article Type:**

| Article Type | Color Class | Font | Sign | Usage |
|--------------|-------------|------|------|-------|
| `expense` | `text-error` | `font-bold` | `-` | Расход (красный) |
| `income` | `text-success` | `font-bold` | `+` | Доход (зелёный) |
| `debit` | `text-info` | `font-bold` | `-` | Списание (синий) |
| `credit` | `text-warning` | `font-bold` | `+` | Пополнение (оранжевый) |

**Implementation:**
```typescript
// Color class logic
let amountClass = 'font-bold';
if (article_type === 'expense') amountClass = 'text-error font-bold';
else if (article_type === 'income') amountClass = 'text-success font-bold';
else if (article_type === 'debit') amountClass = 'text-info font-bold';
else if (article_type === 'credit') amountClass = 'text-warning font-bold';

// Amount formatting
const amountInt = Math.floor(parseFloat(amount));
const formatted = amountInt.toLocaleString('ru-RU').replace(',', ' ');
let display = formatted;
if (article_type === 'expense' || article_type === 'debit') {
  display = `-${formatted}`;
} else if (article_type === 'income' || article_type === 'credit') {
  display = `+${formatted}`;
}
```

**Key Points:**
- Always include `font-bold` for visual emphasis
- Add sign prefix (+/-) for clarity
- Remove decimals (use `Math.floor`)
- Format with spaces: `1 234` not `1234`
- Use `ru-RU` locale for number formatting

### 3. Icon System Pattern

**Status Icons (Emoji):**

| Icon | Field | Title | Meaning |
|------|-------|-------|---------|
| 🔔 | `has_reminder` | "Напоминание" | Scheduled reminder exists |
| 🔄 | `recurring_plan_id` | "Регламентный платеж" | Generated from recurring plan |
| ☁️ | `is_offline_sync` | "Создано offline" | Created during offline mode |

**Action Icons:**

| Action | Icon Type | Class | SVG |
|--------|-----------|-------|-----|
| Edit | Emoji ✏️ | `btn-primary` | - |
| Delete | SVG | `btn-error btn-square` | Trash icon |

**Delete Button SVG:**
```html
<button class="btn btn-xs btn-error btn-square" onclick="..." title="Удалить">
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

**Key Points:**
- Status icons: Emoji (simple, no dependencies)
- Action icons: SVG for delete (consistent design)
- Edit uses emoji ✏️ for simplicity
- Delete uses SVG for professional appearance
- Always include `title` attribute for tooltips

### 4. Table Header Pattern

**Desktop Headers:**
```html
<thead>
  <tr>
    <th>Тип</th>
    <th>Дата</th>
    <th>Счёт</th>
    <th>Категория</th>
    <th>Сумма</th>
    <th>Описание</th>
    <th title="Напоминание">🔔</th>
    <th title="Регламентный платеж">🔄</th>
    <th title="Создано offline">☁️</th>
    <th>⚙️ Действия</th>
  </tr>
</thead>
```

**Key Points:**
- Status icons in headers for compact display
- Include tooltips via `title` attribute
- Actions header uses gear emoji ⚙️
- Single column for actions (Edit + Delete in flex container)

### 5. Button Layout Pattern

**Desktop Actions (Facts Page):**
```html
<td>
  <div class="flex gap-1">
    <button class="btn btn-xs btn-primary gap-1" onclick="...">✏️</button>
    <button class="btn btn-xs btn-error btn-square" onclick="...">
      <svg>...</svg>
    </button>
  </div>
</td>
```

**Dashboard Actions (Recent Records):**
```html
<td>
  <div class="flex gap-1">
    <button class="btn btn-xs btn-primary gap-1" onclick="openEditFromDashboard(${id})">✏️</button>
    <button class="btn btn-xs btn-error btn-square" onclick="deleteFactFromDashboard(${id}, ${isRecurring})">
      <svg>...</svg>
    </button>
  </div>
</td>
```

**Key Points:**
- Wrap buttons in `<div class="flex gap-1">` for spacing
- Edit: `btn-primary` with emoji
- Delete: `btn-error btn-square` with SVG
- Consistent function naming across pages

### 6. Function Naming Pattern

**Dashboard (Recent Records):**
```typescript
openEditFromDashboard(factId: number)
deleteFactFromDashboard(factId: number, isRecurring: 0 | 1)
```

**Facts Page:**
```typescript
window.FactsManager?.showEditModal?.(factId)
window.FactsManager?.deleteFact?.(factId)
```

**Key Points:**
- Dashboard uses global functions (simpler)
- Facts page uses namespace pattern (better encapsulation)
- Consistent verb naming: `open`/`show` for modals, `delete` for deletion
- Include context in name: `FromDashboard` suffix

### 7. Record Type Badge Pattern

**Badge Styles:**

| Record Type | Badge Class | Text |
|-------------|-------------|------|
| `fact` | `badge-success` | Факт |
| `plan` | `badge-info` | План |

**Sizes:**
- Desktop table: `badge-xs` (compact)
- Mobile list: `badge-sm` (readable)

**Implementation:**
```typescript
const badgeClass = record_type === 'plan'
  ? 'badge badge-info badge-xs'
  : 'badge badge-success badge-xs';
const text = record_type === 'plan' ? 'План' : 'Факт';
```

### 8. Date Formatting Pattern

**Desktop:** Full date `dd.mm.yyyy`
```typescript
const factDateFull = factDate.toLocaleDateString('ru-RU'); // "10.02.2026"
```

**Mobile:** Short date `dd.mm`
```typescript
const factDateShort = factDate.toLocaleDateString('ru-RU', {
  day: '2-digit',
  month: '2-digit'
}); // "10.02"
```

**Key Points:**
- Desktop shows full date for context
- Mobile shows short date to save space
- Always use `ru-RU` locale
- ISO 8601 format from API: `"2026-02-10"`

### 9. Text Truncation Pattern

**Description Truncation:**
```typescript
const description = fact.description || '—';
const descriptionFull = description;
const descriptionTruncated = description.length > 30
  ? description.substring(0, 30) + '...'
  : description;
```

**HTML with Tooltip:**
```html
<td class="max-w-xs truncate" title="${descriptionFull}">
  ${descriptionTruncated}
</td>
```

**Key Points:**
- Truncate at 30 characters for descriptions
- Show full text in `title` tooltip
- Use `—` (em dash) for empty values
- CSS: `max-w-xs truncate` for ellipsis

### 10. Empty State Pattern

**No Records:**
```html
<div class="alert alert-info">
  <svg>...</svg>
  <span>Записи не найдены. Добавьте первую запись!</span>
</div>
```

**Error State:**
```html
<div class="alert alert-error">
  <svg>...</svg>
  <span>Ошибка загрузки записей. Попробуйте обновить страницу.</span>
</div>
```

**Key Points:**
- Always show friendly message
- Include action hint ("Добавьте", "Попробуйте")
- Use DaisyUI alert components
- Include SVG icons for visual clarity

## Implementation Examples

### Recent Transactions (Dashboard)

**File:** `frontend/web/static/js/dashboard/recentTransactions.ts`

**Key Features:**
- Fetches JSON from `/api/v1/facts/recent?limit=10`
- Renders desktop table + mobile list
- Shows last 10 transactions
- Hidden during offline mode
- Auto-refreshes on `fact:created` event

**Usage:**
```typescript
await window.Dashboard.loadRecentTransactions();
```

### Facts Table (Facts Page)

**File:** `frontend/web/static/js/facts/operations/factsController.ts`

**Key Features:**
- Fetches JSON from `/api/v1/facts/list` with filters
- Supports pagination, sorting, filtering
- Checkbox selection for bulk operations
- Shows all transactions with advanced filters

**Usage:**
```typescript
await window.FactsManager.loadFacts();
```

## API Contract

### GET /api/v1/facts/recent

**Response Schema:**
```typescript
interface RecentTransaction {
  id: number;
  record_type: 'fact' | 'plan';
  fact_date: string; // ISO 8601
  financial_center_name: string | null;
  article_name: string;
  article_type: 'expense' | 'income' | 'debit' | 'credit';
  amount: string; // Decimal as string
  description: string | null;
  is_offline_sync: boolean;
  recurring_plan_id: number | null;
  has_reminder: boolean;
  user_name: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
}
```

**Key Points:**
- Backend returns enriched data (with JOINs)
- Includes `article_type` and `article_name` from Article table
- Includes `financial_center_name` from FinancialCenter table
- `has_reminder` calculated from ScheduledReminder existence
- All fields required for frontend rendering

## Backend Implementation

### Endpoint Logic

**File:** `backend/app/api/v1/endpoints/facts.py`

**Key Features:**
```python
# Multi-entity SELECT with JOINs
statement = (
    select(BudgetFact, Article, FinancialCenter, CostCenter, User)
    .join(Article, BudgetFact.article_id == Article.id)
    .outerjoin(FinancialCenter, BudgetFact.financial_center_id == FinancialCenter.id)
    .outerjoin(CostCenter, BudgetFact.cost_center_id == CostCenter.id)
    .outerjoin(User, BudgetFact.user_id == User.id)
)

# Build enriched response
for fact, article, financial_center, cost_center, user in rows:
    fact_dict = {
        "id": fact.id,
        "article_type": article.type,  # From JOIN
        "article_name": article.name,  # From JOIN
        "financial_center_name": financial_center.name if financial_center else None,
        # ... other fields
    }
```

**Key Points:**
- Use multi-entity SELECT to load related data
- JOIN with Article table (required fields)
- OUTERJOIN with optional tables (FinancialCenter, User)
- Build dict manually to include all required fields
- Cache result (TTL 10s) for performance

## Migration History

### v1.0 → v2.0 Migration (2026-02-10)

**Changes:**
1. ❌ Removed: `/api/v1/facts/recent-html` endpoint
2. ✅ Added: `/api/v1/facts/recent` JSON endpoint
3. ✅ Added: `recentTransactions.ts` client-side renderer
4. ✅ Fixed: Missing JOINs causing 500 errors
5. ✅ Fixed: Missing mobile responsive layout
6. ✅ Fixed: Amount color coding
7. ✅ Fixed: Icon system (🔔🔄☁️)
8. ✅ Fixed: Action buttons (SVG trash icon)
9. ✅ Fixed: Actions header (⚙️)

**Performance Impact:**
- Response size: HTML ~15KB → JSON ~8KB (47% reduction)
- Initial load: Faster (smaller payload)
- Cache efficiency: Better (JSON more cacheable)
- Maintainability: Improved (single source of truth)

## Testing

### Manual Testing Checklist

**Desktop (≥768px):**
- [ ] Table displays all 10 columns
- [ ] Amount colors: red (expense), green (income), blue (debit), orange (credit)
- [ ] Font bold on amounts
- [ ] Icons: 🔔🔄☁️ visible with tooltips
- [ ] Actions header shows "⚙️ Действия"
- [ ] Edit button: blue with ✏️
- [ ] Delete button: red square with SVG trash icon
- [ ] Buttons have 1px gap
- [ ] Hover states work

**Mobile (<768px):**
- [ ] List view (not table)
- [ ] Two-line compact layout
- [ ] Tap on row opens edit modal
- [ ] Amount colors match desktop
- [ ] Icons visible inline
- [ ] Badge sizes readable (badge-sm)
- [ ] Description truncated correctly

**Edge Cases:**
- [ ] Empty state shows info message
- [ ] Error state shows error message
- [ ] Offline mode hides section
- [ ] Long descriptions truncate with tooltip
- [ ] Missing financial center shows "—"
- [ ] Zero facts handled gracefully

### E2E Tests

**Location:** `tests/e2e/webapp/test_recent_records.spec.ts` (TODO)

**Test Cases:**
```typescript
test('should render desktop table with all columns', async ({ page }) => {
  // Verify 10-column table structure
  // Verify Actions header with ⚙️
});

test('should render mobile list on small screens', async ({ page }) => {
  // Set viewport to 375x667
  // Verify list view (not table)
  // Verify tap-to-edit
});

test('should apply correct amount colors', async ({ page }) => {
  // Verify expense = text-error
  // Verify income = text-success
  // Verify font-bold applied
});

test('should show status icons with tooltips', async ({ page }) => {
  // Verify 🔔🔄☁️ icons
  // Hover and verify tooltips
});
```

## Performance Considerations

### Caching Strategy

**Backend Cache:**
```python
cache_key = f"recent_facts:{user_id}:{limit}"
cached = await cache_service.get(cache_key)
await cache_service.set(cache_key, enriched_facts, CacheTTL.SHORT())  # 10s TTL
```

**Cache Invalidation:**
- On fact CRUD operations
- Via WebSocket broadcast (`fact:created`, `fact:updated`, `fact:deleted`)
- TTL: 10 seconds (balance between freshness and performance)

### Query Optimization

**Partition Pruning:**
```python
cutoff_date = date.today() - timedelta(days=90)
statement = statement.where(BudgetFact.fact_date >= cutoff_date)
```

**Benefits:**
- Reduces partition locks from 96 → ~3
- Prevents "out of shared memory" errors
- Faster query execution (<100ms)

**Trade-off:**
- Only shows recent 90 days (acceptable for dashboard)

## Best Practices

### Do's ✅

1. **Always use multi-entity SELECT for related data**
   ```python
   select(BudgetFact, Article, FinancialCenter, User)
   ```

2. **Include all required fields in response**
   - `article_type`, `article_name` from Article
   - `financial_center_name` from FinancialCenter
   - `has_reminder` calculated flag

3. **Use consistent color classes**
   - `text-error font-bold` for expenses
   - `text-success font-bold` for income

4. **Format amounts consistently**
   - Remove decimals: `Math.floor()`
   - Add sign: `+` or `-`
   - Add spaces: `1 234`

5. **Wrap buttons in flex container**
   ```html
   <div class="flex gap-1">
     <button>Edit</button>
     <button>Delete</button>
   </div>
   ```

### Don'ts ❌

1. **Don't use emoji for delete icon**
   - ❌ `🗑️` emoji
   - ✅ SVG trash icon

2. **Don't forget font-bold on amounts**
   - ❌ `text-error`
   - ✅ `text-error font-bold`

3. **Don't use separate columns for actions**
   - ❌ `<th class="w-8"></th><th class="w-8"></th>`
   - ✅ `<th>⚙️ Действия</th>` (single column)

4. **Don't skip mobile responsive layout**
   - ❌ Desktop-only table
   - ✅ Desktop table + mobile list

5. **Don't return HTML from API**
   - ❌ `/api/v1/facts/recent-html`
   - ✅ `/api/v1/facts/recent` (JSON)

## Troubleshooting

### Common Issues

**Problem:** 500 error - missing `article_type`/`article_name`
```
ValidationError: Field required
```
**Solution:** Add JOINs to Article table in backend query

---

**Problem:** Amount not bold
**Solution:** Add `font-bold` class: `text-error font-bold`

---

**Problem:** Mobile table not responsive
**Solution:** Add mobile list view: `<div class="block md:hidden">`

---

**Problem:** Delete button emoji differs from Facts page
**Solution:** Replace emoji with SVG trash icon + `btn-square`

---

**Problem:** Actions header missing
**Solution:** Replace `<th class="w-8"></th>` with `<th>⚙️ Действия</th>`

## Related Documentation

- [Frontend Responsive Design](./responsive-design.md) - Breakpoints and mobile patterns
- [Modal Architecture](./modal-architecture.md) - Modal interactions
- [WebSocket Real-time Updates](../core/websocket.md) - Event broadcasting
- [Caching Strategy](../optimization/caching-strategy.md) - Cache TTL patterns
- [API Endpoints](../backend/endpoints/) - REST API documentation

## Changelog

### v2.0.0 (2026-02-10) - Table Optimization Plan

**Added:**
- Client-side JSON rendering for Recent Records
- Multi-entity SELECT with JOINs in backend
- Unified desktop/mobile responsive patterns
- SVG trash icon for delete buttons
- Actions header with ⚙️ icon

**Fixed:**
- 404 error on `/static/js/dashboard/recentTransactions.js`
- 500 error due to missing `article_type`/`article_name`
- Missing mobile responsive layout
- Amount color coding without `font-bold`
- Inconsistent delete icon (emoji vs SVG)
- Missing Actions header in table

**Removed:**
- Server-side HTML rendering (`/recent-html` endpoint deprecated)

### v1.0.0 (2025-XX-XX) - Initial Implementation

- Server-side HTML rendering
- Basic table structure
- Desktop-only layout
