---
review:
  plan_hash: e2f83e617a5bc616
  spec_hash: c9bc85964fc96b0d
  last_run: 2026-06-07
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-06-07-scheduler-advisory-lock-tz-intent.md
  spec:   docs/superpowers/specs/2026-06-07-scheduler-advisory-lock-tz-design.md
---

# Scheduler advisory-lock leak fix + timezone comment clarity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 7 APScheduler jobs deduplicate across uvicorn workers using a transaction-scoped PostgreSQL advisory lock that cannot leak onto pooled connections, and fix misleading `UTC` comments to say `SYSTEM_TIMEZONE`.

**Architecture:** A new `advisory_xact_lock` async context manager opens its own dedicated lock-holder session, runs `pg_try_advisory_xact_lock`, holds that transaction open for the whole job, and rolls back on exit — so the transaction-scoped lock auto-releases with zero manual unlock and zero leak. The actual job work runs on a *separate* `get_session_context` session whose internal commits never touch the lock.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy/SQLModel async (`async_session_maker`, QueuePool `pool_size=5, max_overflow=10`), APScheduler `AsyncIOScheduler`, PostgreSQL 16. Tests: pytest (`asyncio_mode = auto`), run via `backend/.venv`.

---

## Background (read before starting)

- Source spec: `docs/superpowers/specs/2026-06-07-scheduler-advisory-lock-tz-design.md`.
- Single source file changed: `backend/app/scheduler.py`.
- One new test file: `tests/unit/backend/test_scheduler_advisory_lock.py`.
  - NOTE: the spec text says `tests/backend/`, but that directory holds only a `.venv`. The real backend unit tests live in `tests/unit/backend/` (e.g. `test_write_behind_order.py`). Use `tests/unit/backend/`.
- Branch is already `dev/scheduler-advisory-lock-tz-fix`. PR target is `test`, **never** `prod`. Do **not** edit `CLAUDE.md`, touch Docker volumes, or build on the server.

### Why a dedicated lock session (not an xact lock on the work session)

`refresh_monthly_balances` and `RecurringPlanService.generate_pending_facts` commit internally. A transaction-scoped lock on the *work* session would release at the first internal commit, breaking cross-worker dedup. So the lock lives on its own session that never commits mid-job.

### Per-job session usage (decides whether each job keeps a work session)

| Job | Uses the DB session for work? | Work session in "after" code |
|-----|-------------------------------|------------------------------|
| `recalculate_article_usage_stats_job` | yes (`session.execute` + `commit`) | **keep** `get_session_context` |
| `send_weekly_reports_job` | no (only `NotificationService`) | **drop** — no work session |
| `check_budget_thresholds_job` | no (only `NotificationService`) | **drop** — no work session |
| `refresh_balance_aggregates_job` | yes (`refresh_monthly_balances(session=...)`) | **keep** |
| `send_plan_reminders_job` | yes (`ReminderService(... session=...)`) | **keep** |
| `generate_recurring_facts_job` | yes (`generate_pending_facts(session=...)`) | **keep** |
| `cleanup_expired_webauthn_challenges_job` | yes (`session.exec` + `commit`) | **keep** |

For the two "drop" jobs, the original session was used *only* to hold the advisory lock; the work never touched it. Moving the lock to its own session leaves the work with no session to open — dropping the unused `get_session_context` is correct and reduces pool pressure (spec Edge Cases).

---

## File Structure

- `backend/app/scheduler.py` — single module, all changes:
  - imports: add `asynccontextmanager`, add `async_session_maker`.
  - add `advisory_xact_lock` context manager.
  - rewrite all 7 job bodies.
  - remove `try_advisory_lock` and `release_advisory_lock`.
  - replace `UTC` → `SYSTEM_TIMEZONE` in docstrings, registration comments, registration log lines.
- `tests/unit/backend/test_scheduler_advisory_lock.py` — new, unit test for `advisory_xact_lock` (mocked session, no real PG).

---

### Task 1: Add `advisory_xact_lock` context manager (TDD)

