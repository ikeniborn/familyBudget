"""
Notification service for budget threshold alerts.

Checks budget vs actual spending and sends Telegram notifications
when thresholds are exceeded.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional, Tuple

from telegram import Bot
from telegram.error import TelegramError

from bot.utils.api_client import APIClient
from bot.utils.logger import get_logger
from bot.utils.validators import format_amount, format_date

logger = get_logger(__name__)


class NotificationService:
    """
    Service for checking budget thresholds and sending notifications.
    """

    def __init__(self, bot: Bot, api_client: APIClient):
        """
        Initialize notification service.

        Args:
            bot: Telegram Bot instance
            api_client: API client for backend communication
        """
        self.bot = bot
        self.api_client = api_client
        logger.info("NotificationService initialized")

    async def check_budget_threshold(
        self,
        token: str,
        telegram_id: int,
        article_id: int,
        threshold_percent: int = 90,
    ) -> bool:
        """
        Check if budget threshold exceeded for an article.

        Compares plan vs actual for current month and sends notification
        to the specific user if actual >= threshold% of plan.

        Args:
            token: User's access token (for API authentication)
            telegram_id: User's Telegram ID (notification recipient)
            article_id: Article ID to check
            threshold_percent: Threshold percentage (default: 90)

        Returns:
            bool: True if notification was sent, False otherwise
        """
        try:
            # Get current month period
            today = date.today()
            month_start = date(today.year, today.month, 1)

            # Calculate month end
            if today.month == 12:
                month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

            # Fetch all facts for current month
            facts_response = await self.api_client.list_facts(
                token=token,
                date_from=month_start.isoformat(),
                date_to=month_end.isoformat(),
                limit=10000,
            )

            facts = facts_response.get("facts", [])

            # Separate by record_type and filter by article
            plan_facts = [
                f for f in facts
                if f.get("record_type") == "plan" and f.get("article_id") == article_id
            ]
            actual_facts = [
                f for f in facts
                if f.get("record_type") == "fact" and f.get("article_id") == article_id
            ]

            # Calculate totals
            plan_total = sum(
                abs(Decimal(str(f.get("amount", "0")))) for f in plan_facts
            )
            actual_total = sum(
                abs(Decimal(str(f.get("amount", "0")))) for f in actual_facts
            )

            # Check if threshold exceeded
            if plan_total == 0:
                # No plan set, no notification
                return False

            percent_used = (actual_total / plan_total) * 100

            # Check if broadcast notification already sent for this period
            if await self._notification_already_sent(
                article_id, month_start, month_end, threshold_percent
            ):
                logger.debug(
                    f"Broadcast notification already sent for article {article_id} "
                    f"in period {month_start} to {month_end}"
                )
                return False

            # Send notification if threshold exceeded
            if percent_used >= threshold_percent:
                # Fetch article info
                article = await self.api_client.get_article(token, article_id)
                article_name = article.get("name", f"Article #{article_id}")

                # Send notification to the specific user (not broadcast)
                # SECURITY FIX: Only send to the user who owns the budget data
                try:
                    await self._send_threshold_notification(
                        telegram_id=telegram_id,
                        article_name=article_name,
                        plan_total=plan_total,
                        actual_total=actual_total,
                        percent_used=percent_used,
                        threshold_percent=threshold_percent,
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to send notification to user {telegram_id}: {e}"
                    )
                    return False

                # Create notification record in backend (user-specific)
                await self.api_client.create_notification(
                    article_id=article_id,
                    notification_type="budget_threshold",
                    threshold_percent=threshold_percent,
                    plan_amount=str(plan_total),
                    actual_amount=str(actual_total),
                    period_start=month_start.isoformat(),
                    period_end=month_end.isoformat(),
                    user_id=telegram_id,  # User-specific notification
                )

                logger.info(
                    f"Threshold notification sent to user {telegram_id}: "
                    f"article={article_id}, percent={percent_used:.0f}%"
                )

                return True

            return False

        except Exception as e:
            logger.error(f"Error checking budget threshold: {e}", exc_info=True)
            return False

    async def _notification_already_sent(
        self,
        article_id: int,
        period_start: date,
        period_end: date,
        threshold_percent: int,
    ) -> bool:
        """
        Check if broadcast notification already sent for this article/period.

        Args:
            article_id: Article ID
            period_start: Period start date
            period_end: Period end date
            threshold_percent: Threshold percentage

        Returns:
            bool: True if broadcast notification already sent
        """
        try:
            return await self.api_client.check_duplicate_notification(
                article_id=article_id,
                notification_type="budget_threshold",
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
            )
        except Exception as e:
            logger.error(
                f"Error checking duplicate notification: {e}",
                exc_info=True
            )
            # On error, assume notification not sent (fail-safe: send notification)
            return False

    async def _send_threshold_notification(
        self,
        telegram_id: int,
        article_name: str,
        plan_total: Decimal,
        actual_total: Decimal,
        percent_used: Decimal,
        threshold_percent: int,
    ):
        """
        Send budget threshold notification via Telegram.

        Args:
            telegram_id: User's Telegram ID
            article_name: Article name
            plan_total: Planned amount
            actual_total: Actual amount spent
            percent_used: Percentage of budget used
            threshold_percent: Threshold that was exceeded
        """
        try:
            # Determine status emoji and message
            if percent_used >= 100:
                status_emoji = "🚨"
                status_text = "ПРЕВЫШЕН"
            elif percent_used >= threshold_percent:
                status_emoji = "⚠️"
                status_text = "ДОСТИГНУТ ПОРОГ"
            else:
                return  # Should not happen, but just in case

            difference = actual_total - plan_total

            message_parts = [
                f"{status_emoji} *Бюджетное предупреждение*",
                "---",
                "ЦФО: Семья",
                f"Категория: {article_name}",
                f"Статус: {status_text}",
                "---",
                "*Статистика:*",
                f"План: {format_amount(plan_total)} ₽",
                f"Факт: {format_amount(actual_total)} ₽",
                f"Использовано: {percent_used:.0f}%",
            ]

            if percent_used >= 100:
                message_parts.append(f"Превышение: +{format_amount(abs(difference))} ₽")

            message = "\n".join(message_parts)

            # Send notification
            await self.bot.send_message(
                chat_id=telegram_id,
                text=message,
                parse_mode="Markdown",
            )

            logger.info(f"Threshold notification sent to user {telegram_id}")

        except TelegramError as e:
            logger.error(f"Error sending Telegram notification: {e}")
        except Exception as e:
            logger.error(f"Unexpected error sending notification: {e}", exc_info=True)


# Global notification service instance
_notification_service: Optional[NotificationService] = None


def get_notification_service() -> Optional[NotificationService]:
    """
    Get global notification service instance.

    Returns:
        NotificationService or None if not initialized
    """
    return _notification_service


def init_notification_service(bot: Bot, api_client: APIClient) -> NotificationService:
    """
    Initialize notification service.

    Args:
        bot: Telegram Bot instance
        api_client: API client instance

    Returns:
        NotificationService: Initialized service
    """
    global _notification_service
    _notification_service = NotificationService(bot, api_client)
    logger.info("Notification service initialized globally")
    return _notification_service
