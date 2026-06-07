---
review:
  spec_hash: c9bc85964fc96b0d
  last_run: 2026-06-07
  phases:
    structure:   { status: passed }
    coverage:    { status: passed }
    clarity:     { status: passed }
    consistency: { status: passed }
  findings:
    - id: F-001
      phase: clarity
      severity: INFO
      section: Design
      section_hash: 87a410af2c370b98
      text: "Lock-holder session is named three ways (lock session / lock-holder session / dedicated lock session); unify the term."
      verdict: fixed
      verdict_at: 2026-06-07
    - id: F-002
      phase: clarity
      severity: INFO
      section: Edge Cases
      section_hash: 9e5966b71129b7da
      text: "'daily jobs barely overlap' is not backed by an explicit schedule-overlap analysis."
      verdict: fixed
      verdict_at: 2026-06-07
chain:
  intent: docs/superpowers/intents/2026-06-07-scheduler-advisory-lock-tz-intent.md
---

# Design: Scheduler advisory-lock leak fix + timezone comment clarity

**Date:** 2026-06-07
**Status:** approved
**Intent:** `docs/superpowers/intents/2026-06-07-scheduler-advisory-lock-tz-intent.md`
**Branch:** `dev/scheduler-advisory-lock-tz-fix` → PR into `test` (never `prod`)

## Problem

Scheduler jobs in `backend/app/scheduler.py` guard cross-worker execution with
**session-level** advisory locks (`pg_try_advisory_lock`). Session-level locks
live on the PostgreSQL *connection*, not on a transaction. Under the SQLAlchemy
QueuePool (`db/session.py`, `pool_size=5, max_overflow=10`) a lock can leak onto
a pooled connection and survive after the job finishes.

Observed on 2026-06-07: a leaked lock (id 1007, recurring-plans) was held by an
idle pooled connection ~10h after a successful run. When the daily balance job
fired, **both** uvicorn workers received `False` from `pg_try_advisory_lock` and
logged `skipped`, so the balance aggregates were never recalculated. This
corrupts trust in production financial data.

Secondary defect: docstrings, comments and registration log lines in
`scheduler.py` say jobs run in **UTC**, but the scheduler is constructed with
`timezone=settings.SYSTEM_TIMEZONE` (prod = Europe/Moscow) and the triggers are
timezone-less, so they actually inherit `SYSTEM_TIMEZONE`. The runtime behaviour
is already correct; only the text is wrong and misleading.

## Root Cause

- `pg_try_advisory_lock(id)` is **session-scoped** (connection-scoped). It is
  released only by an explicit `pg_advisory_unlock(id)` on the same connection,
  by `pg_advisory_unlock_all()`, or when the connection closes. With pooling the
  connection is reused, not closed, so any missed/partial unlock leaks the lock
  onto a long-lived idle connection.
- `pg_try_advisory_lock` is re-entrant (counter-based): a leak compounds — a
  later acquire on the same connection raises the count, and a single unlock does
  not fully clear it.

## Goals

- Daily balance job recalculates **every** day at its scheduled time in
  `SYSTEM_TIMEZONE`; log shows `Balance aggregates refreshed successfully` with
  no double `skipped`.
- After any job runs, `pg_locks WHERE locktype='advisory'` returns 0 rows.
- Cross-worker dedup holds for **arbitrary N** workers: exactly one worker does
  the work, the rest skip.
- Scheduler comments/docstrings/log lines say `SYSTEM_TIMEZONE`, not `UTC`.

## Non-Goals

- No refactor of the job bodies or of the service functions they call.
- No change to scheduling **logic** or trigger times (behaviour already correct).
- No automated integration test against a real PostgreSQL in CI (real
  verification is manual on the test server — see Verification).

## Chosen Approach

**Dedicated lock-holder session + `pg_try_advisory_xact_lock`, transaction held
open for the whole job.** Work runs on a separate session, unchanged.

Why this over alternatives:

- **Single transaction for lock + work** (xact lock on the work session, drop
  internal commits): rejected — `refresh_monthly_balances` (`balance_aggregation_service.py:224`)
  and `recurring_plan_service.py` commit internally; an xact lock on the work
  session would release at the **first** internal commit, breaking dedup. Removing
  those commits means refactoring financial-write services — out of scope and
  against the intent's surgical-edit constraint.
- **Keep session-level lock, guarantee release** (`pg_advisory_unlock_all` on
  connection reset): rejected — session-level locks are inherently leak-prone
  under pooling, and the intent hard-mandates a transaction-scoped lock with
  "zero leak by design".

The dedicated lock-holder session opens its own transaction with
`pg_try_advisory_xact_lock`, never commits it mid-job, and rolls back on exit.
Because the lock is transaction-scoped, it auto-releases when that transaction
ends (rollback on normal/error exit) or when the connection drops (process
crash). The work session's internal commits run on a **different** connection and
do not touch the lock.

## Design

### 1. Lock context manager (`scheduler.py`)

Replace `try_advisory_lock` and `release_advisory_lock` with a single async
context manager:

```python
from contextlib import asynccontextmanager
from backend.app.db.session import async_session_maker

@asynccontextmanager
async def advisory_xact_lock(lock_id: int):
    """
    Acquire a transaction-scoped PostgreSQL advisory lock on a dedicated
    lock-holder session, held open for the whole job. Yields True if acquired,
    False if
    another worker holds it. The lock auto-releases when this session's
    transaction ends (rollback on exit, or connection drop on crash) — zero
    leak by design, no manual unlock.
    """
    async with async_session_maker() as lock_session:
        result = await lock_session.execute(
            text("SELECT pg_try_advisory_xact_lock(:lock_id)"),
            {"lock_id": lock_id},
        )
        acquired = bool(result.scalar())
        try:
            yield acquired
        finally:
            # Ends the transaction → releases the xact lock. The lock-holder
            # session does no writes, so rollback is the clean choice.
            await lock_session.rollback()
```

