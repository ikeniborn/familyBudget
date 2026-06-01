# Bot Testing Reference

## Test Location

```
bot/tests/
├── conftest.py                       ← fixtures: mock_update, mock_context, mock_api_client
├── test_start_handler.py
├── test_add_handler.py
├── test_summary_handler.py
└── test_telegram_bot_journey.py      ← end-to-end conversation flows
```

Run from project root:
```bash
cd tests && ./run-tests.sh backend
# or specifically:
python -m pytest bot/tests/ -v
```

---

## Core Fixtures (conftest.py)

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram import Update, User, Message, Chat, CallbackQuery
from telegram.ext import ContextTypes


@pytest.fixture
def mock_user():
    user = MagicMock(spec=User)
    user.id = 123456789
    user.first_name = "Test"
    user.last_name = "User"
    user.username = "testuser"
    return user


@pytest.fixture
def mock_update(mock_user):
    update = MagicMock(spec=Update)
    update.effective_user = mock_user
    update.message = MagicMock(spec=Message)
    update.message.reply_text = AsyncMock()
    update.message.text = ""
    update.callback_query = None
    return update


@pytest.fixture
def mock_context():
    context = MagicMock()
    context.user_data = {}
    context.bot = AsyncMock()
    return context


@pytest.fixture
def authenticated_context(mock_context):
    mock_context.user_data["authenticated"] = True
    mock_context.user_data["access_token"] = "test_jwt_token"
    mock_context.user_data["user_info"] = {"id": 1, "first_name": "Test"}
    return mock_context
```

---

## Testing Simple Command Handlers

```python
import pytest
from unittest.mock import AsyncMock, patch
from handlers.today import today_handler


@pytest.mark.asyncio
async def test_today_handler_authenticated(mock_update, authenticated_context):
    summary = {"total_income": 5000, "total_expense": 3000, "balance": 2000,
                "count_income": 2, "count_expense": 3}
    facts = [{"id": 1, "amount": 5000, "article_name": "Зарплата", "fact_date": "2025-06-01"}]
    articles = [{"id": 1, "name": "Зарплата", "article_type": "income"}]

    with patch("handlers.today.api_client") as mock_client:
        mock_client.get_facts_summary = AsyncMock(return_value=summary)
        mock_client.list_facts = AsyncMock(return_value=facts)
        mock_client.list_articles = AsyncMock(return_value=articles)

        await today_handler(mock_update, authenticated_context)

    mock_update.message.reply_text.assert_called_once()
    call_args = mock_update.message.reply_text.call_args[0][0]
    assert "5 000" in call_args or "5000" in call_args


@pytest.mark.asyncio
async def test_today_handler_unauthenticated(mock_update, mock_context):
    await today_handler(mock_update, mock_context)
    mock_update.message.reply_text.assert_called_once()
    assert "/start" in mock_update.message.reply_text.call_args[0][0]
```

---

## Testing ConversationHandler Steps

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from telegram.ext import ConversationHandler
from handlers.add_plan import (
    addplan_command, amount_entered, confirmation_handler,
    SELECT_ARTICLE, ENTER_AMOUNT, CONFIRM,
    KEY_AMOUNT, KEY_ARTICLE_ID,
)


@pytest.mark.asyncio
async def test_addplan_entry(mock_update, authenticated_context):
    articles = [{"id": 1, "name": "Зарплата", "article_type": "income"}]

    with patch("handlers.add_plan.api_client") as mock_client:
        mock_client.list_articles = AsyncMock(return_value=articles)
        result = await addplan_command(mock_update, authenticated_context)

    assert result == SELECT_ARTICLE
    mock_update.message.reply_text.assert_called_once()


@pytest.mark.asyncio
async def test_amount_entered_valid(mock_update, authenticated_context):
    authenticated_context.user_data[KEY_ARTICLE_ID] = 1
    mock_update.message.text = "1500"

    result = await amount_entered(mock_update, authenticated_context)

    assert result == CONFIRM
    assert authenticated_context.user_data[KEY_AMOUNT] == 1500


@pytest.mark.asyncio
async def test_amount_entered_invalid(mock_update, authenticated_context):
    mock_update.message.text = "не число"

    result = await amount_entered(mock_update, authenticated_context)

    assert result == ENTER_AMOUNT  # stay in same state
    assert "❌" in mock_update.message.reply_text.call_args[0][0]
```

---

## Testing CallbackQuery handlers

```python
@pytest.fixture
def mock_callback_update(mock_user):
    update = MagicMock(spec=Update)
    update.effective_user = mock_user
    update.callback_query = MagicMock()
    update.callback_query.answer = AsyncMock()
    update.callback_query.edit_message_text = AsyncMock()
    update.callback_query.data = "confirm_yes"
    return update


@pytest.mark.asyncio
async def test_confirm_saves(mock_callback_update, authenticated_context):
    authenticated_context.user_data[KEY_AMOUNT] = 1000
    authenticated_context.user_data[KEY_ARTICLE_ID] = 1

    with patch("handlers.add_plan.api_client") as mock_client:
        mock_client.create_fact = AsyncMock(return_value={"id": 42})
        result = await confirmation_handler(mock_callback_update, authenticated_context)

    assert result == ConversationHandler.END
    mock_callback_update.callback_query.edit_message_text.assert_called_once()
    assert "✅" in mock_callback_update.callback_query.edit_message_text.call_args[0][0]
```

---

## Testing API Client

```python
import pytest
import httpx
from unittest.mock import patch, AsyncMock, MagicMock
from utils.api_client import APIClient


@pytest.mark.asyncio
async def test_create_fact_success():
    client = APIClient()
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"id": 99, "amount": 500}
    mock_response.raise_for_status = MagicMock()

    with patch.object(client.client, "post", AsyncMock(return_value=mock_response)):
        result = await client.create_fact(
            token="test_token",
            article_id=1,
            fact_date="2025-06-01",
            amount=500,
        )

    assert result["id"] == 99


@pytest.mark.asyncio
async def test_api_raises_on_4xx():
    client = APIClient()
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Forbidden", request=MagicMock(), response=mock_response
    )

    with patch.object(client.client, "get", AsyncMock(return_value=mock_response)):
        with pytest.raises(httpx.HTTPStatusError):
            await client.list_facts(token="bad_token")
```
