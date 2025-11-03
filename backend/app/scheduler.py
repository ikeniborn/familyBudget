"""
Background scheduler for periodic tasks.

This module sets up APScheduler for running background jobs:
- Daily statistics recalculation (00:00)
- Cleanup tasks
- Notification jobs

Uses AsyncIOScheduler for async compatibility with FastAPI.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from backend.app.db.session import get_session_context
from backend.app.core.logging import get_logger

logger = get_logger(__name__)

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
    """
    logger.info("[SCHEDULER] Starting article usage statistics recalculation job")

    try:
        async with get_session_context() as session:
            # Call PostgreSQL function
            await session.execute(text("SELECT recalculate_article_usage_stats()"))
            await session.commit()

            logger.info("[SCHEDULER] Article usage statistics recalculated successfully")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error recalculating article usage statistics: {e}", exc_info=True)
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

    # Create AsyncIOScheduler (compatible with FastAPI async)
    scheduler = AsyncIOScheduler(
        timezone="UTC",
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

    # Add more jobs here as needed

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
