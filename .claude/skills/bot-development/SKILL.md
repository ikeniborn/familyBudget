---
name: Telegram Bot Development
description: Автоматизация создания Telegram bot команд и handlers
version: 1.0.0
author: Family Budget Team
tags: [telegram, bot, python-telegram-bot, conversationhandler]
dependencies: [api-development]
---

# Telegram Bot Development Skill

Автоматизация создания новых команд и conversation handlers для Telegram бота проекта Family Budget.

## Когда использовать этот скил

Используй этот скил когда нужно:
- Создать новую команду для Telegram бота
- Добавить ConversationHandler с multi-step flow
- Интегрировать команду с backend API
- Создать inline keyboards
- Добавить валидацию пользовательского ввода

Скил автоматически вызывается при запросах типа:
- "Создай новую команду /command для бота"
- "Добавь multi-step conversation для X"
- "Создай inline keyboard для выбора Y"

## Контекст проекта

Проект использует:
- **python-telegram-bot 20.x** для Telegram бота
- **ConversationHandler** для multi-step команд
- **InlineKeyboardMarkup** для inline keyboards
- **API Client** (`bot/utils/api_client.py`) для взаимодействия с backend
- **SessionManager** для управления JWT токенами
- **Validators** (`bot/utils/validators.py`) для валидации ввода

## Структура bot handlers

```
bot/
├── main.py                  # Entry point, graceful shutdown
├── bot.py                   # BotApplication class, handler registration
├── handlers/                # Command handlers
│   ├── start.py             # /start - OAuth authentication
│   ├── add.py               # /add - Add transaction (ConversationHandler)
│   ├── add_plan.py          # /addplan - Add budget plan
│   ├── edit.py              # /edit - Edit/delete transactions
│   ├── summary.py           # /summary - Plan vs Fact comparison
│   ├── today.py             # /today - Today's statistics
│   ├── stats.py             # /stats - All-time statistics
│   ├── settings.py          # /settings - User settings
│   ├── help.py              # /help - Help message
│   └── export.py            # /export - Export data
├── utils/                   # Utilities
│   ├── api_client.py        # HTTP client for backend API
│   ├── session.py           # SessionManager (JWT tokens)
│   ├── telegram_auth.py     # Telegram OAuth validation
│   ├── validators.py        # Input validation
│   ├── logger.py            # Logging setup
│   ├── scheduler.py         # APScheduler for jobs
│   └── notification_service.py  # Budget threshold notifications
├── jobs/                    # Background jobs
│   └── weekly_report.py     # Weekly budget reports
└── config/
    └── settings.py          # Pydantic Settings
```

## Шаблон простой команды

Для простых команд без conversation (например, `/help`, `/today`):

```python
"""
/{command_name} command handler.

Description: {What this command does}
"""

from telegram import Update
from telegram.ext import ContextTypes

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager

logger = get_logger(__name__)


async def {command_name}_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle /{command_name} command.

    Args:
        update: Telegram update
        context: Bot context

    Returns:
        None
    """
    user = update.effective_user

    if not user:
        logger.warning("/{command_name} called without user context")
        return

    logger.info(f"/{command_name} command from user {user.id} (@{user.username})")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\\n\\n"
            "Используйте /start для входа в систему."
        )
        logger.warning(f"Unauthenticated /{command_name} attempt from user {user.id}")
        return

    try:
        # Fetch data from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        data = await api_client.get("/endpoint", token=token)

        # Format response
        message = format_response(data)

        # Send response
        await update.message.reply_text(
            message,
            parse_mode="Markdown"
        )

        logger.info(f"/{command_name} completed for user {user.id}")

    except Exception as e:
        logger.error(f"Error in /{command_name}: {e}", exc_info=True)
        await update.message.reply_text(
            "❌ Произошла ошибка при выполнении команды.\\n\\n"
            "Попробуйте позже."
        )


def format_response(data: dict) -> str:
    """Format API response into user-friendly message."""
    # Implementation
    return "Formatted message"


# Registration in bot.py:
# self.application.add_handler(CommandHandler("{command_name}", {command_name}_command))
```

## Шаблон ConversationHandler

Для multi-step команд (например, `/add`, `/edit`):

