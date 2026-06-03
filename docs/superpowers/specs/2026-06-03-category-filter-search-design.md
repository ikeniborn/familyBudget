# Design: Category Filter Search (facts & plan)

**Date:** 2026-06-03
**Status:** approved
**Intent:** [2026-06-03-category-filter-search-intent.md](../intents/2026-06-03-category-filter-search-intent.md)

## Objective

Replace plain `<select id="filter-article">` on `/facts` and `/plan` pages with `ChoicesCategoryTree`
(Choices.js wrapper used in modal forms). Provides substring search, breadcrumb hierarchy, Fuse.js
fuzzy matching. Also fixes analytics-article to show only plan-relevant categories (client-side).

## Architecture

### New Files

```
frontend/web/static/js/
├── modules/filterWidgets/
│   └── categoryFilter.ts          # Shared ChoicesCategoryTree factory
├── facts/features/filterArticle/
│   └── init.ts                    # Facts page singleton + helpers
└── plan/features/filterArticle/
    └── init.ts                    # Plan page singleton + helpers
```

### `modules/filterWidgets/categoryFilter.ts`

Exports `createCategoryFilterWidget()` returning a `CategoryFilterWidget` object:

```ts
interface CategoryFilterWidget {
  init(elementId: string, articleType?: string | null): void;
  destroy(): void;
  setValue(value: string | null): void;  // updates Choices.js UI
  clearValue(): void;
  getInstance(): any;
}
```

Implementation mirrors `analyticsArticleChoices.ts` pattern:
- `init`: calls `new BudgetShared.ChoicesCategoryTree(elementId, { type?, multiple: false, showPath: true, showClearButton: true })`
- `destroy`: calls `instance.destroy()`, sets `instance = null`
- `setValue(value)`: calls `instance.setChoiceByValue(value ?? '')` — updates Choices UI (not just underlying `<select>`)
- `clearValue`: alias for `setValue(null)`

### `facts/features/filterArticle/init.ts`

```ts
export const factsFilterArticleWidget = createCategoryFilterWidget();

export function initFactsFilterArticle(type?: string | null): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', type ?? null);
}

export function resetFactsFilterArticle(): void {
  factsFilterArticleWidget.destroy();
  factsFilterArticleWidget.init('#filter-article', null);
}
```

### `plan/features/filterArticle/init.ts`

Same shape, exports `planFilterArticleWidget`, `initPlanFilterArticle`, `resetPlanFilterArticle`.
This module is the single import point for `filterAnalyticsSync.ts`.

## Changes to Existing Files

### HTML templates

**`frontend/web/templates/facts.html`** and
**`frontend/web/templates/components/plan/filters_section.html`**:

Remove DaisyUI classes from `#filter-article` — Choices.js wraps the select in its own `<div>`,
DaisyUI `select select-bordered` classes conflict with Choices.js styling (same pattern as modals):

```html
<!-- Before -->
<select id="filter-article" class="select select-bordered category-filter w-full" ...>

<!-- After -->
<select id="filter-article" class="category-filter w-full" ...>
```

### `facts/index.ts`

1. Remove `populateArticleDropdown(articles)` call — ChoicesCategoryTree loads from API itself
2. After `loadAndPopulateDropdowns()`: call `initFactsFilterArticle()`
3. Add `change` listener on `#filter-article-type`:
   - `initFactsFilterArticle(newType)` — destroy + reinit with type filter
   - Reset `article_id` in filter state to `null`
4. `data-action="reset-filters"` handler: call `resetFactsFilterArticle()`

### `facts/operations/filterOperations.ts`

In `syncFiltersToUI()` (reset path, line ~208), after `articleSelect.value = ''`:

```ts
import { factsFilterArticleWidget } from '../features/filterArticle/init';
// ...
factsFilterArticleWidget.clearValue();
```

### `plan/index.ts`

1. After dropdown init: call `initPlanFilterArticle()`
2. Add `change` listener on `#filter-article-type`:
   - `initPlanFilterArticle(newType)`
   - Reset `article_id` in filter state to `null`
3. `data-action="reset-filters"` handler: call `resetPlanFilterArticle()`

### `plan/filters.ts`

In `writeFiltersToUI()` (line ~200), after `articleSelect.value = ...`:

```ts
import { planFilterArticleWidget } from './features/filterArticle/init';
// ...
planFilterArticleWidget.setValue(filters.article_id ? String(filters.article_id) : null);
```

### `plan/filterAnalyticsSync.ts` *(proposal-first — approved in design)*

Add import at top:

```ts
import { planFilterArticleWidget } from './features/filterArticle/init';
```

In `syncAnalyticsToFilters`, after `filterArticle.value = newValue` (line ~354):

```ts
planFilterArticleWidget.setValue(newValue || null);
```

In `syncAnalyticsToFilters`, when resetting article on type change (line ~339):

