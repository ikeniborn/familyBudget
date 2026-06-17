"""Medicine course service: CRUD + pause/complete + remaining-stock estimate (decision #6/#7)."""
from datetime import timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_stock import MedicineStock
from backend.app.services.medicine_schedule import estimate_stock
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_courses(session: AsyncSession, *, active_only: bool, patient_id: int | None,
                       limit: int, offset: int) -> tuple[list[MedicineCourse], int]:
    stmt = select(MedicineCourse).where(MedicineCourse.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(MedicineCourse).where(MedicineCourse.deleted_at.is_(None))
    if active_only:
        stmt = stmt.where(MedicineCourse.is_active == True)  # noqa: E712
        count_stmt = count_stmt.where(MedicineCourse.is_active == True)  # noqa: E712
    if patient_id is not None:
        stmt = stmt.where(MedicineCourse.patient_id == patient_id)
        count_stmt = count_stmt.where(MedicineCourse.patient_id == patient_id)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(MedicineCourse.created_at.desc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_course(session: AsyncSession, course_id: int) -> MedicineCourse | None:
    return (await session.execute(
        select(MedicineCourse).where(
            MedicineCourse.id == course_id, MedicineCourse.deleted_at.is_(None))
    )).scalar_one_or_none()


async def create_course(session: AsyncSession, data: dict, user_id: int) -> MedicineCourse:
    data = dict(data)
    duration = data.pop("duration_days", None)
    if data.get("end_date") is None and duration:
        data["end_date"] = data["start_date"] + timedelta(days=duration - 1)
    course = MedicineCourse(creator_id=user_id, **data)
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def update_course(session: AsyncSession, course: MedicineCourse, data: dict) -> MedicineCourse:
    for k, v in data.items():
        if v is not None:
            setattr(course, k, v)
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def pause_course(session: AsyncSession, course: MedicineCourse) -> MedicineCourse:
    course.is_active = False
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def complete_course(session: AsyncSession, course: MedicineCourse) -> MedicineCourse:
    """Mark finished: deactivate + soft-delete (decision: completed courses are soft-deleted)."""
    course.is_active = False
    course.deleted_at = _now()
    course.updated_at = _now()
    session.add(course)
    await session.commit()
    await session.refresh(course)
    return course


async def aggregate_remaining(session: AsyncSession, medicine_id: int) -> Decimal:
    """Σ stock.quantity_remaining for the medicine across active packages."""
    total = (await session.execute(
        select(func.coalesce(func.sum(MedicineStock.quantity_remaining), 0)).where(
            MedicineStock.medicine_id == medicine_id,
            MedicineStock.deleted_at.is_(None),
            MedicineStock.quantity_remaining > 0,
        )
    )).scalar_one()
    return Decimal(str(total))


async def course_estimate(session: AsyncSession, course: MedicineCourse) -> dict:
    remaining = await aggregate_remaining(session, course.medicine_id)
    return estimate_stock(
        remaining=remaining, dose_amount=course.dose_amount,
        intake_times=course.intake_times, schedule_type=course.schedule_type,
        schedule_config=course.schedule_config)
