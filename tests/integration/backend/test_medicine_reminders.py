"""Integration tests for Phase 3: reminder fan-out, due query, snooze."""
import pytest
from datetime import datetime
from sqlalchemy import text

from backend.app.services.medicine_reminder_service import MedicineReminderService


async def _course_with_reminders(client):
    """Seed medicine + family member, create a course with reminders enabled.

    Returns (course_id, patient_id).  Authentication is via cookie set on `client`
    (authenticated_client fixture) — no explicit headers needed.
    """
    r = await client.post("/api/v1/medicines", json={"name": "Рем", "form": "tablet"})
    assert r.status_code == 201, f"medicine create failed: {r.text}"
    mid = r.json()["id"]

    r = await client.post("/api/v1/family-members", json={"name": "Маша"})
    assert r.status_code == 201, f"family member create failed: {r.text}"
    pid = r.json()["id"]

    r = await client.post("/api/v1/medicine-courses", json={
        "medicine_id": mid,
        "patient_id": pid,
        "dose_amount": "1",
        "dose_unit": "шт",
        "intake_times": ["08:00"],
        "start_date": "2026-06-15",
        "schedule_type": "daily",
        "reminders_enabled": True,
        "notification_channels": ["telegram"],
    })
    assert r.status_code == 201, f"course create failed: {r.text}"
    return r.json()["id"], pid


@pytest.mark.asyncio
async def test_generation_creates_reminders(authenticated_client, db_session):
    """Course creation fan-outs at least one reminder row for the start-date intake."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    count = (await db_session.execute(text("""
        SELECT COUNT(*) FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid
    """), {"cid": cid})).scalar_one()
    assert count >= 1


@pytest.mark.asyncio
async def test_due_query_picks_past_pending(authenticated_client, db_session):
    """get_due returns reminders whose reminder_datetime is in the past and status=pending."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    # Back-date all reminders for this course so they are "due now"
    await db_session.execute(text("""
        UPDATE t_medicine_reminder
        SET reminder_datetime = '2000-01-01 00:00:00', status = 'pending'
        WHERE intake_log_id IN (
            SELECT id FROM t_f_medicine_intake_log WHERE course_id = :cid
        )
    """), {"cid": cid})
    await db_session.flush()

    svc = MedicineReminderService()
    due = await svc.get_due(db_session)
    assert len(due) >= 1


@pytest.mark.asyncio
async def test_snooze_creates_future_pending(authenticated_client, db_session):
    """POST /medicine-intakes/{id}/snooze re-schedules the reminder to a future pending state."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    intake_id = (await db_session.execute(text(
        "SELECT id FROM t_f_medicine_intake_log WHERE course_id = :cid ORDER BY scheduled_at LIMIT 1"
    ), {"cid": cid})).scalar_one()

    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{intake_id}/snooze")
    assert r.status_code == 200, f"snooze failed: {r.text}"

    pending = (await db_session.execute(text(
        "SELECT COUNT(*) FROM t_medicine_reminder WHERE intake_log_id = :iid AND status = 'pending'"
    ), {"iid": intake_id})).scalar_one()
    assert pending >= 1

    future_dt = (await db_session.execute(text(
        "SELECT reminder_datetime FROM t_medicine_reminder "
        "WHERE intake_log_id=:iid AND status='pending' ORDER BY reminder_datetime DESC LIMIT 1"
    ), {"iid": intake_id})).scalar_one()
    assert future_dt > datetime.now()  # snooze scheduled it forward