```ts
planFilterArticleWidget.clearValue();
```

No other changes to `filterAnalyticsSync.ts`. Reading `.value` from underlying `<select>` still
works — Choices.js keeps it in sync on user interaction.

### `plan/analyticsArticleChoices.ts`

Rename `_articles` → `articles` parameter (use it). The implementation path depends on whether
`ChoicesCategoryTree` exposes a method to override its internal article list:

**Path A (preferred):** `ChoicesCategoryTree` exposes a public method (e.g. `setItems`, `setChoices`)
→ call it with `articles` after init to replace the API-loaded list with the pre-filtered plan list.

**Path B (fallback):** `ChoicesCategoryTree` doesn't support injection
→ call `new ChoicesCategoryTree(...)` normally (loads from API with type filter), then call
`getInstance().clearChoices()` + `getInstance().setChoices(mappedArticles)` directly on the
underlying Choices.js instance to replace items with plan-relevant articles only.

**Stop rule:** If neither path works (ChoicesCategoryTree mangles the Choices instance in a way that
prevents post-init item replacement), halt and escalate — do NOT touch `budgetShared.ts`.
In that case, use plain Choices.js (without ChoicesCategoryTree wrapper) for `analytics-article` only.

The intent's constraint: "analytics-article filtering filtered client-side from already loaded data"
is met by using `filterOptions.articles` (already fetched by `loadAnalyticsFilterOptions()`) as the
source, not making a new `/api/v1/articles?type=X` call.

### `plan/analytics.ts` — `loadAnalyticsArticleFilter`

Replace API call for typed articles with client-side filter from cached `filterOptions`:

```ts
// Before: when articleType !== null → fetch /api/v1/articles?type=X
// After: use cached filterOptions.articles, filter by type client-side

if (articleType !== null) {
  const cached = await loadAnalyticsFilterOptions();  // already cached after first load
  const filtered = (cached?.articles ?? []).filter(a => a.type === articleType);
  initAnalyticsArticleChoices(filtered, articleType);
} else if (allArticles !== null) {
  initAnalyticsArticleChoices(allArticles, null);
} else {
  const cached = await loadAnalyticsFilterOptions();
  initAnalyticsArticleChoices(cached?.articles ?? [], null);
}
```

This ensures `analytics-article` shows only articles present in plan records for the currently
selected month/CFO — no new API endpoints, filtered from already-loaded data.

## Data Flow

### facts page — filter-article selection

```
User types → ChoicesCategoryTree Fuse.js → select option
→ Choices.js updates underlying <select>.value
→ existing filterOperations.ts reads .value (unchanged)
→ loadFacts() with article_id filter
```

### plan page — article-type change → category reset

```
#filter-article-type change
→ initPlanFilterArticle(newType)
  → destroy old Choices instance
  → new ChoicesCategoryTree('#filter-article', { type: newType })
    → API: /api/v1/articles?type=newType
→ setFilters({ article_id: null })
→ planFilterArticleWidget.clearValue()  [UI already fresh from reinit]
```

### plan page — analytics → filters sync (filterAnalyticsSync.ts)

```
Analytics article changes
→ syncAnalyticsToFilters()
→ filterArticle.value = newValue  [underlying select]
→ planFilterArticleWidget.setValue(newValue)  [Choices.js UI]
→ loadFacts()
```

### analytics-article — client-side filtering

```
Month button clicked → loadAnalyticsFilterOptions({ planning_month })
→ API: /analytics/plans/filter-options?planning_month=X  [cached per month]
→ loadAnalyticsArticleFilter(type, cached.articles)
→ client-side filter by type
→ initAnalyticsArticleChoices(filtered, type)
→ Choices UI shows only plan-relevant categories
```

## Reset Handling

`data-action="reset-filters"`:
1. `resetPlanFilterArticle()` / `resetFactsFilterArticle()` → destroy + reinit without type
2. Existing reset logic clears other filters, reloads table — unchanged

## Testing

### E2E (Playwright)

- `/facts`: type substring in category filter → list filters in real time
- `/facts`: select article type → category list narrows to that type only
- `/facts`: select type + category → table filters correctly
- `/facts`: "Сбросить" → Choices cleared visually, table reloads without category filter
- `/plan`: same 4 cases as facts
- `/plan`: change analytics-article → filter-article updates in Choices UI (bidirectional sync)
- `/plan`: analytics-article list contains only categories from current month's plan records
- Mobile 375px: Choices.js dropdown renders correctly, not clipped

### TypeScript
`npm run type-check` passes — no errors from new imports or renamed parameters.

## Constraints Honored

- No backend/API changes
- `budgetShared.ts` — not touched
- `filterAnalyticsSync.ts` — minimal change (3 lines: import + 2 method calls), approved in design
- Window exports pattern maintained
- No new API endpoints
