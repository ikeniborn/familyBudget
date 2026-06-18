# Intent: Fix plan WS broadcasts using the fact filter (drops plan fields)

**Date:** 2026-06-17
**Status:** approved

## Objective
`broadcast_plan_created` (`budget_ws.py:952`) and `broadcast_plan_updated`
(`:959`) filter their payload with `_filter_fact_data(plan_data)`, which keeps
only `SAFE_FACT_FIELDS`. Plan-specific fields (e.g. `frequency_type`) are
silently stripped before the `plan_created` / `plan_updated` events go out over
WebSocket + long-poll. A dedicated `_filter_plan_data` (`:900`, `SAFE_PLAN_FIELDS`)
already exists and is used correctly by the `recurring_plan_*` broadcasts. Fix
now so live plan events carry their real data.

## Desired Outcomes
- `plan_created` and `plan_updated` WS/long-poll events include plan-specific
  fields (matching `SAFE_PLAN_FIELDS`), not just the fact subset.
- Clients subscribed to plan events receive `frequency_type` and other plan
  fields and render/update without a follow-up fetch.
- No field outside the plan safe-list leaks into the payload.

## Health Metrics
- `_filter_fact_data` and fact broadcasts (`fact_created/updated/deleted`) stay unchanged.
- `recurring_plan_*` broadcasts (already on `_filter_plan_data`) stay unchanged.
- Payload safe-listing is preserved — no unfiltered dict ever broadcast.
- WS connection lifecycle, Redis Pub/Sub fan-out, long-poll buffer behavior unaffected.

## Strategic Context
- Interacts with: `backend/app/api/v1/endpoints/budget_ws.py` filter helpers
  and `SAFE_PLAN_FIELDS`, frontend WS client consuming plan events
  (see [[realtime#Event Catalog & Payload Filtering]], [[frontend#Real-Time & Network Modules]]).
- Confirm `SAFE_PLAN_FIELDS` actually lists the fields clients need for
  `plan_created/updated` before asserting the fix is complete.
- Priority trade-off: **trust** — correct + still-safe-listed payloads.

## Constraints
### Steering (behavioral guidance)
- One-line target change: swap `_filter_fact_data` → `_filter_plan_data` in the
  two `broadcast_plan_*` functions; do not refactor the filter design.
### Hard (architectural enforcement)
- Keep allow-list filtering — never broadcast a raw/unfiltered dict.
- Do not widen `SAFE_PLAN_FIELDS` to include sensitive fields.

## Autonomy Zones
- Full autonomy (reversible, low risk): the filter-function swap.
- Guarded (log + confidence threshold): adding/adjusting fields in `SAFE_PLAN_FIELDS` if a needed field is missing.
- Proposal-first (needs approval): any change to the broadcast/event-naming contract.
- No autonomy (human only): none.

## Stop Rules
- Halt if: a field clients need for plan events is absent from `SAFE_PLAN_FIELDS`
  AND is sensitive → escalate the allow-list decision.
- Done when: a `plan_created` (and `plan_updated`) event observed on the wire
  carries the plan-specific fields from `SAFE_PLAN_FIELDS`, fact broadcasts are
  unchanged, and no field outside the safe-list appears.
