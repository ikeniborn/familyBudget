# Intent: Correct stale push-URL docstring in medicine_alert_service

**Date:** 2026-06-17
**Status:** approved

## Objective
`backend/app/services/medicine_alert_service.py:5` module docstring states the
Web Push payload uses `data.url="/medicines"`, but the code (`:69`) sets
`url:"/medicines/stock"` — the page that actually lists expiring items in Phase 1
(an inline comment at `:65-66` explains the Phase-2 switch). The behavior is
correct; only the docstring is stale and misleading. Fix now to keep docs in
sync with code (project mandates current docs).

## Desired Outcomes
- The module docstring states `data.url="/medicines/stock"`, matching the code.
- No behavior change — the push payload still targets `/medicines/stock`.
- Reader of the file sees one consistent URL, not two conflicting ones.

## Health Metrics
- Expiry-alert behavior unchanged: 30-day window, daily job 03:00, advisory
  lock 1010, Telegram + Web Push dispatch (see [[medicine#Expiry Alerts]]).
- Push payload fields (`type`, `url`) emitted at runtime are byte-identical to today.

## Strategic Context
- Interacts with: documentation accuracy only; the runtime push path and
  frontend `/medicines/stock` page are untouched (see [[medicine#Scheduler Wiring]]).
- Priority trade-off: **trust** — docs must not contradict code.

## Constraints
### Steering (behavioral guidance)
- Touch only the docstring text; leave the `:65-66` Phase-2 comment intact (it is
  accurate context).
### Hard (architectural enforcement)
- Do NOT change the runtime `url` value or any alert logic.

## Autonomy Zones
- Full autonomy (reversible, low risk): the docstring text edit.
- Guarded: none.
- Proposal-first: none.
- No autonomy (human only): none.

## Stop Rules
- Halt if: editing reveals the runtime `url` is itself wrong for Phase 1 (then
  this becomes a behavior bug, not a doc fix → re-scope).
- Done when: the docstring and the runtime `push_data["url"]` both read
  `/medicines/stock`, with zero runtime change.
