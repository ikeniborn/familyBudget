"""Medicine reminder service: fan-out create, due query, send (Telegram buttons + Web Push), snooze.

Mirrors reminder_service.ReminderService. Reminder rows: one per (intake_log_id, recipient_user_id).
"""
from datetime import timedelta

import httpx
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.config import Settings, get_settings
from backend.app.core.json_utils import dumps as json_dumps
from backend.app.core.logging import get_logger
from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine import Medicine
from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.models.medicine_reminder import MedicineReminder
from backend.app.models.push_subscription import PushSubscription
from backend.app.models.user import User
from backend.app.services.telegram_auth import make_telegram_client
from backend.app.utils.timezone import now_local, now_utc

logger = get_logger(__name__)


def _now():
    return now_local().replace(tzinfo=None)


class MedicineReminderService:
    """Dispatch medicine intake reminders via Telegram (inline buttons) + Web Push."""

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self.bot_token = self.settings.TELEGRAM_BOT_TOKEN
        self.telegram_api_url = f"https://api.telegram.org/bot{self.bot_token}"

    # ---------- fan-out ----------
    async def create_reminders_for_intake(
        self,
        session: AsyncSession,
        intake: MedicineIntakeLog,
        course: MedicineCourse,
        patient: FamilyMember,
    ) -> int:
        """Create pending reminders for guardian + linked patient (dedup via UNIQUE). Returns count created."""
        if not course.reminders_enabled or not course.notification_channels:
            return 0  # no channels -> send() would never deliver
        recipients = {patient.guardian_user_id}
        if patient.linked_user_id:
            recipients.add(patient.linked_user_id)
        created = 0
        for uid in recipients:
            try:
                async with session.begin_nested():  # SAVEPOINT: a dup rolls back only this row
                    session.add(MedicineReminder(
                        intake_log_id=intake.id, recipient_user_id=uid,
                        reminder_datetime=intake.scheduled_at, status="pending"))
                created += 1
            except IntegrityError:
                pass  # already exists for this (intake, recipient) — dedup (decision #3)
        return created

    # ---------- due query ----------
    async def get_due(self, session: AsyncSession, batch_size: int = 100) -> list[MedicineReminder]:
        now = _now()
        rows = await session.execute(
            select(MedicineReminder)
            .where(MedicineReminder.status == "pending",
                   MedicineReminder.reminder_datetime <= now)
            .order_by(MedicineReminder.reminder_datetime)
            .limit(batch_size))
        return list(rows.scalars().all())

    # ---------- send ----------
    async def send(self, session: AsyncSession, reminder: MedicineReminder) -> tuple[bool, bool]:
        intake = await session.get(MedicineIntakeLog, reminder.intake_log_id)
        if not intake:
            reminder.mark_failed("intake not found")
            await session.commit()
            return False, False
        course = await session.get(MedicineCourse, intake.course_id)
        medicine = await session.get(Medicine, course.medicine_id) if course else None
        patient = await session.get(FamilyMember, intake.patient_id)
        user = await session.get(User, reminder.recipient_user_id)
        if not (course and medicine and patient and user):
            reminder.mark_failed("missing related rows")
            await session.commit()
            return False, False

        channels = course.notification_channels or []
        time_str = intake.scheduled_at.strftime("%H:%M")
        food = {"before": "до еды", "with": "во время еды", "after": "после еды", "any": ""}.get(
            course.with_food or "", "")
        message = (
            f"💊 Пора принять: {medicine.name}\n"
            f"👤 {patient.name}  ⏰ {time_str}\n"
            f"{course.dose_amount} {course.dose_unit} {food}".rstrip()
        )

        telegram_sent = False
        if "telegram" in channels and user.telegram_id and getattr(user, "enable_telegram_notifications", True):
            telegram_sent = await self._send_telegram(
                user.telegram_id, message, intake.id, course.snooze_minutes)
            reminder.telegram_sent = telegram_sent

        web_push_sent = False
        if "web_push" in channels and getattr(user, "enable_push_notifications", True):
            web_push_sent = await self._send_web_push(
                session, user.id, title=f"💊 {medicine.name}", body=message)
            reminder.web_push_sent = web_push_sent

        if telegram_sent or web_push_sent:
            reminder.mark_sent()
            logger.info("[MED_REMINDER] Sent reminder %s (telegram=%s web_push=%s)",
                        reminder.id, telegram_sent, web_push_sent)
        else:
            reminder.increment_retry("all channels failed")
        await session.commit()
        return telegram_sent, web_push_sent

    async def _send_telegram(
        self, telegram_id: int, message: str, log_id: int, snooze_minutes: int
    ) -> bool:
        """Send with inline quick-action buttons (decision #5: Telegram only)."""
        reply_markup = {"inline_keyboard": [[
            {"text": "✅ Принял", "callback_data": f"med:take:{log_id}"},
            {"text": "⏭ Пропустить", "callback_data": f"med:skip:{log_id}"},
            {"text": f"🕐 Отложить {snooze_minutes} мин", "callback_data": f"med:snooze:{log_id}"},
        ]]}
        try:
            async with make_telegram_client() as client:
                resp = await client.post(
                    f"{self.telegram_api_url}/sendMessage",
                    json={"chat_id": telegram_id, "text": message, "reply_markup": reply_markup},
                    timeout=10.0)
                resp.raise_for_status()
                return True
        except httpx.HTTPError as e:
            logger.error("[MED_REMINDER] Telegram send failed to %s: %s", telegram_id, e)
            return False

    async def _send_web_push(
        self, session: AsyncSession, user_id: int, title: str, body: str
    ) -> bool:
        """Web Push: clicking opens /medicines (no action buttons — decision #5)."""
        if not self.settings.VAPID_PUBLIC_KEY or "PLACEHOLDER" in (self.settings.VAPID_PUBLIC_KEY or ""):
            return False
        subs = (await session.execute(
            select(PushSubscription).where(PushSubscription.user_id == user_id))).scalars().all()
        if not subs:
            return False
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            logger.warning("[MED_REMINDER] pywebpush not installed")
            return False
        payload = json_dumps({
            "title": title, "body": body,
            "icon": "/static/icons/icon-192.png", "badge": "/static/icons/icon-192.png",
            "tag": "medicine-reminder",
            "data": {"type": "medicine_reminder", "url": "/medicines"},
        })
        sent = 0
        expired = []
        for sub in subs:
            try:
                webpush(
                    subscription_info={"endpoint": sub.endpoint,
                                       "keys": {"p256dh": sub.p256dh_key, "auth": sub.auth_key}},
                    data=payload,
                    vapid_private_key=self.settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": f"mailto:{self.settings.VAPID_CONTACT_EMAIL or 'noreply@example.com'}"})
                sub.last_used_at = now_utc().replace(tzinfo=None)
                sent += 1
            except WebPushException as e:
                if e.response and e.response.status_code == 410:
                    expired.append(sub)
            except Exception as e:  # noqa: BLE001
                logger.error("[MED_REMINDER] webpush error: %s", e)
        for sub in expired:
            await session.delete(sub)
        return sent > 0

    # ---------- snooze ----------
    async def snooze(self, session: AsyncSession, intake_id: int, recipient_user_id: int) -> MedicineReminder:
        """Re-schedule the recipient's reminder to now + course.snooze_minutes (default 30).

        UNIQUE(intake_log_id, recipient_user_id) ⇒ at most one row per pair, so we update
        the existing row in place rather than inserting a duplicate.
        """
        intake = await session.get(MedicineIntakeLog, intake_id)
        course = await session.get(MedicineCourse, intake.course_id) if intake else None
        snooze_minutes = course.snooze_minutes if course else 30
        snooze_at = _now() + timedelta(minutes=snooze_minutes)

        row = (await session.execute(
            select(MedicineReminder).where(
                MedicineReminder.intake_log_id == intake_id,
                MedicineReminder.recipient_user_id == recipient_user_id,
            ))).scalar_one_or_none()
        if row:
            row.status = "pending"
            row.reminder_datetime = snooze_at
            row.sent_at = None
        else:
            row = MedicineReminder(
                intake_log_id=intake_id, recipient_user_id=recipient_user_id,
                reminder_datetime=snooze_at, status="pending")
            session.add(row)
        logger.info("[MED_REMINDER] Snoozed reminder for intake=%s recipient=%s until %s",
                    intake_id, recipient_user_id, snooze_at)
        await session.commit()
        await session.refresh(row)
        return row
