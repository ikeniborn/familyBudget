"""Verify Phase 1 medicine tables exist after migrations are applied."""
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_phase1_tables_exist(session):
    rows = await session.execute(text(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    ))
    names = {r[0] for r in rows}
    assert {"t_d_medicine", "t_d_medicine_history",
            "t_d_family_member", "t_f_medicine_stock"} <= names


@pytest.mark.asyncio
async def test_stock_expiry_index_and_form_check(session):
    # expiry_date index present
    idx = await session.execute(text(
        "SELECT indexname FROM pg_indexes WHERE tablename='t_f_medicine_stock'"
    ))
    assert any("expiry" in r[0] for r in idx)
    # form CHECK rejects bad value
    with pytest.raises(Exception):
        await session.execute(text(
            "INSERT INTO t_d_medicine (name, form, prescription_required, is_active, creator_id) "
            "VALUES ('x', 'NOT_A_FORM', false, true, 1)"
        ))
