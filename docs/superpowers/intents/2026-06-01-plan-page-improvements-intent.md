# Intent: Plan Page Improvements

**Date:** 2026-06-01
**Status:** draft

## Objective

Four improvements to the plan page:

1. **Planning period offset** — planning period always starts from current month, but users plan around the 20th. After the 20th, the default planning period should shift to next month (before 20th = current month, from 20th = next month). Corrections are still possible before the 20th.
2. **Category typeahead** — plan analytics filter uses a dropdown; with many categories, search is needed. Replace with typeahead (reuse existing "choices" component from modal form).
3. **Performance** — plan page loads in ~10s vs facts page ~2s. Root cause: all recurring plans load at once. Add "Load more" pagination (50 rows per request) to both facts and plan pages.
4. **Double render bug** — when adding a record on the plan page, the row renders with wrong structure first, then correctly after refresh. Same bug was fixed on facts page — apply same fix here.

## Desired Outcomes

- After 20th of any month, all plan-related UI (page filters, modal form) defaults to next month as planning period; before 20th defaults to current month
- Web and bot both use the new period logic
- Analytics category filter on plan page replaced with typeahead; user types partial name, sees matching options
- Plan page loads in time comparable to facts page (~2s); "Load more" button loads next 50 rows on demand
- New plan record renders correctly on first insert — no intermediate broken state

## Health Metrics

- Facts page must not break or regress when pagination is added
- Modal form's existing category search component must remain unchanged
- Plan record offline sync (Dexie) must not be disrupted by pagination changes
- Bot API contracts must not change (bot also gets period shift but via same backend utility)

## Strategic Context

- Interacts with: `recurring_plan_service.py`, `api/v1/endpoints/facts.py`, plan page frontend, bot handlers, Dexie offline sync
- Period logic lives on backend as a **reusable utility function** (not a new endpoint), called by any endpoint that needs the current planning period
- Priority trade-off: **quality** — correct architecture over fastest delivery

## Constraints

### Steering (behavioral guidance)

- Reuse existing "choices" category search component — no new UI component for typeahead
- Pagination uses limit/offset pattern; add to API endpoints if not already supported
- Period utility function must be shared — not duplicated across endpoints/bot/web

### Hard (architectural enforcement)

- DB schema must not change
- Bot API contracts must not change (period logic is additive, not breaking)
- Facts page existing behavior must not regress

## Autonomy Zones

- Full autonomy (reversible, low risk): utility function implementation, pagination parameters (page size = 50), double render fix, typeahead wiring
- Guarded (log + confidence threshold): changes to facts page (already working — verify before/after)
- Proposal-first (needs approval): any new API endpoint (must use utility function instead)
- No autonomy (human only): DB schema changes, bot API contract changes

## Stop Rules

- Halt if: offline sync (Dexie) breaks for plan records
- Halt if: facts page regresses (load time or behavior)
- Escalate if: period utility requires new endpoint (not just function) — confirm approach first
- Done when:
  1. Period shift works on web (page filters + modal) and bot, 20th threshold correct
  2. Category typeahead on analytics filter functional, existing modal search unchanged
  3. Plan page loads first 50 rows; "Load more" fetches next 50; total load time ~2s
  4. New plan record inserts without double render
  5. Related bugs found during work: fix inline
