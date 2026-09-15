"""
Tests for partition_service: on-demand t_f_budget_fact partition creation.

The SQL function ensure_budget_fact_partition() only creates partitions
inside [2020-01-01 .. current month + 6 months] (revision b7f4a2c9d1e3).
"""
from datetime import date

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from backend.app.services.partition_service import (
    ensure_partition_runway,
    ensure_partitions_for_dates,
)


async def _partition_exists(session, name: str) -> bool:
    result = await session.execute(
        text(
            "SELECT 1 FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename = :name"
        ),
        {"name": name},
    )
    return result.scalar() is not None


async def _drop_partition(session, name: str) -> None:
    await session.execute(text(f'DROP TABLE IF EXISTS "{name}"'))
    await session.commit()


@pytest.mark.asyncio
async def test_ensure_creates_partition_inside_window(session):
    """A missing in-window partition is created with inherited indexes."""
    partition = "t_f_budget_fact_2021_05"
    await _drop_partition(session, partition)

    await ensure_partitions_for_dates(session, [date(2021, 5, 15)])
    await session.commit()

    assert await _partition_exists(session, partition)

    # Indexes must be inherited from the partitioned parent
    result = await session.execute(
        text("SELECT count(*) FROM pg_indexes WHERE tablename = :name"),
        {"name": partition},
    )
    assert result.scalar() > 0

    await _drop_partition(session, partition)


@pytest.mark.asyncio
async def test_ensure_noop_for_existing_partition(session):
    """Existing partitions are left untouched (guard applies to creation only)."""
    current_month = date.today().replace(day=1)
    # Runs twice without error
    await ensure_partitions_for_dates(session, [current_month])
    await ensure_partitions_for_dates(session, [current_month])


@pytest.mark.asyncio
async def test_ensure_rejects_date_before_window(session):
    with pytest.raises(DBAPIError, match="auto-creation window"):
        await ensure_partitions_for_dates(session, [date(2010, 1, 1)])
    await session.rollback()


@pytest.mark.asyncio
async def test_ensure_rejects_date_beyond_window(session):
    with pytest.raises(DBAPIError, match="auto-creation window"):
        await ensure_partitions_for_dates(session, [date(2040, 1, 1)])
    await session.rollback()


@pytest.mark.asyncio
async def test_partition_runway_covers_six_months_ahead(session):
    """Runway pre-creates current month through +6 months."""
    await ensure_partition_runway(session)
    await session.commit()

    first = date.today().replace(day=1)
    for offset in range(7):
        month_index = first.month - 1 + offset
        month = date(first.year + month_index // 12, month_index % 12 + 1, 1)
        name = f"t_f_budget_fact_{month.strftime('%Y_%m')}"
        assert await _partition_exists(session, name), name
