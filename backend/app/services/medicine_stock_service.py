"""Medicine stock service: CRUD with soft-delete + version; expiring/low-stock queries."""
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import func, select

from backend.app.models.medicine_stock import MedicineStock
from backend.app.utils.timezone import now_local


def _now():
    return now_local().replace(tzinfo=None)


async def list_stock(session: AsyncSession, *, limit: int, offset: int,
                     expiring_in_days: int | None = None,
                     medicine_id: int | None = None) -> tuple[list[MedicineStock], int]:
    stmt = select(MedicineStock).where(MedicineStock.deleted_at.is_(None))
    count_stmt = select(func.count()).select_from(MedicineStock).where(MedicineStock.deleted_at.is_(None))
    if medicine_id is not None:
        stmt = stmt.where(MedicineStock.medicine_id == medicine_id)
        count_stmt = count_stmt.where(MedicineStock.medicine_id == medicine_id)
    if expiring_in_days is not None:
        cutoff = _now().date() + timedelta(days=expiring_in_days)
        stmt = stmt.where(MedicineStock.expiry_date <= cutoff)
        count_stmt = count_stmt.where(MedicineStock.expiry_date <= cutoff)
    total = (await session.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(MedicineStock.expiry_date.asc()).limit(limit).offset(offset)
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), total


async def get_stock(session: AsyncSession, stock_id: int) -> MedicineStock | None:
    return (await session.execute(
        select(MedicineStock).where(
            MedicineStock.id == stock_id, MedicineStock.deleted_at.is_(None)
        )
    )).scalar_one_or_none()


async def create_stock(session: AsyncSession, data: dict, user_id: int) -> MedicineStock:
    stock = MedicineStock(creator_id=user_id, **data)
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock


async def update_stock(session: AsyncSession, stock: MedicineStock, data: dict, user_id: int) -> MedicineStock:
    for k, v in data.items():
        if v is not None:
            setattr(stock, k, v)
    stock.version += 1
    stock.last_modified_by = user_id
    stock.updated_at = _now()
    session.add(stock)
    await session.commit()
    await session.refresh(stock)
    return stock


async def soft_delete_stock(session: AsyncSession, stock: MedicineStock, user_id: int) -> None:
    stock.deleted_at = _now()
    stock.version += 1
    stock.last_modified_by = user_id
    stock.updated_at = _now()
    session.add(stock)
    await session.commit()