```python
"""
/{command_name} command handler with ConversationHandler.

Multi-step conversation:
1. State 1: {Description}
2. State 2: {Description}
3. State 3: {Description}
4. Confirm: {Description}
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from bot.utils.api_client import get_api_client
from bot.utils.logger import get_logger
from bot.utils.session import SessionManager
from bot.utils.validators import validate_amount, format_amount, ValidationError

logger = get_logger(__name__)

# Conversation states
STATE_1, STATE_2, STATE_3, CONFIRM = range(4)

# Context keys
KEY_DATA_1 = "data_1"
KEY_DATA_2 = "data_2"
KEY_DATA_3 = "data_3"


async def command_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Start /{command_name} conversation.

    Workflow:
    1. Check authentication
    2. Fetch initial data from backend
    3. Display options (inline keyboard)
    4. Enter STATE_1

    Returns:
        int: Next conversation state (STATE_1 or END)
    """
    user = update.effective_user

    if not user:
        logger.warning("/{command_name} called without user context")
        return ConversationHandler.END

    logger.info(f"/{command_name} command from user {user.id}")

    # Check authentication
    if not SessionManager.is_authenticated(context):
        await update.message.reply_text(
            "❌ Требуется авторизация.\\n\\n"
            "Используйте /start для входа в систему."
        )
        return ConversationHandler.END

    try:
        # Fetch data from backend
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()
        data = await api_client.get("/endpoint", token=token)

        if not data:
            await update.message.reply_text(
                "❌ Нет данных для отображения.\\n\\n"
                "Обратитесь к администратору."
            )
            return ConversationHandler.END

        # Build inline keyboard
        keyboard = build_keyboard(data)

        # Clear previous conversation data
        context.user_data.pop(KEY_DATA_1, None)
        context.user_data.pop(KEY_DATA_2, None)
        context.user_data.pop(KEY_DATA_3, None)

        # Show options
        await update.message.reply_text(
            "📋 **{Command Name}**\\n\\n"
            "Шаг 1/3: Выберите опцию:",
            reply_markup=keyboard,
            parse_mode="Markdown"
        )

        return STATE_1

    except Exception as e:
        logger.error(f"Error in /{command_name}: {e}", exc_info=True)
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте позже.")
        return ConversationHandler.END


async def handle_state_1(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle STATE_1: {Description}

    Expects: Callback query with data format "prefix_{id}"

    Returns:
        int: Next conversation state (STATE_2 or END)
    """
    query = update.callback_query
    await query.answer()

    try:
        # Parse callback data
        data_id = int(query.data.split("_")[1])

        # Save to context
        context.user_data[KEY_DATA_1] = data_id

        # Ask for next input
        await query.edit_message_text(
            "📋 **{Command Name}**\\n\\n"
            "Шаг 2/3: Введите {что нужно ввести}:",
            parse_mode="Markdown"
        )

        return STATE_2

    except (ValueError, IndexError) as e:
        logger.error(f"Invalid callback data: {query.data}, error: {e}")
        await query.edit_message_text("❌ Ошибка обработки. Попробуйте /cancel")
        return ConversationHandler.END


async def handle_state_2(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle STATE_2: {Description}

    Expects: Text message with user input

    Returns:
        int: Next conversation state (STATE_3 or SAME)
    """
    user_input = update.message.text

    try:
        # Validate input
        validated_data = validate_amount(user_input)  # or other validator

        # Save to context
        context.user_data[KEY_DATA_2] = validated_data

        # Ask for next input or show confirmation
        await update.message.reply_text(
            "📋 **{Command Name}**\\n\\n"
            "Шаг 3/3: Подтвердите данные:\\n\\n"
            f"Data 1: {context.user_data[KEY_DATA_1]}\\n"
            f"Data 2: {validated_data}\\n\\n"
            "Всё верно?",
            reply_markup=InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("✅ Подтвердить", callback_data="confirm"),
                    InlineKeyboardButton("❌ Отменить", callback_data="cancel")
                ]
            ]),
            parse_mode="Markdown"
        )

        return CONFIRM

    except ValidationError as e:
        await update.message.reply_text(
            f"❌ Ошибка валидации: {e}\\n\\n"
            "Попробуйте ещё раз."
        )
        return STATE_2  # Retry same state


async def handle_confirm(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """
    Handle CONFIRM: Create entity via API

    Returns:
        int: ConversationHandler.END
    """
    query = update.callback_query
    await query.answer()

    if query.data == "cancel":
        await query.edit_message_text(
            "❌ Отменено.\\n\\n"
            "Используйте /{command_name} для повтора."
        )
        return ConversationHandler.END

    try:
        # Get data from context
        data_1 = context.user_data[KEY_DATA_1]
        data_2 = context.user_data[KEY_DATA_2]

        # Create via API
        token = SessionManager.get_access_token(context)
        api_client = await get_api_client()

        payload = {
            "field_1": data_1,
            "field_2": data_2,
        }

        response = await api_client.post("/endpoint", data=payload, token=token)

        # Success
        await query.edit_message_text(
            "✅ Успешно создано!\\n\\n"
            f"ID: {response['id']}",
            parse_mode="Markdown"
        )

        logger.info(f"/{command_name} completed for user {update.effective_user.id}")
        return ConversationHandler.END

    except Exception as e:
        logger.error(f"Error creating entity: {e}", exc_info=True)
        await query.edit_message_text(
            "❌ Ошибка при создании.\\n\\n"
            "Попробуйте позже."
        )
        return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Cancel conversation."""
    await update.message.reply_text(
        "❌ Отменено.\\n\\n"
        "Используйте /{command_name} для повтора."
    )
    return ConversationHandler.END


def build_keyboard(data: list[dict]) -> InlineKeyboardMarkup:
    """Build inline keyboard from data."""
    buttons = [
        [InlineKeyboardButton(item["name"], callback_data=f"prefix_{item['id']}")]
        for item in data
    ]
    return InlineKeyboardMarkup(buttons)


# Registration in bot.py:
# conversation_handler = ConversationHandler(
#     entry_points=[CommandHandler("{command_name}", command_start)],
#     states={
#         STATE_1: [CallbackQueryHandler(handle_state_1)],
#         STATE_2: [MessageHandler(filters.TEXT & ~filters.COMMAND, handle_state_2)],
#         CONFIRM: [CallbackQueryHandler(handle_confirm)],
#     },
#     fallbacks=[CommandHandler("cancel", cancel)],
# )
# self.application.add_handler(conversation_handler)
```

