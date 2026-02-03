"""
Background scheduler for periodic tasks.

This module sets up APScheduler for running background jobs:
- Daily statistics recalculation (00:00)
- Cleanup tasks
- Notification jobs

Uses AsyncIOScheduler for async compatibility with FastAPI.

IMPORTANT: When running with multiple workers (uvicorn --workers N),
each worker initializes its own scheduler. To prevent duplicate job
execution, we use PostgreSQL advisory locks (pg_try_advisory_lock).
Only one worker can acquire the lock and execute the job.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from backend.app.core.config import get_settings
from backend.app.core.logging import get_logger
from backend.app.db.session import get_session_context
from backend.app.services.notification_service import NotificationService
from backend.app.services.reminder_service import ReminderService

logger = get_logger(__name__)

# Advisory lock IDs for scheduler jobs (unique per job)
# Using hash of job name to generate unique lock IDs
LOCK_ID_ARTICLE_STATS = 1001
LOCK_ID_WEEKLY_REPORTS = 1003
LOCK_ID_BUDGET_THRESHOLDS = 1004
LOCK_ID_PLAN_REMINDERS = 1005
LOCK_ID_BALANCE_AGGREGATES = 1006
LOCK_ID_RECURRING_PLANS = 1007
LOCK_ID_WEBAUTHN_CLEANUP = 1008


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

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


async def recalculate_article_usage_stats_job():
    """
    Job: Recalculate article usage statistics from t_f_budget_fact.

    Calls PostgreSQL function recalculate_article_usage_stats() which:
    1. Truncates t_article_usage_stats
    2. Recalculates usage counts from t_f_budget_fact
    3. Inserts updated statistics

    Schedule: Daily at 00:00

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
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
        logger.error(f"[SCHEDULER] Error recalculating article usage statistics: {e}", exc_info=True)
        raise


async def send_weekly_reports_job():
    """
    Job: Send weekly budget reports to all users (FR-005).

    Sends summary of previous week (Mon-Sun) to all active users.
    Includes plan vs actual, expense/income breakdown, usage percentage.

    Schedule: Every Monday at 09:00 UTC

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting weekly reports job")

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

                logger.info(f"[SCHEDULER] Weekly reports job completed: {sent_count} reports sent")
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_WEEKLY_REPORTS)
    except Exception as e:
        logger.error(f"[SCHEDULER] Error in weekly reports job: {e}", exc_info=True)
        raise


async def check_budget_thresholds_job():
    """
    Job: Check budget thresholds for all articles (FR-006).

    Checks current month budget vs actual for all expense categories.
    Sends broadcast notification if threshold exceeded (default 90%).

    Schedule: Daily at 18:00 UTC

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting budget threshold check job")

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
                    f"[SCHEDULER] Budget threshold check completed: "
                    f"{notifications_sent} notifications sent"
                )
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_BUDGET_THRESHOLDS)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error in budget threshold check job: {e}", exc_info=True)
        raise


async def refresh_balance_aggregates_job():
    """
    Job: Refresh monthly balance aggregates for financial centers.

    Calculates and stores monthly closing balances in t_agg_financial_center_balance_monthly
    to optimize balance calculation queries in analytics.

    Process:
    1. For each active financial center
    2. For each month from earliest transaction to current month
    3. Calculate cumulative closing balance at end of month
    4. Count transactions in that month
    5. Upsert into aggregate table

    Schedule: Daily at 01:00 UTC (after article stats at 00:00)

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting balance aggregates refresh job")

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
                    f"[SCHEDULER] Balance aggregates refreshed successfully: "
                    f"{result['updated_count']} records updated, "
                    f"{result['financial_centers']} financial centers, "
                    f"{result['months_processed']} months processed"
                )
            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_BALANCE_AGGREGATES)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error refreshing balance aggregates: {e}", exc_info=True)
        raise


async def send_plan_reminders_job():
    """
    Job: Send due plan reminders via Telegram and Web Push.

    Checks for reminders with status='pending' and reminder_datetime <= now.
    Sends notifications via Telegram (if user has telegram_id) and
    Web Push (if user has subscriptions).

    Schedule: Every 5 minutes

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting plan reminders job")

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

                logger.info(f"[SCHEDULER] Found {len(due_reminders)} due plan reminders")

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
                    f"[SCHEDULER] Plan reminders job completed: "
                    f"{sent_count}/{len(due_reminders)} reminders sent successfully"
                )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_PLAN_REMINDERS)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error in plan reminders job: {e}", exc_info=True)
        raise