**Files:**
- Test: `tests/unit/backend/test_scheduler_advisory_lock.py` (create)
- Modify: `backend/app/scheduler.py` (imports at top; new context manager after line 72)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/backend/test_scheduler_advisory_lock.py` with exactly:

```python
"""Unit tests for scheduler advisory_xact_lock context manager.

Verifies the context manager executes pg_try_advisory_xact_lock on a dedicated
lock-holder session, yields the boolean result, and always rolls back on exit
(releasing the transaction-scoped lock). Does not exercise a real PostgreSQL lock.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_mock_session(scalar_value: bool):
    """Build an AsyncSession-like mock whose execute().scalar() == scalar_value.

    Returns (mock_context_manager, mock_session). The context manager is what
    async_session_maker() returns; entering it yields mock_session.
    """
    mock_result = MagicMock()
    mock_result.scalar.return_value = scalar_value

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.rollback = AsyncMock()

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm, mock_session


@pytest.mark.asyncio
async def test_advisory_xact_lock_acquired():
    from backend.app.scheduler import LOCK_ID_BALANCE_AGGREGATES, advisory_xact_lock

    mock_cm, mock_session = _make_mock_session(scalar_value=True)

    with patch("backend.app.scheduler.async_session_maker", return_value=mock_cm):
        async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
            assert acquired is True

    # Executed the transaction-scoped lock SQL with the right id
    call = mock_session.execute.await_args
    assert "pg_try_advisory_xact_lock" in str(call.args[0])
    assert call.args[1] == {"lock_id": LOCK_ID_BALANCE_AGGREGATES}

    # Always rolls back on exit -> releases the xact lock
    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_advisory_xact_lock_not_acquired():
    from backend.app.scheduler import LOCK_ID_BALANCE_AGGREGATES, advisory_xact_lock

    mock_cm, mock_session = _make_mock_session(scalar_value=False)

    with patch("backend.app.scheduler.async_session_maker", return_value=mock_cm):
        async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
            assert acquired is False

    # Rollback still runs on the not-acquired path
    mock_session.rollback.assert_awaited_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_scheduler_advisory_lock.py -v`
Expected: FAIL — `ImportError: cannot import name 'advisory_xact_lock' from 'backend.app.scheduler'` (collection error on both tests).

- [ ] **Step 3: Add the imports**

In `backend/app/scheduler.py`, change the contextlib/import block at the top. Find:

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from backend.app.core.config import get_settings
from backend.app.core.logging import get_logger
from backend.app.db.session import get_session_context
from backend.app.services.notification_service import NotificationService
from backend.app.services.reminder_service import ReminderService
```

Replace with:

```python
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from backend.app.core.config import get_settings
from backend.app.core.logging import get_logger
from backend.app.db.session import async_session_maker, get_session_context
from backend.app.services.notification_service import NotificationService
from backend.app.services.reminder_service import ReminderService
```

- [ ] **Step 4: Add the context manager**

In `backend/app/scheduler.py`, immediately after the `release_advisory_lock` function (the line `)` closing its `session.execute(...)`, before the `# Global scheduler instance` comment), insert:

```python


@asynccontextmanager
async def advisory_xact_lock(lock_id: int):
    """
    Acquire a transaction-scoped PostgreSQL advisory lock on a dedicated
    lock-holder session, held open for the whole job.

    Yields True if the lock was acquired, False if another worker holds it.
    The lock auto-releases when this session's transaction ends (rollback on
    exit, or connection drop on crash) - zero leak by design, no manual unlock.
    Job work must run on a SEPARATE session so its internal commits never
    release this lock.
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
            # Ends the transaction -> releases the xact lock. The lock-holder
            # session does no writes, so rollback is the clean choice.
            await lock_session.rollback()
```

Leave `try_advisory_lock` and `release_advisory_lock` in place for now (still used by the not-yet-migrated jobs); they are removed in Task 3.

- [ ] **Step 5: Run test to verify it passes**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_scheduler_advisory_lock.py -v`
Expected: PASS — `2 passed`.

- [ ] **Step 6: Type-check the module imports cleanly**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler"`
Expected: no output, exit 0.

- [ ] **Step 7: Commit**

```bash
git add backend/app/scheduler.py tests/unit/backend/test_scheduler_advisory_lock.py
git commit -m "feat(scheduler): add transaction-scoped advisory_xact_lock context manager"
```

---

### Task 2: Migrate all 7 job bodies to `advisory_xact_lock`

**Files:**
- Modify: `backend/app/scheduler.py` (7 job functions)

Rules applied to every job (from spec §2):
- The per-job `try/finally` with manual `release_advisory_lock` is removed.
- The outer `try/except` (error log + `raise`) is preserved verbatim.
- The `skipped` and `... successfully` / `... completed` log strings are preserved **verbatim**.
- Jobs that used the session only for the lock drop the inner `get_session_context`.

