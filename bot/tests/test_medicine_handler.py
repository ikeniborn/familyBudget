"""Regression tests for medicine bot handlers.

Guards against the double-prefix bug: the api_client base_url already ends in
`/api/v1`, so handler paths must be relative (`/medicine-intakes/...`). Passing
`/api/v1/medicine-intakes/...` produced `/api/v1/api/v1/...` → 404.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from bot.handlers.medicine import medicine_callback, taken_handler


def _callback_update(data: str):
    update = MagicMock()
    query = MagicMock()
    query.data = data
    query.answer = AsyncMock()
    query.edit_message_text = AsyncMock()
    update.callback_query = query
    return update, query


@pytest.mark.asyncio
async def test_medicine_callback_take_uses_relative_path(mock_context):
    """med:take must call the backend with a base-relative path (no /api/v1 prefix)."""
    update, query = _callback_update("med:take:5")
    api = MagicMock()
    api.get = AsyncMock(return_value={"version": 1})
    api.post = AsyncMock(return_value={})

    with patch("bot.handlers.medicine.get_api_client", AsyncMock(return_value=api)), \
         patch("bot.handlers.medicine.SessionManager.is_authenticated", return_value=True), \
         patch("bot.handlers.medicine.SessionManager.get_access_token", return_value="tok"):
        await medicine_callback(update, mock_context)

    get_path = api.get.call_args[0][0]
    post_path = api.post.call_args[0][0]
    assert get_path == "/medicine-intakes/5"
    assert post_path == "/medicine-intakes/5/take"
    # The base_url already contains /api/v1 — handler paths must NOT repeat it.
    assert not get_path.startswith("/api/v1")
    assert not post_path.startswith("/api/v1")
    query.edit_message_text.assert_awaited_with("Принято")


@pytest.mark.asyncio
async def test_medicine_callback_snooze_uses_relative_path(mock_context):
    """med:snooze must also use a base-relative path."""
    update, _ = _callback_update("med:snooze:7")
    api = MagicMock()
    api.post = AsyncMock(return_value={})

    with patch("bot.handlers.medicine.get_api_client", AsyncMock(return_value=api)), \
         patch("bot.handlers.medicine.SessionManager.is_authenticated", return_value=True), \
         patch("bot.handlers.medicine.SessionManager.get_access_token", return_value="tok"):
        await medicine_callback(update, mock_context)

    post_path = api.post.call_args[0][0]
    assert post_path == "/medicine-intakes/7/snooze"
    assert not post_path.startswith("/api/v1")


@pytest.mark.asyncio
async def test_taken_handler_uses_relative_paths(mock_update, mock_context):
    """/taken lists intakes and marks one taken via base-relative paths."""
    api = MagicMock()
    api.get = AsyncMock(return_value={
        "intakes": [{"id": 3, "version": 1, "status": "scheduled",
                     "scheduled_at": "2026-06-18T08:00:00", "medicine_name": "X"}]
    })
    api.post = AsyncMock(return_value={})

    with patch("bot.handlers.medicine.get_api_client", AsyncMock(return_value=api)), \
         patch("bot.handlers.medicine.SessionManager.is_authenticated", return_value=True), \
         patch("bot.handlers.medicine.SessionManager.get_access_token", return_value="tok"):
        await taken_handler(mock_update, mock_context)

    assert api.get.call_args[0][0] == "/medicine-intakes"
    assert api.post.call_args[0][0] == "/medicine-intakes/3/take"
    for call in [api.get.call_args, api.post.call_args]:
        assert not call[0][0].startswith("/api/v1")
