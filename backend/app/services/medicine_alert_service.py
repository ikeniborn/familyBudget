"""Daily medicine expiry alerts: query expiring stock, format + send via Telegram + Web Push.

Broadcasts directly to all active users (no t_medicine_reminder rows — those are only for
course intakes), mirroring the broadcast pattern of NotificationService.check_all_budget_thresholds.
Web Push payload follows spec decision #5: data.type="medicine_expiry", data.url="/medicines",
no action buttons (click opens the dashboard).
"""
import logging
from datetime import timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.services.notification_service import NotificationService
from backend.app.utils.timezone import now_local

logger = logging.getLogger(__name__)

EXPIRY_WINDOW_DAYS = 30


def format_expiry_message(items: list[dict]) -> str | None:
    """Format an expiry-alert message. Returns None when there is nothing to report."""
    if not items:
        return None
    lines = ["💊 *Скоро истекает срок годности*", "---"]
    for it in items:
        lines.append(f"• {it['name']} — до {it['expiry_date']}, "
                     f"остаток {it['quantity_remaining']} {it['unit']}")
    return "\n".join(lines)


async def get_expiring_stock(session: AsyncSession) -> list[dict]:
    """Stock expiring within EXPIRY_WINDOW_DAYS with remaining > 0 (joined to medicine name)."""
    cutoff = now_local().date() + timedelta(days=EXPIRY_WINDOW_DAYS)
    rows = await session.execute(text("""
        SELECT m.name AS name, s.expiry_date AS expiry_date,
               s.quantity_remaining AS quantity_remaining, s.unit AS unit
        FROM t_f_medicine_stock s
        JOIN t_d_medicine m ON m.id = s.medicine_id
        WHERE s.deleted_at IS NULL
          AND s.quantity_remaining > 0
          AND s.expiry_date <= :cutoff
        ORDER BY s.expiry_date ASC
    """), {"cutoff": cutoff})
    return [dict(r._mapping) for r in rows]


async def send_expiry_alerts(session: AsyncSession, settings) -> int:
    """Broadcast expiry alert to all active users via Telegram + Web Push. Returns Telegram count."""
    items = await get_expiring_stock(session)
    message = format_expiry_message(items)
    if not message:
        return 0
    svc = NotificationService(settings)
    users = await svc.get_active_users(session)
    sent = 0
    # Telegram
    for u in users:
        if u.telegram_id and u.enable_telegram_notifications:
            if await svc.send_telegram_message(telegram_id=u.telegram_id, message=message):
                sent += 1
    # Web Push (spec decision #5: tag="medicine-expiry", data.type="medicine_expiry", url="/medicines").
    # Phase 1 deferred web push; now complete via MedicineReminderService._send_web_push_expiry
    # which sets the correct tag (PushService hardcodes "budget-notification").
    from backend.app.services.medicine_reminder_service import MedicineReminderService
    push_svc = MedicineReminderService(settings)
    push_title = "💊 Скоро истекает срок годности"
    push_body = f"{len(items)} позиций в аптечке требуют внимания."
    for u in users:
        if u.enable_push_notifications:
            await push_svc._send_web_push_expiry(session, u.id, push_title, push_body)
    logger.info("[MEDICINE] Expiry alert: %s pushes sent (%s items)", sent, len(items))
    return sent
