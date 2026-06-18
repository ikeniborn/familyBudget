"""Intake service: generate intake_log + reminders, list, take/skip (status only this phase)."""
from datetime import date, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.services.medicine_reminder_service import MedicineReminderService
from backend.app.services.medicine_schedule import expand_schedule
from backend.app.utils.timezone import now_local

GENERATION_HORIZON_DAYS = 7


class IntakeVersionConflict(Exception):
    """Raised when take/skip is attempted with a stale version (→ HTTP 409)."""


def _now():
    return now_local().replace(tzinfo=None)


async def generate_for_course(session: AsyncSession, course: MedicineCourse,
                              window_start: date, window_end: date) -> int:
    """Insert intake_log rows for [window_start, window_end] + fan-out reminders.

    Idempotent: UNIQUE(course_id, scheduled_at) skips existing logs via SAVEPOINT rollback;
    UNIQUE(intake_log_id, recipient_user_id) skips existing reminders.
    Returns the number of new rows created.
    """
    slots = expand_schedule(
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config, start_date=course.start_date,
        end_date=course.end_date, window_start=window_start, window_end=window_end)
    if not slots:
        return 0
    patient = await session.get(FamilyMember, course.patient_id)
    reminder_svc = MedicineReminderService()
    created = 0
    for slot in slots:
        log = MedicineIntakeLog(course_id=course.id, patient_id=course.patient_id, scheduled_at=slot)
        try:
            async with session.begin_nested():  # SAVEPOINT: a dup rolls back only this row, not the batch
                session.add(log)
        except IntegrityError:
            continue  # row already exists → skip (and its reminders too)
        created += 1
        if patient:
            await reminder_svc.create_reminders_for_intake(session, log, course, patient)
    await session.commit()
    return created


async def generate_all(session: AsyncSession, *, horizon_days: int = GENERATION_HORIZON_DAYS) -> int:
    """Generate intake_log `horizon_days` ahead for every active, non-deleted course."""
    today = _now().date()
    window_end = today + timedelta(days=horizon_days)
    courses = (await session.execute(
        select(MedicineCourse).where(
            MedicineCourse.is_active == True,  # noqa: E712
            MedicineCourse.deleted_at.is_(None))
    )).scalars().all()
    total = 0
    for course in courses:
        total += await generate_for_course(session, course, today, window_end)
    return total


async def mark_overdue_late(session: AsyncSession) -> int:
    """scheduled → late when scheduled_at < now - 24h. Returns rows updated."""
    cutoff = _now() - timedelta(hours=24)
    result = await session.execute(text("""
        UPDATE t_f_medicine_intake_log
        SET status='late', updated_at=:now
        WHERE status='scheduled' AND scheduled_at < :cutoff
    """), {"cutoff": cutoff, "now": _now()})
    await session.commit()
    return result.rowcount or 0


async def list_intakes(session: AsyncSession, *, on_date: date | None, patient_id: int | None,
                       course_id: int | None = None):
    """Return intake rows joined to medicine + member names for dashboard / course-journal rendering."""
    clauses = ["1=1"]
    params: dict = {}
    if on_date is not None:
        clauses.append("l.scheduled_at >= :day_start AND l.scheduled_at < :day_end")
        params["day_start"] = datetime(on_date.year, on_date.month, on_date.day)
        params["day_end"] = datetime(on_date.year, on_date.month, on_date.day) + timedelta(days=1)
    if patient_id is not None:
        clauses.append("l.patient_id = :pid")
        params["pid"] = patient_id
    if course_id is not None:
        clauses.append("l.course_id = :cid")
        params["cid"] = course_id
    where = " AND ".join(clauses)
    rows = await session.execute(text(f"""
        SELECT l.id, l.course_id, l.patient_id, l.scheduled_at, l.taken_at, l.status,
               l.dose_taken, l.stock_id, l.comment, l.marked_by, l.version,
               m.name AS medicine_name, fm.name AS patient_name,
               c.dose_amount, c.dose_unit, c.with_food
        FROM t_f_medicine_intake_log l
        JOIN t_f_medicine_course c ON c.id = l.course_id
        JOIN t_d_medicine m ON m.id = c.medicine_id
        JOIN t_d_family_member fm ON fm.id = l.patient_id
        WHERE {where}
        ORDER BY l.scheduled_at ASC
    """), params)
    return [dict(r._mapping) for r in rows]


async def get_intake(session: AsyncSession, intake_id: int) -> MedicineIntakeLog | None:
    return (await session.execute(
        select(MedicineIntakeLog).where(MedicineIntakeLog.id == intake_id)
    )).scalar_one_or_none()


async def mark_intake(session: AsyncSession, intake: MedicineIntakeLog, *, status: str,
                      expected_version: int, user_id: int,
                      dose_taken=None, comment: str | None = None) -> MedicineIntakeLog:
    """Set status to 'taken' or 'skipped' with optimistic locking. Raises IntakeVersionConflict on mismatch.

    Phase 2 marks status only; Phase 4 adds stock deduction inside the 'taken' branch.
    """
    if intake.version != expected_version:
        raise IntakeVersionConflict()
    intake.status = status
    intake.marked_by = user_id
    intake.version += 1
    intake.updated_at = _now()
    if status == "taken":
        intake.taken_at = _now()
        if dose_taken is not None:
            intake.dose_taken = dose_taken
    if comment is not None:
        intake.comment = comment
    session.add(intake)
    await session.commit()
    await session.refresh(intake)
    return intake
