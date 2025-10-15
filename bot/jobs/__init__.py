"""
Jobs module for scheduled tasks.

Contains background jobs for automated notifications and reports.
"""

from bot.jobs.weekly_report import send_weekly_reports

__all__ = ["send_weekly_reports"]