async def generate_recurring_facts_job():
    """
    Job: Generate pending facts for all active recurring plans.

    Iterates over all active recurring plans where next_generation_date <= today
    and generates BudgetFact records up to 90 days ahead (default horizon).

    Process:
    1. Find all active recurring plans needing generation
    2. For each plan, generate facts until horizon reached or end_date/count limit
    3. Update plan's next_generation_date and occurrences_generated

    Schedule: Daily at 02:00 UTC (after balance aggregates at 01:00)

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting recurring facts generation job")

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
                    f"[SCHEDULER] Recurring facts generation completed: "
                    f"{result['facts_created']} facts created for "
                    f"{result['plans_processed']} plans"
                )

                # ✅ CRITICAL: Invalidate cache + WebSocket broadcast after scheduler generation
                if result['facts_created'] > 0:
                    import backend.app.api.v1.endpoints.budget_ws as ws
                    from backend.app.services.cache_service import CacheService

                    # Invalidate cache for all users (scheduler affects all users)
                    cache_service = CacheService()
                    await cache_service.invalidate_recurring_plans(user_id=None)
                    logger.info(
                        f"[SCHEDULER] Cache invalidated after generating "
                        f"{result['facts_created']} facts"
                    )

                    # Broadcast WebSocket event to ALL users
                    await ws.broadcast_recurring_plan_facts_generated({
                        "facts_count": result['facts_created'],
                        "plans_count": result['plans_processed'],
                        "reminders_count": result.get('reminders_created', 0),
                    })
                    logger.info(
                        f"[SCHEDULER] Broadcasted recurring_plan_facts_generated: "
                        f"{result['facts_created']} facts for {result['plans_processed']} plans"
                    )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_RECURRING_PLANS)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error in recurring facts generation job: {e}", exc_info=True)
        raise


async def cleanup_expired_webauthn_challenges_job():
    """
    Job: Delete expired WebAuthn challenges from database.

    Removes challenges where expires_at < NOW() to prevent table bloat.
    WebAuthn challenges expire after 10 minutes (registration/authentication).

    Schedule: Every hour

    Uses PostgreSQL advisory lock to prevent duplicate execution
    when running with multiple uvicorn workers.
    """
    logger.info("[SCHEDULER] Starting WebAuthn challenge cleanup job")

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
                    f"[SCHEDULER] Found {count_before} expired WebAuthn challenges"
                )

                # Delete expired challenges
                delete_stmt = delete(WebAuthnChallenge).where(
                    WebAuthnChallenge.expires_at < now
                )
                result = await session.exec(delete_stmt)
                await session.commit()

                logger.info(
                    f"[SCHEDULER] WebAuthn challenge cleanup completed: "
                    f"{count_before} challenges deleted"
                )

            finally:
                # Always release the lock
                await release_advisory_lock(session, LOCK_ID_WEBAUTHN_CLEANUP)

    except Exception as e:
        logger.error(f"[SCHEDULER] Error in WebAuthn challenge cleanup job: {e}", exc_info=True)
        raise


def init_scheduler() -> AsyncIOScheduler:
    """
    Initialize and configure APScheduler.

    Returns:
        AsyncIOScheduler: Configured scheduler instance
    """
    global scheduler

    if scheduler is not None:
        logger.warning("[SCHEDULER] Scheduler already initialized")
        return scheduler

    logger.info("[SCHEDULER] Initializing APScheduler")

    # Get system timezone from settings
    settings = get_settings()

    # Create AsyncIOScheduler (compatible with FastAPI async)
    scheduler = AsyncIOScheduler(
        timezone=settings.SYSTEM_TIMEZONE,
        job_defaults={
            "coalesce": True,  # Combine multiple missed runs into one
            "max_instances": 1,  # Only one instance of job at a time
            "misfire_grace_time": 3600,  # 1 hour grace period for missed jobs
        }
    )

    # Register jobs

    # Job 1: Recalculate article usage statistics (daily at 00:00 UTC)
    scheduler.add_job(
        recalculate_article_usage_stats_job,
        trigger=CronTrigger(hour=0, minute=0),
        id="recalculate_article_usage_stats",
        name="Recalculate Article Usage Statistics",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: recalculate_article_usage_stats (daily at 00:00 UTC)")

    # Job 2: Refresh balance aggregates (daily at 01:00 UTC)
    scheduler.add_job(
        refresh_balance_aggregates_job,
        trigger=CronTrigger(hour=1, minute=0),
        id="refresh_balance_aggregates",
        name="Refresh Monthly Balance Aggregates",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: refresh_balance_aggregates (daily at 01:00 UTC)")

    # Job 3: Send weekly budget reports (every Monday at 09:00 UTC)
    scheduler.add_job(
        send_weekly_reports_job,
        trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),
        id="send_weekly_reports",
        name="Send Weekly Budget Reports (FR-005)",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: send_weekly_reports (every Monday at 09:00 UTC)")

    # Job 4: Check budget thresholds (daily at 18:00 UTC)
    scheduler.add_job(
        check_budget_thresholds_job,
        trigger=CronTrigger(hour=18, minute=0),
        id="check_budget_thresholds",
        name="Check Budget Thresholds (FR-006)",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: check_budget_thresholds (daily at 18:00 UTC)")

    # Job 5: Send plan reminders (every 5 minutes)
    scheduler.add_job(
        send_plan_reminders_job,
        trigger=CronTrigger(minute="*/5"),
        id="send_plan_reminders",
        name="Send Plan Reminders (Telegram + Web Push)",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: send_plan_reminders (every 5 minutes)")

    # Job 6: Generate recurring facts (daily at 02:00 UTC)
    scheduler.add_job(
        generate_recurring_facts_job,
        trigger=CronTrigger(hour=2, minute=0),
        id="generate_recurring_facts",
        name="Generate Recurring Plan Facts",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: generate_recurring_facts (daily at 02:00 UTC)")

    # Job 7: Cleanup expired WebAuthn challenges (every hour)
    scheduler.add_job(
        cleanup_expired_webauthn_challenges_job,
        trigger=CronTrigger(minute=0),  # Every hour at :00
        id="cleanup_expired_webauthn_challenges",
        name="Cleanup Expired WebAuthn Challenges",
        replace_existing=True,
    )
    logger.info("[SCHEDULER] Registered job: cleanup_expired_webauthn_challenges (every hour)")

    return scheduler


async def start_scheduler():
    """
    Start the scheduler.

    Called during application startup (lifespan).
    """
    global scheduler

    if scheduler is None:
        scheduler = init_scheduler()

    if not scheduler.running:
        scheduler.start()
        logger.info("[SCHEDULER] Scheduler started successfully")

        # Log scheduled jobs
        jobs = scheduler.get_jobs()
        logger.info(f"[SCHEDULER] Active jobs: {len(jobs)}")
        for job in jobs:
            logger.info(f"[SCHEDULER]   - {job.id}: {job.name} (next run: {job.next_run_time})")
    else:
        logger.warning("[SCHEDULER] Scheduler is already running")


async def stop_scheduler():
    """
    Stop the scheduler gracefully.

    Called during application shutdown (lifespan).
    """
    global scheduler

    if scheduler is not None and scheduler.running:
        logger.info("[SCHEDULER] Shutting down scheduler")
        scheduler.shutdown(wait=True)
        logger.info("[SCHEDULER] Scheduler stopped successfully")
    else:
        logger.warning("[SCHEDULER] Scheduler is not running")
