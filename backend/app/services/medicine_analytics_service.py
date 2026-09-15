"""Module-only purchase analytics over stock.purchase_price (NO budget integration — decision #1)."""
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def purchase_analytics(session: AsyncSession) -> dict:
    """Total spent + per-medicine breakdown from purchase_price (counts every package ever added)."""
    rows = await session.execute(text("""
        SELECT m.id AS medicine_id, m.name AS medicine_name,
               COALESCE(SUM(s.purchase_price), 0) AS total_spent,
               COUNT(*) AS package_count
        FROM t_f_medicine_stock s
        JOIN t_d_medicine m ON m.id = s.medicine_id
        WHERE s.purchase_price IS NOT NULL
        GROUP BY m.id, m.name
        ORDER BY total_spent DESC
    """))
    by_medicine = [dict(r._mapping) for r in rows]
    total = sum((Decimal(str(r["total_spent"])) for r in by_medicine), Decimal("0"))
    return {"total_spent": total, "by_medicine": by_medicine}
