"""Atomic stock deduction for an intake: chosen package, else FIFO by expiry. SELECT ... FOR UPDATE."""
import logging
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.medicine_course import MedicineCourse
from backend.app.models.medicine_intake_log import MedicineIntakeLog
from backend.app.utils.timezone import now_local

logger = logging.getLogger(__name__)

DEDUCTED = "deducted"
OUT_OF_STOCK = "out_of_stock"


def _now():
    return now_local().replace(tzinfo=None)


async def deduct_for_intake(
    session: AsyncSession, intake: MedicineIntakeLog, course: MedicineCourse,
    dose: Decimal, preferred_stock_id: int | None,
) -> str:
    """Deduct `dose` from a package and set intake.stock_id. Returns DEDUCTED or OUT_OF_STOCK.

    Locks the chosen row FOR UPDATE so concurrent takes can't double-spend.
    Caller commits (this runs inside mark_intake's transaction).
    """
    if preferred_stock_id is not None:
        # medicine_id guard: a chosen package must belong to the course's medicine
        row = (await session.execute(text("""
            SELECT id, quantity_remaining FROM t_f_medicine_stock
            WHERE id = :sid AND medicine_id = :mid AND deleted_at IS NULL
            FOR UPDATE
        """), {"sid": preferred_stock_id, "mid": course.medicine_id})).first()
    else:
        row = (await session.execute(text("""
            SELECT id, quantity_remaining FROM t_f_medicine_stock
            WHERE medicine_id = :mid AND quantity_remaining > 0 AND deleted_at IS NULL
            ORDER BY expiry_date ASC
            LIMIT 1
            FOR UPDATE
        """), {"mid": course.medicine_id})).first()

    if not row or Decimal(str(row.quantity_remaining)) <= 0:
        return OUT_OF_STOCK

    remaining = Decimal(str(row.quantity_remaining))
    new_qty = remaining - dose
    if new_qty < 0:
        new_qty = Decimal("0")  # deduct what's available (partial package)
    await session.execute(text("""
        UPDATE t_f_medicine_stock SET quantity_remaining = :q, updated_at = :now WHERE id = :id
    """), {"q": new_qty, "now": _now(), "id": row.id})
    intake.stock_id = row.id
    logger.info("[MED_DEDUCT] intake=%s stock=%s %s→%s", intake.id, row.id, remaining, new_qty)
    return DEDUCTED
