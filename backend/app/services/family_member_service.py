"""Family member service: CRUD + delete-guard (block while active courses exist)."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.family_member import FamilyMember
from backend.app.models.medicine_course import MedicineCourse
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_family_members(session: AsyncSession, *, active_only: bool = True) -> tuple[list[FamilyMember], int]:
    stmt = select(FamilyMember)
    if active_only:
        stmt = stmt.where(FamilyMember.is_active == True)  # noqa: E712
    rows = (await session.execute(stmt.order_by(FamilyMember.name.asc()))).scalars().all()
    return list(rows), len(rows)


async def get_family_member(session: AsyncSession, member_id: int) -> FamilyMember | None:
    return (await session.execute(
        select(FamilyMember).where(FamilyMember.id == member_id)
    )).scalar_one_or_none()


async def create_family_member(session: AsyncSession, data: dict, default_guardian_id: int) -> FamilyMember:
    data = dict(data)
    if not data.get("guardian_user_id"):
        data["guardian_user_id"] = default_guardian_id
    member = FamilyMember(**data)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def update_family_member(session: AsyncSession, member: FamilyMember, data: dict) -> FamilyMember:
    for k, v in data.items():
        if v is not None:
            setattr(member, k, v)
    member.updated_at = _now()
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member


async def has_active_links(session: AsyncSession, member_id: int) -> bool:
    """True if the member has any non-deleted course (blocks delete)."""
    courses = (await session.execute(
        select(func.count()).select_from(MedicineCourse).where(
            MedicineCourse.patient_id == member_id,
            MedicineCourse.deleted_at.is_(None),
        )
    )).scalar_one()
    return courses > 0


async def archive_family_member(session: AsyncSession, member: FamilyMember) -> FamilyMember:
    """Soft-archive (is_active=False) — mirrors Medicine. No hard delete (spec decision)."""
    member.is_active = False
    member.updated_at = _now()
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return member