## Регистрация handlers в bot.py

```python
from bot.handlers.{command_name} import {command_name}_command
# или для ConversationHandler:
from bot.handlers.{command_name} import conversation_handler as {command_name}_handler

class BotApplication:
    def __init__(self):
        # ...
        self._register_handlers()

    def _register_handlers(self):
        """Register all command handlers."""
        # Simple command
        self.application.add_handler(CommandHandler("{command_name}", {command_name}_command))

        # ConversationHandler
        self.application.add_handler({command_name}_handler)
```

## Проверочный чеклист

После создания handler проверь:

- [ ] Handler файл создан в `bot/handlers/{command_name}.py`
- [ ] Добавлена проверка аутентификации (SessionManager)
- [ ] Используется API client для взаимодействия с backend
- [ ] Добавлено логирование (logger)
- [ ] Валидация пользовательского ввода (validators)
- [ ] Обработка ошибок (try/except)
- [ ] Handler зарегистрирован в `bot/bot.py`
- [ ] Для ConversationHandler добавлен fallback (/cancel)
- [ ] Протестирована команда в Telegram

## Связанные скилы

- **api-development**: для создания backend endpoints
- **testing**: для создания тестов bot handlers

## Примеры использования

### Пример 1: Простая команда

```
Создай команду /balance для показа баланса по всем счетам.
Получай данные из GET /api/v1/financial-centers/balance.
Форматируй ответ с эмодзи 💰.
```

### Пример 2: Multi-step команда

```
Создай команду /transfer для перевода между счетами.
Шаги:
1. Выбрать счет источник (inline keyboard)
2. Выбрать счет назначения
3. Ввести сумму (валидация: положительное число)
4. Подтвердить
API: POST /api/v1/transfers
```

## Часто задаваемые вопросы

**Q: Как передавать данные между состояниями ConversationHandler?**

A: Используй `context.user_data` dictionary:
```python
context.user_data["key"] = value
later_value = context.user_data.get("key")
```

**Q: Как обработать timeout в conversation?**

A: Добавь `conversation_timeout` в ConversationHandler:
```python
ConversationHandler(
    conversation_timeout=300,  # 5 minutes
    ...
)
```

**Q: Как создать динамическую inline keyboard?**

A: Используй list comprehension:
```python
keyboard = [
    [InlineKeyboardButton(item["name"], callback_data=f"id_{item['id']}")]
    for item in items
]
return InlineKeyboardMarkup(keyboard)
```
