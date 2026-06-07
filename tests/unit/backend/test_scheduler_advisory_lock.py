"""Unit tests for scheduler advisory_xact_lock context manager.

Verifies the context manager executes pg_try_advisory_xact_lock on a dedicated
lock-holder session, yields the boolean result, and always rolls back on exit
(releasing the transaction-scoped lock). Does not exercise a real PostgreSQL lock.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_mock_session(scalar_value: bool):
    """Build an AsyncSession-like mock whose execute().scalar() == scalar_value.

    Returns (mock_context_manager, mock_session). The context manager is what
    async_session_maker() returns; entering it yields mock_session.
    """
    mock_result = MagicMock()
    mock_result.scalar.return_value = scalar_value

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_session.rollback = AsyncMock()

    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm, mock_session


@pytest.mark.asyncio
async def test_advisory_xact_lock_acquired():
    from backend.app.scheduler import LOCK_ID_BALANCE_AGGREGATES, advisory_xact_lock

    mock_cm, mock_session = _make_mock_session(scalar_value=True)

    with patch("backend.app.scheduler.async_session_maker", return_value=mock_cm):
        async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
            assert acquired is True

    # Executed the transaction-scoped lock SQL with the right id
    call = mock_session.execute.await_args
    assert "pg_try_advisory_xact_lock" in str(call.args[0])
    assert call.args[1] == {"lock_id": LOCK_ID_BALANCE_AGGREGATES}

    # Always rolls back on exit -> releases the xact lock
    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_advisory_xact_lock_not_acquired():
    from backend.app.scheduler import LOCK_ID_BALANCE_AGGREGATES, advisory_xact_lock

    mock_cm, mock_session = _make_mock_session(scalar_value=False)

    with patch("backend.app.scheduler.async_session_maker", return_value=mock_cm):
        async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES) as acquired:
            assert acquired is False

    # Rollback still runs on the not-acquired path
    mock_session.rollback.assert_awaited_once()


@pytest.mark.asyncio
async def test_advisory_xact_lock_rollback_on_body_exception():
    from backend.app.scheduler import LOCK_ID_BALANCE_AGGREGATES, advisory_xact_lock

    mock_cm, mock_session = _make_mock_session(scalar_value=True)

    with patch("backend.app.scheduler.async_session_maker", return_value=mock_cm):
        with pytest.raises(RuntimeError):
            async with advisory_xact_lock(LOCK_ID_BALANCE_AGGREGATES):
                raise RuntimeError("job body failed")

    # finally still releases the xact lock when the body raises
    mock_session.rollback.assert_awaited_once()
