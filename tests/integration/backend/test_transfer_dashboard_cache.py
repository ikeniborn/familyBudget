"""Transfer creation must make the committed pair visible to dashboard subscribers."""

from datetime import date
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import event
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.api.v1.endpoints import transfers
from backend.app.models.article import Article
from backend.app.models.financial_center import FinancialCenter
from backend.app.schemas.transfer import TransferCreate
from backend.app.services.cache_service import cache_service


@pytest.mark.asyncio
async def test_transfer_invalidates_dashboard_between_commit_and_broadcast(db_session, test_user, monkeypatch):
    calls = []
    debit = Article(user_id=test_user.id, name="Debit", type="debit")
    credit = Article(user_id=test_user.id, name="Credit", type="credit")
    source = FinancialCenter(user_id=test_user.id, name="Source")
    target = FinancialCenter(user_id=test_user.id, name="Target")
    db_session.add_all([debit, credit, source, target])
    await db_session.flush()
    transfer = TransferCreate(
        transfer_date=date.today(), amount=11,
        from_financial_center_id=source.id, from_article_id=debit.id,
        to_financial_center_id=target.id, to_article_id=credit.id,
    )
    monkeypatch.setattr(
        cache_service, "invalidate_dashboard", AsyncMock(side_effect=lambda: calls.append("invalidate"))
    )
    monkeypatch.setattr(
        transfers._get_budget_ws_broadcast(), "broadcast_transfer_created",
        AsyncMock(side_effect=lambda data: calls.append("broadcast")),
    )

    async with AsyncSession(bind=await db_session.connection(), expire_on_commit=False) as session:
        event.listen(session.sync_session, "after_commit", lambda _: calls.append("commit"))
        result = await transfers.create_transfer(transfer, session, test_user)

    assert result.expense_fact_id != result.income_fact_id
    assert calls == ["commit", "invalidate", "broadcast"]
