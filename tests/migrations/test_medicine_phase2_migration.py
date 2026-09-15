"""Verify Phase 2 medicine tables + UNIQUE(course_id, scheduled_at)."""
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


@pytest.mark.asyncio
async def test_phase2_tables_exist(db_session):
    rows = await db_session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    ))
    names = {r[0] for r in rows}
    assert {"t_f_medicine_course", "t_f_medicine_intake_log"} <= names


@pytest.mark.asyncio
async def test_intake_log_unique_course_scheduled(db_session):
    # Seed a user (required by FKs in medicine/family_member tables)
    await db_session.execute(text(
        "INSERT INTO t_d_user (id, telegram_id, is_admin, is_active, "
        "two_factor_enabled, enable_push_notifications, enable_telegram_notifications, "
        "created_at, updated_at) "
        "VALUES (1, 100000001, false, true, false, true, true, NOW(), NOW()) "
        "ON CONFLICT DO NOTHING"
    ))
    # Seed a user, member, medicine, course
    await db_session.execute(text(
        "INSERT INTO t_d_medicine (id, name, form, prescription_required, is_active, creator_id) "
        "VALUES (9001, 'X', 'tablet', false, true, 1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_d_family_member (id, guardian_user_id, name) "
        "VALUES (9001, 1, 'Test') ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_course (id, medicine_id, patient_id, dose_amount, dose_unit, "
        "intake_times, start_date, schedule_type, is_active, reminders_enabled, "
        "notification_channels, snooze_minutes, creator_id) "
        "VALUES (9001, 9001, 9001, 1, 'шт', '[\"08:00\"]'::jsonb, '2026-06-15', 'daily', true, true, "
        "'[\"telegram\"]'::jsonb, 30, 1) ON CONFLICT DO NOTHING"))
    await db_session.execute(text(
        "INSERT INTO t_f_medicine_intake_log (course_id, patient_id, scheduled_at, status, version) "
        "VALUES (9001, 9001, '2026-06-16 08:00:00', 'scheduled', 1)"))
    with pytest.raises(IntegrityError):  # UNIQUE(course_id, scheduled_at)
        await db_session.execute(text(
            "INSERT INTO t_f_medicine_intake_log (course_id, patient_id, scheduled_at, status, version) "
            "VALUES (9001, 9001, '2026-06-16 08:00:00', 'scheduled', 1)"))
