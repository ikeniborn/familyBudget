"""
E2E tests for /summary command (plan vs fact comparison).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from bot.handlers.summary import summary_command


@pytest.mark.asyncio
async def test_summary_command_authenticated(mock_update, mock_context, mock_api_client):
    """Test /summary command for authenticated user."""
    with patch('bot.handlers.summary.get_api_client', return_value=mock_api_client):
        with patch('bot.handlers.summary.SessionManager.is_authenticated', return_value=True):
            with patch('bot.handlers.summary.SessionManager.get_token', return_value="test_token"):
                await summary_command(mock_update, mock_context)

                # Verify summary was fetched
                mock_api_client.get_facts_summary.assert_called()

                # Verify message with summary was sent
                mock_update.message.reply_text.assert_called()
                call_args = mock_update.message.reply_text.call_args[0][0]
                # Check for keywords that should be in summary
                assert any(keyword in call_args.lower() for keyword in ["доход", "расход", "баланс", "income", "expense"])


@pytest.mark.asyncio
async def test_summary_command_unauthenticated(mock_update, mock_context):
    """Test /summary command when user is not authenticated."""
    with patch('bot.handlers.summary.SessionManager.is_authenticated', return_value=False):
        await summary_command(mock_update, mock_context)

        # Verify user was redirected to /start
        mock_update.message.reply_text.assert_called()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "/start" in call_args


@pytest.mark.asyncio
async def test_summary_command_no_data(mock_update, mock_context, mock_api_client):
    """Test /summary command when user has no transactions."""
    # Mock API to return empty summary
    mock_api_client.get_facts_summary = AsyncMock(return_value={
        "total_income": "0.00",
        "total_expense": "0.00",
        "balance": "0.00",
        "count_income": 0,
        "count_expense": 0
    })

    with patch('bot.handlers.summary.get_api_client', return_value=mock_api_client):
        with patch('bot.handlers.summary.SessionManager.is_authenticated', return_value=True):
            with patch('bot.handlers.summary.SessionManager.get_token', return_value="test_token"):
                await summary_command(mock_update, mock_context)

                # Verify empty state message
                mock_update.message.reply_text.assert_called()
                call_args = mock_update.message.reply_text.call_args[0][0]
                # Should show zeros
                assert "0" in call_args