- [ ] **Step 1: Migrate `recalculate_article_usage_stats_job`**

Find:

```python
    logger.info("[SCHEDULER] Starting article usage statistics recalculation job")

    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_ARTICLE_STATS):
                logger.info(
                    "[SCHEDULER] Article stats job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                # Call PostgreSQL function
                await session.execute(text("SELECT recalculate_article_usage_stats()"))
                await session.commit()

                logger.info("[SCHEDULER] Article usage statistics recalculated successfully")
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_ARTICLE_STATS)
    except Exception as e:
        logger.error("[SCHEDULER] Error recalculating article usage statistics: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    logger.info("[SCHEDULER] Starting article usage statistics recalculation job")

    try:
        async with advisory_xact_lock(LOCK_ID_ARTICLE_STATS) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Article stats job skipped - "
                    "another worker is already executing"
                )
                return

            async with get_session_context() as session:
                # Call PostgreSQL function
                await session.execute(text("SELECT recalculate_article_usage_stats()"))
                await session.commit()

                logger.info("[SCHEDULER] Article usage statistics recalculated successfully")
    except Exception as e:
        logger.error("[SCHEDULER] Error recalculating article usage statistics: %s", e, exc_info=True)
        raise
```

- [ ] **Step 2: Migrate `send_weekly_reports_job` (drops work session)**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_WEEKLY_REPORTS):
                logger.info(
                    "[SCHEDULER] Weekly reports job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                settings = get_settings()
                notification_service = NotificationService(settings)
                sent_count = await notification_service.send_weekly_reports()

                logger.info("[SCHEDULER] Weekly reports job completed: %s reports sent", sent_count)
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_WEEKLY_REPORTS)
    except Exception as e:
        logger.error("[SCHEDULER] Error in weekly reports job: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_WEEKLY_REPORTS) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Weekly reports job skipped - "
                    "another worker is already executing"
                )
                return

            settings = get_settings()
            notification_service = NotificationService(settings)
            sent_count = await notification_service.send_weekly_reports()

            logger.info("[SCHEDULER] Weekly reports job completed: %s reports sent", sent_count)
    except Exception as e:
        logger.error("[SCHEDULER] Error in weekly reports job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 3: Migrate `check_budget_thresholds_job` (drops work session)**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_BUDGET_THRESHOLDS):
                logger.info(
                    "[SCHEDULER] Budget threshold job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                settings = get_settings()
                notification_service = NotificationService(settings)
                notifications_sent = await notification_service.check_all_budget_thresholds()

                logger.info(
                    "[SCHEDULER] Budget threshold check completed: %s notifications sent",
                    notifications_sent
                )
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_BUDGET_THRESHOLDS)

    except Exception as e:
        logger.error("[SCHEDULER] Error in budget threshold check job: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_BUDGET_THRESHOLDS) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Budget threshold job skipped - "
                    "another worker is already executing"
                )
                return

            settings = get_settings()
            notification_service = NotificationService(settings)
            notifications_sent = await notification_service.check_all_budget_thresholds()

            logger.info(
                "[SCHEDULER] Budget threshold check completed: %s notifications sent",
                notifications_sent
            )

    except Exception as e:
        logger.error("[SCHEDULER] Error in budget threshold check job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 4: Migrate `refresh_balance_aggregates_job`**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_BALANCE_AGGREGATES):
                logger.info(
                    "[SCHEDULER] Balance aggregates job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                from backend.app.services.balance_aggregation_service import refresh_monthly_balances

                # Refresh all aggregates (full refresh daily)
                result = await refresh_monthly_balances(session=session)

                logger.info(
                    "[SCHEDULER] Balance aggregates refreshed successfully: "
                    "%s records updated, %s financial centers, %s months processed",
                    result['updated_count'],
                    result['financial_centers'],
                    result['months_processed']
                )
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_BALANCE_AGGREGATES)

    except Exception as e:
        logger.error("[SCHEDULER] Error refreshing balance aggregates: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Balance aggregates job skipped - "
                    "another worker is already executing"
                )
                return

            async with get_session_context() as session:
                from backend.app.services.balance_aggregation_service import refresh_monthly_balances

                # Refresh all aggregates (full refresh daily)
                result = await refresh_monthly_balances(session=session)

                logger.info(
                    "[SCHEDULER] Balance aggregates refreshed successfully: "
                    "%s records updated, %s financial centers, %s months processed",
                    result['updated_count'],
                    result['financial_centers'],
                    result['months_processed']
                )

    except Exception as e:
        logger.error("[SCHEDULER] Error refreshing balance aggregates: %s", e, exc_info=True)
        raise
```

- [ ] **Step 5: Migrate `send_plan_reminders_job` (early `return` now inside work session)**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_PLAN_REMINDERS):
                logger.info(
                    "[SCHEDULER] Plan reminders job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                reminder_service = ReminderService()

                # Get due reminders
                due_reminders = await reminder_service.get_due_reminders(
                    session=session,
                    batch_size=100,
                )

                if not due_reminders:
                    logger.debug("[SCHEDULER] No due plan reminders found")
                    return

                logger.info("[SCHEDULER] Found %s due plan reminders", len(due_reminders))

                # Send each reminder
                sent_count = 0
                for reminder in due_reminders:
                    telegram_sent, web_push_sent = await reminder_service.send_reminder(
                        session=session,
                        reminder=reminder,
                    )
                    if telegram_sent or web_push_sent:
                        sent_count += 1

                logger.info(
                    "[SCHEDULER] Plan reminders job completed: %s/%s reminders sent successfully",
                    sent_count,
                    len(due_reminders)
                )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_PLAN_REMINDERS)

    except Exception as e:
        logger.error("[SCHEDULER] Error in plan reminders job: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_PLAN_REMINDERS) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Plan reminders job skipped - "
                    "another worker is already executing"
                )
                return

            async with get_session_context() as session:
                reminder_service = ReminderService()

                # Get due reminders
                due_reminders = await reminder_service.get_due_reminders(
                    session=session,
                    batch_size=100,
                )

                if not due_reminders:
                    logger.debug("[SCHEDULER] No due plan reminders found")
                    return

                logger.info("[SCHEDULER] Found %s due plan reminders", len(due_reminders))

                # Send each reminder
                sent_count = 0
                for reminder in due_reminders:
                    telegram_sent, web_push_sent = await reminder_service.send_reminder(
                        session=session,
                        reminder=reminder,
                    )
                    if telegram_sent or web_push_sent:
                        sent_count += 1

                logger.info(
                    "[SCHEDULER] Plan reminders job completed: %s/%s reminders sent successfully",
                    sent_count,
                    len(due_reminders)
                )

    except Exception as e:
        logger.error("[SCHEDULER] Error in plan reminders job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 6: Migrate `generate_recurring_facts_job`**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_RECURRING_PLANS):
                logger.info(
                    "[SCHEDULER] Recurring facts job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                from backend.app.services.recurring_plan_service import RecurringPlanService

                service = RecurringPlanService()
                result = await service.generate_pending_facts(session=session)

                logger.info(
                    "[SCHEDULER] Recurring facts generation completed: "
                    "%s facts created for %s plans",
                    result['facts_created'],
                    result['plans_processed']
                )

                # ✅ CRITICAL: Invalidate cache + WebSocket broadcast after scheduler generation
                if result['facts_created'] > 0:
                    import backend.app.api.v1.endpoints.budget_ws as ws
                    from backend.app.services.cache_service import CacheService

                    # Invalidate cache for all users (scheduler affects all users)
                    cache_service = CacheService()
                    await cache_service.invalidate_recurring_plans(user_id=None)
                    logger.info(
                        "[SCHEDULER] Cache invalidated after generating %s facts",
                        result['facts_created']
                    )

                    # Broadcast WebSocket event to ALL users
                    await ws.broadcast_recurring_plan_facts_generated({
                        "facts_count": result['facts_created'],
                        "plans_count": result['plans_processed'],
                        "reminders_count": result.get('reminders_created', 0),
                    })
                    logger.info(
                        "[SCHEDULER] Broadcasted recurring_plan_facts_generated: "
                        "%s facts for %s plans",
                        result['facts_created'],
                        result['plans_processed']
                    )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_RECURRING_PLANS)

    except Exception as e:
        logger.error("[SCHEDULER] Error in recurring facts generation job: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_RECURRING_PLANS) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] Recurring facts job skipped - "
                    "another worker is already executing"
                )
                return

            async with get_session_context() as session:
                from backend.app.services.recurring_plan_service import RecurringPlanService

                service = RecurringPlanService()
                result = await service.generate_pending_facts(session=session)

                logger.info(
                    "[SCHEDULER] Recurring facts generation completed: "
                    "%s facts created for %s plans",
                    result['facts_created'],
                    result['plans_processed']
                )

                # ✅ CRITICAL: Invalidate cache + WebSocket broadcast after scheduler generation
                if result['facts_created'] > 0:
                    import backend.app.api.v1.endpoints.budget_ws as ws
                    from backend.app.services.cache_service import CacheService

                    # Invalidate cache for all users (scheduler affects all users)
                    cache_service = CacheService()
                    await cache_service.invalidate_recurring_plans(user_id=None)
                    logger.info(
                        "[SCHEDULER] Cache invalidated after generating %s facts",
                        result['facts_created']
                    )

                    # Broadcast WebSocket event to ALL users
                    await ws.broadcast_recurring_plan_facts_generated({
                        "facts_count": result['facts_created'],
                        "plans_count": result['plans_processed'],
                        "reminders_count": result.get('reminders_created', 0),
                    })
                    logger.info(
                        "[SCHEDULER] Broadcasted recurring_plan_facts_generated: "
                        "%s facts for %s plans",
                        result['facts_created'],
                        result['plans_processed']
                    )

    except Exception as e:
        logger.error("[SCHEDULER] Error in recurring facts generation job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 7: Migrate `cleanup_expired_webauthn_challenges_job` (early `return` now inside work session)**

Find:

```python
    try:
        async with get_session_context() as session:
            # Try to acquire advisory lock (non-blocking)
            if not await try_advisory_lock(session, LOCK_ID_WEBAUTHN_CLEANUP):
                logger.info(
                    "[SCHEDULER] WebAuthn cleanup job skipped - "
                    "another worker is already executing"
                )
                return

            try:
                from datetime import datetime

                from sqlalchemy import delete, func, select

                from backend.app.models.webauthn_challenge import WebAuthnChallenge

                now = datetime.utcnow()

                # Count expired challenges before cleanup
                count_stmt = select(func.count(WebAuthnChallenge.id)).where(
                    WebAuthnChallenge.expires_at < now
                )
                count_result = await session.exec(count_stmt)
                count_before = count_result.scalar() or 0

                if count_before == 0:
                    logger.debug("[SCHEDULER] No expired WebAuthn challenges found")
                    return

                logger.info(
                    "[SCHEDULER] Found %s expired WebAuthn challenges",
                    count_before
                )

                # Delete expired challenges
                delete_stmt = delete(WebAuthnChallenge).where(
                    WebAuthnChallenge.expires_at < now
                )
                await session.exec(delete_stmt)
                await session.commit()

                logger.info(
                    "[SCHEDULER] WebAuthn challenge cleanup completed: %s challenges deleted",
                    count_before
                )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_WEBAUTHN_CLEANUP)

    except Exception as e:
        logger.error("[SCHEDULER] Error in WebAuthn challenge cleanup job: %s", e, exc_info=True)
        raise
```

Replace with:

```python
    try:
        async with advisory_xact_lock(LOCK_ID_WEBAUTHN_CLEANUP) as acquired:
            if not acquired:
                logger.info(
                    "[SCHEDULER] WebAuthn cleanup job skipped - "
                    "another worker is already executing"
                )
                return

            async with get_session_context() as session:
                from datetime import datetime

                from sqlalchemy import delete, func, select

                from backend.app.models.webauthn_challenge import WebAuthnChallenge

                now = datetime.utcnow()

                # Count expired challenges before cleanup
                count_stmt = select(func.count(WebAuthnChallenge.id)).where(
                    WebAuthnChallenge.expires_at < now
                )
                count_result = await session.exec(count_stmt)
                count_before = count_result.scalar() or 0

                if count_before == 0:
                    logger.debug("[SCHEDULER] No expired WebAuthn challenges found")
                    return

                logger.info(
                    "[SCHEDULER] Found %s expired WebAuthn challenges",
                    count_before
                )

                # Delete expired challenges
                delete_stmt = delete(WebAuthnChallenge).where(
                    WebAuthnChallenge.expires_at < now
                )
                await session.exec(delete_stmt)
                await session.commit()

                logger.info(
                    "[SCHEDULER] WebAuthn challenge cleanup completed: %s challenges deleted",
                    count_before
                )

    except Exception as e:
        logger.error("[SCHEDULER] Error in WebAuthn challenge cleanup job: %s", e, exc_info=True)
        raise
```

- [ ] **Step 8: Verify no job still calls the old helpers**

Run: `grep -n "try_advisory_lock\|release_advisory_lock" backend/app/scheduler.py`
Expected: only the two **definitions** remain (`async def try_advisory_lock` and `async def release_advisory_lock`). No `await try_advisory_lock(` / `await release_advisory_lock(` call sites.

- [ ] **Step 9: Verify the verbatim log strings survived (7 skipped + the success/completed lines)**

Run: `grep -c "job skipped - " backend/app/scheduler.py`
Expected: `7`

Run: `grep -n "Balance aggregates refreshed successfully\|recalculated successfully\|cleanup completed\|reports sent\|notifications sent\|reminders sent successfully\|generation completed" backend/app/scheduler.py`
Expected: each original success/completion log line still present.

- [ ] **Step 10: Type-check the module imports cleanly**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler"`
Expected: no output, exit 0.

- [ ] **Step 11: Unit test still green**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_scheduler_advisory_lock.py -v`
Expected: `2 passed`.

- [ ] **Step 12: Commit**

```bash
git add backend/app/scheduler.py
git commit -m "refactor(scheduler): run all 7 jobs under transaction-scoped advisory lock"
```

---

### Task 3: Remove the obsolete session-level lock helpers

**Files:**
- Modify: `backend/app/scheduler.py` (delete `try_advisory_lock` + `release_advisory_lock`)

- [ ] **Step 1: Delete both helper functions**

Find and delete this entire block (from the `async def try_advisory_lock` line through the end of `release_advisory_lock`):

```python
async def try_advisory_lock(session, lock_id: int) -> bool:
    """
    Try to acquire PostgreSQL advisory lock (non-blocking).

    Advisory locks are session-level locks that prevent multiple workers
    from executing the same job simultaneously.

    Args:
        session: Database session
        lock_id: Unique lock identifier

    Returns:
        bool: True if lock acquired, False if another process holds it
    """
    result = await session.execute(
        text("SELECT pg_try_advisory_lock(:lock_id)"),
        {"lock_id": lock_id}
    )
    return result.scalar()


async def release_advisory_lock(session, lock_id: int):
    """
    Release PostgreSQL advisory lock.

    Args:
        session: Database session
        lock_id: Lock identifier to release
    """
    await session.execute(
        text("SELECT pg_advisory_unlock(:lock_id)"),
        {"lock_id": lock_id}
    )
```

The file should now go from the `LOCK_ID_WEBAUTHN_CLEANUP = 1008` constant block, through a blank line, directly into the `@asynccontextmanager` / `advisory_xact_lock` definition added in Task 1.

- [ ] **Step 2: Verify the helpers are gone entirely**

Run: `grep -n "pg_try_advisory_lock\|pg_advisory_unlock\|def try_advisory_lock\|def release_advisory_lock" backend/app/scheduler.py`
Expected: no output (only `pg_try_advisory_xact_lock` remains, which does not match these patterns).

- [ ] **Step 3: Type-check the module imports cleanly**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler"`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add backend/app/scheduler.py
git commit -m "refactor(scheduler): remove obsolete session-level advisory lock helpers"
```

---

### Task 4: Fix misleading `UTC` comments → `SYSTEM_TIMEZONE`

**Files:**
- Modify: `backend/app/scheduler.py` (docstrings, registration comments, registration log lines)

The 14 `UTC` mentions all appear as the standalone token `" UTC"` (leading space). `datetime.utcnow()` does **not** contain `" UTC"`, so a scoped replace is safe and must NOT touch it. The timezone-less `CronTrigger(...)` calls must stay unchanged — they correctly inherit `scheduler.timezone = settings.SYSTEM_TIMEZONE`.

- [ ] **Step 1: Replace the `" UTC"` token everywhere in the file**

Use a replace-all edit on `backend/app/scheduler.py`: replace the exact string `" UTC"` (a space followed by `UTC`) with `" SYSTEM_TIMEZONE"`. This updates all 4 docstring `Schedule:` lines, all 5 `# Job N:` registration comments, and all 5 `Registered job: ...` log lines.

- [ ] **Step 2: Verify no stray `UTC` scheduling text remains, and `utcnow` is untouched**

Run: `grep -n "UTC" backend/app/scheduler.py`
Expected: exactly one line — `now = datetime.utcnow()` inside `cleanup_expired_webauthn_challenges_job`. No `... UTC)` comments or log lines.

Run: `grep -c " UTC" backend/app/scheduler.py`
Expected: `0` (the `" UTC"` token is fully gone; `datetime.utcnow()` has no leading-space `UTC` so it is not counted).

Run: `grep -c "SYSTEM_TIMEZONE" backend/app/scheduler.py`
Expected: `15` — the 14 replaced tokens (4 docstrings + 5 `# Job N:` comments + 5 `Registered job:` log lines) plus the pre-existing `timezone=settings.SYSTEM_TIMEZONE` in `init_scheduler`.

- [ ] **Step 3: Confirm triggers were not altered**

Run: `grep -n "CronTrigger(" backend/app/scheduler.py`
Expected: 7 timezone-less `CronTrigger(...)` calls, unchanged (no `timezone=` argument added).

- [ ] **Step 4: Type-check the module imports cleanly**

Run: `PYTHONPATH=. backend/.venv/bin/python -c "import backend.app.scheduler"`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend/app/scheduler.py
git commit -m "docs(scheduler): correct UTC comments to SYSTEM_TIMEZONE"
```

---

### Task 5: Final verification against the spec's "Done When"

**Files:** none (verification only)

- [ ] **Step 1: Full scheduler review read**

Re-read `backend/app/scheduler.py` end-to-end and confirm, per spec §Done When:
- All 7 jobs use `advisory_xact_lock(...)`; none call `try_advisory_lock` / `release_advisory_lock`.
- No `try/finally` lock-release blocks remain in any job; outer `try/except ... raise` preserved in all 7.
- `try_advisory_lock` / `release_advisory_lock` definitions are gone.
- Scheduling comments/docstrings/log lines say `SYSTEM_TIMEZONE`; only `datetime.utcnow()` keeps `utc`.

- [ ] **Step 2: Run the new unit test**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend/test_scheduler_advisory_lock.py -v`
Expected: `2 passed`.

- [ ] **Step 3: Run the existing backend unit-test suite (no regressions)**

Run: `PYTHONPATH=. backend/.venv/bin/pytest tests/unit/backend -q`
Expected: all collected tests pass (same set as before this change; the only new file is the scheduler test). If any pre-existing test was already failing on `main`/`test` for unrelated reasons, note it and confirm it is unrelated to `scheduler.py`.

- [ ] **Step 4: Confirm branch + git state**

Run: `git status && git log --oneline -5`
Expected: on `dev/scheduler-advisory-lock-tz-fix`, working tree clean, with the 4 commits from Tasks 1–4 present.

- [ ] **Step 5: STOP — proposal-first gate**

Do **not** open the PR or bump `VERSION` autonomously. Per spec §Constraints & Autonomy these need approval. Report completion and the post-deploy manual verification checklist to the user:
- Logs show `Balance aggregates refreshed successfully: N records` with no double `skipped`.
- `SELECT * FROM pg_locks WHERE locktype = 'advisory';` returns 0 rows after a job run.
- All 7 jobs still deduplicate across the 2 prod workers.

---

## Self-Review (performed during planning)

**Spec coverage:**
- Lock context manager (spec §Design.1) → Task 1.
- All 7 job bodies migrated (spec §Design.2) → Task 2 (steps 1–7).
- Remove `try_advisory_lock`/`release_advisory_lock` (spec §Done When) → Task 3.
- Timezone comment fix (spec §Design.3) → Task 4.
- Unit test for `advisory_xact_lock`, both paths, mocked session (spec §Testing) → Task 1 steps 1/5.
- No real-PG integration test (spec §Non-Goals) → respected.
- Verbatim `skipped` / success log strings (spec §Design.2 rules) → Task 2 steps 9 + Task 5 step 1.
- Early-`return` jobs handled (spec §Design.2) → Task 2 steps 5 & 7.
- Proposal-first / human-only gates (spec §Constraints) → Task 5 step 5.

**Type consistency:** `advisory_xact_lock(lock_id)` yields `acquired: bool`; every job uses `as acquired:` then `if not acquired:`. Import name `async_session_maker` matches `backend/app/db/session.py`. Patch target `backend.app.scheduler.async_session_maker` matches the added import. `LOCK_ID_*` constants unchanged and reused by name.

**Placeholder scan:** none — every code step shows full find/replace blocks and exact commands with expected output.
