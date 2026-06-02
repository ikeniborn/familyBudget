# Intent: Category Filter Search (facts & plan)

**Date:** 2026-06-03
**Status:** draft

## Objective

Replace plain `<select>` for category filter on `/facts` and `/plan` pages with `ChoicesCategoryTree`
(Choices.js wrapper already used in forms). Large category lists are hard to navigate without search.
Standardizes the category selection UX across the app.

## Desired Outcomes

- User types a substring in the category filter → list filters in real time (Fuse.js search)
- Selecting "Тип категории" narrows the category list to that type only
- Switching "Тип категории" resets the selected category (clears Choices selection)
- In `/plan` analytics section (`analytics-article`), the category list shows only categories
  present in actual plan records, respecting current analytics filters
  (month buttons, CFO filter, article type filter) — filtered client-side from already loaded data
- Reset filters button clears the Choices.js instance (not just the hidden `<select>`)
- Works on mobile 375px, tablet 768px, desktop 1280px

## Health Metrics

- Facts/plan table still filters correctly after applying category filter
- `filterAnalyticsSync.ts` bidirectional sync (filter↔analytics) continues to work
- `data-action="reset-filters"` clears Choices instance and reloads table
- No TypeScript type-check errors (`npm run type-check` passes)
- No regressions in other pages that use `ChoicesCategoryTree`

## Strategic Context

- Interacts with: `ChoicesCategoryTree` (budgetShared.ts), `filterAnalyticsSync.ts`,
  facts state (filter-article in API query), plan state (filter-article in API query),
  analytics state (analytics-article drives chart rendering)
- Priority trade-off: UX speed (search responsiveness) over complexity
- Choices.js v11.0.3 vendored; `ChoicesCategoryTree` is the established wrapper pattern

## Constraints

### Steering (behavioral guidance)

- Use `ChoicesCategoryTree` as in modal forms — same hierarchy, breadcrumb paths, Fuse.js search
- Filter analytics categories client-side from already loaded plan data — no new API endpoints
- When article type changes → reset category selection, then re-filter category list
- `analytics-article` filtering: intersect full article list with articles from current
  plan records (respecting selected month/CFO/article type)

### Hard (architectural enforcement)

- No backend/API changes
- No changes to `budgetShared.ts` without proposal-first approval
- Changes to `filterAnalyticsSync.ts` require proposal-first approval
- Window exports pattern must be maintained (`adapters/windowExports.ts`)

## Autonomy Zones

- Full autonomy (reversible, low risk): HTML template changes, new TS logic for type→category
  filtering, analytics-article client-side filtering, CSS adjustments
- Proposal-first (needs approval): any edits to `budgetShared.ts` or `filterAnalyticsSync.ts`
- No autonomy (human only): backend changes, API schema changes, production deploy

## Stop Rules

- Halt if: `ChoicesCategoryTree` doesn't support external category list injection
  (needs API call internally) — escalate with alternative approach
- Halt if: `filterAnalyticsSync.ts` sync logic breaks after category filter change —
  propose patch before applying
- Escalate if: TypeScript errors cannot be resolved without touching `budgetShared.ts`
- Done when: deployed to test server (fbd.ikeniborn.ru), category search works on facts and plan
  pages, analytics category filter shows only plan-relevant categories
