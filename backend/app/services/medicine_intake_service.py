"""Intake service: generate intake_log + reminders-stub, list, take/skip (status only this phase)."""
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.services.medicine_schedule import expand_schedule
from backend.app.utils.timezone import now_local

GENERATION_HORIZON_DAYS = 7


class IntakeVersionConflict(Exception):
    """Raised when take/skip is attempted with a stale version (→ HTTP 409)."""


def _now():
    return now_local().replace(tzinfo=None)


async def generate_for_course(session: AsyncSession, course: MedicineCourse,
                              window_start: date, window_end: date) -> int:
    """Insert intake_log rows for [window_start, window_end]. Idempotent and concurrency-safe:
    pre-filters slots that already exist, and INSERT ... ON CONFLICT DO NOTHING on
    UNIQUE(course_id, scheduled_at) is the backstop against a race with another worker.
    Returns the number of new rows. No per-row rollback (a single rollback would discard the
    whole batch)."""
    slots = expand_schedule(
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config, start_date=course.start_date,
        end_date=course.end_date, window_start=window_start, window_end=window_end)
    if not slots:
        return 0
    existing = set((await session.execute(
        select(MedicineIntakeLog.scheduled_at).where(
            MedicineIntakeLog.course_id == course.id,
            MedicineIntakeLog.scheduled_at.in_(slots),
        )
    )).scalars().all())
    new_slots = [s for s in slots if s not in existing]
    if not new_slots:
        return 0
    now = _now()
    await session.execute(text("""
        INSERT INTO t_f_medicine_intake_log
            (course_id, patient_id, scheduled_at, status, version, created_at, updated_at)
        VALUES (:cid, :pid, :ts, 'scheduled', 1, :now, :now)
        ON CONFLICT (course_id, scheduled_at) DO NOTHING
    """), [{"cid": course.id, "pid": course.patient_id, "ts": s, "now": now} for s in new_slots])
    await session.commit()
    return len(new_slots)


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
        params["day_start"] = f"{on_date} 00:00:00"
        params["day_end"] = f"{on_date + timedelta(days=1)} 00:00:00"
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
