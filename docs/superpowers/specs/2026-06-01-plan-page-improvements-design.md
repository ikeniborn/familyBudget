# Design: Plan Page Improvements

**Date:** 2026-06-01
**Status:** approved
**Intent doc:** `docs/superpowers/intents/2026-06-01-plan-page-improvements-intent.md`

---

## Overview

Four independent improvements to the plan page (`/plan`):

1. **Planning period offset** — default period shifts to next month after the 20th
2. **Category typeahead** — replace `<select>` dropdown with `ChoicesCategoryTree` in analytics filter
3. **Pagination** — API-first with "Load more" button instead of loading all records at once
4. **Double render fix** — align `get_fact_row_html` backend output with `renderFactsTable` TypeScript output

---

## Task 1: Planning Period Offset

### Rule

```
if today.day < 20:  planning_month = current month
if today.day >= 20: planning_month = next month
```

### Backend utility

New file: `backend/app/utils/planning.py`

```python
from datetime import date, timedelta

def get_planning_month(as_of: date | None = None) -> date:
    """Return the first day of the current planning month.
    Before the 20th: returns first day of current month.
    From the 20th onward: returns first day of next month.
    """
    today = as_of or date.today()
    if today.day >= 20:
        # advance to next month
        first_next = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
        return first_next
    return today.replace(day=1)
```

Used by:
- `bot/handlers/add_plan.py` — suggest default date hint when prompting for date
- Any future backend logic that needs the current planning period

### Frontend (filters.ts)

Replace the two `DEFAULT_DATE_FROM` / `DEFAULT_DATE_TO` IIFE computations with a shared function:

```typescript
function getPlanningMonthStart(): Date {
  const today = new Date();
  const base = today.getDate() >= 20
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  return base;
}
```

`DEFAULT_DATE_FROM` = `getPlanningMonthStart()` formatted as `YYYY-MM-DD`.
`DEFAULT_DATE_TO` = 3 months after `getPlanningMonthStart()`, last day.

Both `DEFAULT_DATE_FROM` and `DEFAULT_DATE_TO` constants stay — they just use the new helper.

### Frontend (planModal.ts — setupCreatePlanPeriodButtons)

Replace `today.getMonth()` base with planning month base:

```typescript
// Before
const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);

// After
const planningBase = new Date(
  today.getDate() >= 20
    ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1)
);
const d = new Date(planningBase.getFullYear(), planningBase.getMonth() + offset, 1);
```

Same change applies to `transfer-period-btn` in `plan_transfer_tab.html` (same JS pattern in a corresponding setup function if it exists, or inline in template).

### Bot (add_plan.py)

In `amount_entered()`, add a planning period hint to the date-prompt message:

```python
from backend.app.utils.planning import get_planning_month  # or duplicate the 3-line rule locally

planning_month = get_planning_month()
hint = planning_month.strftime("01.%m.%Y")

# Prompt text addition:
f"💡 Рекомендуемый период: {hint}"
```

Bot API contracts unchanged — user still enters date manually; hint is informational only.

### Affected files

| File | Change |
|------|--------|
| `backend/app/utils/planning.py` | NEW — utility function |
| `frontend/web/static/js/plan/filters.ts` | `DEFAULT_DATE_FROM` / `DEFAULT_DATE_TO` use `getPlanningMonthStart()` |
| `frontend/web/static/js/plan/planModal.ts` | `setupCreatePlanPeriodButtons()` — planning base |
| `bot/handlers/add_plan.py` | Add hint to date prompt |

---

## Task 2: Category Typeahead in Analytics

### Current state

`analytics-article` is a plain `<select>` element. `loadAnalyticsArticleFilter()` manipulates DOM options directly.

### Change

Replace DOM-based population with `ChoicesCategoryTree` (already used on `analytics.html:2652` with identical pattern).

New module: `frontend/web/static/js/plan/analyticsArticleChoices.ts`

```typescript
let articleChoicesInstance: any = null;

export function initAnalyticsArticleChoices(
  articles: Array<{ id: number; name: string; type: string; parent_id: number | null }>,
  articleType: string | null
): void {
  const ChoicesCategoryTree = (window as any).BudgetShared?.ChoicesCategoryTree;
  if (!ChoicesCategoryTree) return;

  if (articleChoicesInstance?.destroy) {
    articleChoicesInstance.destroy();
    articleChoicesInstance = null;
  }

  articleChoicesInstance = new ChoicesCategoryTree('#analytics-article', {
    type: articleType || undefined,
    multiple: false,
    showPath: false,
    showClearButton: true,
    mode: 'create',
    onChange: (selected: any[]) => {
      const id = selected[0]?.id ?? null;
      onAnalyticsArticleChange(id);
    }
  });
}
```

`onAnalyticsArticleChange(id)` calls existing analytics reload logic (currently in `analytics.ts`).

All existing `loadAnalyticsArticleFilter()` call sites replaced with `initAnalyticsArticleChoices(articles, type)`.

When article type filter changes → destroy + re-init (same pattern as analytics.html).

### HTML change

`plan.html` — the `#analytics-article` element stays as `<select>`, `ChoicesCategoryTree` wraps it (no HTML structure change needed).

