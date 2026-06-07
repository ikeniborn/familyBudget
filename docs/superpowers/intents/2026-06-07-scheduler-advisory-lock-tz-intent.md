# Intent: scheduler advisory-lock leak + timezone clarity

**Date:** 2026-06-07
**Status:** draft

## Objective
Session-level advisory locks (`pg_try_advisory_lock`) used by scheduler jobs leak
onto pooled connections and are not reliably released. As a result the daily
balance-recalculation job (and other daily jobs) intermittently get skipped by
**all** uvicorn workers, so nothing runs. On 2026-06-07 the balance aggregates
were not recalculated automatically (both workers logged `skipped`); a leaked
lock (id 1007, recurring-plans) was observed held by an idle pooled connection
~10h after a successful job. Fix now because the bug corrupts trust in
production financial data.

## Desired Outcomes
- Daily balance job recalculates **every** day at `01:00` in SYSTEM_TIMEZONE
  (prod = Europe/Moscow); log shows `Balance aggregates refreshed successfully: N records`,
  with no double `skipped`.
- All scheduler jobs are bound to `SYSTEM_TIMEZONE` from `.env` (verified, no
  hardcoded UTC in triggers).
- Comments/docstrings in `scheduler.py` reflect reality — "SYSTEM_TIMEZONE", not "UTC".
- After any job runs, `pg_locks WHERE locktype='advisory'` returns 0 rows (no leak).
- Cross-worker dedup preserved: exactly one worker does the work, the rest skip.

## Health Metrics
- All 7 jobs keep deduplicating across workers (no double execution).
- Balance recalc idempotency (UPSERT) preserved — re-run creates no duplicates.
- Balance job runtime does not grow (currently ~73s full refresh).
- Job RAM profile does not worsen (backend +~65MiB peak; prod is tight, 1.8GiB).
- Existing scheduler/lock tests stay green.

## Strategic Context
- Interacts with: APScheduler running in **N uvicorn workers** (env `WORKERS`,
  default 1, prod=2, may be higher), PostgreSQL advisory locks, the SQLAlchemy
  connection pool (`db/session.py`, QueuePool 5+10), all 7 scheduler jobs,
  aggregate table `t_agg_financial_center_balance_monthly`, analytics (reads aggregates).
- Dedup must hold for **arbitrary N** workers, not just 2.
- Priority trade-off: **trust** — correctness of financial data over speed/cost.

## Constraints
### Steering (behavioral guidance)
- Minimal surgical edits — touch only the lock mechanism + timezone comments;
  do not refactor the jobs themselves.
- Preserve current log format (`skipped` / `refreshed successfully`).

### Hard (architectural enforcement)
- Do not edit CLAUDE.md, do not touch Docker volumes, do not build on the server
  (delivery via CI/CD + VERSION bump).
- Work in a `dev/*` branch → PR into `test`, never into `prod`.
- Cross-worker dedup is mandatory (no double execution allowed).
- Advisory lock must not outlive its connection/transaction — zero leak by
  design (`pg_try_advisory_xact_lock`).
- Job timezone comes solely from `SYSTEM_TIMEZONE`, no hardcoding.

## Autonomy Zones
- Full autonomy (reversible, low risk): edit `scheduler.py` (lock helpers +
  timezone comments) and tests, inside the `dev/*` branch.
- Guarded (log + confidence threshold): run tests locally / in CI.
- Proposal-first (needs approval): open PR `dev/* → test`; bump VERSION.
- No autonomy (human only): merge into `prod`, deploy to server, any direct
  changes on production.

> These zones OVERRIDE subagent-driven-development's "continuous execution,
> don't pause" default. Any task touching proposal-first / no-go decisions
> is marked HUMAN CHECKPOINT in the plan.

## Stop Rules
- Halt if: tests fail; dedup breaks for N>1; lat/architecture violated.
- Escalate if: xact-lock requires changing session/transaction signatures
  beyond the lock helpers.
- Done when: all 7 jobs use a transaction-scoped lock; `pg_locks advisory = 0`
  after a run; balance job logs `refreshed successfully` with no double skip;
  timezone comments corrected; tests green; code ready in a `dev/*` branch for
  a PR into `test`.
