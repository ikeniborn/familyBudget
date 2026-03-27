"""
Backend notification service for scheduler jobs.

Handles automated notifications:
- Weekly budget reports (FR-005)
- Budget threshold checks (FR-006)
"""
from datetime import date, timedelta
from decimal import Decimal

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import Settings
from backend.app.core.logging import get_logger
from backend.app.db.session import get_session_context
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.notification import Notification
from backend.app.models.user import User
from backend.app.services.telegram_auth import make_telegram_client
from backend.app.utils.timezone import now_local

logger = get_logger(__name__)


class NotificationService:
    """Service for automated notifications (scheduler jobs)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.api_internal_key = settings.API_INTERNAL_KEY
        self.telegram_api_url = f"https://api.telegram.org/bot{self.bot_token}"

    async def send_telegram_message(
        self,
        telegram_id: int,
        message: str,
        parse_mode: str = "Markdown"
    ) -> bool:
        """
        Send message via Telegram Bot API.

        Args:
            telegram_id: User's Telegram ID
            message: Message text (Markdown formatted)
            parse_mode: Parse mode (Markdown, HTML, or None)

        Returns:
            bool: True if message sent successfully
        """
        try:
            async with make_telegram_client() as client:
                response = await client.post(
                    f"{self.telegram_api_url}/sendMessage",
                    json={
                        "chat_id": telegram_id,
                        "text": message,
                        "parse_mode": parse_mode,
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                return True
        except httpx.HTTPError as e:
            logger.error("Failed to send Telegram message to %s: %s", telegram_id, e)
            return False

    async def create_notification_record(
        self,
        session: AsyncSession,
        article_id: int,
        notification_type: str,
        threshold_percent: int,
        plan_amount: Decimal,
        actual_amount: Decimal,
        period_start: date,
        period_end: date,
        user_id: int | None = None,
    ) -> Notification:
        """
        Create notification record in database.

        Args:
            session: Database session
            article_id: Article ID
            notification_type: Type (budget_threshold, budget_exceeded, weekly_report)
            threshold_percent: Threshold percentage
            plan_amount: Planned amount
            actual_amount: Actual amount
            period_start: Period start date
            period_end: Period end date
            user_id: User ID (None = broadcast)

        Returns:
            Notification: Created notification
        """
        notification = Notification(
            user_id=user_id,
            article_id=article_id,
            notification_type=notification_type,
            threshold_percent=threshold_percent,
            plan_amount=plan_amount,
            actual_amount=actual_amount,
            period_start=period_start,
            period_end=period_end,
        )
        session.add(notification)
        await session.commit()
        await session.refresh(notification)
        return notification

    async def check_notification_exists(
        self,
        session: AsyncSession,
        article_id: int,
        notification_type: str,
        period_start: date,
        period_end: date,
    ) -> bool:
        """
        Check if broadcast notification already exists for period.

        Args:
            session: Database session
            article_id: Article ID
            notification_type: Notification type
            period_start: Period start
            period_end: Period end

        Returns:
            bool: True if notification exists
        """
        statement = select(Notification).where(
            Notification.user_id.is_(None),
            Notification.article_id == article_id,
            Notification.notification_type == notification_type,
            Notification.period_start == period_start,
            Notification.period_end == period_end,
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none() is not None

    async def get_active_users(self, session: AsyncSession) -> list[User]:
        """
        Get all active users with is_active=True and is_current=True.

        Args:
            session: Database session

        Returns:
            list[User]: Active users
        """
        statement = select(User).where(
            User.is_active,
        )
        result = await session.execute(statement)
        return list(result.scalars().all())

    async def send_weekly_reports(self) -> int:
        """
        Send weekly budget reports to all active users (FR-005).

        Called by scheduler every Monday at 09:00 UTC.
        Reports cover previous week (Mon-Sun).

        Returns:
            int: Number of reports sent successfully
        """
        logger.info("[SCHEDULER] Starting weekly reports job")

        try:
            async with get_session_context() as session:
                # Calculate previous week period using SYSTEM_TIMEZONE
                # (scheduler runs in SYSTEM_TIMEZONE, so use same for date calculations)
                today = now_local().date()  # now_local(None) uses SYSTEM_TIMEZONE
                days_since_monday = today.weekday()
                last_monday = today - timedelta(days=days_since_monday + 7)
                last_sunday = last_monday + timedelta(days=6)

                logger.info(
                    "[SCHEDULER] Weekly report period: %s to %s", last_monday, last_sunday
                )

                # Get active users
                users = await self.get_active_users(session)

                if not users:
                    logger.warning("[SCHEDULER] No active users found for weekly report")
                    return 0

                # Fetch all facts for previous week
                facts_stmt = select(BudgetFact).where(
                    BudgetFact.fact_date >= last_monday,
                    BudgetFact.fact_date <= last_sunday,
                )
                facts_result = await session.execute(facts_stmt)
                facts = list(facts_result.scalars().all())

                # Calculate summary by record_type
                plan_total = sum(
                    abs(f.amount) for f in facts if f.record_type == "plan"
                )
                fact_total = sum(
                    abs(f.amount) for f in facts if f.record_type == "fact"
                )

                # Calculate expense/income breakdown
                expense_facts = [
                    f for f in facts
                    if f.record_type == "fact" and f.amount < 0
                ]
                income_facts = [
                    f for f in facts
                    if f.record_type == "fact" and f.amount > 0
                ]

                expense_total = sum(abs(f.amount) for f in expense_facts)
                income_total = sum(abs(f.amount) for f in income_facts)

                # Format weekly report message
                message_parts = [
                    "📊 *Еженедельный отчет по бюджету*",
                    "",
                    f"*Период:* {last_monday.strftime('%d.%m.%Y')} - {last_sunday.strftime('%d.%m.%Y')}",
                    "",
                    "*Итого:*",
                    f"План: {plan_total:,.2f} ₽",
                    f"Факт: {fact_total:,.2f} ₽",
                    "",
                    "*Детализация:*",
                    f"Расходы: {expense_total:,.2f} ₽ ({len(expense_facts)} операций)",
                    f"Доходы: {income_total:,.2f} ₽ ({len(income_facts)} операций)",
                    "",
                ]

                # Calculate usage percent if plan exists
                if plan_total > 0:
                    usage_percent = (fact_total / plan_total) * 100
                    message_parts.append(f"*Исполнение плана:* {usage_percent:.1f}%")
                    message_parts.append("")

                message_parts.extend([
                    "Используйте /summary для детального анализа",
                    "или /add для добавления новых операций",
                ])

                message = "\n".join(message_parts)

                # Send to all active users
                sent_count = 0
                for user in users:
                    # FILTER: Check Telegram notifications enabled
                    if not user.enable_telegram_notifications:
                        logger.debug(
                            "[NOTIF_FILTER] Skipping weekly report for user %s: "
                            "Telegram notifications disabled", user.id
                        )
                        continue

                    if user.telegram_id:
                        success = await self.send_telegram_message(
                            telegram_id=user.telegram_id,
                            message=message,
                        )
                        if success:
                            sent_count += 1

                logger.info(
                    "[SCHEDULER] Weekly reports sent to %s/%s users", sent_count, len(users)
                )

                return sent_count

        except Exception as e:
            logger.error("[SCHEDULER] Error sending weekly reports: %s", e, exc_info=True)
            return 0

    async def check_all_budget_thresholds(self) -> int:
        """
        Check budget thresholds for all articles (FR-006).

        Called by scheduler daily at 18:00 UTC.
        Checks current month budget vs actual for all expense categories.

        Returns:
            int: Number of notifications sent
        """
        logger.info("[SCHEDULER] Starting budget threshold checks")

        try:
            async with get_session_context() as session:
                # Calculate current month period using SYSTEM_TIMEZONE
                # (scheduler runs in SYSTEM_TIMEZONE, so use same for date calculations)
                today = now_local().date()  # now_local(None) uses SYSTEM_TIMEZONE
                month_start = date(today.year, today.month, 1)

                if today.month == 12:
                    month_end = date(today.year + 1, 1, 1) - timedelta(days=1)
                else:
                    month_end = date(today.year, today.month + 1, 1) - timedelta(days=1)

                logger.info(
                    "[SCHEDULER] Checking budget for period: %s to %s", month_start, month_end
                )

                # Get all active expense articles
                articles_stmt = select(Article).where(
                    Article.is_active,
                    Article.type == "expense",
                )
                articles_result = await session.execute(articles_stmt)
                articles = list(articles_result.scalars().all())

                logger.info("[SCHEDULER] Checking %s expense articles", len(articles))

                # Get active users for broadcast
                users = await self.get_active_users(session)
                # FILTER: Only users with Telegram notifications enabled
                telegram_ids = [
                    u.telegram_id for u in users
                    if u.telegram_id and u.enable_telegram_notifications
                ]

                if not telegram_ids:
                    logger.warning("[SCHEDULER] No active users with telegram_id found")
                    return 0

                notifications_sent = 0

                # Check each article
                for article in articles:
                    # Get facts for current month
                    facts_stmt = select(BudgetFact).where(
                        BudgetFact.article_id == article.id,
                        BudgetFact.fact_date >= month_start,
                        BudgetFact.fact_date <= month_end,
                    )
                    facts_result = await session.execute(facts_stmt)
                    facts = list(facts_result.scalars().all())

                    # Calculate totals
                    plan_facts = [f for f in facts if f.record_type == "plan"]
                    actual_facts = [f for f in facts if f.record_type == "fact"]

                    plan_total = sum(abs(f.amount) for f in plan_facts)
                    actual_total = sum(abs(f.amount) for f in actual_facts)

                    # Skip if no plan set
                    if plan_total == 0:
                        continue

                    # Calculate usage percent
                    percent_used = (actual_total / plan_total) * 100

                    # Check if threshold exceeded (default 90%)
                    threshold_percent = 90

                    if percent_used >= threshold_percent:
                        # Check if notification already sent for this period
                        exists = await self.check_notification_exists(
                            session=session,
                            article_id=article.id,
                            notification_type="budget_threshold",
                            period_start=month_start,
                            period_end=month_end,
                        )

                        if exists:
                            logger.debug(
                                "[SCHEDULER] Notification already sent for article %s", article.id
                            )
                            continue

                        # Format notification message
                        if percent_used >= 100:
                            status_emoji = "🚨"
                            status_text = "ПРЕВЫШЕН"
                        else:
                            status_emoji = "⚠️"
                            status_text = "ДОСТИГНУТ ПОРОГ"

                        difference = actual_total - plan_total

                        message_parts = [
                            f"{status_emoji} *Бюджетное предупреждение*",
                            "---",
                            "ЦФО: Семья",
                            f"Категория: {article.name}",
                            f"Статус: {status_text}",
                            "---",
                            "*Статистика:*",
                            f"План: {plan_total:,.2f} ₽",
                            f"Факт: {actual_total:,.2f} ₽",
                            f"Использовано: {percent_used:.0f}%",
                        ]

                        if percent_used >= 100:
                            message_parts.append(f"Превышение: +{abs(difference):,.2f} ₽")

                        message = "\n".join(message_parts)

                        # Send broadcast notification to all users
                        sent_count = 0
                        for telegram_id in telegram_ids:
                            success = await self.send_telegram_message(
                                telegram_id=telegram_id,
                                message=message,
                            )
                            if success:
                                sent_count += 1

                        # Create notification record (broadcast)
                        await self.create_notification_record(
                            session=session,
                            article_id=article.id,
                            notification_type="budget_threshold",
                            threshold_percent=threshold_percent,
                            plan_amount=plan_total,
                            actual_amount=actual_total,
                            period_start=month_start,
                            period_end=month_end,
                            user_id=None,  # Broadcast
                        )

                        notifications_sent += 1

                        logger.info(
                            "[SCHEDULER] Budget threshold notification sent for article %s: "
                            "%.0f%% (%s/%s users)",
                            article.id, percent_used, sent_count, len(telegram_ids)
                        )

                logger.info(
                    "[SCHEDULER] Budget threshold checks completed: %s notifications sent",
                    notifications_sent
                )

                return notifications_sent

        except Exception as e:
            logger.error(
                "[SCHEDULER] Error checking budget thresholds: %s", e,
                exc_info=True
            )
            return 0