### Affected files

| File | Change |
|------|--------|
| `frontend/web/static/js/plan/analyticsArticleChoices.ts` | NEW — init/destroy wrapper |
| `frontend/web/static/js/plan/analytics.ts` | Replace `loadAnalyticsArticleFilter()` body; call `initAnalyticsArticleChoices` |

---

## Task 3: API-First Pagination with "Load more"

### Current state

`loadFacts()` in `factsTable.ts`:
1. Calls `dataLayer.getFacts(factFilters)` → loads **all** matching records from Dexie
2. Post-filters, sorts, slices client-side
3. Client-side prev/next pagination over already-loaded data

Facts API already supports `limit`, `offset`, `total` (facts.py:522–717). Default limit 100, max 10000.

### Change

Replace client-side "load all → slice" with server-side API calls with `limit=50&offset=N`.

#### State

```typescript
let currentOffset = 0;
const PAGE_SIZE = 50;
let totalFacts = 0;        // existing — repurpose
let hasMoreFacts = false;  // new flag
```

#### loadFacts() — new flow

```
1. Reset: currentOffset = 0, clear table
2. GET /api/v1/facts?record_type=plan&...filters...&limit=50&offset=0
3. Render returned rows
4. totalFacts = response.total
5. hasMoreFacts = (currentOffset + PAGE_SIZE) < totalFacts
6. Show/hide "Load more" button
```

#### loadMoreFacts() — new function

```
1. currentOffset += PAGE_SIZE
2. GET /api/v1/facts?...&limit=50&offset=currentOffset
3. Append rows to existing tbody (no clear)
4. hasMoreFacts = (currentOffset + PAGE_SIZE) < totalFacts
5. Update button state
```

#### "Load more" button

Add to `plan.html` below the facts table:

```html
<div id="load-more-container" class="flex justify-center py-4 hidden">
  <button id="load-more-btn"
    class="btn btn-outline btn-sm"
    onclick="window.PlanApp.FactsTable.loadMoreFacts()">
    Загрузить ещё
    <span id="load-more-counter" class="text-base-content/60"></span>
  </button>
</div>
```

Counter text: `(показано X из Y)`.

#### Dexie

Dexie sync continues in background (writes, deletes, offline operations). `isDexieActive()` check removed from `loadFacts()` — display is always API-first. WS-event inject (`fetchAndInjectPlanRow`) unchanged — still API-direct.

#### has_recurring_plan / has_reminder post-filters

These filters are currently applied client-side after loading all data. With API-first:
- Check if facts endpoint supports these as query params → yes, `has_recurring_plan` is supported (facts.py:534)
- `has_reminder` — already supported (facts.py:535)
- Remove client-side post-filtering — both params pass directly to API

#### Affected files

| File | Change |
|------|--------|
| `frontend/web/static/js/plan/factsTable.ts` | Replace `loadFacts()`, add `loadMoreFacts()`, new state vars |
| `frontend/web/static/js/plan/adapters/windowExports.ts` | Export `loadMoreFacts` |
| `frontend/web/templates/plan.html` | Add `#load-more-container` button |
| `backend/app/api/v1/endpoints/facts.py` | No change needed — `has_reminder` already supported |

---

## Task 4: Double Render Fix

### Root cause

`get_fact_row_html()` (facts.py:1469–1502) plan-branch generates different HTML than `renderFactsTable()` (factsTable.ts:455–480).

### Diffs to fix (backend plan-branch only)

| Column | Before (backend) | After (= TS output) |
|--------|-----------------|---------------------|
| ID `<td>` | `<td><code class="badge badge-ghost">{id}</code></td>` | `<td class="text-base-content/50 text-xs">{id}</td>` |
| Article `<td>` | `<td><span class="{color}">{name}</span></td>` | `<td>{name}</td>` |
| Updated at `<td>` | `<td class="text-xs whitespace-nowrap">{updated_at}</td>` | `<td class="text-xs text-base-content/60">{updated_at}</td>` |

No changes to the TypeScript `renderFactsTable` — backend aligns to it.

### Affected files

| File | Change |
|------|--------|
| `backend/app/api/v1/endpoints/facts.py` | 3-line fix in plan-branch of `get_fact_row_html()` (lines 1478–1502) |

---

## Testing

| Task | Verify |
|------|--------|
| 1 | On/before 19th: default period = current month. On/after 20th: next month. Modal buttons match. Bot hint correct. |
| 2 | Analytics category typeahead: typing filters list, hierarchy visible, selection triggers chart reload. Modal form category search unchanged. |
| 3 | Plan page loads in ≤3s. First 50 rows show. "Load more" appends next 50. Filter change resets offset and reloads. WS-event inserts still work. |
| 4 | Add plan record: inserted row matches existing rows visually. No badge, no colored article span. Verified on mobile breakpoint too. |

## Constraints (from intent)

- DB schema: unchanged
- Bot API contracts: unchanged (hint is additive text only)
- Facts page: unchanged — only plan-branch of `get_fact_row_html` modified
- Dexie offline sync: background sync unaffected
- Modal form category search (`ChoicesCategoryTree` on `#article_id`): untouched
