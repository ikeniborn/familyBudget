"""Verify t_medicine_reminder + UNIQUE(intake_log_id, recipient_user_id)."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_reminder_table_exists(db_session):
    rows = await db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
    assert "t_medicine_reminder" in {r[0] for r in rows}


@pytest.mark.asyncio
async def test_reminder_unique_recipient_per_intake(db_session):
    # minimal chain: medicine→member→course→intake
    await db_session.execute(text(
        "INSERT INTO t_d_medicine (id,name,form,prescription_required,is_active,creator_id) "
        "VALUES (9101,'X','tablet',false,true,1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_d_family_member (id,guardian_user_id,name) VALUES (9101,1,'T') ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_course (id,medicine_id,patient_id,dose_amount,dose_unit,intake_times,"
        "start_date,schedule_type,is_active,reminders_enabled,notification_channels,snooze_minutes,creator_id) "
        "VALUES (9101,9101,9101,1,'шт','[\"08:00\"]'::jsonb,'2026-06-15','daily',true,true,"
        "'[\"telegram\"]'::jsonb,30,1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_intake_log (id,course_id,patient_id,scheduled_at,status,version) "
        "VALUES (9101,9101,9101,'2026-06-16 08:00:00','scheduled',1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_medicine_reminder (intake_log_id,recipient_user_id,reminder_datetime,status) "
        "VALUES (9101,1,'2026-06-16 08:00:00','pending')"))
    with pytest.raises(Exception):
        await db_session.execute(text(
            "INSERT INTO t_medicine_reminder (intake_log_id,recipient_user_id,reminder_datetime,status) "
            "VALUES (9101,1,'2026-06-16 08:00:00','pending')"))
