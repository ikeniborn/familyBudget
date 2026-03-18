"""
Reminder service for scheduled plan notifications.

Handles CRUD operations for reminders and sending notifications
via Telegram and Web Push when reminders are due.
"""
from datetime import datetime

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import Settings, get_settings
from backend.app.core.json_utils import dumps as json_dumps
from backend.app.core.logging import get_logger
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.push_subscription import PushSubscription
from backend.app.models.scheduled_reminder import ScheduledReminder
from backend.app.models.user import User
from backend.app.utils.timezone import now_local, now_utc

logger = get_logger(__name__)


class ReminderService:
    """Service for scheduled reminder management."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.bot_token = self.settings.TELEGRAM_BOT_TOKEN
        self.telegram_api_url = f"https://api.telegram.org/bot{self.bot_token}"

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def create_reminder(
        self,
        session: AsyncSession,
        fact_id: int,
        reminder_datetime: datetime,
        user_id: int,
    ) -> ScheduledReminder:
        """
        Create a scheduled reminder for a plan.

        Args:
            session: Database session
            fact_id: ID of the plan (BudgetFact with record_type='plan')
            reminder_datetime: When to send the reminder (naive datetime in SYSTEM_TIMEZONE)
            user_id: User ID (for validation)

        Returns:
            ScheduledReminder: Created reminder

        Raises:
            ValueError: If fact is not a plan or doesn't belong to user
        """
        # Validate plan exists and belongs to user
        fact = await session.get(BudgetFact, fact_id)
        if not fact:
            raise ValueError(f"Plan with ID {fact_id} not found")
        if fact.user_id != user_id:
            raise ValueError("Plan does not belong to current user")
        if fact.record_type != "plan":
            raise ValueError("Reminders can only be set for plans (record_type='plan')")

        # Check if reminder already exists
        existing = await self.get_reminder_by_fact_id(session, fact_id)
        if existing:
            raise ValueError(f"Reminder already exists for plan {fact_id}")

        reminder = ScheduledReminder(
            fact_id=fact_id,
            reminder_datetime=reminder_datetime,
            status="pending",
            # Use naive datetime for TIMESTAMP WITHOUT TIME ZONE columns
            created_at=now_utc().replace(tzinfo=None),
            updated_at=now_utc().replace(tzinfo=None),
        )

        session.add(reminder)
        await session.commit()
        await session.refresh(reminder)

        logger.info(
            "[REMINDER] Created reminder %s for plan %s, scheduled at %s",
            reminder.id, fact_id, reminder_datetime,
        )

        return reminder

    async def update_reminder(
        self,
        session: AsyncSession,
        fact_id: int,
        reminder_datetime: datetime,
        user_id: int,
    ) -> ScheduledReminder:
        """
        Update a scheduled reminder.

        Args:
            session: Database session
            fact_id: ID of the plan
            reminder_datetime: New reminder datetime (naive datetime in SYSTEM_TIMEZONE)
            user_id: User ID (for validation)

        Returns:
            ScheduledReminder: Updated reminder

        Raises:
            ValueError: If reminder not found or doesn't belong to user
        """
        # Get reminder
        reminder = await self.get_reminder_by_fact_id(session, fact_id)
        if not reminder:
            raise ValueError(f"Reminder for plan {fact_id} not found")

        # Validate plan belongs to user
        fact = await session.get(BudgetFact, fact_id)
        if not fact or fact.user_id != user_id:
            raise ValueError("Plan does not belong to current user")

        # Update reminder
        reminder.reminder_datetime = reminder_datetime
        reminder.status = "pending"  # Reset status when updating
        # Use naive datetime for TIMESTAMP WITHOUT TIME ZONE columns
        reminder.updated_at = now_utc().replace(tzinfo=None)

        await session.commit()
        await session.refresh(reminder)

        logger.info(
            "[REMINDER] Updated reminder %s for plan %s, new datetime: %s",
            reminder.id, fact_id, reminder_datetime,
        )

        return reminder

    async def delete_reminder(
        self,
        session: AsyncSession,
        fact_id: int,
        user_id: int,
    ) -> bool:
        """
        Delete a scheduled reminder.

        Args:
            session: Database session
            fact_id: ID of the plan
            user_id: User ID (for validation)

        Returns:
            bool: True if deleted

        Raises:
            ValueError: If reminder not found or doesn't belong to user
        """
        # Get reminder
        reminder = await self.get_reminder_by_fact_id(session, fact_id)
        if not reminder:
            raise ValueError(f"Reminder for plan {fact_id} not found")

        # Validate plan belongs to user
        fact = await session.get(BudgetFact, fact_id)
        if not fact or fact.user_id != user_id:
            raise ValueError("Plan does not belong to current user")

        await session.delete(reminder)
        await session.commit()

        logger.info("[REMINDER] Deleted reminder for plan %s", fact_id)

        return True

    async def get_reminder_by_fact_id(
        self,
        session: AsyncSession,
        fact_id: int,
    ) -> ScheduledReminder | None:
        """
        Get reminder by plan ID.

        Args:
            session: Database session
            fact_id: ID of the plan

        Returns:
            ScheduledReminder or None
        """
        statement = select(ScheduledReminder).where(
            ScheduledReminder.fact_id == fact_id
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_reminder_with_plan_info(
        self,
        session: AsyncSession,
        fact_id: int,
        user_id: int,
    ) -> dict | None:
        """
        Get reminder with plan and article info.

        Args:
            session: Database session
            fact_id: ID of the plan
            user_id: User ID (for validation)

        Returns:
            Dict with reminder and plan info or None
        """
        reminder = await self.get_reminder_by_fact_id(session, fact_id)
        if not reminder:
            return None

        # Get plan
        fact = await session.get(BudgetFact, fact_id)
        if not fact or fact.user_id != user_id:
            return None

        # Get article name
        article = await session.get(Article, fact.article_id)
        article_name = article.name if article else None

        # Format datetime (already stored in SYSTEM_TIMEZONE, no conversion needed)
        return {
            "id": reminder.id,
            "fact_id": reminder.fact_id,
            "reminder_datetime": reminder.reminder_datetime,
            "reminder_datetime_local": reminder.reminder_datetime.strftime("%d.%m.%Y %H:%M") if reminder.reminder_datetime else None,
            "status": reminder.status,
            "sent_at": reminder.sent_at,
            "telegram_sent": reminder.telegram_sent,
            "web_push_sent": reminder.web_push_sent,
            "error_message": reminder.error_message,
            "retry_count": reminder.retry_count,
            "created_at": reminder.created_at,
            "updated_at": reminder.updated_at,
            "article_name": article_name,
            "amount": float(fact.amount) if fact.amount else None,
            "fact_date": fact.fact_date,
            "description": fact.description,
        }

    # =========================================================================
    # Scheduler Methods
    # =========================================================================

    async def get_due_reminders(
        self,
        session: AsyncSession,
        batch_size: int = 100,
    ) -> list[ScheduledReminder]:
        """
        Get reminders that are due (status=pending and datetime <= now).

        Args:
            session: Database session
            batch_size: Maximum number of reminders to fetch

        Returns:
            List of due reminders
        """
        # Use naive datetime for comparison with TIMESTAMP WITHOUT TIME ZONE column
        # reminder_datetime is stored as naive datetime in SYSTEM_TIMEZONE
        # (frontend sends local time, we compare with current SYSTEM_TIMEZONE time)
        now = now_local().replace(tzinfo=None)
        statement = (
            select(ScheduledReminder)
            .where(
                ScheduledReminder.status == "pending",
                ScheduledReminder.reminder_datetime <= now,
            )
            .order_by(ScheduledReminder.reminder_datetime)
            .limit(batch_size)
        )
        result = await session.execute(statement)
        return list(result.scalars().all())

    async def send_reminder(
        self,
        session: AsyncSession,
        reminder: ScheduledReminder,
    ) -> tuple[bool, bool]:
        """
        Send reminder notification via Telegram and Web Push.

        Args:
            session: Database session
            reminder: Reminder to send

        Returns:
            Tuple of (telegram_success, web_push_success)
        """
        # Get plan and user info
        fact = await session.get(BudgetFact, reminder.fact_id)
        if not fact:
            logger.error("[REMINDER] Plan %s not found for reminder %s", reminder.fact_id, reminder.id)
            reminder.mark_failed("Plan not found")
            await session.commit()
            return False, False

        user = await session.get(User, fact.user_id)
        if not user:
            logger.error("[REMINDER] User %s not found for reminder %s", fact.user_id, reminder.id)
            reminder.mark_failed("User not found")
            await session.commit()
            return False, False

        # Get article name
        article = await session.get(Article, fact.article_id)
        article_name = article.name if article else f"Категория #{fact.article_id}"

        # Get financial center name
        financial_center_name = None
        if fact.financial_center_id:
            fc = await session.get(FinancialCenter, fact.financial_center_id)
            financial_center_name = fc.name if fc else None

        # Generate message
        message = self._generate_message(
            article_name=article_name,
            amount=float(fact.amount),
            fact_date=fact.fact_date,
            description=fact.description,
            financial_center_name=financial_center_name,
        )

        # Send Telegram notification (check user preference)
        telegram_sent = False
        if user.telegram_id:
            if user.enable_telegram_notifications:
                telegram_sent = await self._send_telegram(user.telegram_id, message)
                reminder.telegram_sent = telegram_sent
            else:
                logger.info(
                    "[NOTIF_FILTER] Skipping Telegram reminder for user %s: "
                    "Telegram notifications disabled",
                    user.id,
                )

        # Send Web Push notification (check user preference)
        web_push_sent = False
        if user.enable_push_notifications:
            web_push_sent = await self._send_web_push_to_user(
                session=session,
                user_id=user.id,
                title="Напоминание о плане",
                body=message,
                fact_id=fact.id,
            )
            reminder.web_push_sent = web_push_sent
        else:
            logger.info(
                "[NOTIF_FILTER] Skipping Web Push reminder for user %s: "
                "Push notifications disabled",
                user.id,
            )

        # Update reminder status
        if telegram_sent or web_push_sent:
            reminder.mark_sent()
            logger.info(
                "[REMINDER] Sent reminder %s for plan %s: telegram=%s, web_push=%s",
                reminder.id, reminder.fact_id, telegram_sent, web_push_sent,
            )
        else:
            error_msg = "All notification channels failed"
            reminder.increment_retry(error_msg)
            logger.warning(
                "[REMINDER] Failed to send reminder %s, retry_count=%s",
                reminder.id, reminder.retry_count,
            )

        await session.commit()
        return telegram_sent, web_push_sent

    def _generate_message(
        self,
        article_name: str,
        amount: float,
        fact_date: datetime,
        description: str | None = None,
        financial_center_name: str | None = None,
    ) -> str:
        """
        Generate reminder message text.

        Args:
            article_name: Category name
            amount: Plan amount
            fact_date: Plan date
            description: Optional description
            financial_center_name: Optional financial center (ЦФО) name

        Returns:
            Formatted message text
        """
        # Format amount
        amount_abs = abs(amount)
        amount_str = f"{amount_abs:,.2f}".replace(",", " ").replace(".", ",")

        # Format date
        date_str = fact_date.strftime("%d.%m.%Y") if hasattr(fact_date, 'strftime') else str(fact_date)

        # Build message
        parts = [
            "🔔 *Напоминание о запланированной операции*",
            "",
        ]

        # Add ЦФО if available
        if financial_center_name:
            parts.append(f"🏦 ЦФО: {financial_center_name}")

        parts.extend([
            f"📁 Категория: {article_name}",
            f"💰 Сумма: {amount_str} ₽",
            f"📅 Дата: {date_str}",
            f"📝 Описание: {description or '—'}",
        ])

        return "\n".join(parts)

    async def _send_telegram(
        self,
        telegram_id: int,
        message: str,
        parse_mode: str = "Markdown",
    ) -> bool:
        """
        Send message via Telegram Bot API.

        Args:
            telegram_id: User's Telegram ID
            message: Message text
            parse_mode: Parse mode (Markdown, HTML)

        Returns:
            bool: True if message sent successfully
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.telegram_api_url}/sendMessage",
                    json={
                        "chat_id": telegram_id,
                        "text": message,
                        "parse_mode": parse_mode,
                    }
                )
                response.raise_for_status()
                return True
        except httpx.HTTPError as e:
            logger.error("[REMINDER] Failed to send Telegram message to %s: %s", telegram_id, e)
            return False

    async def _send_web_push_to_user(
        self,
        session: AsyncSession,
        user_id: int,
        title: str,
        body: str,
        fact_id: int,
    ) -> bool:
        """
        Send Web Push notification to all user's subscriptions.

        Args:
            session: Database session
            user_id: Target user ID
            title: Notification title
            body: Notification body
            fact_id: Plan ID (for navigation)

        Returns:
            bool: True if at least one notification sent successfully
        """
        # Check if VAPID is configured
        if not self.settings.VAPID_PUBLIC_KEY or not self.settings.VAPID_PRIVATE_KEY:
            logger.debug("[REMINDER] VAPID keys not configured, skipping Web Push")
            return False

        if "PLACEHOLDER" in self.settings.VAPID_PUBLIC_KEY:
            logger.debug("[REMINDER] VAPID keys are placeholders, skipping Web Push")
            return False

        # Get user's subscriptions
        statement = select(PushSubscription).where(
            PushSubscription.user_id == user_id
        )
        result = await session.execute(statement)
        subscriptions = list(result.scalars().all())

        if not subscriptions:
            logger.debug("[REMINDER] No push subscriptions for user %s", user_id)
            return False

        # Try to import pywebpush
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            logger.warning("[REMINDER] pywebpush not installed, skipping Web Push")
            return False

        # Prepare notification payload
        payload = json_dumps({
            "title": title,
            "body": body,
            "icon": "/static/icons/icon-192.png",
            "badge": "/static/icons/icon-192.png",
            "tag": f"reminder-{fact_id}",
            "data": {
                "type": "plan_reminder",
                "fact_id": fact_id,
                "url": f"/plan?highlight={fact_id}",
            },
        })

        sent_count = 0
        expired_subscriptions = []

        for subscription in subscriptions:
            subscription_info = {
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh_key,
                    "auth": subscription.auth_key,
                },
            }

            try:
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=self.settings.VAPID_PRIVATE_KEY,
                    vapid_claims={
                        "sub": f"mailto:{self.settings.VAPID_CONTACT_EMAIL or 'admin@example.com'}"
                    },
                )

                # Update last_used_at (use naive datetime for TIMESTAMP WITHOUT TIME ZONE)
                subscription.last_used_at = now_utc().replace(tzinfo=None)
                sent_count += 1

            except WebPushException as e:
                if e.response and e.response.status_code == 410:
                    # Subscription expired - mark for deletion
                    expired_subscriptions.append(subscription)
                    logger.debug("[REMINDER] Subscription expired: %s...", subscription.endpoint[:50])
                else:
                    logger.error("[REMINDER] WebPush error: %s", e)
            except Exception as e:
                logger.error("[REMINDER] Unexpected WebPush error: %s", e)

        # Delete expired subscriptions
        for sub in expired_subscriptions:
            await session.delete(sub)

        if sent_count > 0:
            logger.info("[REMINDER] Sent Web Push to %s/%s subscriptions for user %s", sent_count, len(subscriptions), user_id)

        return sent_count > 0

    # =========================================================================
    # List Reminders
    # =========================================================================

    async def list_user_reminders(
        self,
        session: AsyncSession,
        user_id: int,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        """
        List reminders for a user with plan info.

        Args:
            session: Database session
            user_id: User ID
            status: Optional status filter
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            Tuple of (list of reminders with plan info, total count)
        """
        # Build base query - join reminder with fact
        base_query = (
            select(ScheduledReminder, BudgetFact, Article)
            .join(BudgetFact, ScheduledReminder.fact_id == BudgetFact.id)
            .outerjoin(Article, BudgetFact.article_id == Article.id)
            .where(BudgetFact.user_id == user_id)
        )

        if status:
            base_query = base_query.where(ScheduledReminder.status == status)

        # Get total count
        from sqlalchemy import func as sa_func
        count_query = (
            select(sa_func.count())
            .select_from(ScheduledReminder)
            .join(BudgetFact, ScheduledReminder.fact_id == BudgetFact.id)
            .where(BudgetFact.user_id == user_id)
        )
        if status:
            count_query = count_query.where(ScheduledReminder.status == status)

        count_result = await session.execute(count_query)
        total = count_result.scalar() or 0

        # Get paginated results
        query = (
            base_query
            .order_by(ScheduledReminder.reminder_datetime.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await session.execute(query)
        rows = result.all()

        # Build response
        items = []
        for reminder, fact, article in rows:
            items.append({
                "id": reminder.id,
                "fact_id": reminder.fact_id,
                "reminder_datetime": reminder.reminder_datetime,
                "status": reminder.status,
                "sent_at": reminder.sent_at,
                "telegram_sent": reminder.telegram_sent,
                "web_push_sent": reminder.web_push_sent,
                "error_message": reminder.error_message,
                "retry_count": reminder.retry_count,
                "created_at": reminder.created_at,
                "updated_at": reminder.updated_at,
                "article_name": article.name if article else None,
                "amount": float(fact.amount) if fact.amount else None,
                "fact_date": fact.fact_date,
                "description": fact.description,
            })

        return items, total
