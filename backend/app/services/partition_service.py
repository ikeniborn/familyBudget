"""
Partition management for t_f_budget_fact.

The fact table is partitioned by month. Partitions are created on demand by
the SQL function ensure_budget_fact_partition(date), which only allows
creation inside a bounded window (2020-01-01 .. current month + 6 months).

Keeping the partition set small is a hard requirement: pre-creating hundreds
of partitions (372 at peak) multiplied by per-partition indexes bloated every
PostgreSQL backend's relation cache to ~90MB and exhausted server RAM.

Usage:
    - Call ensure_partitions_for_dates() before inserting BudgetFact rows
      (or moving them across months via fact_date update).
    - ensure_partition_runway() is invoked by the scheduler to pre-create
      partitions for the upcoming months so the insert path almost never
      has to run DDL.
"""

from collections.abc import Iterable
from datetime import date

from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

# How many months ahead partitions are pre-created (and how far ahead the
# SQL function allows auto-creation).
PARTITION_RUNWAY_MONTHS = 6


async def ensure_partitions_for_dates(
    session: AsyncSession, dates: Iterable[date | None]
) -> None:
    """
    Ensure monthly partitions exist for every month covered by the dates.

    No-op for months whose partition already exists. Raises a database
    check_violation error for dates outside the allowed creation window.
    """
    months = {d.replace(day=1) for d in dates if d is not None}
    for month in sorted(months):
        await session.execute(
            text("SELECT ensure_budget_fact_partition(:target)"),
            {"target": month},
        )


async def ensure_partition_runway(
    session: AsyncSession, months_ahead: int = PARTITION_RUNWAY_MONTHS
) -> None:
    """Pre-create partitions from the current month through months_ahead."""
    first = date.today().replace(day=1)
    months = []
    for offset in range(months_ahead + 1):
        month_index = first.month - 1 + offset
        months.append(
            date(first.year + month_index // 12, month_index % 12 + 1, 1)
        )
    await ensure_partitions_for_dates(session, months)
