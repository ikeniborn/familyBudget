"""
Pytest configuration and fixtures for bot tests.
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from telegram import Update, User, Chat, Message
from telegram.ext import ContextTypes


@pytest.fixture
def mock_update():
    """Create a mock Telegram Update object."""
    update = MagicMock(spec=Update)
    update.effective_user = MagicMock(spec=User)
    update.effective_user.id = 123456789
    update.effective_user.first_name = "Test"
    update.effective_user.username = "testuser"
    update.effective_chat = MagicMock(spec=Chat)
    update.effective_chat.id = 123456789
    update.message = MagicMock(spec=Message)
    update.message.reply_text = AsyncMock()
    update.callback_query = None
    return update


@pytest.fixture
def mock_context():
    """Create a mock Context object."""
    context = MagicMock(spec=ContextTypes.DEFAULT_TYPE)
    context.user_data = {}
    context.bot_data = {}
    context.chat_data = {}
    context.bot = MagicMock()
    context.bot.send_message = AsyncMock()
    return context


@pytest.fixture
def mock_api_client(monkeypatch):
    """Mock API client for testing."""
    mock_client = MagicMock()

    # Mock authentication
    mock_client.authenticate_telegram_user = AsyncMock(return_value={
        "access_token": "test_token_123",
        "user": {
            "id": 1,
            "telegram_id": 123456789,
            "first_name": "Test",
            "username": "testuser"
        }
    })

    # Mock article fetching
    mock_client.get_articles = AsyncMock(return_value={
        "articles": [
            {"id": 1, "name": "Groceries", "type": "expense", "is_current": True},
            {"id": 2, "name": "Salary", "type": "income", "is_current": True},
            {"id": 3, "name": "Transport", "type": "expense", "is_current": True},
        ]
    })

    # Mock fact creation
    mock_client.create_fact = AsyncMock(return_value={
        "id": 1,
        "user_id": 1,
        "article_id": 1,
        "fact_date": "2025-10-15",
        "amount": "150.50",
        "description": "Test transaction",
        "record_type": "fact",
        "financial_center_id": None,
        "cost_center_id": None
    })

    # Mock fact fetching
    mock_client.get_user_facts = AsyncMock(return_value={
        "facts": [
            {
                "id": 1,
                "article_id": 1,
                "fact_date": "2025-10-15",
                "amount": "150.50",
                "description": "Test transaction",
                "record_type": "fact"
            }
        ],
        "total": 1
    })

    # Mock summary fetching
    mock_client.get_facts_summary = AsyncMock(return_value={
        "total_income": "5000.00",
        "total_expense": "3500.00",
        "balance": "1500.00",
        "count_income": 5,
        "count_expense": 42
    })

    # Mock financial centers
    mock_client.get_financial_centers = AsyncMock(return_value={
        "financial_centers": [
            {"id": 1, "name": "Cash", "code": "CASH"},
            {"id": 2, "name": "Bank Account", "code": "BANK"},
        ]
    })

    # Mock cost centers
    mock_client.get_cost_centers = AsyncMock(return_value={
        "cost_centers": [
            {"id": 1, "name": "Personal", "code": "PERS"},
            {"id": 2, "name": "Family", "code": "FAM"},
        ]
    })

    return mock_client


@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    """Setup test environment variables."""
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456:ABC-DEF-test-token")
    monkeypatch.setenv("BACKEND_API_URL", "http://localhost:8000/api/v1")
    monkeypatch.setenv("LOG_LEVEL", "ERROR")  # Reduce logging during tests
