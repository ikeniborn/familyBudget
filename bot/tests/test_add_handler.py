"""
E2E tests for /add command (transaction creation).

Tests the complete conversation flow for adding transactions.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from bot.handlers.add import (
    add_command,
    article_selected,
    amount_entered,
    date_entered,
    description_entered,
    confirmation_handler,
    SELECT_ARTICLE,
    ENTER_AMOUNT,
    ENTER_DATE,
    ENTER_DESCRIPTION,
    SELECT_FINANCIAL_CENTER,
)


@pytest.mark.asyncio
async def test_add_command_shows_article_keyboard(mock_update, mock_context, mock_api_client):
    """Test that /add command shows article selection keyboard."""
    mock_context.user_data = {}

    with patch('bot.handlers.add.get_api_client', return_value=mock_api_client):
        with patch('bot.handlers.add.SessionManager.is_authenticated', return_value=True):
            with patch('bot.handlers.add.SessionManager.get_token', return_value="test_token"):
                result = await add_command(mock_update, mock_context)

                # Verify we're at SELECT_ARTICLE state
                assert result == SELECT_ARTICLE

                # Verify articles were fetched
                mock_api_client.get_articles.assert_called_once()

                # Verify keyboard was shown
                mock_update.message.reply_text.assert_called()
                call_args = mock_update.message.reply_text.call_args
                assert 'reply_markup' in call_args[1]  # Keyboard present


@pytest.mark.asyncio
async def test_add_command_unauthenticated(mock_update, mock_context):
    """Test /add command when user is not authenticated."""
    with patch('bot.handlers.add.SessionManager.is_authenticated', return_value=False):
        result = await add_command(mock_update, mock_context)

        # Verify user was redirected to /start
        mock_update.message.reply_text.assert_called()
        call_args = mock_update.message.reply_text.call_args[0][0]
        assert "/start" in call_args


@pytest.mark.asyncio
async def test_article_selection_stores_data(mock_update, mock_context):
    """Test that article selection stores data in context."""
    # Mock callback query
    mock_update.callback_query = MagicMock()
    mock_update.callback_query.data = "art:1:expense:Groceries"
    mock_update.callback_query.answer = AsyncMock()
    mock_update.callback_query.message = MagicMock()
    mock_update.callback_query.message.reply_text = AsyncMock()

    mock_context.user_data = {}

    result = await article_selected(mock_update, mock_context)

    # Verify we moved to ENTER_AMOUNT state
    assert result == ENTER_AMOUNT

    # Verify article data was stored
    assert mock_context.user_data.get('article_id') == 1
    assert mock_context.user_data.get('article_type') == 'expense'
    assert mock_context.user_data.get('article_name') == 'Groceries'


@pytest.mark.asyncio
async def test_amount_validation_valid(mock_update, mock_context):
    """Test amount validation with valid input."""
    mock_update.message.text = "150.50"
    mock_context.user_data = {'article_type': 'expense'}

    result = await amount_entered(mock_update, mock_context)

    # Verify we moved to ENTER_DATE state
    assert result == ENTER_DATE

    # Verify amount was stored
    assert mock_context.user_data.get('amount') == "150.50"


@pytest.mark.asyncio
async def test_amount_validation_invalid(mock_update, mock_context):
    """Test amount validation with invalid input."""
    mock_update.message.text = "invalid_amount"
    mock_context.user_data = {}

    result = await amount_entered(mock_update, mock_context)

    # Verify we stayed at ENTER_AMOUNT state
    assert result == ENTER_AMOUNT

    # Verify error message was sent
    mock_update.message.reply_text.assert_called()
    call_args = mock_update.message.reply_text.call_args[0][0]
    assert "ошибка" in call_args.lower() or "error" in call_args.lower()


@pytest.mark.asyncio
async def test_complete_transaction_flow(mock_update, mock_context, mock_api_client):
    """Test complete transaction creation flow."""
    # Setup context with all required data
    mock_context.user_data = {
        'article_id': 1,
        'article_type': 'expense',
        'article_name': 'Groceries',
        'amount': '150.50',
        'date': '2025-10-15',
        'description': 'Weekly shopping',
        'financial_center_id': None,
        'cost_center_id': None,
    }

    # Mock callback query for confirmation
    mock_update.callback_query = MagicMock()
    mock_update.callback_query.data = "confirm_yes"
    mock_update.callback_query.answer = AsyncMock()
    mock_update.callback_query.message = MagicMock()
    mock_update.callback_query.message.reply_text = AsyncMock()

    with patch('bot.handlers.add.get_api_client', return_value=mock_api_client):
        with patch('bot.handlers.add.SessionManager.get_token', return_value="test_token"):
            result = await confirmation_handler(mock_update, mock_context)

            # Verify fact was created via API
            mock_api_client.create_fact.assert_called_once()
            call_args = mock_api_client.create_fact.call_args[1]
            assert call_args['article_id'] == 1
            assert call_args['amount'] == '150.50'
            assert call_args['description'] == 'Weekly shopping'

            # Verify success message was sent
            mock_update.callback_query.message.reply_text.assert_called()
            call_args = mock_update.callback_query.message.reply_text.call_args[0][0]
            assert "успешно" in call_args.lower() or "success" in call_args.lower()
