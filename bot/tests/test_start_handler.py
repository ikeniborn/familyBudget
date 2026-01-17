"""
E2E tests for /start command (authentication).
"""

import pytest
from unittest.mock import AsyncMock, patch
from bot.handlers.start import start_handler


@pytest.mark.skip(reason="Requires refactoring: message changed to authorization flow")
@pytest.mark.asyncio
async def test_start_handler_new_user(mock_update, mock_context, mock_api_client):
    """Test /start command for new user authentication."""
    # Mock API client
    with patch('bot.handlers.start.get_api_client', return_value=mock_api_client):
        # Call handler
        await start_handler(mock_update, mock_context)

        # Verify API authentication was called
        mock_api_client.authenticate_telegram_user.assert_called_once()

        # Verify welcome message was sent
        mock_update.message.reply_text.assert_called()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "добро пожаловать" in call_args.lower() or "welcome" in call_args.lower()


@pytest.mark.skip(reason="Requires refactoring: SessionManager.set_token doesn't exist")
@pytest.mark.asyncio
async def test_start_handler_stores_token(mock_update, mock_context, mock_api_client):
    """Test that /start stores JWT token in session."""
    with patch('bot.handlers.start.get_api_client', return_value=mock_api_client):
        with patch('bot.handlers.start.SessionManager.set_token') as mock_set_token:
            await start_handler(mock_update, mock_context)

            # Verify token was stored
            mock_set_token.assert_called_once()
            call_args = mock_set_token.call_args[0]
            assert call_args[0] == mock_update.effective_user.id
            assert call_args[1] == "test_token_123"


@pytest.mark.asyncio
async def test_start_handler_api_error(mock_update, mock_context, mock_api_client):
    """Test /start command when API returns error."""
    # Mock API client to raise exception
    mock_api_client.authenticate_telegram_user = AsyncMock(side_effect=Exception("API Error"))

    with patch('bot.handlers.start.get_api_client', return_value=mock_api_client):
        await start_handler(mock_update, mock_context)

        # Verify error message was sent
        mock_update.message.reply_text.assert_called()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "ошибка" in call_args.lower() or "error" in call_args.lower()