The `LOCK_ID_*` constants are unchanged.

### 2. Job body pattern (all 7 jobs)

Each job changes from the acquire / try / finally-unlock shape to a wrapping
context manager with a separate work session. Example
(`refresh_balance_aggregates_job`):

Before:
```python
async with get_session_context() as session:
    if not await try_advisory_lock(session, LOCK_ID_BALANCE_AGGREGATES):
        logger.info("[SCHEDULER] Balance aggregates job skipped - ...")
        return
    try:
        result = await refresh_monthly_balances(session=session)
        logger.info("[SCHEDULER] Balance aggregates refreshed successfully: ...")
    finally:
        await release_advisory_lock(session, LOCK_ID_BALANCE_AGGREGATES)
```

After:
```python
async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
    if not acquired:
        logger.info("[SCHEDULER] Balance aggregates job skipped - ...")
        return
    async with get_session_context() as session:
        result = await refresh_monthly_balances(session=session)
        logger.info("[SCHEDULER] Balance aggregates refreshed successfully: ...")
```

Applies to all 7 jobs:
`recalculate_article_usage_stats_job`, `send_weekly_reports_job`,
`check_budget_thresholds_job`, `refresh_balance_aggregates_job`,
`send_plan_reminders_job`, `generate_recurring_facts_job`,
`cleanup_expired_webauthn_challenges_job`.

Rules:
- The per-job `try/finally` with manual `release_advisory_lock` is removed.
- The outer `try/except` (error log + `raise`) is preserved.
- The `skipped` and `... successfully` log strings are preserved **verbatim**
  (log-format constraint).
- Early `return` inside the work block (`send_plan_reminders_job`,
  `cleanup_expired_webauthn_challenges_job`) now sits inside the inner
  `get_session_context`; the outer context manager still rolls back and releases
  the lock — no leak.

### 3. Timezone comment fix (text only, no logic change)

In `scheduler.py`, replace `UTC` with `SYSTEM_TIMEZONE` in:
- Job docstrings (`Schedule: ...` lines).
- `# Job N:` registration comments.
- `logger.info("[SCHEDULER] Registered job: ... (... UTC)")` lines.

Do **not** change:
- The timezone-less `CronTrigger(...)` calls — they correctly inherit
  `scheduler.timezone = settings.SYSTEM_TIMEZONE`.
- `datetime.utcnow()` in `cleanup_expired_webauthn_challenges_job` — it compares
  against `expires_at` (stored UTC), unrelated to scheduling.

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Work raises | Outer `try/except` logs + re-raises; `advisory_xact_lock` finally rolls back → lock released. |
| `idle_in_transaction_session_timeout` kills the lock-holder session mid-job | Lock released early, but dedup was already decided at job start (other workers skipped) → harmless. |
| N workers fire simultaneously | Exactly one wins `pg_try_advisory_xact_lock`; the rest get `False` → `skipped`. Holds for any N. |
| Process crash mid-job | Connection drops → PostgreSQL auto-releases the xact lock. No leak. |
| Pool pressure | Each running job holds 2 connections (lock + work). Pool is 5+10=15 per worker. Heavy daily jobs run at distinct times (00:00, 01:00, 02:00, 18:00 SYSTEM_TIMEZONE); only the `*/5`-min reminders and hourly WebAuthn cleanup can coincide, both short → at most ~3 jobs (6 connections) concurrent → ample headroom. |

## Testing

- **Unit test** (`tests/backend/`): cover `advisory_xact_lock` structure with a
  mocked session — assert it executes `pg_try_advisory_xact_lock`, yields the
  boolean result, and calls `rollback()` on exit (both acquired and not-acquired
  paths). Does not exercise a real PG lock.
- No automated PG integration test in CI (per decision).

## Verification (manual, on test server after deploy)

Triggered by the user signalling that the deploy to `fbd` is live:
- Logs: balance job prints `Balance aggregates refreshed successfully: N records`,
  with no double `skipped`.
- `SELECT * FROM pg_locks WHERE locktype = 'advisory';` returns 0 rows after a
  job run.
- All 7 jobs continue to deduplicate across the 2 prod workers (no double
  execution).

## Constraints & Autonomy (from intent)

- Work in `dev/scheduler-advisory-lock-tz-fix`; PR into `test`, never `prod`.
- Do not edit `CLAUDE.md`, do not touch Docker volumes, do not build on the
  server (delivery via CI/CD + `VERSION` bump).
- **Proposal-first (needs approval):** open PR `dev/* → test`; bump `VERSION`.
- **Human-only:** merge into `prod`, deploy to server.

## Files Touched

- `backend/app/scheduler.py` — lock helpers → context manager; 7 job bodies;
  timezone comments/logs.
- `tests/backend/` — new unit test for `advisory_xact_lock`.

## Done When

- All 7 jobs use the transaction-scoped lock via `advisory_xact_lock`.
- `try_advisory_lock` / `release_advisory_lock` removed.
- Timezone comments/logs say `SYSTEM_TIMEZONE`.
- Unit test green; existing tests stay green.
- Code ready in `dev/scheduler-advisory-lock-tz-fix` for a PR into `test`.
- Post-deploy manual check confirms `refreshed successfully` + `pg_locks
  advisory = 0`.
