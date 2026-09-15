"""Integration tests for Phase 3: reminder fan-out, due query, snooze."""
import pytest
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


async def _reminder_counts(db_session, cid):
    """Return {status: count} over all reminders of the course's intakes."""
    rows = (await db_session.execute(text("""
        SELECT r.status, COUNT(*) FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid GROUP BY r.status
    """), {"cid": cid})).all()
    return dict(rows)


@pytest.mark.asyncio
async def test_pause_cancels_pending_reminders(authenticated_client, db_session):
    """Slice M2: pausing a course cancels its pending reminders so they stop firing."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    assert (await _reminder_counts(db_session, cid)).get("pending", 0) >= 1

    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/pause")
    assert r.status_code == 200, r.text

    counts = await _reminder_counts(db_session, cid)
    assert counts.get("pending", 0) == 0
    assert counts.get("cancelled", 0) >= 1


@pytest.mark.asyncio
async def test_complete_cancels_pending_reminders(authenticated_client, db_session):
    """Slice M2: completing (soft-deleting) a course cancels its pending reminders."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/complete")
    assert r.status_code == 200, r.text
    counts = await _reminder_counts(db_session, cid)
    assert counts.get("pending", 0) == 0
    assert counts.get("cancelled", 0) >= 1


@pytest.mark.asyncio
async def test_resume_rearms_future_reminders(authenticated_client, db_session):
    """Slice M2: resume re-arms cancelled reminders for future doses (past ones stay
    cancelled — no burst of stale pushes)."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/pause")
    assert r.status_code == 200, r.text
    assert (await _reminder_counts(db_session, cid)).get("pending", 0) == 0

    r = await authenticated_client.post(f"/api/v1/medicine-courses/{cid}/resume")
    assert r.status_code == 200, r.text

    future_pending = (await db_session.execute(text("""
        SELECT COUNT(*) FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid AND r.status = 'pending' AND r.reminder_datetime >= NOW()
    """), {"cid": cid})).scalar_one()
    assert future_pending >= 1
    past_pending = (await db_session.execute(text("""
        SELECT COUNT(*) FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid AND r.status = 'pending' AND r.reminder_datetime < NOW()
    """), {"cid": cid})).scalar_one()
    assert past_pending == 0


@pytest.mark.asyncio
async def test_skip_and_take_cancel_intake_reminders(authenticated_client, db_session):
    """Slice M2: marking a dose skipped or taken cancels that dose's pending reminders."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    r = await authenticated_client.get(f"/api/v1/medicine-intakes?course_id={cid}")
    assert r.status_code == 200, r.text
    intakes = [i for i in r.json()["intakes"] if i["status"] == "scheduled"]
    assert len(intakes) >= 2, "need at least two scheduled doses for this test"

    async def pending_for(iid):
        return (await db_session.execute(text(
            "SELECT COUNT(*) FROM t_medicine_reminder WHERE intake_log_id=:iid AND status='pending'"
        ), {"iid": iid})).scalar_one()

    skip_target, take_target = intakes[0], intakes[1]
    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{skip_target['id']}/skip",
                                        json={"version": skip_target["version"]})
    assert r.status_code == 200, r.text
    assert await pending_for(skip_target["id"]) == 0

    r = await authenticated_client.post(f"/api/v1/medicine-intakes/{take_target['id']}/take",
                                        json={"version": take_target["version"]})
    assert r.status_code == 200, r.text
    assert await pending_for(take_target["id"]) == 0


@pytest.mark.asyncio
async def test_send_skips_non_pending_reminder(authenticated_client, db_session):
    """Slice M2: dispatch is defensive — a reminder cancelled between get_due and send
    is not delivered and keeps its status."""
    cid, _pid = await _course_with_reminders(authenticated_client)
    rid = (await db_session.execute(text("""
        SELECT r.id FROM t_medicine_reminder r
        JOIN t_f_medicine_intake_log l ON l.id = r.intake_log_id
        WHERE l.course_id = :cid LIMIT 1
    """), {"cid": cid})).scalar_one()
    await db_session.execute(text(
        "UPDATE t_medicine_reminder SET status='cancelled' WHERE id=:rid"), {"rid": rid})
    await db_session.flush()

    from backend.app.models.medicine_reminder import MedicineReminder
    reminder = await db_session.get(MedicineReminder, rid)
    svc = MedicineReminderService()
    telegram_sent, web_push_sent = await svc.send(db_session, reminder)
    assert (telegram_sent, web_push_sent) == (False, False)
    row = (await db_session.execute(text(
        "SELECT status, retry_count, error_message FROM t_medicine_reminder WHERE id=:rid"
    ), {"rid": rid})).one()
    # Untouched: no status flip, no retry accounting — send() must return before channels.
    assert row.status == "cancelled"
    assert row.retry_count == 0
    assert row.error_message is None


@pytest.mark.asyncio
async def test_mark_overdue_late(authenticated_client, db_session):
    """scheduled → late once scheduled_at is more than 24h in the past."""
    from backend.app.services import medicine_intake_service as svc

    cid, _pid = await _course_with_reminders(authenticated_client)  # start_date 2026-06-15, all past
    updated = await svc.mark_overdue_late(db_session)
    assert updated >= 1
    stale = (await db_session.execute(text("""
        SELECT COUNT(*) FROM t_f_medicine_intake_log
        WHERE course_id=:cid AND status='scheduled'
          AND scheduled_at < NOW() - INTERVAL '24 hours'
    """), {"cid": cid})).scalar_one()
    assert stale == 0


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
    # Compare in SYSTEM_TIMEZONE (what the service writes), not the machine's local clock.
    from backend.app.utils.timezone import now_local
    assert future_dt > now_local().replace(tzinfo=None)  # snooze scheduled it forward
