"""Slice M6: reminder send() channel gating, message content, retry accounting;
expiry alerts end-to-end with mocked transports."""
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from backend.app.core.config import get_settings
from backend.app.services.medicine_reminder_service import MedicineReminderService


async def _course_with_backdated_reminder(client, db_session, channels):
    r = await client.post("/api/v1/medicines", json={"name": "Отпр", "form": "tablet"})
    assert r.status_code == 201, r.text
    mid = r.json()["id"]
    r = await client.post("/api/v1/family-members", json={"name": "Гриша"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r = await client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid, "patient_id": pid, "dose_amount": "2", "dose_unit": "мл",
        "intake_times": ["08:30"], "start_date": "2026-06-15", "schedule_type": "daily",
        "reminders_enabled": True, "notification_channels": channels})
    assert r.status_code == 201, r.text
    cid = r.json()["id"]
    rid = (await db_session.execute(text("""
        SELECT r.id FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid AND r.status = 'pending' LIMIT 1
    """), {"cid": cid})).scalar_one()
    return cid, rid


async def _get_reminder(db_session, rid):
    from backend.app.models.medicine_reminder import MedicineReminder
    return await db_session.get(MedicineReminder, rid)


@pytest.mark.asyncio
async def test_send_telegram_only_course_skips_web_push(authenticated_client, db_session, monkeypatch):
    """Channels gate delivery: a telegram-only course must never attempt Web Push,
    and the message carries medicine name, time and dose."""
    _cid, rid = await _course_with_backdated_reminder(
        authenticated_client, db_session, ["telegram"])

    sent_messages = []

    async def fake_telegram(self, telegram_id, message, log_id, snooze_minutes):
        sent_messages.append(message)
        return True

    async def fail_web_push(self, *a, **kw):
        raise AssertionError("web_push must not be attempted for a telegram-only course")

    monkeypatch.setattr(MedicineReminderService, "_send_telegram", fake_telegram)
    monkeypatch.setattr(MedicineReminderService, "send_web_push", fail_web_push)
    # Recipient must look telegram-capable regardless of the test user's real state.
    await db_session.execute(text(
        "UPDATE t_d_user SET telegram_id = 111 WHERE telegram_id IS NULL"))
    await db_session.flush()

    svc = MedicineReminderService()
    reminder = await _get_reminder(db_session, rid)
    tg, wp = await svc.send(db_session, reminder)

    assert (tg, wp) == (True, False)
    assert reminder.status == "sent"
    msg = sent_messages[0]
    assert "Отпр" in msg and "08:30" in msg and "мл" in msg


@pytest.mark.asyncio
async def test_send_retry_accounting_to_failed(authenticated_client, db_session, monkeypatch):
    """All channels failing increments retry_count; the third failure marks the reminder failed."""
    _cid, rid = await _course_with_backdated_reminder(
        authenticated_client, db_session, ["telegram"])

    async def failing_telegram(self, *a, **kw):
        return False

    monkeypatch.setattr(MedicineReminderService, "_send_telegram", failing_telegram)
    await db_session.execute(text(
        "UPDATE t_d_user SET telegram_id = 111 WHERE telegram_id IS NULL"))
    await db_session.flush()

    svc = MedicineReminderService()
    reminder = await _get_reminder(db_session, rid)

    for expected_retry in (1, 2):
        assert await svc.send(db_session, reminder) == (False, False)
        assert reminder.retry_count == expected_retry
        assert reminder.status == "pending"

    assert await svc.send(db_session, reminder) == (False, False)
    assert reminder.retry_count == 3
    assert reminder.status == "failed"


@pytest.mark.asyncio
async def test_send_expiry_alerts_end_to_end(authenticated_client, db_session, monkeypatch):
    """Expiring stock produces one broadcast per telegram-enabled active user with
    the item count in the message."""
    r = await authenticated_client.post("/api/v1/medicines", json={"name": "Истекает", "form": "tablet"})
    assert r.status_code == 201, r.text
    from datetime import date, timedelta
    soon = (date.today() + timedelta(days=10)).isoformat()
    r = await authenticated_client.post("/api/v1/medicine-stock", json={
        "medicine_id": r.json()["id"], "quantity_remaining": "3", "quantity_initial": "3",
        "unit": "шт", "expiry_date": soon})
    assert r.status_code == 201, r.text

    from backend.app.services import medicine_alert_service
    from backend.app.services.notification_service import NotificationService

    recipients = [SimpleNamespace(id=1, telegram_id=111, enable_telegram_notifications=True,
                                  enable_push_notifications=False)]
    telegram_messages = []

    async def fake_get_active_users(self, session):
        return recipients

    async def fake_send_telegram(self, *, telegram_id, message):
        telegram_messages.append((telegram_id, message))
        return True

    monkeypatch.setattr(NotificationService, "get_active_users", fake_get_active_users)
    monkeypatch.setattr(NotificationService, "send_telegram_message", fake_send_telegram)

    sent = await medicine_alert_service.send_expiry_alerts(db_session, get_settings())

    assert sent == 1
    tid, msg = telegram_messages[0]
    assert tid == 111
    assert "Истекает" in msg
