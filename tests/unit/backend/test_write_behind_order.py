"""Unit test verifying broadcast happens after session.commit() in write-behind."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_broadcast_called_after_commit():
    """
    _process_item() must call session.commit() before _broadcast_event().
    Order matters: client fetches row-html after receiving WS event.
    """
    call_order = []

    mock_session = AsyncMock()

    async def fake_commit():
        call_order.append("commit")

    async def fake_flush():
        pass

    mock_session.commit = fake_commit
    mock_session.flush = fake_flush
    mock_session.add = MagicMock()
    mock_session.delete = AsyncMock()

    async def fake_session_gen():
        yield mock_session

    from backend.app.services.write_behind_service import WriteBehindService, WriteQueueItem, WriteOperation

    service = WriteBehindService()

    async def fake_broadcast(item):
        call_order.append("broadcast")

    async def fake_process_fact(session, item):
        pass

    async def fake_invalidate():
        pass

    service._broadcast_event = fake_broadcast
    service._process_fact = fake_process_fact

    item = WriteQueueItem(
        operation=WriteOperation.CREATE,
        entity_type="fact",
        data={"pre_generated_id": 1, "article_id": 1, "amount": 100, "fact_date": "2026-05-31"},
        user_id=1,
    )

    with patch("backend.app.db.session.get_session", side_effect=lambda: fake_session_gen()), \
         patch("backend.app.services.cache_service.cache_service") as mock_cache:
        mock_cache.invalidate_dashboard = fake_invalidate
        await service._process_item(item)

    assert call_order == ["commit", "broadcast"], (
        f"Expected commit before broadcast, got: {call_order}"
    )
