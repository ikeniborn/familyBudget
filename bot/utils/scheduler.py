"""
APScheduler integration for automated jobs.

Manages scheduled tasks like weekly reports and budget notifications.
"""

from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from telegram import Bot

from bot.utils.logger import get_logger

logger = get_logger(__name__)


class BotScheduler:
    """
    Scheduler for bot automated tasks.

    Manages APScheduler instance and job registration.
    """

    def __init__(self, bot: Optional[Bot] = None):
        """
        Initialize scheduler.

        Args:
            bot: Telegram Bot instance (optional, can be set later)
        """
        self.scheduler = AsyncIOScheduler()
        self.bot = bot
        self.jobs = {}
        logger.info("BotScheduler initialized")

    def set_bot(self, bot: Bot):
        """
        Set bot instance after initialization.

        Args:
            bot: Telegram Bot instance
        """
        self.bot = bot
        logger.info("Bot instance set in scheduler")

    def start(self):
        """Start the scheduler."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Scheduler started")
        else:
            logger.warning("Scheduler already running")

    def shutdown(self, wait: bool = True):
        """
        Shutdown the scheduler.

        Args:
            wait: Whether to wait for jobs to complete
        """
        if self.scheduler.running:
            self.scheduler.shutdown(wait=wait)
            logger.info("Scheduler shutdown")

    def add_weekly_report_job(
        self,
        day_of_week: str = "sun",
        hour: int = 20,
        minute: int = 0,
        user_telegram_ids: Optional[list] = None,
    ):
        """
        Add weekly report job.

        Args:
            day_of_week: Day to run (mon, tue, wed, thu, fri, sat, sun)
            hour: Hour to run (0-23)
            minute: Minute to run (0-59)
            user_telegram_ids: List of telegram IDs to send reports to (optional)

        Note:
            The job requires a bot instance to be set.
        """
        if not self.bot:
            logger.error("Cannot add weekly report job: bot instance not set")
            return

        from bot.jobs.weekly_report import send_weekly_reports

        # Create cron trigger for weekly execution
        trigger = CronTrigger(day_of_week=day_of_week, hour=hour, minute=minute)

        # Add job
        job = self.scheduler.add_job(
            send_weekly_reports,
            trigger=trigger,
            args=[self.bot, user_telegram_ids],
            id="weekly_report",
            name="Weekly Budget Report",
            replace_existing=True,
        )

        self.jobs["weekly_report"] = job

        logger.info(
            f"Weekly report job scheduled: {day_of_week} {hour:02d}:{minute:02d}"
        )

        return job

    def remove_job(self, job_id: str):
        """
        Remove a job by ID.

        Args:
            job_id: Job identifier
        """
        try:
            self.scheduler.remove_job(job_id)
            if job_id in self.jobs:
                del self.jobs[job_id]
            logger.info(f"Job removed: {job_id}")
        except Exception as e:
            logger.error(f"Error removing job {job_id}: {e}")

    def list_jobs(self):
        """
        List all scheduled jobs.

        Returns:
            List of job objects
        """
        return self.scheduler.get_jobs()

    def get_job_status(self, job_id: str):
        """
        Get status of a specific job.

        Args:
            job_id: Job identifier

        Returns:
            Job object or None if not found
        """
        try:
            return self.scheduler.get_job(job_id)
        except Exception:
            return None


# Global scheduler instance
_scheduler: Optional[BotScheduler] = None


def get_scheduler() -> BotScheduler:
    """
    Get global scheduler instance.

    Returns:
        BotScheduler: Scheduler instance
    """
    global _scheduler
    if _scheduler is None:
        _scheduler = BotScheduler()
    return _scheduler


def init_scheduler(bot: Bot) -> BotScheduler:
    """
    Initialize and configure scheduler with bot instance.

    Args:
        bot: Telegram Bot instance

    Returns:
        BotScheduler: Configured scheduler instance
    """
    scheduler = get_scheduler()
    scheduler.set_bot(bot)

    # Add default jobs
    # Weekly report: Sunday 20:00
    # Note: user_telegram_ids should be loaded from persistent storage
    # For now, this is a placeholder
    scheduler.add_weekly_report_job(
        day_of_week="sun",
        hour=20,
        minute=0,
        user_telegram_ids=[],  # Empty list - will be populated later
    )

    logger.info("Scheduler initialized with default jobs")

    return scheduler
