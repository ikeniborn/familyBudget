"""Medicine catalog service: CRUD + SCD2 history append + delete-guard."""
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine import Medicine
from backend.app.models.medicine_history import FAR_FUTURE_DATETIME, MedicineHistory
from backend.app.models.medicine_stock import MedicineStock
from backend.app.utils.timezone import now_local

_HISTORY_FIELDS = ("name", "inn", "form", "dosage", "prescription_required", "notes", "is_active")


def _now() -> datetime:
    return now_local().replace(tzinfo=None)


async def _append_history(
    session: AsyncSession, medicine: Medicine, change_type: str,
    changed_fields: list[str] | None, user_id: int,
) -> None:
    """Close the current history row (if any) and insert a new current snapshot.

    SCD2 temporal columns (valid_from/valid_to) are tz-aware; we write naive-UTC
    (datetime.utcnow) like store_service/product_group_service — NOT the module-local
    _now() (which is SYSTEM_TIMEZONE wall-clock and would store the wrong instant).
    """
    now = datetime.utcnow()
    prev = await session.execute(
        select(MedicineHistory).where(
            MedicineHistory.medicine_id == medicine.id,
            MedicineHistory.is_current == True,  # noqa: E712
        )
    )
    for row in prev.scalars().all():
        row.is_current = False
        row.valid_to = now
        session.add(row)

    session.add(MedicineHistory(
        medicine_id=medicine.id, creator_id=medicine.creator_id,
        name=medicine.name, inn=medicine.inn, form=medicine.form, dosage=medicine.dosage,
        prescription_required=medicine.prescription_required, notes=medicine.notes,
        is_active=medicine.is_active,
        valid_from=now, valid_to=FAR_FUTURE_DATETIME, is_current=True,
        change_type=change_type, changed_fields=changed_fields, changed_by_user_id=user_id,
    ))


async def list_medicines(session: AsyncSession, *, active_only: bool, limit: int, offset: int,
                         search: str | None = None) -> tuple[list[Medicine], int]:
    stmt = select(Medicine)
    count_stmt = select(func.count()).select_from(Medicine)
    if active_only:
        stmt = stmt.where(Medicine.is_active == True)  # noqa: E712
        count_stmt = count_stmt.where(Medicine.is_active == True)  # noqa: E712
    if search:
        like = f"%{search}%"
        stmt = stmt.where(Medicine.name.ilike(like))
        count_stmt = count_stmt.where(Medicine.name.ilike(like))
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Medicine.name.asc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_medicine(session: AsyncSession, medicine_id: int) -> Medicine | None:
    return (await session.execute(
        select(Medicine).where(Medicine.id == medicine_id)
    )).scalar_one_or_none()


async def create_medicine(session: AsyncSession, data: dict, user_id: int) -> Medicine:
    medicine = Medicine(creator_id=user_id, **data)
    session.add(medicine)
    await session.flush()  # assign id before history
    await _append_history(session, medicine, "CREATE", None, user_id)
    await session.commit()
    await session.refresh(medicine)
    return medicine


async def update_medicine(session: AsyncSession, medicine: Medicine, data: dict, user_id: int) -> Medicine:
    changed = [k for k in _HISTORY_FIELDS if k in data and getattr(medicine, k) != data[k]]
    for k, v in data.items():
        setattr(medicine, k, v)
    medicine.updated_at = _now()
    session.add(medicine)
    if changed:
        if "is_active" in changed:
            change_type = "ARCHIVE" if not medicine.is_active else "RESTORE"
        else:
            change_type = "UPDATE"
        await _append_history(session, medicine, change_type, changed, user_id)
    await session.commit()
    await session.refresh(medicine)
    return medicine


async def has_active_links(session: AsyncSession, medicine_id: int) -> bool:
    """True if any non-deleted stock references this medicine (blocks hard delete)."""
    stock = (await session.execute(
        select(func.count()).select_from(MedicineStock).where(
            MedicineStock.medicine_id == medicine_id,
            MedicineStock.deleted_at.is_(None),
        )
    )).scalar_one()
    return stock > 0


async def archive_medicine(session: AsyncSession, medicine: Medicine, user_id: int) -> Medicine:
    """Soft-archive (is_active=False)."""
    return await update_medicine(session, medicine, {"is_active": False}, user_id)
